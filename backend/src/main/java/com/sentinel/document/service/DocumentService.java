package com.sentinel.document.service;


import com.sentinel.document.model.Document;
import com.sentinel.document.model.DocumentStatus;
import com.sentinel.document.model.DocumentType;
import com.sentinel.document.model.SignatureMatchStatus;
import com.sentinel.document.repository.DocumentRepository;
import com.sentinel.integration.service.StubMlService;
import com.sentinel.audit.service.AuditService;
import com.sentinel.casemanagement.service.CaseService;
import com.sentinel.common.service.LocalStorageService;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.customer.model.Customer;
import com.sentinel.customer.service.CustomerService;
import com.sentinel.integration.service.MlGateway;
import com.sentinel.integration.service.StubMlService.DocumentScores;
import com.sentinel.risk.service.RiskEngine;
import com.sentinel.risk.model.RiskSettings;
import com.sentinel.tenant.model.Tenant;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final CustomerService customerService;
    private final LocalStorageService storageService;
    private final MlGateway mlGateway;
    private final RiskEngine riskEngine;
    private final CaseService caseService;
    private final AuditService auditService;

    public DocumentService(
            DocumentRepository documentRepository,
            CustomerService customerService,
            LocalStorageService storageService,
            MlGateway mlGateway,
            RiskEngine riskEngine,
            CaseService caseService,
            AuditService auditService) {
        this.documentRepository = documentRepository;
        this.customerService = customerService;
        this.storageService = storageService;
        this.mlGateway = mlGateway;
        this.riskEngine = riskEngine;
        this.caseService = caseService;
        this.auditService = auditService;
    }

    @Transactional
    public Document verify(
            Long tenantId, String externalCustomerId, DocumentType type, String documentImageBase64) {
        Customer customer = customerService.requireByExternalId(tenantId, externalCustomerId);
        return verifyForCustomer(tenantId, customer, type, documentImageBase64);
    }

    @Transactional
    public Document verifyMultipart(
            Long tenantId, String externalCustomerId, DocumentType type, MultipartFile documentImage) {
        return verify(tenantId, externalCustomerId, type, storageService.toBase64(documentImage));
    }

    @Transactional
    public Document verifyForCustomer(
            Long tenantId, Customer customer, DocumentType type, String documentImageBase64) {
        Tenant tenant = customer.getTenant();
        String path = storageService.storeBase64(
                tenantId, "documents/" + customer.getId(), documentImageBase64, "jpg");

        boolean hasSpecimen = customer.getReferenceSignatureUrl() != null
                && !customer.getReferenceSignatureUrl().isBlank();
        String specimenB64 =
                hasSpecimen ? storageService.readRelativeAsBase64(customer.getReferenceSignatureUrl()) : null;
        DocumentScores scores = mlGateway.scoreDocument(
                type.name(),
                hasSpecimen,
                customer.getName(),
                customer.getExternalCustomerId(),
                documentImageBase64,
                specimenB64);

        Document doc = new Document();
        doc.setTenant(tenant);
        doc.setCustomer(customer);
        doc.setType(type);
        doc.setImageUrl(path);
        doc.setOcrExtractedData(scores.ocr());
        doc.setTamperingScore(scores.tampering());
        doc.setFieldConsistencyFlags(scores.consistencyFlags());
        doc.setFraudRiskScore(scores.fraudRisk());

        if (!hasSpecimen) {
            doc.setSignatureMatchStatus(SignatureMatchStatus.SKIPPED_NO_REFERENCE);
            doc.setSignatureMatchScore(null);
        } else {
            doc.setSignatureMatchStatus(SignatureMatchStatus.SCORED);
            doc.setSignatureMatchScore(scores.signatureMatch());
        }
        doc.setStatus(DocumentStatus.COMPLETE);
        doc = documentRepository.save(doc);

        RiskSettings settings = riskEngine.requireSettings(tenantId);
        customerService.refreshRisk(customer);
        customer = customerService.requireCustomer(tenantId, customer.getId());

        String explanation = riskEngine.explainDocument(doc, settings);
        boolean suspicious = scores.tampering() >= settings.getTamperingThreshold()
                || (doc.getSignatureMatchStatus() == SignatureMatchStatus.SCORED
                        && scores.signatureMatch() != null
                        && scores.signatureMatch() < settings.getSignatureMatchThreshold())
                || riskEngine.shouldOpenCase(customer.getRiskScore(), settings);

        if (suspicious) {
            caseService.create(tenant, customer, doc, customer.getRiskScore(), explanation);
        }

        auditService.record(
                tenantId,
                TenantAccess.currentUserIdOrNull(),
                "DOCUMENT_VERIFY",
                "Document",
                doc.getId().toString(),
                null,
                Map.of(
                        "type", type.name(),
                        "signatureMatchStatus", doc.getSignatureMatchStatus().name(),
                        "tamperingScore", scores.tampering(),
                        "fraudRiskScore", scores.fraudRisk()));

        return doc;
    }

    @Transactional(readOnly = true)
    public Document get(Long tenantId, Long documentId) {
        return documentRepository
                .findByIdAndTenant_Id(documentId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found"));
    }

    @Transactional(readOnly = true)
    public long countByTenant(Long tenantId) {
        return documentRepository.countByTenant_Id(tenantId);
    }
}
