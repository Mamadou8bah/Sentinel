package com.sentinel.admin.dto;

import jakarta.validation.constraints.Size;

public record WebhookSettingsRequest(@Size(max = 1024) String webhookUrl) {}
