package com.sentinel.customer.repository;

import com.sentinel.customer.model.KycSession;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KycSessionRepository extends JpaRepository<KycSession, Long> {

    @EntityGraph(attributePaths = {"customer", "tenant"})
    Optional<KycSession> findByIdAndTenant_Id(Long id, Long tenantId);

    @EntityGraph(attributePaths = {"customer", "tenant"})
    Optional<KycSession> findByPublicToken(String publicToken);
}
