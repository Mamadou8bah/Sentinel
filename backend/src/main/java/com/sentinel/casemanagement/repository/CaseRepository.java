package com.sentinel.casemanagement.repository;

import com.sentinel.casemanagement.model.CaseEntity;
import com.sentinel.casemanagement.model.CaseStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

public interface CaseRepository extends JpaRepository<CaseEntity, Long> {

    @EntityGraph(attributePaths = {"customer", "relatedDocument"})
    List<CaseEntity> findByTenant_IdOrderByRiskScoreAtCreationDescCreatedAtDesc(Long tenantId);

    @EntityGraph(attributePaths = {"customer", "relatedDocument"})
    List<CaseEntity> findByTenant_IdAndStatusOrderByRiskScoreAtCreationDescCreatedAtDesc(
            Long tenantId, CaseStatus status);

    @EntityGraph(attributePaths = {"customer", "relatedDocument"})
    List<CaseEntity> findByTenant_IdOrderByCreatedAtDesc(Long tenantId);

    @EntityGraph(attributePaths = {"customer", "relatedDocument"})
    List<CaseEntity> findByTenant_IdAndStatusOrderByCreatedAtDesc(Long tenantId, CaseStatus status);

    @EntityGraph(attributePaths = {"customer", "relatedDocument", "tenant"})
    Optional<CaseEntity> findByIdAndTenant_Id(Long id, Long tenantId);

    long countByTenant_IdAndStatus(Long tenantId, CaseStatus status);

    long countByTenant_Id(Long tenantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CaseEntity c where c.id = :id and c.tenant.id = :tenantId")
    Optional<CaseEntity> findForDecision(Long id, Long tenantId);
}
