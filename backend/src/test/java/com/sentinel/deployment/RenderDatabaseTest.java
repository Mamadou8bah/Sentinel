package com.sentinel.deployment;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(
        properties = {
            "spring.datasource.url=${SENTINEL_DEPLOYMENT_TEST_URL}",
            "spring.datasource.username=${SENTINEL_DEPLOYMENT_TEST_USER:validation}",
            "spring.datasource.password=local-test-only",
            "sentinel.jwt.secret=isolated-local-deployment-test-key-at-least-32-bytes",
            "sentinel.crypto.field-key=isolated-local-encryption-test-key",
            "sentinel.ml.api-key=isolated-local-ml-service-test-secret-32-bytes",
            "sentinel.ml.cv-base-url=https://cv.example.com",
            "sentinel.ml.transaction-base-url=https://tx.example.com",
            "sentinel.cors-origins=https://desk.example.com",
            "sentinel.hosted.public-base-url=https://desk.example.com"
        })
@ActiveProfiles("render")
@EnabledIfEnvironmentVariable(
        named = "SENTINEL_DEPLOYMENT_TEST_URL",
        matches = "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]{1,5}/sentinel_render_[a-z0-9_]+_test.*")
class RenderDatabaseTest {
    @Autowired JdbcTemplate jdbc;

    @Test
    void freshMigrationValidatesWithoutDemoAccounts() {
        assertEquals(
                1,
                jdbc.queryForObject(
                        "select count(*) from sentinel.flyway_schema_history where success=true and"
                            + " version='1'",
                        Integer.class));
        assertEquals(0, jdbc.queryForObject("select count(*) from sentinel.users", Integer.class));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "select count(*) from sentinel.tenant_api_keys", Integer.class));
        assertNotNull(
                jdbc.queryForObject(
                        "select to_regclass('sentinel.webhook_deliveries')::text", String.class));
    }
}
