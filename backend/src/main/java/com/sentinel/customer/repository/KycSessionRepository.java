package com.sentinel.customer.repository;

import com.sentinel.customer.model.KycSession;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

public interface KycSessionRepository extends JpaRepository<KycSession, Long> {

    @EntityGraph(attributePaths = {"customer", "tenant"})
    Optional<KycSession> findByIdAndTenant_Id(Long id, Long tenantId);

    @EntityGraph(attributePaths = {"customer", "tenant"})
    Optional<KycSession> findByPublicToken(String publicToken);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from KycSession s where s.id = :id and s.tenant.id = :tenantId")
    Optional<KycSession> findForSubmission(Long id, Long tenantId);
}
