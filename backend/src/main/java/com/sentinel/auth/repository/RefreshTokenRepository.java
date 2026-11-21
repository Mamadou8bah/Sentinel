package com.sentinel.auth.repository;


import com.sentinel.auth.model.RefreshToken;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByTokenHashAndRevokedFalse(String tokenHash);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update RefreshToken t set t.revoked = true where t.user.id = :id")
    void revokeForUser(@org.springframework.data.repository.query.Param("id") Long id);
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update RefreshToken t set t.revoked = true where t.user.tenant.id = :id")
    void revokeForTenant(@org.springframework.data.repository.query.Param("id") Long id);
}
