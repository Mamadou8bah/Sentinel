package com.sentinel.risk.repository;


import com.sentinel.risk.model.RiskSettings;
import com.sentinel.tenant.model.Tenant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RiskSettingsRepository extends JpaRepository<RiskSettings, Long> {
    Optional<RiskSettings> findByTenant(Tenant tenant);

    Optional<RiskSettings> findByTenant_Id(Long tenantId);

    boolean existsByTenant_Id(Long tenantId);
}
