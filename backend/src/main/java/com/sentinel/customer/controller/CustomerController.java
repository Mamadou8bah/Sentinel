package com.sentinel.customer.controller;


import com.sentinel.customer.service.CustomerService;
import com.sentinel.common.util.TenantAccess;
import com.sentinel.customer.dto.CustomerDetailResponse;
import com.sentinel.customer.dto.CustomerRiskScoreResponse;
import com.sentinel.customer.dto.CustomerSummaryResponse;
import com.sentinel.customer.dto.SpecimenRequest;
import com.sentinel.customer.dto.SpecimenResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public List<CustomerSummaryResponse> list() {
        return customerService.list(TenantAccess.requireTenantId()).stream()
                .map(CustomerSummaryResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public CustomerDetailResponse get(@PathVariable Long id) {
        return customerService.customer360(TenantAccess.requireTenantId(), id);
    }

    @GetMapping("/{id}/risk-score")
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public CustomerRiskScoreResponse riskScore(@PathVariable Long id) {
        return CustomerRiskScoreResponse.from(
                customerService.requireCustomer(TenantAccess.requireTenantId(), id));
    }

    @PostMapping("/{id}/signature-specimen")
    @PreAuthorize("hasAnyRole('ADMIN','COMPLIANCE','ANALYST')")
    public SpecimenResponse specimen(@PathVariable Long id, @Valid @RequestBody SpecimenRequest request) {
        var c = customerService.enrollSpecimen(TenantAccess.requireTenantId(), id, request.signatureImage());
        return new SpecimenResponse(c.getId(), c.getExternalCustomerId(), true);
    }
}
