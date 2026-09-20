package com.sentinel.audit.service;


import com.sentinel.audit.model.AuditLog;
import com.sentinel.audit.repository.AuditLogRepository;
import com.sentinel.auth.model.User;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.repository.TenantRepository;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    public AuditService(
            AuditLogRepository auditLogRepository,
            TenantRepository tenantRepository,
            UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void record(
            Long tenantId,
            Long userId,
            String action,
            String entityType,
            String entityId,
            Map<String, Object> before,
            Map<String, Object> after) {
        Tenant tenant = tenantRepository
                .findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));

        AuditLog log = new AuditLog();
        log.setTenant(tenant);
        if (userId != null) {
            User user = userRepository.findById(userId).orElse(null);
            log.setUser(user);
        }
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setBeforeState(before);
        log.setAfterState(after);
        auditLogRepository.save(log);
    }
}
