package com.sentinel.auth.service;

import com.sentinel.auth.model.User;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.auth.security.SentinelUserDetails;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SentinelUserDetailsService {

    private final UserRepository userRepository;

    public SentinelUserDetailsService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public UserDetails loadUserByTenantIdAndUsername(Long tenantId, String username) {
        if (tenantId == null || username == null || username.isBlank()) {
            throw new UsernameNotFoundException("User not found");
        }
        User user = userRepository
                .findByTenant_IdAndUsername(tenantId, username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        user.getTenant().getCode();
        return new SentinelUserDetails(user);
    }
}
