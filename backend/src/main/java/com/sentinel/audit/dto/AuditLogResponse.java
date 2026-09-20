package com.sentinel.audit.dto;

import com.sentinel.audit.model.AuditLog;
import java.time.Instant;
import java.util.Map;

public record AuditLogResponse(
        Long id,
        String action,
        String entityType,
        String entityId,
        Long userId,
        Map<String, Object> beforeState,
        Map<String, Object> afterState,
        Instant createdAt) {

    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getUser() != null ? log.getUser().getId() : null,
                log.getBeforeState(),
                log.getAfterState(),
                log.getCreatedAt());
    }
}
