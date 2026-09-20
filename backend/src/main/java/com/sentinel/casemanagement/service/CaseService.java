package com.sentinel.casemanagement.service;


import com.sentinel.casemanagement.model.CaseDecision;
import com.sentinel.casemanagement.model.CaseEntity;
import com.sentinel.casemanagement.model.CaseStatus;
import com.sentinel.casemanagement.repository.CaseRepository;
import com.sentinel.audit.service.AuditService;
import com.sentinel.auth.model.User;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.customer.model.Customer;
import com.sentinel.document.model.Document;
import com.sentinel.integration.service.WebhookPublisher;
import com.sentinel.risk.service.RiskEngine;
import com.sentinel.risk.model.RiskSettings;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.websocket.service.CaseEventPublisher;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CaseService {

    private final CaseRepository caseRepository;
    private final RiskEngine riskEngine;
    private final AuditService auditService;
    private final UserRepository userRepository;
    private final CaseEventPublisher caseEventPublisher;
    private final WebhookPublisher webhookPublisher;

    public CaseService(
            CaseRepository caseRepository,
            RiskEngine riskEngine,
            AuditService auditService,
            UserRepository userRepository,
            CaseEventPublisher caseEventPublisher,
            WebhookPublisher webhookPublisher) {
        this.caseRepository = caseRepository;
        this.riskEngine = riskEngine;
        this.auditService = auditService;
        this.userRepository = userRepository;
        this.caseEventPublisher = caseEventPublisher;
        this.webhookPublisher = webhookPublisher;
    }

    @Transactional
    public CaseEntity openIfNeeded(
            Tenant tenant, Customer customer, Document relatedDocument, int riskScore, String explanation) {
        RiskSettings settings = riskEngine.requireSettings(tenant.getId());
        if (!riskEngine.shouldOpenCase(riskScore, settings)) {
            return null;
        }
        return create(tenant, customer, relatedDocument, riskScore, explanation);
    }

    @Transactional
    public CaseEntity create(
            Tenant tenant, Customer customer, Document relatedDocument, int riskScore, String explanation) {
        CaseEntity c = new CaseEntity();
        c.setTenant(tenant);
        c.setCustomer(customer);
        c.setRelatedDocument(relatedDocument);
        c.setStatus(CaseStatus.OPEN);
        c.setRiskScoreAtCreation(riskScore);
        c.setExplanation(explanation);
        CaseEntity saved = caseRepository.save(c);

        auditService.record(
                tenant.getId(),
                TenantAccess.currentUserIdOrNull(),
                "CASE_OPEN",
                "Case",
                saved.getId().toString(),
                null,
                Map.of("riskScore", riskScore, "customerId", customer.getId()));

        Map<String, Object> event = eventPayload(saved, "CASE_OPENED");
        caseEventPublisher.caseOpened(tenant.getId(), event);
        webhookPublisher.publish(tenant, "CASE_OPENED", event);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<CaseEntity> listForTenant(Long tenantId, CaseStatus status) {
        if (status != null) {
            return caseRepository.findByTenant_IdAndStatusOrderByCreatedAtDesc(tenantId, status);
        }
        return caseRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId);
    }

    @Transactional(readOnly = true)
    public long countByTenantAndStatus(Long tenantId, CaseStatus status) {
        return caseRepository.countByTenant_IdAndStatus(tenantId, status);
    }

    @Transactional(readOnly = true)
    public CaseEntity getForTenant(Long tenantId, Long caseId) {
        return caseRepository
                .findByIdAndTenant_Id(caseId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Case not found"));
    }

    @Transactional
    public CaseEntity decide(Long tenantId, Long caseId, CaseDecision decision, String note, Long actorUserId) {
        if (note == null || note.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Decision note is required");
        }
        CaseEntity c = getForTenant(tenantId, caseId);
        Map<String, Object> before = snapshot(c);

        c.setDecision(decision);
        c.setDecisionNote(note.trim());
        c.setStatus(decision == CaseDecision.ESCALATE ? CaseStatus.UNDER_REVIEW : CaseStatus.RESOLVED);
        if (actorUserId != null) {
            User actor = userRepository.findById(actorUserId).orElse(null);
            c.setAssignedTo(actor);
        }
        CaseEntity saved = caseRepository.save(c);

        auditService.record(
                tenantId,
                actorUserId,
                "CASE_DECIDE",
                "Case",
                saved.getId().toString(),
                before,
                snapshot(saved));

        Map<String, Object> event = eventPayload(saved, "CASE_DECIDED");
        caseEventPublisher.caseUpdated(tenantId, event);
        webhookPublisher.publish(saved.getTenant(), "CASE_DECIDED", event);
        return saved;
    }

    private static Map<String, Object> snapshot(CaseEntity c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", c.getStatus() != null ? c.getStatus().name() : null);
        m.put("decision", c.getDecision() != null ? c.getDecision().name() : null);
        m.put("decisionNote", c.getDecisionNote());
        m.put("riskScoreAtCreation", c.getRiskScoreAtCreation());
        return m;
    }

    private static Map<String, Object> eventPayload(CaseEntity c, String event) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("event", event);
        m.put("caseId", c.getId().toString());
        m.put("customerId", c.getCustomer().getId().toString());
        m.put(
                "externalCustomerId",
                c.getCustomer().getExternalCustomerId() == null ? "" : c.getCustomer().getExternalCustomerId());
        m.put("status", c.getStatus().name());
        m.put("riskScore", c.getRiskScoreAtCreation());
        m.put("explanation", c.getExplanation());
        if (c.getDecision() != null) {
            m.put("decision", c.getDecision().name());
        }
        return m;
    }
}
