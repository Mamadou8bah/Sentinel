package com.sentinel.auth;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    Optional<User> findByTenant_IdAndUsername(Long tenantId, String username);

    boolean existsByTenant_IdAndUsername(Long tenantId, String username);
}
