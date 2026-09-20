package com.sentinel.customer.controller;

import com.sentinel.customer.dto.HostedKycSessionResponse;
import com.sentinel.customer.dto.HostedKycSubmitRequest;
import com.sentinel.customer.model.KycSession;
import com.sentinel.customer.service.KycService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public hosted KYC endpoints — customer completes verification via token URL.
 * No staff JWT and no bank API key.
 */
@RestController
@RequestMapping("/api/kyc/hosted")
public class HostedKycController {

    private final KycService kycService;

    public HostedKycController(KycService kycService) {
        this.kycService = kycService;
    }

    @GetMapping("/{token}")
    public HostedKycSessionResponse get(@PathVariable String token) {
        KycSession session = kycService.requireByPublicToken(token);
        session.getTenant().getName();
        if (session.getCustomer() != null) {
            session.getCustomer().getKycStatus();
        }
        return HostedKycSessionResponse.from(session, kycService.isExpired(session));
    }

    @PostMapping("/{token}/submit")
    public HostedKycSessionResponse submit(
            @PathVariable String token, @Valid @RequestBody HostedKycSubmitRequest request) {
        KycSession session = kycService.submitByPublicToken(
                token, request.idImage(), request.selfieImage(), request.name());
        session.getTenant().getName();
        if (session.getCustomer() != null) {
            session.getCustomer().getKycStatus();
        }
        return HostedKycSessionResponse.from(session, false);
    }
}
