package com.sentinel.customer.dto;

import jakarta.validation.constraints.*;

import java.util.List;

public record HostedKycSubmitRequest(
        @NotBlank @Size(max = 4000100) String idImage,
        @Size(max = 4000100) String selfieImage,
        @Size(max = 255) String name,
        @Size(max = 12) List<@NotBlank @Size(max = 4000100) String> frames,
        @Size(max = 10666768) String videoBase64) {
    @AssertTrue(message = "Supply one recording, or legacy image evidence, but not both")
    public boolean isCaptureValid() {
        if (videoBase64 != null && !videoBase64.isBlank())
            return (selfieImage == null || selfieImage.isBlank())
                    && (frames == null || frames.isEmpty());
        return selfieImage != null && !selfieImage.isBlank();
    }
}
