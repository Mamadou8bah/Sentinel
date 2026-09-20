package com.sentinel.document.repository;


import com.sentinel.document.model.Document;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByCustomer_IdAndTenant_Id(Long customerId, Long tenantId);

    @EntityGraph(attributePaths = {"customer"})
    Optional<Document> findByIdAndTenant_Id(Long id, Long tenantId);

    long countByTenant_Id(Long tenantId);
}
