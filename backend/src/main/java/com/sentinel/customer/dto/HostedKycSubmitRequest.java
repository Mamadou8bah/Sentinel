package com.sentinel.customer.dto;

import jakarta.validation.constraints.*;

import java.util.List;

public record HostedKycSubmitRequest(
        @NotBlank @Size(max = 6666768) String idImage,
        @Size(max = 4000100) String selfieImage,
        @Size(max = 255) String name,
        @Size(max = 12) List<@NotBlank @Size(max = 4000100) String> frames,
        @Size(max = 10666768) String videoBase64,
        @Pattern(regexp = "PASSPORT|ID_CARD|DRIVING_LICENCE") String documentType) {
    public HostedKycSubmitRequest(String idImage, String selfieImage, String name, List<String> frames, String videoBase64) {
        this(idImage, selfieImage, name, frames, videoBase64, null);
    }
    @AssertTrue(message = "Supply one recording, or legacy image evidence, but not both")
    public boolean isCaptureValid() {
        if (videoBase64 != null && !videoBase64.isBlank())
            return (selfieImage == null || selfieImage.isBlank())
                    && (frames == null || frames.isEmpty());
        return selfieImage != null && !selfieImage.isBlank();
    }
}
