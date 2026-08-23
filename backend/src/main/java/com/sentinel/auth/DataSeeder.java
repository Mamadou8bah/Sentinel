package com.sentinel.auth;

import com.sentinel.risk.RiskSettings;
import com.sentinel.risk.RiskSettingsRepository;
import com.sentinel.tenant.Tenant;
import com.sentinel.tenant.TenantRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final String DEMO_PASSWORD = "ChangeMe123!";
    private static final String DEMO_TENANT_CODE = "demo-bank";

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RiskSettingsRepository riskSettingsRepository;

    public DataSeeder(
            TenantRepository tenantRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            RiskSettingsRepository riskSettingsRepository) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.riskSettingsRepository = riskSettingsRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Tenant tenant = ensureDemoTenant();
        seedUser(tenant, "admin", Role.ADMIN);
        seedUser(tenant, "compliance", Role.COMPLIANCE);
        seedUser(tenant, "analyst", Role.ANALYST);
        ensureRiskSettings(tenant);

        log.info(
                "Demo tenant '{}' ready — users admin / compliance / analyst (password: {})",
                DEMO_TENANT_CODE,
                DEMO_PASSWORD);
    }

    private Tenant ensureDemoTenant() {
        return tenantRepository
                .findByCode(DEMO_TENANT_CODE)
                .orElseGet(() -> {
                    Tenant t = new Tenant();
                    t.setCode(DEMO_TENANT_CODE);
                    t.setName("Demo Bank");
                    t.setEnabled(true);
                    Tenant saved = tenantRepository.save(t);
                    log.info("Seeded tenant '{}'", DEMO_TENANT_CODE);
                    return saved;
                });
    }

    private void ensureRiskSettings(Tenant tenant) {
        if (riskSettingsRepository.existsByTenant_Id(tenant.getId())) {
            return;
        }
        RiskSettings settings = new RiskSettings();
        settings.setTenant(tenant);
        riskSettingsRepository.save(settings);
        log.info("Seeded risk_settings for tenant '{}'", tenant.getCode());
    }

    private void seedUser(Tenant tenant, String username, Role role) {
        if (userRepository.existsByTenant_IdAndUsername(tenant.getId(), username)) {
            return;
        }
        User user = new User();
        user.setTenant(tenant);
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(DEMO_PASSWORD));
        user.setRole(role);
        user.setEnabled(true);
        userRepository.save(user);
        log.info("Seeded user '{}' ({}) for tenant '{}'", username, role, tenant.getCode());
    }
}
