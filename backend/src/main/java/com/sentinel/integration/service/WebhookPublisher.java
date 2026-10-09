package com.sentinel.integration.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinel.integration.model.WebhookDelivery;
import com.sentinel.integration.repository.WebhookDeliveryRepository;
import com.sentinel.tenant.model.Tenant;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Enqueue within the domain transaction; dispatch only sees committed rows. */
@Service
public class WebhookPublisher {
    private final WebhookDeliveryRepository repository;
    private final ObjectMapper mapper;

    public WebhookPublisher(WebhookDeliveryRepository repository, ObjectMapper mapper) {
        this.repository = repository;
        this.mapper = mapper;
    }

    @Transactional
    public void publish(Tenant tenant, String event, Map<String, Object> payload) {
        if (tenant == null || tenant.getWebhookUrl() == null || tenant.getWebhookUrl().isBlank()) return;
        var delivery = new WebhookDelivery();
        delivery.eventId = UUID.randomUUID().toString();
        delivery.tenantId = tenant.getId();
        delivery.createdAt = Instant.now();
        delivery.nextAttemptAt = delivery.createdAt;
        Map<String, Object> body = new LinkedHashMap<>(payload);
        body.put("event", event);
        body.put("tenantCode", tenant.getCode());
        body.put("eventId", delivery.eventId);
        try {
            delivery.payload = mapper.writeValueAsString(body);
        } catch (Exception e) {
            throw new IllegalStateException("Unable to serialize webhook event", e);
        }
        repository.save(delivery);
    }
}
