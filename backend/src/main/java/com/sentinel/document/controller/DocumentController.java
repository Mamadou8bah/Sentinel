package com.sentinel.document.controller;

import com.sentinel.common.util.TenantAccess;
import com.sentinel.document.dto.DocumentResponse;
import com.sentinel.document.dto.DocumentVerifyRequest;
import com.sentinel.document.service.DocumentService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @PostMapping("/documents")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public DocumentResponse verify(@Valid @RequestBody DocumentVerifyRequest request) {
        return DocumentResponse.from(documentService.verify(
                TenantAccess.requireTenantId(),
                request.externalCustomerId(),
                request.docType(),
                request.documentImage()));
    }

    @GetMapping("/documents/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public DocumentResponse get(@PathVariable Long id) {
        return DocumentResponse.from(documentService.get(TenantAccess.requireTenantId(), id));
    }

    @GetMapping("/customers/{customerId}/documents")
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public List<DocumentResponse> listForCustomer(@PathVariable Long customerId) {
        return documentService.listForCustomer(TenantAccess.requireTenantId(), customerId).stream()
                .map(DocumentResponse::from)
                .toList();
    }
}
