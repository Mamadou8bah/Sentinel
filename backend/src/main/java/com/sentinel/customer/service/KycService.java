package com.sentinel.customer.service;

import com.sentinel.audit.service.AuditService;
import com.sentinel.casemanagement.service.CaseService;
import com.sentinel.common.config.SentinelProperties;
import com.sentinel.common.service.FieldEncryption;
import com.sentinel.common.service.LocalStorageService;
import com.sentinel.common.util.Hashing;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.customer.model.Customer;
import com.sentinel.customer.model.KycSession;
import com.sentinel.customer.model.KycSessionStatus;
import com.sentinel.customer.model.KycStatus;
import com.sentinel.customer.repository.CustomerRepository;
import com.sentinel.customer.repository.KycSessionRepository;
import com.sentinel.document.model.Document;
import com.sentinel.document.repository.DocumentRepository;
import com.sentinel.integration.service.MlGateway;
import com.sentinel.integration.service.StubMlService.KycScores;
import com.sentinel.integration.service.WebhookPublisher;
import com.sentinel.risk.model.RiskSettings;
import com.sentinel.risk.service.RiskEngine;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.service.TenantService;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class KycService {

    private final KycSessionRepository kycSessionRepository;
    private final CustomerRepository customerRepository;
    private final DocumentRepository documentRepository;
    private final TenantService tenantService;
    private final MlGateway mlGateway;
    private final RiskEngine riskEngine;
    private final CaseService caseService;
    private final LocalStorageService storageService;
    private final AuditService auditService;
    private final FieldEncryption fieldEncryption;
    private final WebhookPublisher webhookPublisher;
    private final SentinelProperties properties;

    public KycService(
            KycSessionRepository kycSessionRepository,
            CustomerRepository customerRepository,
            DocumentRepository documentRepository,
            TenantService tenantService,
            MlGateway mlGateway,
            RiskEngine riskEngine,
            CaseService caseService,
            LocalStorageService storageService,
            AuditService auditService,
            FieldEncryption fieldEncryption,
            WebhookPublisher webhookPublisher,
            SentinelProperties properties) {
        this.kycSessionRepository = kycSessionRepository;
        this.customerRepository = customerRepository;
        this.documentRepository = documentRepository;
        this.tenantService = tenantService;
        this.mlGateway = mlGateway;
        this.riskEngine = riskEngine;
        this.caseService = caseService;
        this.storageService = storageService;
        this.auditService = auditService;
        this.fieldEncryption = fieldEncryption;
        this.webhookPublisher = webhookPublisher;
        this.properties = properties;
    }

    @Transactional
    public KycSession startSession(Long tenantId, String externalCustomerId, String returnUrl) {
        Tenant tenant = tenantService.requireTenant(tenantId);
        KycSession session = new KycSession();
        session.setTenant(tenant);
        session.setExternalCustomerId(externalCustomerId.trim());
        session.setStatus(KycSessionStatus.PENDING);
        session.setChallengeId("chal_" + Hashing.randomHex(8));
        session.setLivenessHint("Turn head slowly left, then right");
        session.setPublicToken(Hashing.randomHex(24));
        session.setExpiresAt(Instant.now()
                .plus(properties.getHosted().getSessionTtlMinutes(), ChronoUnit.MINUTES));
        if (returnUrl != null && !returnUrl.isBlank()) {
            session.setReturnUrl(returnUrl.trim());
        }
        return kycSessionRepository.save(session);
    }

    public String hostedUrl(KycSession session) {
        String base = properties.getHosted().getPublicBaseUrl().replaceAll("/$", "");
        return base + "/kyc/" + session.getPublicToken();
    }

    @Transactional(readOnly = true)
    public KycSession getSession(Long tenantId, Long sessionId) {
        return kycSessionRepository
                .findByIdAndTenant_Id(sessionId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "KYC session not found"));
    }

    @Transactional(readOnly = true)
    public KycSession requireByPublicToken(String token) {
        if (token == null || token.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "KYC session not found");
        }
        return kycSessionRepository
                .findByPublicToken(token.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "KYC session not found"));
    }

    public boolean isExpired(KycSession session) {
        return session.getExpiresAt() != null && session.getExpiresAt().isBefore(Instant.now());
    }

    @Transactional
    public KycSession submitByPublicToken(String token, String idImageBase64, String selfieImageBase64, String name) {
        KycSession session = requireByPublicToken(token);
        if (isExpired(session) && session.getStatus() != KycSessionStatus.COMPLETE) {
            throw new ResponseStatusException(HttpStatus.GONE, "This verification link has expired");
        }
        return submitSession(
                session.getTenant().getId(),
                session.getId(),
                session.getChallengeId(),
                idImageBase64,
                selfieImageBase64,
                name);
    }

    @Transactional
    public KycSession submitSession(
            Long tenantId,
            Long sessionId,
            String challengeId,
            String idImageBase64,
            String selfieImageBase64,
            String providedName) {
        KycSession session = getSession(tenantId, sessionId);
        if (session.getStatus() == KycSessionStatus.COMPLETE) {
            return session;
        }
        if (isExpired(session)) {
            throw new ResponseStatusException(HttpStatus.GONE, "This verification link has expired");
        }
        verifyChallenge(session, challengeId);

        Tenant tenant = session.getTenant();
        storageService.storeBase64(tenantId, "kyc/" + sessionId, idImageBase64, "jpg");
        storageService.storeBase64(tenantId, "kyc/" + sessionId, selfieImageBase64, "jpg");

        session.setStatus(KycSessionStatus.SUBMITTED);
        KycScores scores = mlGateway.scoreKyc(
                session.getExternalCustomerId(), providedName, idImageBase64, selfieImageBase64);

        Customer customer = customerRepository
                .findByTenant_IdAndExternalCustomerId(tenantId, session.getExternalCustomerId())
                .orElseGet(Customer::new);
        boolean created = customer.getId() == null;
        customer.setTenant(tenant);
        customer.setExternalCustomerId(session.getExternalCustomerId());
        customer.setName(scores.name());
        try {
            customer.setDob(LocalDate.parse(scores.dob()));
        } catch (Exception ignored) {
            // keep null when OCR stub returns a non-date
        }
        customer.setIdNumber(fieldEncryption.encrypt(scores.idNumber()));
        customer.setFaceMatchScore(scores.faceMatch());
        customer.setLivenessScore(scores.liveness());

        RiskSettings settings = riskEngine.requireSettings(tenantId);
        KycStatus status = riskEngine.decideKycStatus(scores.faceMatch(), scores.liveness(), settings);
        customer.setKycStatus(status);

        List<Document> docs = created
                ? List.of()
                : documentRepository.findByCustomer_IdAndTenant_Id(customer.getId(), tenantId);
        int risk = riskEngine.computeCustomerRisk(customer, docs, null);
        customer.setRiskScore(risk);
        customer = customerRepository.save(customer);

        session.setCustomer(customer);
        session.setStatus(KycSessionStatus.COMPLETE);
        session.setExplanation(riskEngine.explainKyc(customer, settings));
        session = kycSessionRepository.save(session);

        if (status == KycStatus.FLAGGED || status == KycStatus.REJECTED || riskEngine.shouldOpenCase(risk, settings)) {
            caseService.create(tenant, customer, null, risk, session.getExplanation());
        }

        auditService.record(
                tenantId,
                TenantAccess.currentUserIdOrNull(),
                created ? "KYC_CREATE" : "KYC_UPDATE",
                "Customer",
                customer.getId().toString(),
                null,
                Map.of("kycStatus", status.name(), "riskScore", risk, "sessionId", sessionId));

        Map<String, Object> webhook = new LinkedHashMap<>();
        webhook.put("sessionId", session.getId().toString());
        webhook.put("customerId", customer.getId().toString());
        webhook.put("externalCustomerId", customer.getExternalCustomerId());
        webhook.put("kycStatus", status.name());
        webhook.put("riskScore", risk);
        webhookPublisher.publish(tenant, "KYC_COMPLETE", webhook);

        return session;
    }

    @Transactional
    public KycSession submitSessionMultipart(
            Long tenantId,
            Long sessionId,
            String challengeId,
            MultipartFile idImage,
            MultipartFile selfieImage,
            String providedName) {
        return submitSession(
                tenantId,
                sessionId,
                challengeId,
                storageService.toBase64(idImage),
                storageService.toBase64(selfieImage),
                providedName);
    }

    private static void verifyChallenge(KycSession session, String challengeId) {
        if (challengeId == null || challengeId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "challengeId is required");
        }
        byte[] expected = session.getChallengeId().getBytes(StandardCharsets.UTF_8);
        byte[] provided = challengeId.trim().getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, provided)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid liveness challengeId");
        }
    }
}
