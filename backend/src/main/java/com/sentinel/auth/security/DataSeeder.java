package com.sentinel.auth.security;


import com.sentinel.auth.model.Role;
import com.sentinel.auth.model.User;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.risk.model.RiskSettings;
import com.sentinel.risk.repository.RiskSettingsRepository;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.model.TenantApiKey;
import com.sentinel.tenant.repository.TenantApiKeyRepository;
import com.sentinel.tenant.repository.TenantRepository;
import com.sentinel.tenant.service.TenantService;
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
    /** Documented demo key — hashed at rest; shown in logs once when seeded. */
    public static final String DEMO_API_KEY = "sen_demo_bank_local_dev_key_do_not_use_prod";

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final RiskSettingsRepository riskSettingsRepository;
    private final TenantApiKeyRepository apiKeyRepository;
    private final TenantService tenantService;

    public DataSeeder(
            TenantRepository tenantRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            RiskSettingsRepository riskSettingsRepository,
            TenantApiKeyRepository apiKeyRepository,
            TenantService tenantService) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.riskSettingsRepository = riskSettingsRepository;
        this.apiKeyRepository = apiKeyRepository;
        this.tenantService = tenantService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Tenant tenant = ensureDemoTenant();
        seedUser(tenant, "admin", Role.ADMIN);
        seedUser(tenant, "compliance", Role.COMPLIANCE);
        seedUser(tenant, "analyst", Role.ANALYST);
        ensureRiskSettings(tenant);
        ensureDemoApiKey(tenant);

        log.info(
                "Demo tenant '{}' ready — users admin / compliance / analyst (password: {})",
                DEMO_TENANT_CODE,
                DEMO_PASSWORD);
        log.info("Demo integration API key (X-Api-Key): {}", DEMO_API_KEY);
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

    private void ensureDemoApiKey(Tenant tenant) {
        if (apiKeyRepository.existsByTenant_Id(tenant.getId())) {
            return;
        }
        TenantApiKey key = tenantService.issueApiKey(tenant, DEMO_API_KEY, "demo-seed");
        log.info("Seeded demo API key id={} for tenant '{}'", key.getId(), tenant.getCode());
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
