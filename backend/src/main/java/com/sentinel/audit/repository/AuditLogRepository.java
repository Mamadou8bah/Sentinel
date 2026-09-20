package com.sentinel.audit.repository;


import com.sentinel.audit.model.AuditLog;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/** Append-only: save + find only. No delete or update methods. */
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @EntityGraph(attributePaths = {"user"})
    List<AuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, String entityId);

    @EntityGraph(attributePaths = {"user"})
    List<AuditLog> findByTenant_IdOrderByCreatedAtDesc(Long tenantId);

    @EntityGraph(attributePaths = {"user"})
    List<AuditLog> findByTenant_IdAndEntityTypeAndEntityIdOrderByCreatedAtDesc(
            Long tenantId, String entityType, String entityId);
}
