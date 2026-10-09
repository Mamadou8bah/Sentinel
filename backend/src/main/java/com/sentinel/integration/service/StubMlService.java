package com.sentinel.integration.service;


import com.sentinel.customer.model.Customer;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Deterministic stub scores so the bank integration path works before Python ML is wired.
 * Replace with WebClient calls when {@code sentinel.ml.stub=false}.
 */
@Service
public class StubMlService {

    public record KycScores(
            String name, String dob, String idNumber, double faceMatch, double liveness, double tampering,
            boolean evidenceTrusted, String explanation) {}

    public record DocumentScores(
            Map<String, Object> ocr,
            double tampering,
            Double signatureMatch,
            List<String> consistencyFlags,
            double fraudRisk) {}

    public record TxScores(
            double anomalyScore,
            List<String> ruleFlags,
            String explanation,
            List<Map<String, Object>> shapTopFeatures) {}

    public KycScores scoreKyc(String externalCustomerId, String providedName) {
        int h = Math.abs((externalCustomerId == null ? "x" : externalCustomerId).hashCode());
        String name = (providedName != null && !providedName.isBlank()) ? providedName : "Demo Customer " + (h % 1000);
        // No image model ran: synthetic identity evidence cannot verify a customer.
        return new KycScores(name, "", "", 0.0, 0.0, 1.0, false,
                "Synthetic evidence; identity models did not run");
    }

    public DocumentScores scoreDocument(
            String docType, boolean hasSpecimen, String customerName, String externalCustomerId) {
        int h = Math.abs((docType + ":" + externalCustomerId).hashCode());
        double tamper = 0.08 + (h % 40) / 100.0;
        if (externalCustomerId != null && externalCustomerId.toLowerCase().contains("forge")) {
            tamper = 0.81;
        }
        Double sig = hasSpecimen ? clamp(0.78 + (h % 20) / 100.0) : null;
        if (hasSpecimen && externalCustomerId != null && externalCustomerId.toLowerCase().contains("forge")) {
            sig = 0.42;
        }
        Map<String, Object> ocr = new LinkedHashMap<>();
        ocr.put("amount", 1500 + (h % 500));
        ocr.put("payee", customerName != null ? customerName : "Unknown");
        ocr.put("date", "2024-06-01");
        ocr.put("docType", docType);

        List<String> flags = List.of();
        if (customerName != null && customerName.toLowerCase().contains("mismatch")) {
            flags = List.of("PAYEE_NAME_MISMATCH");
        }

        double fraud = Math.max(tamper, sig == null ? 0.3 : 1.0 - sig);
        return new DocumentScores(ocr, clamp(tamper), sig, flags, clamp(fraud));
    }

    public TxScores scoreTransaction(double amount, String channel, String externalCustomerId) {
        List<String> flags = new java.util.ArrayList<>();
        double anomaly = 0.12;

        if (amount >= 50_000) {
            flags.add("AMOUNT_OUTLIER");
            anomaly += 0.65;
        } else if (amount >= 10_000) {
            flags.add("AMOUNT_ELEVATED");
            anomaly += 0.35;
        }
        if ("ATM".equalsIgnoreCase(channel) && amount >= 5_000) {
            flags.add("CHANNEL_AMOUNT");
            anomaly += 0.15;
        }
        if (externalCustomerId != null && externalCustomerId.toLowerCase().contains("velocity")) {
            flags.add("VELOCITY");
            anomaly += 0.35;
        }

        anomaly = clamp(anomaly + (Math.abs(Double.hashCode(amount) % 17) / 200.0));

        // Rule output has no SHAP attribution because no trained model ran.
        List<Map<String, Object>> shap = List.of();

        String explanation = flags.isEmpty()
                ? "Within normal pattern for this customer"
                : "Triggered: " + String.join(", ", flags);

        return new TxScores(anomaly, flags, "DEMO RULES (no trained model): " + explanation, shap);
    }

    private static double clamp(double v) {
        return Math.max(0.0, Math.min(1.0, v));
    }

    private static double round(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }
}
