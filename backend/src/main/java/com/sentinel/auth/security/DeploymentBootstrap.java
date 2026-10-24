package com.sentinel.auth.security;

import com.sentinel.auth.model.Role;
import com.sentinel.auth.model.User;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.risk.model.RiskSettings;
import com.sentinel.risk.repository.RiskSettingsRepository;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.repository.TenantRepository;
import com.sentinel.tenant.service.TenantService;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Dashboard-driven first deployment for free hosts without an interactive shell. */
@Component
@ConditionalOnProperty(name = "sentinel.bootstrap.enabled", havingValue = "true")
public class DeploymentBootstrap implements ApplicationRunner {
    private final Environment env;
    private final TenantRepository tenants;
    private final UserRepository users;
    private final RiskSettingsRepository risks;
    private final PasswordEncoder passwords;
    private final TenantService service;

    public DeploymentBootstrap(
            Environment env,
            TenantRepository tenants,
            UserRepository users,
            RiskSettingsRepository risks,
            PasswordEncoder passwords,
            TenantService service) {
        this.env = env;
        this.tenants = tenants;
        this.users = users;
        this.risks = risks;
        this.passwords = passwords;
        this.service = service;
    }

    private String required(String name, int length) {
        String value = env.getProperty(name, "");
        if (value.length() < length)
            throw new IllegalStateException(name + " is missing or too short");
        return value;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        String code = required("SENTINEL_BOOTSTRAP_TENANT_CODE", 3);
        if (tenants.existsByCode(code)) return; // Never reset existing credentials on redeploy.
        String username = required("SENTINEL_BOOTSTRAP_ADMIN_USERNAME", 3);
        String password = required("SENTINEL_BOOTSTRAP_ADMIN_PASSWORD", 14);
        if (password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
            throw new IllegalStateException("Bootstrap password exceeds BCrypt's byte limit");
        String key = required("SENTINEL_BOOTSTRAP_API_KEY", 32);
        String secret = required("SENTINEL_BOOTSTRAP_WEBHOOK_SECRET", 32);
        String callback = required("SENTINEL_BOOTSTRAP_WEBHOOK_URL", 10);
        var uri = java.net.URI.create(callback);
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null)
            throw new IllegalStateException("Bootstrap callback must use HTTPS");
        Tenant tenant = new Tenant();
        tenant.setCode(code);
        tenant.setName("Sutura");
        tenant.setEnabled(true);
        tenant.setWebhookUrl(callback);
        tenant.setWebhookSigningSecret(secret);
        tenant = tenants.save(tenant);
        User admin = new User();
        admin.setTenant(tenant);
        admin.setUsername(username);
        admin.setPasswordHash(passwords.encode(password));
        admin.setRole(Role.ADMIN);
        admin.setEnabled(true);
        users.save(admin);
        RiskSettings settings = new RiskSettings();
        settings.setTenant(tenant);
        risks.save(settings);
        service.issueApiKey(tenant, key, "deployment-integration");
    }
}
