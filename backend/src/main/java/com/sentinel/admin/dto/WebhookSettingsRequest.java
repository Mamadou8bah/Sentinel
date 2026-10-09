package com.sentinel.admin.dto;

import jakarta.validation.constraints.Size;

public record WebhookSettingsRequest(@Size(max = 1024) String webhookUrl, @Size(min = 32, max = 256) String signingSecret) {}
