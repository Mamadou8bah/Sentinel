package com.sentinel.casemanagement.controller;


import com.sentinel.casemanagement.model.CaseStatus;
import com.sentinel.casemanagement.service.CaseService;
import com.sentinel.auth.security.SentinelUserDetails;
import com.sentinel.casemanagement.dto.CaseDecisionRequest;
import com.sentinel.casemanagement.dto.CaseResponse;
import com.sentinel.common.util.TenantAccess;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/cases")
public class CaseController {

    private final CaseService caseService;

    public CaseController(CaseService caseService) {
        this.caseService = caseService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public List<CaseResponse> list(@RequestParam(required = false) CaseStatus status) {
        return caseService.listForTenant(TenantAccess.requireTenantId(), status).stream()
                .map(CaseResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public CaseResponse get(@PathVariable Long id) {
        return CaseResponse.from(caseService.getForTenant(TenantAccess.requireTenantId(), id));
    }

    @PatchMapping("/{id}/decision")
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE')")
    public CaseResponse decide(@PathVariable Long id, @Valid @RequestBody CaseDecisionRequest request) {
        SentinelUserDetails staff = TenantAccess.requireStaff();
        return CaseResponse.from(caseService.decide(
                staff.getTenantId(), id, request.decision(), request.note(), staff.getUserId()));
    }
}
