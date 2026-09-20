package com.sentinel.common.service;


import com.sentinel.common.config.SentinelProperties;
import com.sentinel.common.config.SentinelProperties.Storage;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LocalStorageService {

    private static final Set<String> ALLOWED = Set.of(
            "image/jpeg", "image/jpg", "image/png", "image/webp", "application/octet-stream");

    private final Path root;
    private final long maxBytes;

    public LocalStorageService(SentinelProperties properties) {
        Storage storage = properties.getStorage();
        this.root = Path.of(storage.getUploadDir()).toAbsolutePath().normalize();
        this.maxBytes = storage.getMaxSizeMb() * 1024L * 1024L;
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new IllegalStateException("Cannot create upload directory: " + root, e);
        }
    }

    public String storeBase64(Long tenantId, String folder, String base64, String extension) {
        byte[] bytes = decodeBase64(base64);
        return write(tenantId, folder, bytes, extension);
    }

    public String storeMultipart(Long tenantId, String folder, MultipartFile file) {
        validate(file);
        try {
            String original = file.getOriginalFilename() == null ? "upload.bin" : file.getOriginalFilename();
            String ext = original.contains(".") ? original.substring(original.lastIndexOf('.') + 1) : "bin";
            return write(tenantId, folder, file.getBytes(), ext);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store file");
        }
    }

    public String toBase64(MultipartFile file) {
        validate(file);
        try {
            return Base64.getEncoder().encodeToString(file.getBytes());
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot read upload");
        }
    }

    public byte[] readRelative(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return null;
        }
        try {
            Path file = root.resolve(relativePath).normalize();
            if (!file.startsWith(root) || !Files.isRegularFile(file)) {
                return null;
            }
            return Files.readAllBytes(file);
        } catch (IOException e) {
            return null;
        }
    }

    public String readRelativeAsBase64(String relativePath) {
        byte[] bytes = readRelative(relativePath);
        return bytes == null ? null : Base64.getEncoder().encodeToString(bytes);
    }

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File required");
        }
        if (file.getSize() > maxBytes) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File exceeds upload limit");
        }
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!contentType.isBlank() && !ALLOWED.contains(contentType) && !contentType.startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported file type: " + contentType);
        }
    }

    private byte[] decodeBase64(String base64) {
        if (base64 == null || base64.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image payload required");
        }
        String payload = base64.contains(",") ? base64.substring(base64.indexOf(',') + 1) : base64;
        try {
            byte[] bytes = Base64.getDecoder().decode(payload);
            if (bytes.length > maxBytes) {
                throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "File exceeds upload limit");
            }
            return bytes;
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid base64 image");
        }
    }

    private String write(Long tenantId, String folder, byte[] bytes, String extension) {
        Path dir = root.resolve(tenantId.toString()).resolve(folder);
        try {
            Files.createDirectories(dir);
            String name = UUID.randomUUID() + (extension.startsWith(".") ? extension : "." + extension);
            Path file = dir.resolve(name);
            Files.write(file, bytes);
            return root.relativize(file).toString().replace('\\', '/');
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to store file");
        }
    }
}
