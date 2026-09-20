package com.sentinel.transaction.repository;


import com.sentinel.transaction.model.TransactionEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransactionRepository extends JpaRepository<TransactionEntity, Long> {
    List<TransactionEntity> findByCustomer_IdAndTenant_IdOrderByOccurredAtDesc(Long customerId, Long tenantId);

    Optional<TransactionEntity> findByTenant_IdAndExternalTransactionId(Long tenantId, String externalTransactionId);

    long countByTenant_Id(Long tenantId);

    long countByTenant_IdAndFlaggedTrue(Long tenantId);
}
