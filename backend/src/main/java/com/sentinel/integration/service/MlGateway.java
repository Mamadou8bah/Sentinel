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
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/**
 * Facade over explicitly configured stub ML or live Python services.
 * Live inference failures never fall back to synthetic decisions.
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
        var cvTimeouts = new SimpleClientHttpRequestFactory();
        cvTimeouts.setConnectTimeout(3000);
        cvTimeouts.setReadTimeout(10000);
        var txTimeouts = new SimpleClientHttpRequestFactory();
        txTimeouts.setConnectTimeout(1000);
        txTimeouts.setReadTimeout(2500);
        this.cvClient = RestClient.builder().requestFactory(cvTimeouts).baseUrl(properties.getMl().getCvBaseUrl()).build();
        this.txClient = RestClient.builder().requestFactory(txTimeouts).baseUrl(properties.getMl().getTransactionBaseUrl()).build();
    }

    public record LivenessChallenge(String id, String hint, java.time.Instant expiresAt) {}

    public LivenessChallenge startLivenessChallenge() {
        if (properties.getMl().isStub()) {
            return new LivenessChallenge("chal_" + java.util.UUID.randomUUID(),
                    "LOOK_FORWARD, TURN_LEFT, TURN_RIGHT", java.time.Instant.now().plusSeconds(1800));
        }
        try {
            Map<String, Object> response = cvClient.post().uri("/cv/liveness/challenge")
                    .retrieve().body(new ParameterizedTypeReference<>() {});
            if (response == null || !(response.get("challengeId") instanceof String id)
                    || id.isBlank() || id.length() > 64
                    || !(response.get("instructions") instanceof List<?> instructions) || instructions.isEmpty()
                    || instructions.stream().anyMatch(i -> !List.of("LOOK_FORWARD", "TURN_LEFT", "TURN_RIGHT").contains(i))) {
                throw new IllegalStateException("Invalid liveness challenge");
            }
            java.time.Instant expiry = java.time.Instant.parse(String.valueOf(response.get("expiresAt")));
            if (!expiry.isAfter(java.time.Instant.now())) throw new IllegalStateException("Expired liveness challenge");
            return new LivenessChallenge(id, String.join(", ", instructions.stream().map(String::valueOf).toList()), expiry);
        } catch (Exception e) {
            throw unavailable("Liveness challenge", e);
        }
    }

    public KycScores scoreKyc(
            String externalCustomerId, String providedName, String idImageBase64, String selfieImageBase64) {
        return scoreKyc(externalCustomerId, providedName, idImageBase64, selfieImageBase64, null, List.of());
    }

    public KycScores scoreKyc(String externalCustomerId, String providedName, String idImageBase64,
            String selfieImageBase64, String challengeId, List<String> frames) {
        if (properties.getMl().isStub()) {
            return stubMlService.scoreKyc(externalCustomerId, providedName);
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("idImage", idImageBase64 == null ? "" : idImageBase64);
            body.put("selfieImage", selfieImageBase64 == null ? "" : selfieImageBase64);
            if (challengeId != null) body.put("challengeId", challengeId);
            if (frames != null && !frames.isEmpty()) body.put("frames", frames);
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
            boolean trusted = Boolean.TRUE.equals(resp.get("modelRan"))
                    && challengeId != null && !challengeId.isBlank() && frames != null && frames.size() >= 3
                    && Boolean.TRUE.equals(resp.get("qualityOk"))
                    && Boolean.FALSE.equals(resp.get("spoofLikely"))
                    && fields.get("idNumber") instanceof String id && !id.isBlank()
                    && fields.get("dob") instanceof String dob && !dob.isBlank();
            return new KycScores(
                    name,
                    String.valueOf(fields.getOrDefault("dob", "")),
                    String.valueOf(fields.getOrDefault("idNumber", "")),
                    requireScore(resp.get("faceMatchScore")),
                    requireScore(resp.get("livenessScore")),
                    requireScore(resp.get("tamperingScore")), trusted,
                    String.valueOf(resp.getOrDefault("explanation", "Identity evidence evaluated by configured service")));
        } catch (Exception e) {
            throw unavailable("KYC", e);
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
            Double sig = hasSpecimen ? requireScore(resp.get("signatureMatchScore")) : null;
            double tamper = requireScore(resp.get("tamperingScore"));
            double fraud = Math.max(tamper, sig == null ? 0.3 : 1.0 - sig);
            return new DocumentScores(ocr, tamper, sig, List.of(), fraud);
        } catch (Exception e) {
            throw unavailable("Document", e);
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
            double anomaly = requireScore(first.get("anomalyScore"));
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
            throw unavailable("Transaction", e);
        }
    }

    private ResponseStatusException unavailable(String operation, Exception cause) {
        log.warn("{} inference unavailable or invalid; failing closed", operation);
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                operation + " inference unavailable or invalid; no synthetic fallback", cause);
    }

    private static double requireScore(Object value) {
        if (value == null) throw new IllegalStateException("Missing inference score");
        double score = Double.parseDouble(value.toString());
        if (!Double.isFinite(score) || score < 0 || score > 1) {
            throw new IllegalStateException("Invalid inference score");
        }
        return score;
    }

}
