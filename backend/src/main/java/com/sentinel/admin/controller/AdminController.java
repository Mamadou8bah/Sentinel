package com.sentinel.admin.controller;


import com.sentinel.admin.service.AdminService;
import com.sentinel.admin.dto.FraudTrendResponse;
import com.sentinel.admin.dto.WebhookSettingsRequest;
import com.sentinel.admin.dto.WebhookSettingsResponse;
import com.sentinel.admin.dto.WebhookTestResponse;
import com.sentinel.common.util.TenantAccess;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/analytics/fraud-trend")
    @PreAuthorize("hasRole('ADMIN')")
    public FraudTrendResponse fraudTrend() {
        return adminService.fraudTrend(TenantAccess.requireTenantId());
    }

    @GetMapping("/settings/webhook")
    @PreAuthorize("hasRole('ADMIN')")
    public WebhookSettingsResponse getWebhook() {
        return adminService.getWebhook(TenantAccess.requireTenantId());
    }

    @PutMapping("/settings/webhook")
    @PreAuthorize("hasRole('ADMIN')")
    public WebhookSettingsResponse putWebhook(@Valid @RequestBody WebhookSettingsRequest request) {
        return adminService.updateWebhook(TenantAccess.requireTenantId(), request.webhookUrl());
    }

    @PostMapping("/webhooks/test")
    @PreAuthorize("hasRole('ADMIN')")
    public WebhookTestResponse testWebhook() {
        return adminService.testWebhook(TenantAccess.requireTenantId());
    }
}
