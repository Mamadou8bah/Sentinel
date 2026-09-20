package com.sentinel.customer.dto;

public record SpecimenResponse(Long customerId, String externalCustomerId, boolean hasSignatureSpecimen) {}
