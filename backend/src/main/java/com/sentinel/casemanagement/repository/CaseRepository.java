package com.sentinel.casemanagement.repository;


import com.sentinel.casemanagement.model.CaseEntity;
import com.sentinel.casemanagement.model.CaseStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CaseRepository extends JpaRepository<CaseEntity, Long> {

    @EntityGraph(attributePaths = {"customer", "relatedDocument"})
    List<CaseEntity> findByTenant_IdOrderByCreatedAtDesc(Long tenantId);

    @EntityGraph(attributePaths = {"customer", "relatedDocument"})
    List<CaseEntity> findByTenant_IdAndStatusOrderByCreatedAtDesc(Long tenantId, CaseStatus status);

    @EntityGraph(attributePaths = {"customer", "relatedDocument", "tenant"})
    Optional<CaseEntity> findByIdAndTenant_Id(Long id, Long tenantId);

    long countByTenant_IdAndStatus(Long tenantId, CaseStatus status);

    long countByTenant_Id(Long tenantId);
}
