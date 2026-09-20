package com.sentinel.transaction.service;


import com.sentinel.integration.service.StubMlService;
import com.sentinel.transaction.model.TransactionEntity;
import com.sentinel.transaction.model.TxRecommendation;
import com.sentinel.transaction.repository.TransactionRepository;
import com.sentinel.audit.service.AuditService;
import com.sentinel.casemanagement.model.CaseEntity;
import com.sentinel.casemanagement.service.CaseService;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.customer.model.Customer;
import com.sentinel.customer.service.CustomerService;
import com.sentinel.integration.service.MlGateway;
import com.sentinel.integration.service.StubMlService.TxScores;
import com.sentinel.integration.service.WebhookPublisher;
import com.sentinel.risk.service.RiskEngine;
import com.sentinel.risk.model.RiskSettings;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.transaction.dto.TxImportResponse;
import com.sentinel.transaction.dto.TxScoreResponse;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TransactionScoringService {

    private final TransactionRepository transactionRepository;
    private final CustomerService customerService;
    private final MlGateway mlGateway;
    private final RiskEngine riskEngine;
    private final CaseService caseService;
    private final AuditService auditService;
    private final WebhookPublisher webhookPublisher;

    public TransactionScoringService(
            TransactionRepository transactionRepository,
            CustomerService customerService,
            MlGateway mlGateway,
            RiskEngine riskEngine,
            CaseService caseService,
            AuditService auditService,
            WebhookPublisher webhookPublisher) {
        this.transactionRepository = transactionRepository;
        this.customerService = customerService;
        this.mlGateway = mlGateway;
        this.riskEngine = riskEngine;
        this.caseService = caseService;
        this.auditService = auditService;
        this.webhookPublisher = webhookPublisher;
    }

    @Transactional
    public TxScoreResponse score(
            Long tenantId,
            String externalCustomerId,
            String externalTransactionId,
            BigDecimal amount,
            String currency,
            Instant timestamp,
            String channel,
            String location,
            String counterparty) {
        Customer customer = customerService.requireByExternalId(tenantId, externalCustomerId);
        Tenant tenant = customer.getTenant();

        if (externalTransactionId != null && !externalTransactionId.isBlank()) {
            var existing = transactionRepository.findByTenant_IdAndExternalTransactionId(
                    tenantId, externalTransactionId);
            if (existing.isPresent()) {
                return TxScoreResponse.from(existing.get(), customer.getRiskScore(), externalCustomerId, null);
            }
        }

        Map<String, Object> features = new LinkedHashMap<>();
        features.put("currency", currency);
        features.put("location", location);
        features.put("counterparty", counterparty);
        features.put("timestamp", timestamp != null ? timestamp.toString() : Instant.now().toString());

        TxScores scores = mlGateway.scoreTransaction(
                amount.doubleValue(), channel, externalCustomerId, features);
        RiskSettings settings = riskEngine.requireSettings(tenantId);
        TxRecommendation recommendation = riskEngine.recommendationFromAnomaly(scores.anomalyScore(), settings);

        TransactionEntity tx = new TransactionEntity();
        tx.setTenant(tenant);
        tx.setCustomer(customer);
        tx.setExternalTransactionId(externalTransactionId);
        tx.setAmount(amount);
        tx.setCurrency(currency == null || currency.isBlank() ? "GMD" : currency);
        tx.setOccurredAt(timestamp != null ? timestamp : Instant.now());
        tx.setChannel(channel);
        tx.setLocation(location);
        tx.setCounterparty(counterparty);
        tx.setAnomalyScore(scores.anomalyScore());
        tx.setRuleFlags(scores.ruleFlags());
        tx.setShapTopFeatures(scores.shapTopFeatures());
        tx.setExplanation(scores.explanation());
        tx.setRecommendation(recommendation);
        tx.setFlagged(recommendation != TxRecommendation.ALLOW);
        tx = transactionRepository.save(tx);

        customerService.refreshRisk(customer);
        customer = customerService.requireCustomer(tenantId, customer.getId());

        CaseEntity opened = null;
        if (tx.isFlagged()) {
            opened = caseService.create(
                    tenant,
                    customer,
                    null,
                    customer.getRiskScore(),
                    scores.explanation() + " · recommendation " + recommendation);
        }

        auditService.record(
                tenantId,
                TenantAccess.currentUserIdOrNull(),
                "TX_SCORE",
                "Transaction",
                tx.getId().toString(),
                null,
                Map.of(
                        "recommendation", recommendation.name(),
                        "anomalyScore", scores.anomalyScore(),
                        "flagged", tx.isFlagged()));

        TxScoreResponse response = TxScoreResponse.from(
                tx,
                customer.getRiskScore(),
                externalCustomerId,
                opened != null ? opened.getId().toString() : null);
        if (tx.isFlagged()) {
            webhookPublisher.publish(
                    tenant,
                    "TX_FLAGGED",
                    Map.of(
                            "externalTransactionId",
                            response.externalTransactionId() == null ? "" : response.externalTransactionId(),
                            "transactionId",
                            response.transactionId(),
                            "recommendation",
                            response.recommendation().name(),
                            "customerRiskScore",
                            response.customerRiskScore(),
                            "externalCustomerId",
                            externalCustomerId));
        }
        return response;
    }

    @Transactional
    public TxImportResponse importCsv(Long tenantId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "CSV file required");
        }
        List<Object> results = new ArrayList<>();
        int processed = 0;
        int failed = 0;
        try (BufferedReader reader =
                new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String header = reader.readLine();
            if (header == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Empty CSV");
            }
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                String[] cols = line.split(",", -1);
                try {
                    results.add(score(
                            tenantId,
                            col(cols, 0),
                            col(cols, 1),
                            new BigDecimal(col(cols, 2)),
                            col(cols, 3),
                            col(cols, 4).isBlank() ? Instant.now() : Instant.parse(col(cols, 4)),
                            col(cols, 5),
                            col(cols, 6),
                            col(cols, 7)));
                    processed++;
                } catch (Exception e) {
                    failed++;
                    results.add(Map.of("error", e.getMessage() == null ? "parse error" : e.getMessage(), "line", line));
                }
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to read CSV: " + e.getMessage());
        }

        auditService.record(
                tenantId,
                TenantAccess.currentUserIdOrNull(),
                "TX_IMPORT",
                "Transaction",
                "bulk",
                null,
                Map.of("processed", processed, "failed", failed));

        return new TxImportResponse(processed, failed, results);
    }

    @Transactional(readOnly = true)
    public List<TransactionEntity> history(Long tenantId, Long customerId) {
        customerService.requireCustomer(tenantId, customerId);
        return transactionRepository.findByCustomer_IdAndTenant_IdOrderByOccurredAtDesc(customerId, tenantId);
    }

    @Transactional(readOnly = true)
    public long countFlagged(Long tenantId) {
        return transactionRepository.countByTenant_IdAndFlaggedTrue(tenantId);
    }

    @Transactional(readOnly = true)
    public long countByTenant(Long tenantId) {
        return transactionRepository.countByTenant_Id(tenantId);
    }

    private static String col(String[] cols, int i) {
        return i < cols.length ? cols[i].trim() : "";
    }
}
