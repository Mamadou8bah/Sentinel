package com.sentinel.integration.service;

import com.sentinel.common.config.SentinelProperties;
import com.sentinel.integration.service.StubMlService.DocumentScores;
import com.sentinel.integration.service.StubMlService.KycScores;
import com.sentinel.integration.service.StubMlService.TxScores;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Facade over stub ML or live Python services. Falls back to stub on remote failure.
 */
@Service
public class MlGateway {

    private static final Logger log = LoggerFactory.getLogger(MlGateway.class);

    private final SentinelProperties properties;
    private final StubMlService stubMlService;
    private final RestClient cvClient;
    private final RestClient txClient;

    public MlGateway(SentinelProperties properties, StubMlService stubMlService) {
        this.properties = properties;
        this.stubMlService = stubMlService;
        this.cvClient = RestClient.builder().baseUrl(properties.getMl().getCvBaseUrl()).build();
        this.txClient = RestClient.builder().baseUrl(properties.getMl().getTransactionBaseUrl()).build();
    }

    public KycScores scoreKyc(
            String externalCustomerId, String providedName, String idImageBase64, String selfieImageBase64) {
        if (properties.getMl().isStub()) {
            return stubMlService.scoreKyc(externalCustomerId, providedName);
        }
        try {
            Map<String, Object> body = Map.of(
                    "idImage", idImageBase64 == null ? "" : idImageBase64,
                    "selfieImage", selfieImageBase64 == null ? "" : selfieImageBase64);
            Map<String, Object> resp = cvClient
                    .post()
                    .uri("/cv/kyc-verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (resp == null) {
                throw new IllegalStateException("Empty KYC ML response");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> fields =
                    resp.get("extractedFields") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
            String name = providedName != null && !providedName.isBlank()
                    ? providedName
                    : String.valueOf(fields.getOrDefault("name", "Unknown"));
            return new KycScores(
                    name,
                    String.valueOf(fields.getOrDefault("dob", "1990-01-01")),
                    String.valueOf(fields.getOrDefault("idNumber", "")),
                    toDouble(resp.get("faceMatchScore"), 0.5),
                    toDouble(resp.get("livenessScore"), 0.5),
                    toDouble(resp.get("tamperingScore"), 0.1));
        } catch (Exception e) {
            log.warn("CV KYC call failed — falling back to stub: {}", e.getMessage());
            return stubMlService.scoreKyc(externalCustomerId, providedName);
        }
    }

    public DocumentScores scoreDocument(
            String docType,
            boolean hasSpecimen,
            String customerName,
            String externalCustomerId,
            String documentImageBase64,
            String referenceSignatureBase64) {
        if (properties.getMl().isStub()) {
            return stubMlService.scoreDocument(docType, hasSpecimen, customerName, externalCustomerId);
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("documentImage", documentImageBase64 == null ? "" : documentImageBase64);
            body.put("docType", docType);
            if (hasSpecimen && referenceSignatureBase64 != null) {
                body.put("referenceSignature", referenceSignatureBase64);
            }
            Map<String, Object> resp = cvClient
                    .post()
                    .uri("/cv/document-verify")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (resp == null) {
                throw new IllegalStateException("Empty document ML response");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> ocr =
                    resp.get("extractedFields") instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
            Double sig = hasSpecimen ? toDouble(resp.get("signatureMatchScore"), 0.5) : null;
            double tamper = toDouble(resp.get("tamperingScore"), 0.1);
            double fraud = Math.max(tamper, sig == null ? 0.3 : 1.0 - sig);
            return new DocumentScores(ocr, tamper, sig, List.of(), fraud);
        } catch (Exception e) {
            log.warn("CV document call failed — falling back to stub: {}", e.getMessage());
            return stubMlService.scoreDocument(docType, hasSpecimen, customerName, externalCustomerId);
        }
    }

    public TxScores scoreTransaction(
            double amount, String channel, String externalCustomerId, Map<String, Object> features) {
        if (properties.getMl().isStub()) {
            return stubMlService.scoreTransaction(amount, channel, externalCustomerId);
        }
        try {
            Map<String, Object> tx = new LinkedHashMap<>(features);
            tx.put("amount", amount);
            tx.put("channel", channel);
            tx.put("externalCustomerId", externalCustomerId);
            Map<String, Object> body = Map.of("transactions", List.of(tx));
            Map<String, Object> resp = txClient
                    .post()
                    .uri("/ml/transaction-score")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (resp == null || !(resp.get("scores") instanceof List<?> scores) || scores.isEmpty()) {
                throw new IllegalStateException("Empty TX ML response");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> first = (Map<String, Object>) scores.get(0);
            double anomaly = toDouble(first.get("anomalyScore"), 0.2);
            List<String> flags = first.get("ruleFlags") instanceof List<?> l
                    ? l.stream().map(String::valueOf).toList()
                    : List.of();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> shap = first.get("shapTopFeatures") instanceof List<?> l
                    ? (List<Map<String, Object>>) l
                    : List.of();
            String explanation = first.get("explanation") != null
                    ? String.valueOf(first.get("explanation"))
                    : (flags.isEmpty() ? "Model scored transaction" : "Triggered: " + String.join(", ", flags));
            return new TxScores(anomaly, flags, explanation, shap);
        } catch (Exception e) {
            log.warn("TX ML call failed — falling back to stub: {}", e.getMessage());
            return stubMlService.scoreTransaction(amount, channel, externalCustomerId);
        }
    }

    private static double toDouble(Object v, double fallback) {
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        if (v == null) {
            return fallback;
        }
        try {
            return Double.parseDouble(v.toString());
        } catch (Exception e) {
            return fallback;
        }
    }
}
