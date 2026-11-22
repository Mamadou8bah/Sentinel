package com.sentinel.customer.service;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Set;
import java.util.TreeSet;

/** Name agreement supports evidence; it never substitutes for a face or liveness match. */
public final class AccountNameComparison {
    private AccountNameComparison() {}

    public static String compare(String account, Object document) {
        if (!(document instanceof String text)) return "INCONCLUSIVE";
        var expected = tokens(account);
        var actual = tokens(text);
        if (expected.isEmpty() || actual.isEmpty()) return "INCONCLUSIVE";
        if (expected.equals(actual)) return "MATCH";
        if (expected.size() >= 2 && actual.size() >= 2
                && java.util.Collections.disjoint(expected, actual)) return "MISMATCH";
        return "INCONCLUSIVE";
    }

    private static Set<String> tokens(String value) {
        if (value == null || value.isBlank()) return Set.of();
        String normalized = Normalizer.normalize(value, Normalizer.Form.NFKD)
                .replaceAll("\\p{M}", "").replace("'", "").replace("’", "")
                .toUpperCase(java.util.Locale.ROOT).replaceAll("[^\\p{L}]+", " ").trim();
        if (normalized.isEmpty()) return Set.of();
        return new TreeSet<>(Arrays.asList(normalized.split("\\s+")));
    }
}
