package com.sentinel.integration.controller;

import com.sentinel.common.util.TenantAccess;
import com.sentinel.customer.model.Customer;
import com.sentinel.customer.service.CustomerService;
import com.sentinel.customer.service.KycService;
import com.sentinel.customer.dto.KycSessionResponse;
import com.sentinel.customer.dto.SpecimenRequest;
import com.sentinel.customer.dto.SpecimenResponse;
import com.sentinel.customer.dto.StartKycSessionRequest;
import com.sentinel.customer.dto.SubmitKycSessionRequest;
import com.sentinel.document.service.DocumentService;
import com.sentinel.document.model.DocumentType;
import com.sentinel.document.dto.DocumentResponse;
import com.sentinel.document.dto.DocumentVerifyRequest;
import com.sentinel.transaction.service.TransactionScoringService;
import com.sentinel.transaction.dto.TxImportResponse;
import com.sentinel.transaction.dto.TxScoreRequest;
import com.sentinel.transaction.dto.TxScoreResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Bank integration facade — thin controller over customer / document / transaction services.
 * DTOs live in those domain packages (shared by staff + integration channels).
 */
@RestController
@RequestMapping("/api/integration")
@PreAuthorize("hasRole('INTEGRATION')")
public class IntegrationController {

    private final KycService kycService;
    private final CustomerService customerService;
    private final DocumentService documentService;
    private final TransactionScoringService transactionScoringService;

    public IntegrationController(
            KycService kycService,
            CustomerService customerService,
            DocumentService documentService,
            TransactionScoringService transactionScoringService) {
        this.kycService = kycService;
        this.customerService = customerService;
        this.documentService = documentService;
        this.transactionScoringService = transactionScoringService;
    }

    @PostMapping("/kyc/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public KycSessionResponse startKyc(@Valid @RequestBody StartKycSessionRequest request) {
        var session = kycService.startSession(
                TenantAccess.requireTenantId(), request.externalCustomerId(), request.returnUrl());
        return KycSessionResponse.from(session, kycService.hostedUrl(session));
    }

    @PostMapping("/kyc/sessions/{id}/submit")
    public KycSessionResponse submitKyc(
            @PathVariable Long id, @Valid @RequestBody SubmitKycSessionRequest request) {
        var session = kycService.submitSession(
                TenantAccess.requireTenantId(),
                id,
                request.challengeId(),
                request.idImage(),
                request.selfieImage(),
                request.name());
        return KycSessionResponse.from(session, kycService.hostedUrl(session));
    }

    @PostMapping(value = "/kyc/sessions/{id}/submit-multipart", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public KycSessionResponse submitKycMultipart(
            @PathVariable Long id,
            @RequestParam String challengeId,
            @RequestPart("idImage") MultipartFile idImage,
            @RequestPart("selfieImage") MultipartFile selfieImage,
            @RequestParam(required = false) String name) {
        var session = kycService.submitSessionMultipart(
                TenantAccess.requireTenantId(), id, challengeId, idImage, selfieImage, name);
        return KycSessionResponse.from(session, kycService.hostedUrl(session));
    }

    @GetMapping("/kyc/sessions/{id}")
    public KycSessionResponse getKyc(@PathVariable Long id) {
        var session = kycService.getSession(TenantAccess.requireTenantId(), id);
        return KycSessionResponse.from(session, kycService.hostedUrl(session));
    }

    @PostMapping("/customers/{externalCustomerId}/signature-specimen")
    public SpecimenResponse enrollSpecimen(
            @PathVariable String externalCustomerId, @Valid @RequestBody SpecimenRequest request) {
        Customer customer = customerService.enrollSpecimenByExternalId(
                TenantAccess.requireTenantId(), externalCustomerId, request.signatureImage());
        return new SpecimenResponse(customer.getId(), customer.getExternalCustomerId(), true);
    }

    @PostMapping("/documents")
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse verifyDocument(@Valid @RequestBody DocumentVerifyRequest request) {
        return DocumentResponse.from(documentService.verify(
                TenantAccess.requireTenantId(),
                request.externalCustomerId(),
                request.docType(),
                request.documentImage()));
    }

    @PostMapping(value = "/documents/multipart", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentResponse verifyDocumentMultipart(
            @RequestParam String externalCustomerId,
            @RequestParam DocumentType docType,
            @RequestPart("documentImage") MultipartFile documentImage) {
        return DocumentResponse.from(documentService.verifyMultipart(
                TenantAccess.requireTenantId(), externalCustomerId, docType, documentImage));
    }

    @PostMapping("/transactions/score")
    public TxScoreResponse scoreTx(@Valid @RequestBody TxScoreRequest request) {
        return transactionScoringService.score(
                TenantAccess.requireTenantId(),
                request.externalCustomerId(),
                request.externalTransactionId(),
                request.amount(),
                request.currency(),
                request.timestamp(),
                request.channel(),
                request.location(),
                request.counterparty());
    }

    @PostMapping(value = "/transactions/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TxImportResponse importTx(@RequestPart("file") MultipartFile file) {
        return transactionScoringService.importCsv(TenantAccess.requireTenantId(), file);
    }
}
