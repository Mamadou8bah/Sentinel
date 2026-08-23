package com.sentinel.audit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

/** Append-only: save + find only. No delete or update methods. */
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, String entityId);
}
