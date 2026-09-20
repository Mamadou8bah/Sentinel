package com.sentinel.audit.controller;


import com.sentinel.audit.service.AuditQueryService;
import com.sentinel.audit.dto.AuditLogResponse;
import com.sentinel.common.util.TenantAccess;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditQueryService auditQueryService;

    public AuditController(AuditQueryService auditQueryService) {
        this.auditQueryService = auditQueryService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    public List<AuditLogResponse> list(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId) {
        return auditQueryService.list(TenantAccess.requireTenantId(), entityType, entityId);
    }
}
