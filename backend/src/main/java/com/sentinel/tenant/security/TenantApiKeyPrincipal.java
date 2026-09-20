package com.sentinel.tenant.security;


import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.model.TenantApiKey;
import java.util.Collection;
import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/** Principal for bank systems authenticated with {@code X-Api-Key}. */
public class TenantApiKeyPrincipal implements UserDetails {

    private final TenantApiKey apiKey;

    public TenantApiKeyPrincipal(TenantApiKey apiKey) {
        this.apiKey = apiKey;
    }

    public TenantApiKey getApiKey() {
        return apiKey;
    }

    public Long getTenantId() {
        return apiKey.getTenant().getId();
    }

    public String getTenantCode() {
        return apiKey.getTenant().getCode();
    }

    public Tenant getTenant() {
        return apiKey.getTenant();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_INTEGRATION"));
    }

    @Override
    public String getPassword() {
        return "";
    }

    @Override
    public String getUsername() {
        return "api-key:" + apiKey.getKeyPrefix();
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return apiKey.isEnabled() && apiKey.getTenant().isEnabled();
    }
}
