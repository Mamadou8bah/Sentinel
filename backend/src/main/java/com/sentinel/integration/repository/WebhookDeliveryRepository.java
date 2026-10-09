package com.sentinel.integration.repository;
import com.sentinel.integration.model.WebhookDelivery;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import jakarta.persistence.LockModeType;
public interface WebhookDeliveryRepository extends JpaRepository<WebhookDelivery,Long> {
 @Lock(LockModeType.PESSIMISTIC_WRITE)
 List<WebhookDelivery> findByDeliveredAtIsNullAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(Instant now, Pageable pageable);
}
