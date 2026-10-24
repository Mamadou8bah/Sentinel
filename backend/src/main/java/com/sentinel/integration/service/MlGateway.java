package com.sentinel.integration.service;

import com.sentinel.common.config.SentinelProperties;
import com.sentinel.integration.service.StubMlService.DocumentScores;
import com.sentinel.integration.service.StubMlService.KycScores;
import com.sentinel.integration.service.StubMlService.TxScores;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Facade over explicitly configured stub ML or live Python services. Live inference failures never
 * fall back to synthetic decisions.
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
        cvTimeouts.setReadTimeout(30000);
        var txTimeouts = new SimpleClientHttpRequestFactory();
        txTimeouts.setConnectTimeout(1000);
        txTimeouts.setReadTimeout(2500);
        this.cvClient =
                RestClient.builder()
                        .defaultHeader("X-ML-API-Key", properties.getMl().getApiKey())
                        .requestFactory(cvTimeouts)
                        .baseUrl(properties.getMl().getCvBaseUrl())
                        .build();
        this.txClient =
                RestClient.builder()
                        .defaultHeader("X-ML-API-Key", properties.getMl().getApiKey())
                        .requestFactory(txTimeouts)
                        .baseUrl(properties.getMl().getTransactionBaseUrl())
                        .build();
    }

    public record LivenessChallenge(String id, String hint, java.time.Instant expiresAt) {}

    public LivenessChallenge startLivenessChallenge() {
        if (properties.getMl().isStub()) {
            return new LivenessChallenge(
                    "chal_" + java.util.UUID.randomUUID(),
                    "LOOK_FORWARD, TURN_LEFT, TURN_RIGHT",
                    java.time.Instant.now().plusSeconds(1800));
        }
        try {
            Map<String, Object> response =
                    cvClient.post()
                            .uri("/cv/liveness/challenge")
                            .retrieve()
                            .body(new ParameterizedTypeReference<>() {});
            if (response == null
                    || !(response.get("challengeId") instanceof String id)
                    || id.isBlank()
                    || id.length() > 64
                    || !(response.get("instructions") instanceof List<?> instructions)
                    || instructions.isEmpty()
                    || instructions.stream()
                            .anyMatch(
                                    i ->
                                            !List.of("LOOK_FORWARD", "TURN_LEFT", "TURN_RIGHT")
                                                    .contains(i))) {
                throw new IllegalStateException("Invalid liveness challenge");
            }
            java.time.Instant expiry =
                    java.time.Instant.parse(String.valueOf(response.get("expiresAt")));
            if (!expiry.isAfter(java.time.Instant.now()))
                throw new IllegalStateException("Expired liveness challenge");
            return new LivenessChallenge(
                    id,
                    String.join(", ", instructions.stream().map(String::valueOf).toList()),
                    expiry);
        } catch (Exception e) {
            throw unavailable("Liveness challenge", e);
        }
    }

    public KycScores scoreKyc(
            String externalCustomerId,
            String providedName,
            String idImageBase64,
            String selfieImageBase64) {
        return scoreKyc(
                externalCustomerId,
                providedName,
                idImageBase64,
                selfieImageBase64,
                null,
                List.of());
    }

    public KycScores scoreKyc(
            String externalCustomerId,
            String providedName,
            String idImageBase64,
            String selfieImageBase64,
            String challengeId,
            List<String> frames) {
        if (properties.getMl().isStub()) {
            return stubMlService.scoreKyc(externalCustomerId, providedName);
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("idImage", idImageBase64 == null ? "" : idImageBase64);
            body.put("selfieImage", selfieImageBase64 == null ? "" : selfieImageBase64);
            if (challengeId != null) body.put("challengeId", challengeId);
            if (frames != null && !frames.isEmpty()) body.put("frames", frames);
            Map<String, Object> resp =
                    cvClient.post()
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
                    resp.get("extractedFields") instanceof Map<?, ?> m
                            ? (Map<String, Object>) m
                            : Map.of();
            String name =
                    providedName != null && !providedName.isBlank()
                            ? providedName
                            : String.valueOf(fields.getOrDefault("name", "Unknown"));
            // Legacy still captures cannot establish continuous-recording evidence.
            boolean trusted = false;
            return new KycScores(
                    name,
                    String.valueOf(fields.getOrDefault("dob", "")),
                    String.valueOf(fields.getOrDefault("idNumber", "")),
                    requireScore(resp.get("faceMatchScore")),
                    requireScore(resp.get("livenessScore")),
                    requireScore(resp.get("tamperingScore")),
                    trusted,
                    String.valueOf(
                            resp.getOrDefault(
                                    "explanation",
                                    "Identity evidence evaluated by configured service")));
        } catch (Exception e) {
            throw unavailable("KYC", e);
        }
    }

    public KycScores scoreRecordingKyc(
            String customer, String name, String document, String recording, String challengeId) {
        if (recording == null
                || recording.length() > 10666768
                || challengeId == null
                || challengeId.isBlank())
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "A challenge-bound recording is required");
        byte[] bytes;
        try {
            bytes =
                    java.util.Base64.getDecoder()
                            .decode(
                                    recording.contains(",")
                                            ? recording.substring(recording.indexOf(',') + 1)
                                            : recording);
        } catch (IllegalArgumentException invalid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid recording encoding");
        }
        boolean webm =
                bytes.length >= 4
                        && (bytes[0] & 255) == 0x1a
                        && (bytes[1] & 255) == 0x45
                        && (bytes[2] & 255) == 0xdf
                        && (bytes[3] & 255) == 0xa3;
        boolean mp4 =
                bytes.length >= 12
                        && bytes[4] == 'f'
                        && bytes[5] == 't'
                        && bytes[6] == 'y'
                        && bytes[7] == 'p';
        if (bytes.length > 8000000 || (!webm && !mp4))
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Use an MP4 or WebM recording smaller than 8 MB");
        if (properties.getMl().isStub()) return stubMlService.scoreKyc(customer, name);
        try {
            var response =
                    cvClient.post()
                            .uri("/cv/kyc-verify-recording")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(
                                    Map.of(
                                            "idImage",
                                            document,
                                            "videoBase64",
                                            recording,
                                            "challengeId",
                                            challengeId))
                            .retrieve()
                            .body(new ParameterizedTypeReference<Map<String, Object>>() {});
            if (response == null) throw new IllegalStateException("Empty recording response");
            String hash =
                    java.util.HexFormat.of()
                            .formatHex(
                                    java.security.MessageDigest.getInstance("SHA-256")
                                            .digest(bytes));
            if (!"recording-face-v2".equals(response.get("pipeline"))
                    || !challengeId.equals(response.get("challengeId"))
                    || !hash.equals(response.get("recordingSha256")))
                throw new IllegalStateException(
                        "Recording response does not match the submitted challenge/evidence");
            Map<?, ?> fields =
                    response.get("extractedFields") instanceof Map<?, ?> f ? f : Map.of();
            String identifier = fields.get("idNumber") instanceof String value ? value : "",
                    dob = fields.get("dob") instanceof String value ? value : "";
            boolean trusted =
                    Boolean.TRUE.equals(response.get("modelRan"))
                            && Boolean.TRUE.equals(response.get("qualityOk"))
                            && Boolean.FALSE.equals(response.get("spoofLikely"))
                            && !identifier.isBlank()
                            && !dob.isBlank()
                            && response.get("sampledFrames") instanceof Number count
                            && count.intValue() >= 25;
            return new KycScores(
                    name == null || name.isBlank() ? "Unknown" : name,
                    dob,
                    identifier,
                    requireScore(response.get("faceMatchScore")),
                    requireScore(response.get("livenessScore")),
                    requireScore(response.get("tamperingScore")),
                    trusted,
                    String.valueOf(
                            response.getOrDefault("explanation", "Recording evidence evaluated")));
        } catch (org.springframework.web.client.HttpClientErrorException invalid) {
            if (invalid.getStatusCode().value() == 422)
                throw new ResponseStatusException(
                        HttpStatus.UNPROCESSABLE_ENTITY,
                        "Recording could not be verified. Keep one face visible and follow each"
                                + " prompt, then record again.");
            if (invalid.getStatusCode().value() == 409)
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "This challenge is bound to different evidence. Start a new verification"
                                + " session.");
            throw unavailable("Recording KYC", invalid);
        } catch (Exception failure) {
            throw unavailable("Recording KYC", failure);
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
            return stubMlService.scoreDocument(
                    docType, hasSpecimen, customerName, externalCustomerId);
        }
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("documentImage", documentImageBase64 == null ? "" : documentImageBase64);
            body.put("docType", docType);
            if (hasSpecimen && referenceSignatureBase64 != null) {
                body.put("referenceSignature", referenceSignatureBase64);
            }
            Map<String, Object> resp =
                    cvClient.post()
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
                    resp.get("extractedFields") instanceof Map<?, ?> m
                            ? (Map<String, Object>) m
                            : Map.of();
            Double sig = hasSpecimen ? requireScore(resp.get("signatureMatchScore")) : null;
            double tamper = requireScore(resp.get("tamperingScore"));
            double fraud = Math.max(tamper, sig == null ? 0.3 : 1.0 - sig);
            return new DocumentScores(ocr, tamper, sig, List.of(), fraud);
        } catch (Exception e) {
            throw unavailable("Document", e);
        }
    }

    public TxScores scoreTransaction(
            double amount,
            String channel,
            String externalCustomerId,
            Map<String, Object> features) {
        if (properties.getMl().isStub()) {
            return stubMlService.scoreTransaction(amount, channel, externalCustomerId);
        }
        try {
            Map<String, Object> tx = new LinkedHashMap<>(features);
            tx.put("amount", amount);
            tx.put("channel", channel);
            tx.put("externalCustomerId", externalCustomerId);
            Map<String, Object> body = Map.of("transactions", List.of(tx));
            Map<String, Object> resp =
                    txClient.post()
                            .uri("/ml/transaction-score")
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(body)
                            .retrieve()
                            .body(new ParameterizedTypeReference<>() {});
            if (resp == null
                    || !(resp.get("scores") instanceof List<?> scores)
                    || scores.isEmpty()) {
                throw new IllegalStateException("Empty TX ML response");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> first = (Map<String, Object>) scores.get(0);
            double anomaly = requireScore(first.get("anomalyScore"));
            List<String> flags =
                    first.get("ruleFlags") instanceof List<?> l
                            ? l.stream().map(String::valueOf).toList()
                            : List.of();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> shap =
                    first.get("shapTopFeatures") instanceof List<?> l
                            ? (List<Map<String, Object>>) l
                            : List.of();
            String explanation =
                    first.get("explanation") != null
                            ? String.valueOf(first.get("explanation"))
                            : (flags.isEmpty()
                                    ? "Model scored transaction"
                                    : "Triggered: " + String.join(", ", flags));
            boolean modelFlagged = Boolean.TRUE.equals(first.get("modelFlagged"));
            if (modelFlagged
                    && (!Boolean.TRUE.equals(first.get("modelRan"))
                            || requireScore(first.get("modelScore"))
                                    < requireScore(first.get("modelThreshold")))) {
                throw new IllegalStateException(
                        "Invalid threshold decision from transaction model");
            }
            return new TxScores(anomaly, flags, explanation, shap, modelFlagged);
        } catch (Exception e) {
            throw unavailable("Transaction", e);
        }
    }

    private ResponseStatusException unavailable(String operation, Exception cause) {
        log.warn("{} inference unavailable or invalid; failing closed", operation);
        return new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                operation + " inference unavailable or invalid; no synthetic fallback",
                cause);
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
