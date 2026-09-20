package com.sentinel.risk.controller;


import com.sentinel.risk.service.RiskSettingsService;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.risk.dto.RiskSettingsRequest;
import com.sentinel.risk.dto.RiskSettingsResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/settings")
public class RiskController {

    private final RiskSettingsService riskSettingsService;

    public RiskController(RiskSettingsService riskSettingsService) {
        this.riskSettingsService = riskSettingsService;
    }

    @GetMapping("/risk-weights")
    @PreAuthorize("hasRole('ADMIN')")
    public RiskSettingsResponse get() {
        return riskSettingsService.get(TenantAccess.requireTenantId());
    }

    @PutMapping("/risk-weights")
    @PreAuthorize("hasRole('ADMIN')")
    public RiskSettingsResponse put(@Valid @RequestBody RiskSettingsRequest request) {
        return riskSettingsService.update(TenantAccess.requireTenantId(), request);
    }
}
