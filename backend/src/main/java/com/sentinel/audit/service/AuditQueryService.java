package com.sentinel.audit.service;


import com.sentinel.audit.model.AuditLog;
import com.sentinel.audit.repository.AuditLogRepository;
import com.sentinel.audit.dto.AuditLogResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditQueryService {

    private final AuditLogRepository auditLogRepository;

    public AuditQueryService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(readOnly = true)
    public List<AuditLogResponse> list(Long tenantId, String entityType, String entityId) {
        List<AuditLog> logs;
        if (entityType != null && entityId != null) {
            logs = auditLogRepository.findByTenant_IdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
                    tenantId, entityType, entityId);
        } else {
            logs = auditLogRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId);
        }
        return logs.stream().limit(200).map(AuditLogResponse::from).toList();
    }
}
