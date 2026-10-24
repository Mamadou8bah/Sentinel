package com.sentinel.tenant.controller;

import com.sentinel.tenant.dto.RegisterTenantRequest;
import com.sentinel.tenant.dto.RegisterTenantResponse;
import com.sentinel.tenant.service.TenantService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tenants")
public class TenantController {

    private final TenantService tenantService;

    public TenantController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @org.springframework.beans.factory.annotation.Value("${sentinel.registration-open:true}")
    private boolean registrationOpen;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public RegisterTenantResponse register(@Valid @RequestBody RegisterTenantRequest request) {
        if (!registrationOpen)
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Tenant registration is managed by the operator");
        return tenantService.register(request);
    }
}
