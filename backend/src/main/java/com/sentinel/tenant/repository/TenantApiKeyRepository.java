package com.sentinel.tenant.repository;


import com.sentinel.tenant.model.TenantApiKey;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TenantApiKeyRepository extends JpaRepository<TenantApiKey, Long> {

    @Query(
            """
            select k from TenantApiKey k
            join fetch k.tenant
            where k.keyPrefix = :prefix and k.enabled = true
            """)
    List<TenantApiKey> findByKeyPrefixAndEnabledTrue(@Param("prefix") String prefix);

    Optional<TenantApiKey> findByKeyHash(String keyHash);

    boolean existsByTenant_Id(Long tenantId);
}
