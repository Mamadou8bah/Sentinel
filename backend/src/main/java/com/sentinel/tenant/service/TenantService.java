package com.sentinel.tenant.service;


import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.model.TenantApiKey;
import com.sentinel.tenant.repository.TenantApiKeyRepository;
import com.sentinel.tenant.repository.TenantRepository;
import com.sentinel.audit.service.AuditService;
import com.sentinel.auth.model.Role;
import com.sentinel.auth.model.User;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.common.util.Hashing;
import com.sentinel.risk.model.RiskSettings;
import com.sentinel.risk.repository.RiskSettingsRepository;
import com.sentinel.tenant.dto.RegisterTenantRequest;
import com.sentinel.tenant.dto.RegisterTenantResponse;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TenantService {

    private final TenantRepository tenantRepository;
    private final TenantApiKeyRepository apiKeyRepository;
    private final UserRepository userRepository;
    private final RiskSettingsRepository riskSettingsRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public TenantService(
            TenantRepository tenantRepository,
            TenantApiKeyRepository apiKeyRepository,
            UserRepository userRepository,
            RiskSettingsRepository riskSettingsRepository,
            PasswordEncoder passwordEncoder,
            AuditService auditService) {
        this.tenantRepository = tenantRepository;
        this.apiKeyRepository = apiKeyRepository;
        this.userRepository = userRepository;
        this.riskSettingsRepository = riskSettingsRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional
    public RegisterTenantResponse register(RegisterTenantRequest request) {
        String code = request.code().toLowerCase();
        if (tenantRepository.existsByCode(code)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tenant code already exists");
        }

        Tenant tenant = new Tenant();
        tenant.setCode(code);
        tenant.setName(request.name().trim());
        tenant.setEnabled(true);
        if (request.webhookUrl() != null && !request.webhookUrl().isBlank()) {
            tenant.setWebhookUrl(request.webhookUrl().trim());
        }
        tenant = tenantRepository.save(tenant);

        User admin = new User();
        admin.setTenant(tenant);
        admin.setUsername(request.adminUsername().trim());
        admin.setPasswordHash(passwordEncoder.encode(request.adminPassword()));
        admin.setRole(Role.ADMIN);
        admin.setEnabled(true);
        userRepository.save(admin);

        RiskSettings settings = new RiskSettings();
        settings.setTenant(tenant);
        riskSettingsRepository.save(settings);

        String rawKey = "sen_" + Hashing.randomHex(24);
        TenantApiKey apiKey = issueApiKey(tenant, rawKey, "primary");

        auditService.record(
                tenant.getId(),
                null,
                "TENANT_REGISTER",
                "Tenant",
                tenant.getId().toString(),
                null,
                Map.of("code", tenant.getCode(), "apiKeyId", apiKey.getId()));

        return new RegisterTenantResponse(
                tenant.getId(),
                tenant.getCode(),
                tenant.getName(),
                admin.getUsername(),
                rawKey,
                "Store the apiKey now — it cannot be retrieved again.");
    }

    @Transactional
    public TenantApiKey issueApiKey(Tenant tenant, String rawKey, String name) {
        TenantApiKey key = new TenantApiKey();
        key.setTenant(tenant);
        key.setKeyPrefix(rawKey.substring(0, Math.min(12, rawKey.length())));
        key.setKeyHash(Hashing.sha256Hex(rawKey));
        key.setName(name);
        key.setEnabled(true);
        return apiKeyRepository.save(key);
    }

    @Transactional(readOnly = true)
    public Tenant requireTenant(Long tenantId) {
        return tenantRepository
                .findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));
    }

    @Transactional
    public Tenant updateWebhookUrl(Long tenantId, String webhookUrl) {
        Tenant tenant = requireTenant(tenantId);
        tenant.setWebhookUrl(webhookUrl == null || webhookUrl.isBlank() ? null : webhookUrl.trim());
        return tenantRepository.save(tenant);
    }
}
