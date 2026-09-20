package com.sentinel.auth.dto;

import java.util.List;

public record MeResponse(String username, String tenantCode, Long tenantId, List<String> authorities) {}
