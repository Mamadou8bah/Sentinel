package com.sentinel.customer.controller;

import com.sentinel.customer.dto.HostedKycSessionResponse;
import com.sentinel.customer.dto.HostedKycSubmitRequest;
import com.sentinel.customer.service.KycService;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public hosted KYC endpoints — customer completes verification via token URL. No staff JWT and no
 * bank API key.
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
        return kycService.hostedSession(token);
    }

    @PostMapping("/{token}/submit")
    public HostedKycSessionResponse submit(
            @PathVariable String token, @Valid @RequestBody HostedKycSubmitRequest request) {
        try {
            return kycService.submitHosted(token, request);
        } catch (org.springframework.web.server.ResponseStatusException failure) {
            // The failed submission transaction has rolled back. Expire a lost or
            // consumed ML challenge separately so the tenant can issue a fresh link.
            if (failure.getStatusCode().value() == 410 || failure.getStatusCode().value() == 409)
                kycService.expireHostedChallenge(token);
            throw failure;
        }
    }
}
