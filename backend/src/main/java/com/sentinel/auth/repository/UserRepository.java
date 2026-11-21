package com.sentinel.auth.repository;


import com.sentinel.auth.model.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    Optional<User> findByTenant_IdAndUsername(Long tenantId, String username);

    boolean existsByTenant_IdAndUsername(Long tenantId, String username);
    java.util.List<User> findByTenant_IdOrderByCreatedAtAsc(Long tenantId);
    long countByTenant_IdAndRoleAndEnabledTrue(Long tenantId, com.sentinel.auth.model.Role role);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update User u set u.authVersion = u.authVersion + 1 where u.tenant.id = :id")
    void revokeForTenant(@org.springframework.data.repository.query.Param("id") Long id);
}
