package com.sentinel.transaction.dto;

import java.util.List;

public record TxImportResponse(int processed, int failed, List<Object> results) {}
