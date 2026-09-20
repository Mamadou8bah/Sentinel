package com.sentinel.casemanagement.dto;

import com.sentinel.casemanagement.model.CaseDecision;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CaseDecisionRequest(@NotNull CaseDecision decision, @NotBlank String note) {}
