package com.sentinel.integration.service;

import com.sentinel.tenant.model.Tenant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class WebhookPublisher {

    private static final Logger log = LoggerFactory.getLogger(WebhookPublisher.class);

    private final RestClient restClient = RestClient.create();

    @Async
    public void publish(Tenant tenant, String event, Map<String, Object> payload) {
        if (tenant == null || tenant.getWebhookUrl() == null || tenant.getWebhookUrl().isBlank()) {
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("event", event);
        body.put("tenantCode", tenant.getCode());
        body.putAll(payload);
        try {
            restClient
                    .post()
                    .uri(tenant.getWebhookUrl())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Webhook {} delivered to tenant {}", event, tenant.getCode());
        } catch (Exception e) {
            log.warn("Webhook {} failed for tenant {}: {}", event, tenant.getCode(), e.getMessage());
        }
    }
}
