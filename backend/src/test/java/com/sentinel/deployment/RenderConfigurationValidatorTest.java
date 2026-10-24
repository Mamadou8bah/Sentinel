package com.sentinel.deployment;

import static org.junit.jupiter.api.Assertions.*;

import com.sentinel.common.config.RenderConfigurationValidator;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class RenderConfigurationValidatorTest {
    private MockEnvironment valid() {
        return new MockEnvironment()
                .withProperty("sentinel.seed-demo", "false")
                .withProperty("sentinel.ml.stub", "false")
                .withProperty("spring.flyway.enabled", "true")
                .withProperty("spring.jpa.hibernate.ddl-auto", "validate")
                .withProperty("spring.flyway.baseline-on-migrate", "false")
                .withProperty(
                        "sentinel.jwt.secret", "isolated-test-signing-secret-at-least-32-bytes")
                .withProperty(
                        "sentinel.crypto.field-key",
                        "isolated-test-encryption-key-at-least-32-bytes")
                .withProperty(
                        "sentinel.ml.api-key", "isolated-test-inference-key-at-least-32-bytes")
                .withProperty("sentinel.cors-origins", "https://desk.example.com")
                .withProperty("sentinel.hosted.public-base-url", "https://desk.example.com")
                .withProperty("sentinel.ml.cv-base-url", "https://cv.example.com")
                .withProperty("sentinel.ml.transaction-base-url", "https://tx.example.com");
    }

    @Test
    void acceptsExplicitHostedConfiguration() {
        assertDoesNotThrow(() -> new RenderConfigurationValidator(valid()).afterPropertiesSet());
    }

    @Test
    void refusesPublicDefaultsAndWeakSecrets() {
        for (String[] entry :
                new String[][] {
                    {"sentinel.seed-demo", "true"},
                    {"sentinel.ml.stub", "true"},
                    {"sentinel.cors-origins", "*"},
                    {"sentinel.ml.api-key", "private-short"},
                    {"sentinel.ml.cv-base-url", "http://localhost:8001"},
                    {"spring.jpa.hibernate.ddl-auto", "update"}
                }) {
            var failure =
                    assertThrows(
                            IllegalStateException.class,
                            () ->
                                    new RenderConfigurationValidator(
                                                    valid().withProperty(entry[0], entry[1]))
                                            .afterPropertiesSet());
            assertFalse(failure.toString().contains("private-short"));
        }
    }
}
