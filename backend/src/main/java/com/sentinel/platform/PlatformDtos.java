package com.sentinel.platform;

import com.sentinel.auth.model.Role;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.List;

public final class PlatformDtos {
    private PlatformDtos() {}
    public record Login(@NotBlank @Size(max=64) String username, @NotBlank @Size(max=128) String password) {}
    public record Session(String accessToken, String username, String role, Instant expiresAt) {}
    public record PasswordChange(@NotBlank @Size(max=128) String currentPassword,
                                 @NotBlank @Size(min=14,max=72) String newPassword) {}
    public record Summary(long tenants, long enabledTenants, long staff, long customers, long transactions, long cases) {}
    public record TenantRow(Long id, String code, String name, boolean enabled, Instant createdAt,
                            long staff, long customers, long transactions, long cases,
                            String webhookUrl, boolean webhookSecretConfigured) {}
    public record Page<T>(List<T> items, long total, int page, int size) {}
    public record Staff(Long id, String username, Role role, boolean enabled, Instant createdAt) {}
    public record Key(Long id, String name, String prefix, boolean enabled, Instant createdAt, Instant lastUsedAt) {}
    public record TenantDetail(TenantRow tenant, List<Staff> staff, List<Key> keys) {}
    public record CreateTenant(
            @NotBlank @Pattern(regexp="[a-z0-9][a-z0-9-]{1,62}") String code,
            @NotBlank @Size(max=200) String name,
            @NotBlank @Pattern(regexp="[A-Za-z0-9._@-]{3,64}") String adminUsername,
            @NotBlank @Size(min=14,max=72) String adminPassword,
            @Size(max=1024) String webhookUrl,
            @NotBlank @Size(min=5,max=500) String reason) {}
    public record CreatedTenant(Long tenantId, String code, String adminUsername, String apiKey, String webhookSigningSecret) {}
    public record UpdateTenant(@NotBlank @Size(max=200) String name, boolean enabled,
                               @Size(max=1024) String webhookUrl, @Size(max=64) String confirmCode,
                               @NotBlank @Size(min=5,max=500) String reason) {}
    public record CreateStaff(@NotBlank @Pattern(regexp="[A-Za-z0-9._@-]{3,64}") String username,
                              @NotBlank @Size(min=14,max=72) String password, @NotNull Role role,
                              @NotBlank @Size(min=5,max=500) String reason) {}
    public record UpdateStaff(@NotNull Role role, boolean enabled,
                              @NotBlank @Size(min=5,max=500) String reason) {}
    public record ResetPassword(@NotBlank @Size(min=14,max=72) String password,
                                @NotBlank @Size(min=5,max=500) String reason) {}
    public record IssueKey(@NotBlank @Size(max=128) String name,
                           @NotBlank @Size(min=5,max=500) String reason) {}
    public record IssuedKey(Long id, String name, String apiKey) {}
    public record IssuedSecret(String webhookSigningSecret) {}
    public record Reason(@NotBlank @Size(min=5,max=500) String reason) {}
    public record Audit(Long id, String actor, String action, Long tenantId, String detail, Instant createdAt) {}
}
