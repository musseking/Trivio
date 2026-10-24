package rs.trivio.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.MethodParameter;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class UserManagementControllerTest {
    @Mock UserAccountRepository users;
    @Mock PasswordEncoder passwords;
    @Mock JwtTokens tokens;
    UserAccount owner;
    UserAccount customer;
    MockMvc mvc;
    Jwt principal;

    @BeforeEach
    void setUp() {
        owner = account(1L, UserAccount.Role.OWNER);
        customer = account(2L, UserAccount.Role.CUSTOMER);
        principal = jwt(1L);
        mvc = MockMvcBuilders.standaloneSetup(new AuthController(users, passwords, tokens))
            .setControllerAdvice(new AuthApiExceptionHandler())
            .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                public boolean supportsParameter(MethodParameter parameter) {
                    return parameter.getParameterType() == Jwt.class;
                }
                public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                                              NativeWebRequest request, WebDataBinderFactory factory) {
                    return principal;
                }
            }).build();
    }

    static UserAccount account(long id, UserAccount.Role role) {
        var account = new UserAccount("Test", "User", "test" + id + "@example.invalid", "private-hash");
        ReflectionTestUtils.setField(account, "id", id);
        account.setRole(role);
        return account;
    }

    static Jwt jwt(long id) {
        // Claim intentionally stays OWNER; authorization must use the database role.
        return Jwt.withTokenValue("fixture-token").header("alg", "HS256")
            .subject(Long.toString(id)).claim("role", "OWNER").build();
    }

    @Test
    void ownerSeesActiveAndBannedUsersWithoutPasswordHashes() throws Exception {
        customer.setEnabled(false);
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        when(users.findAll()).thenReturn(List.of(owner, customer));
        mvc.perform(get("/auth/admin/users")).andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[1].enabled").value(false))
            .andExpect(jsonPath("$[0].passwordHash").doesNotExist())
            .andExpect(jsonPath("$[1].passwordHash").doesNotExist());
    }

    @Test
    void banBlocksExistingSessionAndLoginThenUnbanRestoresAccess() throws Exception {
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        when(users.findById(2L)).thenReturn(Optional.of(customer));
        when(users.saveAndFlush(customer)).thenReturn(customer);
        mvc.perform(put("/auth/admin/users/2/enabled").contentType("application/json").content("{\"enabled\":false}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(false));
        assertFalse(customer.isEnabled());
        principal = jwt(2L);
        mvc.perform(get("/auth/me")).andExpect(status().isUnauthorized());
        when(users.findByEmail(customer.getEmail())).thenReturn(Optional.of(customer));
        mvc.perform(post("/auth/login").contentType("application/json")
            .content("{\"email\":\"test2@example.invalid\",\"password\":\"fixture-password\"}"))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(passwords);
        principal = jwt(1L);
        mvc.perform(put("/auth/admin/users/2/enabled").contentType("application/json").content("{\"enabled\":true}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.enabled").value(true));
        principal = jwt(2L);
        mvc.perform(get("/auth/me")).andExpect(status().isOk());
        verify(users, times(2)).saveAndFlush(customer);
    }

    @ParameterizedTest
    @EnumSource(value = UserAccount.Role.class, names = {"CUSTOMER", "ADMIN"})
    void onlyDatabaseOwnerCanListBanOrDelete(UserAccount.Role role) throws Exception {
        owner.setRole(role);
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        mvc.perform(get("/auth/admin/users")).andExpect(status().isForbidden());
        mvc.perform(put("/auth/admin/users/2/enabled").contentType("application/json").content("{\"enabled\":false}"))
            .andExpect(status().isForbidden());
        mvc.perform(delete("/auth/admin/users/2")).andExpect(status().isForbidden());
        verify(users, never()).findAll();
        verify(users, never()).findById(2L);
        verify(users, never()).saveAndFlush(any());
        verify(users, never()).delete(any(UserAccount.class));
    }

    @Test
    void ownerAndOwnAccountAreProtected() throws Exception {
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        var otherOwner = account(3L, UserAccount.Role.OWNER);
        when(users.findById(3L)).thenReturn(Optional.of(otherOwner));
        for (long id : new long[] {1L, 3L}) {
            mvc.perform(put("/auth/admin/users/" + id + "/enabled").contentType("application/json").content("{\"enabled\":false}"))
                .andExpect(status().isForbidden());
            mvc.perform(delete("/auth/admin/users/" + id)).andExpect(status().isForbidden());
        }
        verify(users, never()).saveAndFlush(any());
        verify(users, never()).delete(any(UserAccount.class));
    }

    @Test
    void disabledOwnerCannotManageAccounts() throws Exception {
        owner.setEnabled(false);
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        mvc.perform(get("/auth/admin/users")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/auth/admin/users/2")).andExpect(status().isUnauthorized());
        verify(users, never()).findById(2L);
    }

    @Test
    void deleteRemovesOnlyRequestedAccountAndInvalidatesItsSession() throws Exception {
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        when(users.findById(2L)).thenReturn(Optional.of(customer), Optional.empty());
        mvc.perform(delete("/auth/admin/users/2")).andExpect(status().isNoContent()).andExpect(content().string(""));
        verify(users).delete(customer);
        verify(users).flush();
        principal = jwt(2L);
        mvc.perform(get("/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void missingTargetReturnsNotFound() throws Exception {
        when(users.findById(1L)).thenReturn(Optional.of(owner));
        when(users.findById(99L)).thenReturn(Optional.empty());
        mvc.perform(delete("/auth/admin/users/99")).andExpect(status().isNotFound());
        mvc.perform(put("/auth/admin/users/99/enabled").contentType("application/json").content("{\"enabled\":false}"))
            .andExpect(status().isNotFound());
    }

    @Test
    void missingEnabledValueCannotAccidentallyBanAccount() throws Exception {
        mvc.perform(put("/auth/admin/users/2/enabled").contentType("application/json").content("{}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields[0]").value("enabled"));
        mvc.perform(put("/auth/admin/users/2/enabled").contentType("application/json").content("{\"enabled\":null}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(users);
    }
}
