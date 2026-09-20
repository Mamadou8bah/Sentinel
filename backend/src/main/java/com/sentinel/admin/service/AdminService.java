package com.sentinel.admin.service;

import com.sentinel.admin.dto.FraudTrendResponse;
import com.sentinel.admin.dto.WebhookSettingsResponse;
import com.sentinel.admin.dto.WebhookTestResponse;
import com.sentinel.audit.service.AuditService;
import com.sentinel.casemanagement.repository.CaseRepository;
import com.sentinel.casemanagement.model.CaseStatus;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.customer.repository.CustomerRepository;
import com.sentinel.customer.model.KycStatus;
import com.sentinel.document.repository.DocumentRepository;
import com.sentinel.integration.service.WebhookPublisher;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.service.TenantService;
import com.sentinel.transaction.repository.TransactionRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminService {

    private final CaseRepository caseRepository;
    private final CustomerRepository customerRepository;
    private final DocumentRepository documentRepository;
    private final TransactionRepository transactionRepository;
    private final TenantService tenantService;
    private final WebhookPublisher webhookPublisher;
    private final AuditService auditService;

    public AdminService(
            CaseRepository caseRepository,
            CustomerRepository customerRepository,
            DocumentRepository documentRepository,
            TransactionRepository transactionRepository,
            TenantService tenantService,
            WebhookPublisher webhookPublisher,
            AuditService auditService) {
        this.caseRepository = caseRepository;
        this.customerRepository = customerRepository;
        this.documentRepository = documentRepository;
        this.transactionRepository = transactionRepository;
        this.tenantService = tenantService;
        this.webhookPublisher = webhookPublisher;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public FraudTrendResponse fraudTrend(Long tenantId) {
        Map<String, Long> kyc = new LinkedHashMap<>();
        for (KycStatus status : KycStatus.values()) {
            kyc.put(status.name(), customerRepository.countByTenant_IdAndKycStatus(tenantId, status));
        }
        return new FraudTrendResponse(
                customerRepository.countByTenant_Id(tenantId),
                documentRepository.countByTenant_Id(tenantId),
                transactionRepository.countByTenant_Id(tenantId),
                transactionRepository.countByTenant_IdAndFlaggedTrue(tenantId),
                caseRepository.countByTenant_Id(tenantId),
                caseRepository.countByTenant_IdAndStatus(tenantId, CaseStatus.OPEN),
                caseRepository.countByTenant_IdAndStatus(tenantId, CaseStatus.UNDER_REVIEW),
                caseRepository.countByTenant_IdAndStatus(tenantId, CaseStatus.RESOLVED),
                kyc);
    }

    @Transactional(readOnly = true)
    public WebhookSettingsResponse getWebhook(Long tenantId) {
        Tenant tenant = tenantService.requireTenant(tenantId);
        return new WebhookSettingsResponse(
                tenant.getCode(), tenant.getWebhookUrl() == null ? "" : tenant.getWebhookUrl());
    }

    @Transactional
    public WebhookSettingsResponse updateWebhook(Long tenantId, String webhookUrl) {
        Tenant before = tenantService.requireTenant(tenantId);
        String oldUrl = before.getWebhookUrl();
        Tenant updated = tenantService.updateWebhookUrl(tenantId, webhookUrl);
        auditService.record(
                tenantId,
                TenantAccess.currentUserIdOrNull(),
                "WEBHOOK_UPDATE",
                "Tenant",
                tenantId.toString(),
                Map.of("webhookUrl", oldUrl == null ? "" : oldUrl),
                Map.of("webhookUrl", updated.getWebhookUrl() == null ? "" : updated.getWebhookUrl()));
        return new WebhookSettingsResponse(
                updated.getCode(), updated.getWebhookUrl() == null ? "" : updated.getWebhookUrl());
    }

    public WebhookTestResponse testWebhook(Long tenantId) {
        Tenant tenant = tenantService.requireTenant(tenantId);
        webhookPublisher.publish(
                tenant, "WEBHOOK_TEST", Map.of("message", "Sentinel webhook connectivity check"));
        return new WebhookTestResponse(true, tenant.getWebhookUrl() == null ? "" : tenant.getWebhookUrl());
    }
}
