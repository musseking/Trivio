package rs.trivio.auth;

import java.util.List;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/**
 * Sanitized HTTP errors for AuthController.
 *
 * Spring's default validation exception logging may include FieldError's rejected
 * value. For password fields, that exposes plaintext credentials in service logs.
 * Handle these errors here WITHOUT logging the exception, binding result or request.
 */
@RestControllerAdvice(basePackageClasses = AuthController.class)
public class AuthApiExceptionHandler {

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> uploadTooLarge() {
        return ResponseEntity.status(413).body(new ApiError("UPLOAD_TOO_LARGE", "Photo is too large", List.of("file")));
    }

    public record ApiError(String code, String message, List<String> fields) {}

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> invalidFields(MethodArgumentNotValidException exception) {
        // Only field NAMES; do not call toString() on FieldError or exception.
        List<String> fields = exception.getBindingResult().getFieldErrors()
            .stream().map(FieldError::getField).distinct().sorted().toList();
        return ResponseEntity.badRequest()
            .body(new ApiError("VALIDATION_ERROR", "Invalid request data", fields));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiError> invalidJson(HttpMessageNotReadableException exception) {
        // Never reflect malformed JSON, parsing errors, or submitted credentials.
        return ResponseEntity.badRequest()
            .body(new ApiError("INVALID_JSON", "Invalid JSON request body", List.of()));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiError> handledStatus(ResponseStatusException exception) {
        // Handle controller-originated errors directly; do not forward through /error,
        // which may be intercepted by stateless Spring Security as HTTP 401.
        HttpStatusCode status = exception.getStatusCode();
        int value = status.value();
        String code = switch (value) {
            case 400 -> "BAD_REQUEST";
            case 401 -> "UNAUTHORIZED";
            case 403 -> "FORBIDDEN";
            case 404 -> "NOT_FOUND";
            case 409 -> "CONFLICT";
            default -> "REQUEST_ERROR";
        };
        String message = switch (value) {
            case 400 -> "Invalid request";
            case 401 -> "Invalid credentials or account unavailable";
            case 403 -> "Access denied";
            case 404 -> "Resource not found";
            case 409 -> "Email is already registered";
            default -> "Request could not be completed";
        };
        return ResponseEntity.status(status).body(new ApiError(code, message, List.of()));
    }
}
