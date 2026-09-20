package com.sentinel.customer.service;


import com.sentinel.customer.model.Customer;
import com.sentinel.customer.model.KycSession;
import com.sentinel.customer.model.KycSessionStatus;
import com.sentinel.customer.model.KycStatus;
import com.sentinel.customer.repository.CustomerRepository;
import com.sentinel.customer.repository.KycSessionRepository;
import com.sentinel.integration.service.StubMlService;
import com.sentinel.audit.service.AuditService;
import com.sentinel.casemanagement.service.CaseService;
import com.sentinel.common.service.FieldEncryption;
import com.sentinel.common.util.Hashing;
import com.sentinel.common.service.LocalStorageService;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.customer.dto.CustomerDetailResponse;
import com.sentinel.document.model.Document;
import com.sentinel.document.repository.DocumentRepository;
import com.sentinel.integration.service.MlGateway;
import com.sentinel.integration.service.StubMlService.KycScores;
import com.sentinel.integration.service.WebhookPublisher;
import com.sentinel.risk.service.RiskEngine;
import com.sentinel.risk.model.RiskSettings;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.service.TenantService;
import com.sentinel.transaction.model.TransactionEntity;
import com.sentinel.transaction.repository.TransactionRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final KycSessionRepository kycSessionRepository;
    private final DocumentRepository documentRepository;
    private final TransactionRepository transactionRepository;
    private final TenantService tenantService;
    private final MlGateway mlGateway;
    private final RiskEngine riskEngine;
    private final CaseService caseService;
    private final LocalStorageService storageService;
    private final AuditService auditService;
    private final FieldEncryption fieldEncryption;
    private final WebhookPublisher webhookPublisher;

    public CustomerService(
            CustomerRepository customerRepository,
            KycSessionRepository kycSessionRepository,
            DocumentRepository documentRepository,
            TransactionRepository transactionRepository,
            TenantService tenantService,
            MlGateway mlGateway,
            RiskEngine riskEngine,
            CaseService caseService,
            LocalStorageService storageService,
            AuditService auditService,
            FieldEncryption fieldEncryption,
            WebhookPublisher webhookPublisher) {
        this.customerRepository = customerRepository;
        this.kycSessionRepository = kycSessionRepository;
        this.documentRepository = documentRepository;
        this.transactionRepository = transactionRepository;
        this.tenantService = tenantService;
        this.mlGateway = mlGateway;
        this.riskEngine = riskEngine;
        this.caseService = caseService;
        this.storageService = storageService;
        this.auditService = auditService;
        this.fieldEncryption = fieldEncryption;
        this.webhookPublisher = webhookPublisher;
    }

    @Transactional
    public KycSession startSession(Long tenantId, String externalCustomerId) {
        Tenant tenant = tenantService.requireTenant(tenantId);
        KycSession session = new KycSession();
        session.setTenant(tenant);
        session.setExternalCustomerId(externalCustomerId.trim());
        session.setStatus(KycSessionStatus.PENDING);
        session.setChallengeId("chal_" + Hashing.randomHex(8));
        session.setLivenessHint("Turn head slowly left, then right");
        return kycSessionRepository.save(session);
    }

    @Transactional(readOnly = true)
    public KycSession getSession(Long tenantId, Long sessionId) {
        return kycSessionRepository
                .findByIdAndTenant_Id(sessionId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "KYC session not found"));
    }

    @Transactional
    public KycSession submitSession(
            Long tenantId, Long sessionId, String idImageBase64, String selfieImageBase64, String providedName) {
        KycSession session = getSession(tenantId, sessionId);
        if (session.getStatus() == KycSessionStatus.COMPLETE) {
            return session;
        }

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
            // keep null
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
            Long tenantId, Long sessionId, MultipartFile idImage, MultipartFile selfieImage, String providedName) {
        return submitSession(
                tenantId,
                sessionId,
                storageService.toBase64(idImage),
                storageService.toBase64(selfieImage),
                providedName);
    }

    @Transactional
    public Customer enrollSpecimen(Long tenantId, Long customerId, String signatureImageBase64) {
        Customer customer = requireCustomer(tenantId, customerId);
        String path = storageService.storeBase64(tenantId, "specimens/" + customerId, signatureImageBase64, "png");
        customer.setReferenceSignatureUrl(path);
        Customer saved = customerRepository.save(customer);
        auditService.record(
                tenantId,
                TenantAccess.currentUserIdOrNull(),
                "SPECIMEN_ENROLL",
                "Customer",
                customerId.toString(),
                null,
                Map.of("referenceSignatureUrl", path));
        return saved;
    }

    @Transactional
    public Customer enrollSpecimenMultipart(Long tenantId, Long customerId, MultipartFile signatureImage) {
        Customer customer = requireCustomer(tenantId, customerId);
        String path = storageService.storeMultipart(tenantId, "specimens/" + customerId, signatureImage);
        customer.setReferenceSignatureUrl(path);
        return customerRepository.save(customer);
    }

    @Transactional
    public Customer enrollSpecimenByExternalId(Long tenantId, String externalCustomerId, String signatureImageBase64) {
        Customer customer = customerRepository
                .findByTenant_IdAndExternalCustomerId(tenantId, externalCustomerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Customer not found for externalCustomerId"));
        return enrollSpecimen(tenantId, customer.getId(), signatureImageBase64);
    }

    @Transactional(readOnly = true)
    public Customer requireCustomer(Long tenantId, Long customerId) {
        return customerRepository
                .findByIdAndTenant_Id(customerId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));
    }

    @Transactional(readOnly = true)
    public Customer requireByExternalId(Long tenantId, String externalCustomerId) {
        return customerRepository
                .findByTenant_IdAndExternalCustomerId(tenantId, externalCustomerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Customer not found for externalCustomerId"));
    }

    @Transactional(readOnly = true)
    public List<Customer> list(Long tenantId) {
        return customerRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId);
    }

    @Transactional(readOnly = true)
    public long countByTenant(Long tenantId) {
        return customerRepository.countByTenant_Id(tenantId);
    }

    @Transactional(readOnly = true)
    public CustomerDetailResponse customer360(Long tenantId, Long customerId) {
        Customer c = requireCustomer(tenantId, customerId);
        List<Document> docs = documentRepository.findByCustomer_IdAndTenant_Id(customerId, tenantId);
        List<TransactionEntity> txs =
                transactionRepository.findByCustomer_IdAndTenant_IdOrderByOccurredAtDesc(customerId, tenantId);
        return new CustomerDetailResponse(
                c.getId(),
                c.getName(),
                c.getExternalCustomerId(),
                c.getDob(),
                fieldEncryption.mask(c.getIdNumber()),
                c.getKycStatus(),
                c.getFaceMatchScore(),
                c.getLivenessScore(),
                c.getRiskScore(),
                c.getReferenceSignatureUrl() != null,
                docs.size(),
                txs.size(),
                c.getCreatedAt());
    }

    @Transactional
    public void refreshRisk(Customer customer) {
        Long tenantId = customer.getTenant().getId();
        List<Document> docs = documentRepository.findByCustomer_IdAndTenant_Id(customer.getId(), tenantId);
        List<TransactionEntity> txs =
                transactionRepository.findByCustomer_IdAndTenant_IdOrderByOccurredAtDesc(customer.getId(), tenantId);
        Double latestAnomaly = txs.isEmpty() ? null : txs.get(0).getAnomalyScore();
        customer.setRiskScore(riskEngine.computeCustomerRisk(customer, docs, latestAnomaly));
        customerRepository.save(customer);
    }
}
