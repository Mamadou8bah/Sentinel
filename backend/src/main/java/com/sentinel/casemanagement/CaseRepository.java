package com.sentinel.casemanagement;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CaseRepository extends JpaRepository<CaseEntity, Long> {
    List<CaseEntity> findByStatusOrderByCreatedAtDesc(CaseStatus status);
}
