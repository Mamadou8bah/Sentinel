package com.sentinel.integration;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.sentinel.common.config.SentinelProperties;
import com.sentinel.integration.service.MlGateway;
import com.sentinel.integration.service.StubMlService;
import com.sun.net.httpserver.HttpServer;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;

class MlGatewayTest {
    private HttpServer server;
    private MlGateway gateway;
    private StubMlService stub;
    private int status = 503;
    private String body = "{}";
    private volatile String receivedKey;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    receivedKey = exchange.getRequestHeaders().getFirst("X-ML-API-Key");
                    exchange.getRequestBody().readAllBytes();
                    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                    exchange.getResponseHeaders().set("Content-Type", "application/json");
                    exchange.sendResponseHeaders(status, bytes.length);
                    exchange.getResponseBody().write(bytes);
                    exchange.close();
                });
        server.start();
        var properties = new SentinelProperties();
        properties.getMl().setStub(false);
        properties.getMl().setApiKey("test-inference-service-key");
        String url = "http://127.0.0.1:" + server.getAddress().getPort();
        properties.getMl().setCvBaseUrl(url);
        properties.getMl().setTransactionBaseUrl(url);
        stub = mock(StubMlService.class);
        gateway = new MlGateway(properties, stub);
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void disabledMlRefusesAllInferenceWithoutNetworkOrStubCalls() {
        var properties = new SentinelProperties();
        properties.getMl().setEnabled(false);
        properties.getMl().setStub(true); // Disabling takes precedence over every inference mode.
        var disabled = new MlGateway(properties, stub);
        java.util.List<Runnable> calls =
                java.util.List.of(
                        () -> disabled.startLivenessChallenge(),
                        () -> disabled.scoreKyc("7", "Customer", "id", "selfie"),
                        () ->
                                disabled.scoreRecordingKyc(
                                        "7", "Customer", "id", "video", "challenge"),
                        () -> disabled.scoreDocument("ID", false, "Customer", "7", "id", null),
                        () -> disabled.scoreTransaction(100, "api", "7", Map.of()));
        for (Runnable call : calls) {
            assertThatThrownBy(call::run)
                    .isInstanceOfSatisfying(
                            ResponseStatusException.class,
                            error -> assertThat(error.getStatusCode().value()).isEqualTo(503));
        }
        verifyNoInteractions(stub);
        assertThat(receivedKey).isNull();
    }

    @Test
    void failedLiveKycNeverUsesSyntheticVerification() {
        assertThatThrownBy(() -> gateway.scoreKyc("7", "Customer", "id", "selfie"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        ex -> assertThat(ex.getStatusCode().value()).isEqualTo(503));
        verifyNoInteractions(stub);
    }

    @Test
    void failedLiveScoringNeverUsesSyntheticAllow() {
        assertThatThrownBy(() -> gateway.scoreTransaction(100, "api", "7", Map.of()))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(stub);
    }

    @Test
    void missingLivenessCannotVerify() {
        status = 200;
        body = "{\"faceMatchScore\":0.99,\"tamperingScore\":0.1}";
        assertThatThrownBy(() -> gateway.scoreKyc("7", "Customer", "id", "selfie"))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(stub);
    }

    @Test
    void missingAnomalyCannotDefaultToLowRisk() {
        status = 200;
        body = "{\"scores\":[{}]}";
        assertThatThrownBy(() -> gateway.scoreTransaction(100, "api", "7", Map.of()))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(stub);
    }

    @Test
    void highScoresWithoutModelsOrQualityCannotGrantTrustedEvidence() {
        status = 200;
        body =
                """
                {"extractedFields":{"dob":"1990-01-01","idNumber":"TEST-ID"},
                 "faceMatchScore":0.99,"livenessScore":0.99,"tamperingScore":0.1,
                 "modelRan":false,"qualityOk":true,"spoofLikely":false}
                """;
        assertThat(
                        gateway.scoreKyc(
                                        "7",
                                        "Customer",
                                        "id",
                                        "selfie",
                                        "challenge",
                                        java.util.List.of("a", "b", "c"))
                                .evidenceTrusted())
                .isFalse();
        body =
                body.replace("\"modelRan\":false", "\"modelRan\":true")
                        .replace("\"qualityOk\":true", "\"qualityOk\":false");
        assertThat(
                        gateway.scoreKyc(
                                        "7",
                                        "Customer",
                                        "id",
                                        "selfie",
                                        "challenge",
                                        java.util.List.of("a", "b", "c"))
                                .evidenceTrusted())
                .isFalse();
    }

    @Test
    void stillImageCannotGrantTrustedEvidenceEvenWithHighProviderScores() {
        status = 200;
        body =
                """
                {"extractedFields":{"dob":"1990-01-01","idNumber":"TEST-ID"},
                 "faceMatchScore":0.99,"livenessScore":0.99,"tamperingScore":0.1,
                 "modelRan":true,"qualityOk":true,"spoofLikely":false}
                """;
        assertThat(gateway.scoreKyc("7", "Customer", "id", "selfie").evidenceTrusted()).isFalse();
        body = body.replace("\"spoofLikely\":false", "\"spoofLikely\":true");
        assertThat(
                        gateway.scoreKyc(
                                        "7",
                                        "Customer",
                                        "id",
                                        "selfie",
                                        "challenge",
                                        java.util.List.of("a", "b", "c"))
                                .evidenceTrusted())
                .isFalse();
    }

    @Test
    void validationThresholdFlagSurvivesEvenBelowTenantAnomalyThreshold() {
        status = 200;
        body =
                """
                {"scores":[{"anomalyScore":0.2,"modelRan":true,"modelFlagged":true,
                  "modelScore":0.15,"modelThreshold":0.1,"ruleFlags":[],"shapTopFeatures":[]}]}
                """;
        var result =
                gateway.scoreTransaction(100, "api", "7", Map.of("transactionType", "TRANSFER"));
        assertThat(result.modelFlagged()).isTrue();
        assertThat(result.anomalyScore()).isEqualTo(.2);
        body = body.replace("\"modelRan\":true", "\"modelRan\":false");
        assertThatThrownBy(() -> gateway.scoreTransaction(100, "api", "7", Map.of()))
                .isInstanceOf(ResponseStatusException.class);
    }

    @Test
    void syntheticEvidenceNeverPassesIdentityChecksAndDoesNotInventShap() {
        var demo = new StubMlService();
        assertThat(demo.scoreKyc("7", "Customer").faceMatch()).isZero();
        assertThat(demo.scoreKyc("7", "Customer").liveness()).isZero();
        var tx = demo.scoreTransaction(100, "api", "7");
        assertThat(tx.explanation()).contains("no trained model");
        assertThat(tx.shapTopFeatures()).isEmpty();
    }

    @Test
    void recordingScoresMustMatchEvidenceAndCannotVerifyWithoutModels() throws Exception {
        byte[] bytes = new byte[] {0, 0, 0, 24, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'};
        String recording = java.util.Base64.getEncoder().encodeToString(bytes);
        String hash =
                java.util.HexFormat.of()
                        .formatHex(
                                java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
        status = 200;
        body =
                """
        {"pipeline":"recording-face-v2","challengeId":"challenge","recordingSha256":"%s","sampledFrames":36,
         "faceMatchScore":0.99,"livenessScore":0.99,"tamperingScore":0.01,"qualityOk":true,"spoofLikely":false,"modelRan":true,
         "extractedFields":{"idNumber":"TEST123","dob":"1990-01-01"}}
        """
                        .formatted(hash);
        assertThat(
                        gateway.scoreRecordingKyc("7", "Customer", "id", recording, "challenge")
                                .evidenceTrusted())
                .isTrue();
        body = body.replace("\"modelRan\":true", "\"modelRan\":false");
        assertThat(
                        gateway.scoreRecordingKyc("7", "Customer", "id", recording, "challenge")
                                .evidenceTrusted())
                .isFalse();
        body = body.replace(hash, "different-hash");
        assertThatThrownBy(
                        () ->
                                gateway.scoreRecordingKyc(
                                        "7", "Customer", "id", recording, "challenge"))
                .isInstanceOf(ResponseStatusException.class);
        verifyNoInteractions(stub);
    }

    @Test
    void invalidRecordingNeverReachesInference() {
        assertThatThrownBy(
                        () ->
                                gateway.scoreRecordingKyc(
                                        "7", "Customer", "id", "not-video", "challenge"))
                .isInstanceOfSatisfying(
                        ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode().value()).isEqualTo(400));
        verifyNoInteractions(stub);
    }

    @Test
    void forwardsInferenceSecretToBothRemoteServices() {
        assertThatThrownBy(() -> gateway.scoreKyc("7", "Customer", "id", "selfie"))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(receivedKey).isEqualTo("test-inference-service-key");
        receivedKey = null;
        assertThatThrownBy(() -> gateway.scoreTransaction(100, "api", "7", Map.of()))
                .isInstanceOf(ResponseStatusException.class);
        assertThat(receivedKey).isEqualTo("test-inference-service-key");
    }
}
