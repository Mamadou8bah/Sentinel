package com.sentinel.deployment;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(
        properties = {
            "sentinel.seed-demo=false",
            "spring.jpa.hibernate.ddl-auto=none",
            "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
            "spring.jpa.properties.jakarta.persistence.schema-generation.database.action=none",
            "spring.jpa.properties.jakarta.persistence.schema-generation.scripts.action=create",
            "spring.jpa.properties.jakarta.persistence.schema-generation.scripts.create-target=target/render-schema.sql"
        })
@ActiveProfiles("h2")
@EnabledIfSystemProperty(named = "sentinel.export-schema", matches = "true")
class SchemaExportTest {
    @Test
    void exportCurrentMappingsForFreshDeployment() {}
}
