package rs.trivio.vehicle;

import jakarta.validation.ConstraintViolationException;
import java.util.*;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.server.ResponseStatusException;

/** Never return multipart filenames, disk paths, SQL details, raw decoder failures or submitted values. */
@RestControllerAdvice(basePackageClasses = VehiclePhotoController.class)
public class VehicleApiExceptionHandler {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> status(ResponseStatusException exception) {
        String message = exception.getReason();
        if (message == null || exception.getStatusCode().is5xxServerError())
            message = "Servis trenutno nije dostupan. Pokušajte ponovo.";
        return response(exception.getStatusCode(), message, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException exception) {
        Set<String> allowed = Set.of("brand", "model", "year", "price", "mileage", "fuelType",
            "transmission", "enginePowerHp", "color", "description", "version", "photoIds", "coverPhotoId");
        List<String> fields = exception.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField().replaceAll("\\[\\d+\\]", ""))
            .filter(allowed::contains).distinct().toList();
        return response(HttpStatus.BAD_REQUEST, "Proverite unete podatke i pokušajte ponovo.", fields);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> tooLarge() {
        return response(HttpStatus.PAYLOAD_TOO_LARGE, "Fotografija sme imati najviše 5 MiB, a zahtev najviše 52 MiB.", List.of());
    }

    @ExceptionHandler({ConstraintViolationException.class, HttpMessageNotReadableException.class,
        MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class,
        MissingServletRequestPartException.class, MultipartException.class})
    public ResponseEntity<Map<String, Object>> malformed() {
        return response(HttpStatus.BAD_REQUEST, "Zahtev nije ispravan. Proverite podatke i fotografije.", List.of());
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> unsupportedContent() {
        return response(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Format zahteva nije podržan.", List.of());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> unsupportedMethod() {
        return response(HttpStatus.METHOD_NOT_ALLOWED, "Ova operacija nije podržana.", List.of());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> unavailable() {
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "Zahtev trenutno nije moguće izvršiti. Pokušajte ponovo.", List.of());
    }

    private static ResponseEntity<Map<String, Object>> response(HttpStatusCode status, String message, List<String> fields) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        if (!fields.isEmpty()) body.put("fields", fields);
        return ResponseEntity.status(status).body(body);
    }
}
