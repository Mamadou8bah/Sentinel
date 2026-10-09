package com.sentinel.integration.service;

import com.sentinel.integration.repository.WebhookDeliveryRepository;
import com.sentinel.tenant.service.TenantService;
import java.time.Instant;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class WebhookDispatcher {
    private static final Logger log = LoggerFactory.getLogger(WebhookDispatcher.class);
    private final WebhookDeliveryRepository repository;
    private final TenantService tenantService;
    private final RestClient client;

    public WebhookDispatcher(WebhookDeliveryRepository repository, TenantService tenantService) {
        this.repository = repository;
        this.tenantService = tenantService;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(3000);
        client = RestClient.builder().requestFactory(factory).build();
    }

    @Scheduled(fixedDelayString = "${sentinel.webhook.dispatch-delay-ms:5000}")
    @Transactional
    public void deliverPending() {
        var deliveries = repository.findByDeliveredAtIsNullAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(
                Instant.now(), PageRequest.of(0, 10));
        for (var delivery : deliveries) {
            delivery.attempts++;
            try {
                var tenant = tenantService.requireTenant(delivery.tenantId);
                String secret = tenant.getWebhookSigningSecret();
                if (secret == null || secret.length() < 32 || tenant.getWebhookUrl() == null) {
                    throw new IllegalStateException("Webhook signing configuration unavailable");
                }
                String timestamp = Long.toString(Instant.now().getEpochSecond());
                client.post().uri(tenant.getWebhookUrl()).contentType(MediaType.APPLICATION_JSON)
                        .header("X-Sentinel-Event-Id", delivery.eventId)
                        .header("X-Sentinel-Timestamp", timestamp)
                        .header("X-Sentinel-Signature", WebhookSigner.sign(secret, timestamp, delivery.payload))
                        .body(delivery.payload).retrieve().toBodilessEntity();
                delivery.deliveredAt = Instant.now();
            } catch (Exception e) {
                delivery.nextAttemptAt = Instant.now().plusSeconds(
                        Math.min(3600, 1L << Math.min(12, delivery.attempts)));
                log.warn("Webhook event {} delivery deferred (attempt {})", delivery.eventId, delivery.attempts);
            }
            repository.save(delivery);
        }
    }
}
