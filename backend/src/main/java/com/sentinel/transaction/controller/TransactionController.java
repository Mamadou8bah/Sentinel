package com.sentinel.transaction.controller;


import com.sentinel.transaction.service.TransactionScoringService;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.transaction.dto.TxHistoryItemResponse;
import com.sentinel.transaction.dto.TxImportResponse;
import com.sentinel.transaction.dto.TxScoreRequest;
import com.sentinel.transaction.dto.TxScoreResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class TransactionController {

    private final TransactionScoringService transactionScoringService;

    public TransactionController(TransactionScoringService transactionScoringService) {
        this.transactionScoringService = transactionScoringService;
    }

    @PostMapping("/transactions/score")
    @PreAuthorize("hasAnyRole('ADMIN','ANALYST')")
    public TxScoreResponse score(@Valid @RequestBody TxScoreRequest request) {
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
    @PreAuthorize("hasAnyRole('ADMIN','ANALYST')")
    public TxImportResponse importCsv(@RequestPart("file") MultipartFile file) {
        return transactionScoringService.importCsv(TenantAccess.requireTenantId(), file);
    }

    @GetMapping("/customers/{id}/transactions")
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public List<TxHistoryItemResponse> history(@PathVariable Long id) {
        return transactionScoringService.history(TenantAccess.requireTenantId(), id).stream()
                .map(TxHistoryItemResponse::from)
                .toList();
    }
}
