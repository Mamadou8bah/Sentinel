package com.sentinel.customer.repository;


import com.sentinel.customer.model.Customer;
import com.sentinel.customer.model.KycStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerRepository extends JpaRepository<Customer, Long> {
    Optional<Customer> findByIdAndTenant_Id(Long id, Long tenantId);

    Optional<Customer> findByTenant_IdAndExternalCustomerId(Long tenantId, String externalCustomerId);

    List<Customer> findByTenant_IdOrderByCreatedAtDesc(Long tenantId);

    long countByTenant_Id(Long tenantId);

    long countByTenant_IdAndKycStatus(Long tenantId, KycStatus status);
}
