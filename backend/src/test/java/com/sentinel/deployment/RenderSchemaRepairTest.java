package com.sentinel.deployment;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** PostgreSQL-only migration regression; every test transaction is rolled back. */
@EnabledIfEnvironmentVariable(
        named = "SENTINEL_DEPLOYMENT_TEST_URL",
        matches = "jdbc:postgresql://127\\.0\\.0\\.1:[0-9]{1,5}/sentinel_render_[a-z0-9_]+_test.*")
class RenderSchemaRepairTest {
    private String migration(String name) throws Exception {
        try (var input = getClass().getResourceAsStream("/db/render/" + name)) {
            assertNotNull(input);
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test void movesRowsAndOwnedSequencesWithoutDeletingData() throws Exception { check(false, false); }
    @Test void correctSchemaIsUnchangedOnRepeatedRepair() throws Exception { check(true, false); }
    @Test void incompatiblePublicTableAbortsRepair() throws Exception { check(false, true); }

    private void check(boolean fresh, boolean incompatible) throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        String source = "repair_source_" + suffix;
        String target = "repair_target_" + suffix;
        try (var connection = DriverManager.getConnection(
                System.getenv("SENTINEL_DEPLOYMENT_TEST_URL"),
                System.getenv().getOrDefault("SENTINEL_DEPLOYMENT_TEST_USER", "validation"),
                "local-test-only")) {
            connection.setAutoCommit(false);
            try (var sql = connection.createStatement()) {
                sql.execute("CREATE SCHEMA " + source);
                sql.execute("CREATE SCHEMA " + target);
                sql.execute("SET LOCAL search_path TO " + (fresh ? target : source));
                sql.execute(migration("V1__fresh_sentinel.sql"));
                String original = fresh ? target : source;
                sql.execute("INSERT INTO " + original + ".tenants(enabled,created_at,code,name)"
                        + " VALUES(true,now(),'retained','Retained tenant')");
                String repair = migration("V2__repair_pooled_schema.sql")
                        .replace("'sentinel'", "'" + target + "'")
                        .replace("'public'", "'" + source + "'");
                if (incompatible) {
                    sql.execute("ALTER TABLE " + source + ".audit_logs ADD COLUMN unrelated_field text");
                    assertThrows(SQLException.class, () -> sql.execute(repair));
                } else {
                    sql.execute(repair);
                    sql.execute(repair);
                    try (var rows = sql.executeQuery("SELECT code FROM " + target + ".tenants")) {
                        assertTrue(rows.next()); assertEquals("retained", rows.getString(1));
                    }
                    sql.execute("INSERT INTO " + target + ".tenants(enabled,created_at,code,name)"
                            + " VALUES(true,now(),'next','Next tenant')");
                    try (var rows = sql.executeQuery("SELECT max(id) FROM " + target + ".tenants")) {
                        assertTrue(rows.next()); assertEquals(2L, rows.getLong(1));
                    }
                }
            } finally { connection.rollback(); }
        }
    }
}
