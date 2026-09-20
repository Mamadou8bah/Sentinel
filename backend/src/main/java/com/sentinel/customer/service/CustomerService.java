package com.sentinel.customer.service;

import com.sentinel.audit.service.AuditService;
import com.sentinel.common.service.FieldEncryption;
import com.sentinel.common.service.LocalStorageService;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.customer.dto.CustomerDetailResponse;
import com.sentinel.customer.model.Customer;
import com.sentinel.customer.repository.CustomerRepository;
import com.sentinel.document.model.Document;
import com.sentinel.document.repository.DocumentRepository;
import com.sentinel.risk.service.RiskEngine;
import com.sentinel.transaction.model.TransactionEntity;
import com.sentinel.transaction.repository.TransactionRepository;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CustomerService {

    private final CustomerRepository customerRepository;
    private final DocumentRepository documentRepository;
    private final TransactionRepository transactionRepository;
    private final RiskEngine riskEngine;
    private final LocalStorageService storageService;
    private final AuditService auditService;
    private final FieldEncryption fieldEncryption;

    public CustomerService(
            CustomerRepository customerRepository,
            DocumentRepository documentRepository,
            TransactionRepository transactionRepository,
            RiskEngine riskEngine,
            LocalStorageService storageService,
            AuditService auditService,
            FieldEncryption fieldEncryption) {
        this.customerRepository = customerRepository;
        this.documentRepository = documentRepository;
        this.transactionRepository = transactionRepository;
        this.riskEngine = riskEngine;
        this.storageService = storageService;
        this.auditService = auditService;
        this.fieldEncryption = fieldEncryption;
    }

    @Transactional
    public Customer enrollSpecimen(Long tenantId, Long customerId, String signatureImageBase64) {
        Customer customer = requireCustomer(tenantId, customerId);
        String path = storageService.storeBase64(tenantId, "specimens/" + customerId, signatureImageBase64, "png");
        customer.setReferenceSignatureUrl(path);
        Customer saved = customerRepository.save(customer);
        auditService.record(
                tenantId,
                TenantAccess.currentUserIdOrNull(),
                "SPECIMEN_ENROLL",
                "Customer",
                customerId.toString(),
                null,
                Map.of("referenceSignatureUrl", path));
        return saved;
    }

    @Transactional
    public Customer enrollSpecimenMultipart(Long tenantId, Long customerId, MultipartFile signatureImage) {
        Customer customer = requireCustomer(tenantId, customerId);
        String path = storageService.storeMultipart(tenantId, "specimens/" + customerId, signatureImage);
        customer.setReferenceSignatureUrl(path);
        return customerRepository.save(customer);
    }

    @Transactional
    public Customer enrollSpecimenByExternalId(Long tenantId, String externalCustomerId, String signatureImageBase64) {
        Customer customer = customerRepository
                .findByTenant_IdAndExternalCustomerId(tenantId, externalCustomerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Customer not found for externalCustomerId"));
        return enrollSpecimen(tenantId, customer.getId(), signatureImageBase64);
    }

    @Transactional(readOnly = true)
    public Customer requireCustomer(Long tenantId, Long customerId) {
        return customerRepository
                .findByIdAndTenant_Id(customerId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));
    }

    @Transactional(readOnly = true)
    public Customer requireByExternalId(Long tenantId, String externalCustomerId) {
        return customerRepository
                .findByTenant_IdAndExternalCustomerId(tenantId, externalCustomerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Customer not found for externalCustomerId"));
    }

    @Transactional(readOnly = true)
    public List<Customer> list(Long tenantId) {
        return customerRepository.findByTenant_IdOrderByCreatedAtDesc(tenantId);
    }

    @Transactional(readOnly = true)
    public long countByTenant(Long tenantId) {
        return customerRepository.countByTenant_Id(tenantId);
    }

    @Transactional(readOnly = true)
    public CustomerDetailResponse customer360(Long tenantId, Long customerId) {
        Customer c = requireCustomer(tenantId, customerId);
        List<Document> docs = documentRepository.findByCustomer_IdAndTenant_Id(customerId, tenantId);
        List<TransactionEntity> txs =
                transactionRepository.findByCustomer_IdAndTenant_IdOrderByOccurredAtDesc(customerId, tenantId);
        return new CustomerDetailResponse(
                c.getId(),
                c.getName(),
                c.getExternalCustomerId(),
                c.getDob(),
                fieldEncryption.mask(c.getIdNumber()),
                c.getKycStatus(),
                c.getFaceMatchScore(),
                c.getLivenessScore(),
                c.getRiskScore(),
                c.getReferenceSignatureUrl() != null,
                docs.size(),
                txs.size(),
                c.getCreatedAt());
    }

    @Transactional
    public void refreshRisk(Customer customer) {
        Long tenantId = customer.getTenant().getId();
        List<Document> docs = documentRepository.findByCustomer_IdAndTenant_Id(customer.getId(), tenantId);
        List<TransactionEntity> txs =
                transactionRepository.findByCustomer_IdAndTenant_IdOrderByOccurredAtDesc(customer.getId(), tenantId);
        Double latestAnomaly = txs.isEmpty() ? null : txs.get(0).getAnomalyScore();
        customer.setRiskScore(riskEngine.computeCustomerRisk(customer, docs, latestAnomaly));
        customerRepository.save(customer);
    }
}
