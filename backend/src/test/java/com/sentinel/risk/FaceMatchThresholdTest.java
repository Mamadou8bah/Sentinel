package com.sentinel.risk;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import com.sentinel.customer.model.KycStatus;
import com.sentinel.risk.model.RiskSettings;
import com.sentinel.risk.repository.RiskSettingsRepository;
import com.sentinel.risk.service.RiskEngine;
import org.junit.jupiter.api.Test;

class FaceMatchThresholdTest {
    private final RiskEngine engine = new RiskEngine(mock(RiskSettingsRepository.class));

    @Test void acceptsHalfSimilarityInclusivelyButNotBelowTheThreshold() {
        var settings = new RiskSettings();
        assertEquals(.5, settings.getFaceMatchThreshold());
        assertEquals(KycStatus.VERIFIED, engine.decideKycStatus(.5,.98,settings));
        assertEquals(KycStatus.VERIFIED, engine.decideKycStatus(.51,.98,settings));
        assertNotEquals(KycStatus.VERIFIED, engine.decideKycStatus(.499,.98,settings));
    }

    @Test void matchingFaceDoesNotBypassLivenessOrAnExplicitTenantPolicy() {
        var settings = new RiskSettings();
        assertEquals(KycStatus.REJECTED, engine.decideKycStatus(.5,0.,settings));
        assertNotEquals(KycStatus.VERIFIED, engine.decideKycStatus(.5,.6,settings));
        settings.setFaceMatchThreshold(.8);
        assertNotEquals(KycStatus.VERIFIED, engine.decideKycStatus(.5,.98,settings));
    }

    @Test void migrationUpdatesExistingSuturaSettingsAndPreservesOtherTenants() throws Exception {
        try (var connection = java.sql.DriverManager.getConnection("jdbc:h2:mem:face_threshold_policy;MODE=PostgreSQL");
             var statement = connection.createStatement()) {
            statement.execute("create table tenants(id bigint primary key,code varchar(64))");
            statement.execute("create table risk_settings(tenant_id bigint,face_match_threshold double precision default 0.80)");
            statement.execute("insert into tenants values(1,'sutura'),(2,'another-bank'),(3,'new-bank')");
            statement.execute("insert into risk_settings values(1,.8),(2,.8)");
            try (var resource = getClass().getResourceAsStream("/db/migration/V4__sutura_face_match_threshold.sql")) {
                assertNotNull(resource);
                for (String sql : new String(resource.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8).split(";"))
                    if (!sql.isBlank()) statement.execute(sql);
            }
            statement.execute("insert into risk_settings(tenant_id) values(3)");
            try (var rows = statement.executeQuery("select face_match_threshold from risk_settings order by tenant_id")) {
                assertTrue(rows.next()); assertEquals(.5,rows.getDouble(1));
                assertTrue(rows.next()); assertEquals(.8,rows.getDouble(1));
                assertTrue(rows.next()); assertEquals(.5,rows.getDouble(1));
            }
        }
    }
}
