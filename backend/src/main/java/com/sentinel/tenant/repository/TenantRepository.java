package com.sentinel.tenant.repository;


import com.sentinel.tenant.model.Tenant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

public interface TenantRepository extends JpaRepository<Tenant, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Tenant t where t.id = :id")
    Optional<Tenant> findForCustomerEnrollment(Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Tenant t where t.id = :id")
    Optional<Tenant> findForKycStart(Long id);
    Optional<Tenant> findByCode(String code);

    boolean existsByCode(String code);
}
