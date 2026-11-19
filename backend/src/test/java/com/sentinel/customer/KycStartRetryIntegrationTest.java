package com.sentinel.customer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinel.auth.security.DataSeeder;
import com.sentinel.customer.model.KycSessionStatus;
import com.sentinel.customer.repository.KycSessionRepository;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class KycStartRetryIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired KycSessionRepository sessions;

    private long start(String customer) {
        try {
            var response = mvc.perform(post("/api/integration/kyc/sessions")
                    .header("X-Api-Key", DataSeeder.DEMO_API_KEY)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(java.util.Map.of("externalCustomerId", customer))))
                    .andExpect(status().isCreated()).andReturn();
            return mapper.readTree(response.getResponse().getContentAsString()).get("sessionId").asLong();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    @Test
    void aLostStartResponseCanBeRetriedWithoutIssuingAnotherLink() {
        var customer = "retry-" + UUID.randomUUID();
        long first = start(customer);
        assertThat(start(customer)).isEqualTo(first);
        assertThat(start(" " + customer + " ")).isEqualTo(first);
        assertThat(start(customer + "-different")).isNotEqualTo(first);
    }

    @Test
    void expiredAndCompletedSessionsDoNotPreventANewAttempt() {
        var customer = "renew-" + UUID.randomUUID();
        long first = start(customer);
        var expired = sessions.findById(first).orElseThrow();
        expired.setExpiresAt(Instant.now().minusSeconds(1)); sessions.saveAndFlush(expired);
        long second = start(customer); assertThat(second).isNotEqualTo(first);
        var complete = sessions.findById(second).orElseThrow();
        complete.setStatus(KycSessionStatus.COMPLETE); sessions.saveAndFlush(complete);
        assertThat(start(customer)).isNotIn(first, second);
    }

    @Test
    void overlappingColdStartRetriesResolveToOneSession() {
        var customer = "concurrent-" + UUID.randomUUID();
        var first = CompletableFuture.supplyAsync(() -> start(customer));
        var second = CompletableFuture.supplyAsync(() -> start(customer));
        assertThat(first.join()).isEqualTo(second.join());
    }
}
