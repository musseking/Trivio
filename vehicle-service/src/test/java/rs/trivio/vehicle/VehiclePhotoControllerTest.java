package rs.trivio.vehicle;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

/** Standalone MVC tests do not start Spring Boot, discovery, a database or real business services. */
class VehiclePhotoControllerTest {
    private VehiclePhotoManager manager;
    private TrivioAccess access;
    private MockMvc mvc;
    private static final VehiclePhotoResponse PHOTO = new VehiclePhotoResponse(3L,
        "/api/vehicles/media/ff5e349b-965f-4d9d-9ceb-84d7565397fe.jpg",
        "/api/vehicles/media/ff5e349b-965f-4d9d-9ceb-84d7565397fe-thumb.jpg", 0, true);

    @BeforeEach void setUp() {
        manager = mock(VehiclePhotoManager.class);
        access = mock(TrivioAccess.class);
        mvc = MockMvcBuilders.standaloneSetup(new VehiclePhotoController(manager, access))
            .setControllerAdvice(new VehicleApiExceptionHandler()).build();
    }

    @Test void publicListAndMediaDoNotRequireAuthenticationAndMediaHasSafeHeaders() throws Exception {
        when(manager.list(1L)).thenReturn(List.of(PHOTO));
        when(manager.media("ff5e349b-965f-4d9d-9ceb-84d7565397fe.jpg"))
            .thenReturn(new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff});
        mvc.perform(get("/vehicles/1/photos")).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].thumbnailUrl", is(PHOTO.thumbnailUrl())));
        mvc.perform(get("/vehicles/media/ff5e349b-965f-4d9d-9ceb-84d7565397fe.jpg"))
            .andExpect(status().isOk()).andExpect(content().contentType("image/jpeg"))
            .andExpect(header().string("X-Content-Type-Options", "nosniff"))
            .andExpect(header().string("Cache-Control", "public, max-age=31536000, immutable"));
        verifyNoInteractions(access);
    }

    @Test void repeatedUploadFilesBindAndOwnerCheckPrecedesManager() throws Exception {
        when(manager.upload(eq(1L), anyList())).thenReturn(List.of(PHOTO));
        mvc.perform(multipart("/vehicles/1/photos")
                .file(new MockMultipartFile("files", "one.png", "image/png", new byte[]{1}))
                .file(new MockMultipartFile("files", "two.jpg", "image/jpeg", new byte[]{2}))
                .header("Authorization", "Bearer OWNER"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id", is(3)));
        var order = inOrder(access, manager);
        order.verify(access).owner("Bearer OWNER");
        order.verify(manager).upload(eq(1L), argThat(files -> files.size() == 2));
    }

    @Test void missingTokenCannotUpload() throws Exception {
        doThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bearer token required")).when(access).owner(null);
        mvc.perform(multipart("/vehicles/1/photos").file(new MockMultipartFile("files", new byte[]{1})))
            .andExpect(status().isUnauthorized());
        verifyNoInteractions(manager);
    }

    @Test void adminCannotUseAnyNewPhotoWriteRoute() throws Exception {
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "OWNER required")).when(access).owner("Bearer ADMIN");
        mvc.perform(multipart("/vehicles/1/photos")
                .file(new MockMultipartFile("files", new byte[]{1})).header("Authorization", "Bearer ADMIN"))
            .andExpect(status().isForbidden());
        mvc.perform(put("/vehicles/1/photos/order").contentType("application/json")
                .content("{\"photoIds\":[3],\"coverPhotoId\":3}").header("Authorization", "Bearer ADMIN"))
            .andExpect(status().isForbidden());
        mvc.perform(delete("/vehicles/1/photos/3").header("Authorization", "Bearer ADMIN"))
            .andExpect(status().isForbidden());
        mvc.perform(multipart("/vehicles/1/photos/3").file(new MockMultipartFile("file", new byte[]{1}))
                .with(request -> { request.setMethod("PUT"); return request; }).header("Authorization", "Bearer ADMIN"))
            .andExpect(status().isForbidden());
        verifyNoInteractions(manager);
    }

    @Test void ownerReorderAndReplaceUseTheirExactContracts() throws Exception {
        when(manager.reorder(eq(1L), any())).thenReturn(List.of(PHOTO));
        when(manager.replace(eq(1L), eq(3L), any())).thenReturn(List.of(PHOTO));
        mvc.perform(put("/vehicles/1/photos/order").contentType("application/json")
                .content("{\"photoIds\":[3],\"coverPhotoId\":3}").header("Authorization", "Bearer OWNER"))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].cover", is(true)));
        mvc.perform(multipart("/vehicles/1/photos/3").file(new MockMultipartFile("file", "updated.png", "image/png", new byte[]{1}))
                .with(request -> { request.setMethod("PUT"); return request; }).header("Authorization", "Bearer OWNER"))
            .andExpect(status().isOk());
        verify(manager).reorder(1L, new VehiclePhotoOrderRequest(List.of(3L), 3L));
        verify(manager).replace(eq(1L), eq(3L), argThat(file -> file.getOriginalFilename().equals("updated.png")));
    }

    @Test void missingMultipartFieldAndInvalidOrderAreSanitized() throws Exception {
        mvc.perform(multipart("/vehicles/1/photos").file(new MockMultipartFile("unexpected", "private-path.png", "image/png", new byte[]{1})))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message", not(containsString("private-path"))));
        mvc.perform(put("/vehicles/1/photos/order").contentType("application/json")
                .content("{\"photoIds\":[3,null],\"coverPhotoId\":null}").header("Authorization", "Bearer OWNER"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields", hasItem("coverPhotoId")));
        verifyNoInteractions(manager);
    }

    @Test void filesystemFailuresNeverExposePathsOrRawExceptions() throws Exception {
        when(manager.list(1L)).thenThrow(new IllegalStateException("C:\\private\\db-password-original.png"));
        mvc.perform(get("/vehicles/1/photos"))
            .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.message", not(containsString("private"))))
            .andExpect(jsonPath("$.message", not(containsString("password"))))
            .andExpect(jsonPath("$.trace").doesNotExist());
    }
}
