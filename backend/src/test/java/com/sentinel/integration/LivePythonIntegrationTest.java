package com.sentinel.integration;

import com.sentinel.common.config.SentinelProperties;
import com.sentinel.integration.service.MlGateway;
import com.sentinel.integration.service.StubMlService;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.assertj.core.api.Assertions.*;

/** Opt in with local Python services running; ordinary unit runs do not need them. */
@EnabledIfEnvironmentVariable(named = "SENTINEL_LIVE_PYTHON_TEST", matches = "true")
class LivePythonIntegrationTest {
    private MlGateway gateway() {
        var properties = new SentinelProperties();
        properties.getMl().setStub(false);
        properties.getMl().setCvBaseUrl(System.getenv().getOrDefault("CV_ML_BASE_URL", "http://127.0.0.1:18001"));
        properties.getMl().setTransactionBaseUrl(System.getenv().getOrDefault("TRANSACTION_ML_BASE_URL", "http://127.0.0.1:18002"));
        return new MlGateway(properties, new StubMlService());
    }

    @Test void realTrainedServiceReturnsMeasuredScoreAndShap() {
        var result = gateway().scoreTransaction(100, "api", "synthetic-7",
                Map.of("timestamp", "2026-10-07T12:00:00Z", "currency", "GMD"));
        assertThat(result.anomalyScore()).isBetween(0.0, 1.0);
        assertThat(result.shapTopFeatures()).hasSize(3);
        assertThat(result.explanation()).contains("synthetic-generator-v1", "Model");
        var high = gateway().scoreTransaction(50_000, "api", "synthetic-7",
                Map.of("timestamp", "2026-10-07T12:00:00Z", "currency", "GMD"));
        assertThat(high.anomalyScore()).isGreaterThanOrEqualTo(.9);
        assertThat(high.ruleFlags()).contains("AMOUNT_OUTLIER");
    }

    @Test void realIdentityServiceBindsFramesButCannotInventVerification() throws Exception {
        var gateway = gateway();
        var challenge = gateway.startLivenessChallenge();
        var frames = List.of(image(1), image(2), image(3));
        var result = gateway.scoreKyc("synthetic-7", "Synthetic Test", image(4), frames.get(2), challenge.id(), frames);
        assertThat(result.faceMatch()).isZero();
        assertThat(result.liveness()).isZero();
        assertThat(result.evidenceTrusted()).isFalse();
        assertThat(result.explanation()).contains("models unavailable");
    }

    private String image(int seed) throws Exception {
        var image = new BufferedImage(96, 96, BufferedImage.TYPE_INT_RGB);
        for (int x = 0; x < 96; x++) for (int y = 0; y < 96; y++) image.setRGB(x, y, (x * 1000 + y * 17) * seed);
        var bytes = new ByteArrayOutputStream();
        ImageIO.write(image, "PNG", bytes);
        return Base64.getEncoder().encodeToString(bytes.toByteArray());
    }
}
