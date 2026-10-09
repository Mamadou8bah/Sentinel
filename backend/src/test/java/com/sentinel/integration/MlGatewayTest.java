package com.sentinel.integration;

import com.sentinel.common.config.SentinelProperties;
import com.sentinel.integration.service.MlGateway;
import com.sentinel.integration.service.StubMlService;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MlGatewayTest {
    private HttpServer server;
    private MlGateway gateway;
    private StubMlService stub;
    private int status = 503;
    private String body = "{}";

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
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
    void failedLiveKycNeverUsesSyntheticVerification() {
        assertThatThrownBy(() -> gateway.scoreKyc("7", "Customer", "id", "selfie"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
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
        body = """
                {"extractedFields":{"dob":"1990-01-01","idNumber":"TEST-ID"},
                 "faceMatchScore":0.99,"livenessScore":0.99,"tamperingScore":0.1,
                 "modelRan":false,"qualityOk":true,"spoofLikely":false}
                """;
        assertThat(gateway.scoreKyc("7", "Customer", "id", "selfie", "challenge", java.util.List.of("a", "b", "c"))
                .evidenceTrusted()).isFalse();
        body = body.replace("\"modelRan\":false", "\"modelRan\":true").replace("\"qualityOk\":true", "\"qualityOk\":false");
        assertThat(gateway.scoreKyc("7", "Customer", "id", "selfie", "challenge", java.util.List.of("a", "b", "c"))
                .evidenceTrusted()).isFalse();
    }

    @Test
    void stillImageCannotGrantTrustedEvidenceEvenWithHighProviderScores() {
        status = 200;
        body = """
                {"extractedFields":{"dob":"1990-01-01","idNumber":"TEST-ID"},
                 "faceMatchScore":0.99,"livenessScore":0.99,"tamperingScore":0.1,
                 "modelRan":true,"qualityOk":true,"spoofLikely":false}
                """;
        assertThat(gateway.scoreKyc("7", "Customer", "id", "selfie").evidenceTrusted()).isFalse();
        body = body.replace("\"spoofLikely\":false", "\"spoofLikely\":true");
        assertThat(gateway.scoreKyc("7", "Customer", "id", "selfie", "challenge", java.util.List.of("a", "b", "c"))
                .evidenceTrusted()).isFalse();
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
}
