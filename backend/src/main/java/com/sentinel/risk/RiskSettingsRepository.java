package com.sentinel.risk;

import com.sentinel.tenant.Tenant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RiskSettingsRepository extends JpaRepository<RiskSettings, Long> {
    Optional<RiskSettings> findByTenant(Tenant tenant);

    Optional<RiskSettings> findByTenant_Id(Long tenantId);

    boolean existsByTenant_Id(Long tenantId);
}
