package com.sentinel.integration;

import com.sentinel.integration.model.WebhookDelivery;
import com.sentinel.integration.repository.WebhookDeliveryRepository;
import com.sentinel.integration.service.WebhookDispatcher;
import com.sentinel.tenant.model.Tenant;
import com.sentinel.tenant.service.TenantService;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WebhookDispatcherTest {
    private static final String SECRET = "test-secret-012345678901234567890123";
    private HttpServer server;
    private WebhookDelivery delivery;
    private WebhookDeliveryRepository repository;
    private WebhookDispatcher dispatcher;
    private int status = 204;
    private byte[] received;
    private String timestamp, signature, eventId;

    @BeforeEach void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/callback", exchange -> {
            received = exchange.getRequestBody().readAllBytes();
            timestamp = exchange.getRequestHeaders().getFirst("X-Sentinel-Timestamp");
            signature = exchange.getRequestHeaders().getFirst("X-Sentinel-Signature");
            eventId = exchange.getRequestHeaders().getFirst("X-Sentinel-Event-Id");
            exchange.sendResponseHeaders(status, -1);
            exchange.close();
        });
        server.start();
        var tenant = new Tenant();
        tenant.setWebhookUrl("http://127.0.0.1:" + server.getAddress().getPort() + "/callback");
        tenant.setWebhookSigningSecret(SECRET);
        var tenants = mock(TenantService.class);
        when(tenants.requireTenant(1L)).thenReturn(tenant);
        repository = mock(WebhookDeliveryRepository.class);
        delivery = new WebhookDelivery();
        delivery.eventId = "event-42";
        delivery.tenantId = 1L;
        delivery.payload = "{\"explanation\":\"révision\",\"eventId\":\"event-42\"}";
        delivery.createdAt = Instant.now();
        delivery.nextAttemptAt = Instant.now();
        when(repository.findByDeliveredAtIsNullAndNextAttemptAtLessThanEqualOrderByCreatedAtAsc(any(), any()))
                .thenReturn(List.of(delivery));
        dispatcher = new WebhookDispatcher(repository, tenants);
    }

    @AfterEach void stop() { server.stop(0); }

    @Test void signsExactUtf8BytesAndMarksAcknowledgement() throws Exception {
        dispatcher.deliverPending();
        assertThat(received).isEqualTo(delivery.payload.getBytes(StandardCharsets.UTF_8));
        var mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        mac.update((timestamp + ".").getBytes(StandardCharsets.UTF_8));
        assertThat(signature).isEqualTo(HexFormat.of().formatHex(mac.doFinal(received)));
        assertThat(eventId).isEqualTo(delivery.eventId);
        assertThat(delivery.deliveredAt).isNotNull();
        verify(repository).save(delivery);
    }

    @Test void failedDeliveryRetainsEventAndRetriesAfterBackoff() {
        status = 503;
        var before = Instant.now();
        dispatcher.deliverPending();
        assertThat(delivery.deliveredAt).isNull();
        assertThat(delivery.attempts).isEqualTo(1);
        assertThat(delivery.nextAttemptAt).isAfter(before);
        String originalPayload = delivery.payload;
        status = 204;
        dispatcher.deliverPending();
        assertThat(delivery.deliveredAt).isNotNull();
        assertThat(delivery.attempts).isEqualTo(2);
        assertThat(delivery.payload).isEqualTo(originalPayload);
        assertThat(eventId).isEqualTo("event-42");
    }
}
