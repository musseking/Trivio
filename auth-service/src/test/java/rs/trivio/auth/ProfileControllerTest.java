package rs.trivio.auth;

import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class ProfileControllerTest {
    @Mock UserAccountRepository users;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtTokens tokens;
    AuthController controller;
    UserAccount account;
    final Jwt jwt = Jwt.withTokenValue("test-token").header("alg", "HS256").subject("42").build();

    @BeforeEach
    void setUp() {
        controller = new AuthController(users, passwordEncoder, tokens);
        account = new UserAccount("Old", "Name", "old@example.com", "unchanged-hash");
        ReflectionTestUtils.setField(account, "id", 42L);
    }

    @Test
    void updatesAuthenticatedAccountAndPreservesPrivilegesAndPassword() {
        when(users.findById(42L)).thenReturn(Optional.of(account));
        when(users.findByEmail("new@example.com")).thenReturn(Optional.empty());
        when(users.saveAndFlush(account)).thenReturn(account);
        var result = controller.updateProfile(jwt,
            new AuthController.UpdateProfileRequest(" New ", " Name ", "NEW@example.com"));
        assertEquals(42L, result.id());
        assertEquals("New", result.firstName());
        assertEquals("Name", result.lastName());
        assertEquals("new@example.com", result.email());
        assertEquals(UserAccount.Role.CUSTOMER, result.role());
        assertEquals("unchanged-hash", account.getPasswordHash());
        verifyNoInteractions(passwordEncoder, tokens);
    }

    @Test
    void unchangedEmailCanBeSaved() {
        when(users.findById(42L)).thenReturn(Optional.of(account));
        when(users.findByEmail(account.getEmail())).thenReturn(Optional.of(account));
        when(users.saveAndFlush(account)).thenReturn(account);
        assertEquals("Updated", controller.updateProfile(jwt,
            new AuthController.UpdateProfileRequest("Updated", "Name", account.getEmail())).firstName());
    }

    @Test
    void rejectsEmailOwnedByAnotherAccountWithoutChangingProfile() {
        var other = new UserAccount("Other", "User", "taken@example.com", "hash");
        ReflectionTestUtils.setField(other, "id", 7L);
        when(users.findById(42L)).thenReturn(Optional.of(account));
        when(users.findByEmail("taken@example.com")).thenReturn(Optional.of(other));
        var error = assertThrows(ResponseStatusException.class, () -> controller.updateProfile(jwt,
            new AuthController.UpdateProfileRequest("New", "Name", "taken@example.com")));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals("Old", account.getFirstName());
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void disabledAccountCannotEditProfile() {
        ReflectionTestUtils.setField(account, "enabled", false);
        when(users.findById(42L)).thenReturn(Optional.of(account));
        var error = assertThrows(ResponseStatusException.class, () -> controller.updateProfile(jwt,
            new AuthController.UpdateProfileRequest("New", "Name", "new@example.com")));
        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        verify(users, never()).saveAndFlush(any());
    }

    @Test
    void rejectsBlankNamesAndInvalidEmail() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var errors = factory.getValidator().validate(new AuthController.UpdateProfileRequest(" ", "", "invalid"));
            assertEquals(3, errors.size());
        }
    }

    @Test
    void putMeIsMappedAndPersistsProfileThroughHttp() throws Exception {
        when(users.findById(42L)).thenReturn(Optional.of(account));
        when(users.findByEmail("updated@example.com")).thenReturn(Optional.empty());
        when(users.saveAndFlush(account)).thenReturn(account);
        var mvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(new AuthApiExceptionHandler())
            .setCustomArgumentResolvers(new HandlerMethodArgumentResolver() {
                public boolean supportsParameter(MethodParameter parameter) {
                    return parameter.getParameterType() == Jwt.class;
                }
                public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer container,
                                              NativeWebRequest request, WebDataBinderFactory factory) {
                    return jwt;
                }
            }).build();
        mvc.perform(put("/auth/me").contentType("application/json")
            .content("""
                {"firstName":"Updated","lastName":"User","email":"updated@example.com"}
                """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(42))
            .andExpect(jsonPath("$.firstName").value("Updated"))
            .andExpect(jsonPath("$.email").value("updated@example.com"));
        verify(users).saveAndFlush(account);
    }
}
