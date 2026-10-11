package com.sentinel.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sentinel.auth.security.DataSeeder;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class IntegrationApiKeyTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @org.springframework.boot.test.mock.mockito.SpyBean
    private com.sentinel.integration.service.MlGateway gateway;

    @Test
    void modelThresholdCreatesReviewAndTypeIsBoundToIdempotentReference() throws Exception {
        org.mockito.Mockito.doReturn(new com.sentinel.integration.service.StubMlService.TxScores(
                .2, java.util.List.of(), "Validation review threshold exceeded", java.util.List.of(), true))
                .when(gateway).scoreTransaction(org.mockito.ArgumentMatchers.anyDouble(),
                        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        String customer = "threshold-" + java.util.UUID.randomUUID();
        var started = mockMvc.perform(post("/api/integration/kyc/sessions")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCustomerId\":\"" + customer + "\"}"))
                .andExpect(status().isCreated()).andReturn();
        var session = objectMapper.readTree(started.getResponse().getContentAsString());
        mockMvc.perform(post("/api/integration/kyc/sessions/" + session.get("sessionId").asLong() + "/submit")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of("challengeId", session.get("challengeId").asText(),
                                "idImage", "aWQx", "selfieImage", "c2VsZmll", "name", "Threshold Test"))))
                .andExpect(status().isOk());
        String request = """
                {"externalCustomerId":"%s","externalTransactionId":"threshold-ref-%s",
                 "amount":100,"currency":"GMD","channel":"api","transactionType":"TRANSFER","availableBalance":500}
                """.formatted(customer, customer);
        mockMvc.perform(post("/api/integration/transactions/score")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recommendation").value("REVIEW"))
                .andExpect(jsonPath("$.anomalyScore").value(.2)).andExpect(jsonPath("$.caseId").isNotEmpty());
        mockMvc.perform(post("/api/integration/transactions/score")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY).contentType(MediaType.APPLICATION_JSON)
                        .content(request.replace("\"availableBalance\":500", "\"availableBalance\":600")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.recommendation").value("REVIEW"));
        mockMvc.perform(post("/api/integration/transactions/score")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY).contentType(MediaType.APPLICATION_JSON)
                        .content(request.replace("TRANSFER", "CASH_OUT")))
                .andExpect(status().isConflict());
    }

    @Test
    void kycSessionRequiresApiKeyAndChallengeId() throws Exception {
        mockMvc.perform(post("/api/integration/kyc/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCustomerId\":\"ext-1001\"}"))
                .andExpect(status().isUnauthorized());

        MvcResult started = mockMvc.perform(post("/api/integration/kyc/sessions")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCustomerId\":\"ext-1001\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.challengeId").isNotEmpty())
                .andExpect(jsonPath("$.hostedUrl").isNotEmpty())
                .andReturn();

        JsonNode session = objectMapper.readTree(started.getResponse().getContentAsString());
        long sessionId = session.get("sessionId").asLong();
        String challengeId = session.get("challengeId").asText();

        mockMvc.perform(post("/api/integration/kyc/sessions/" + sessionId + "/submit")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {
                                  "challengeId":"wrong-challenge",
                                  "idImage":"aWQx",
                                  "selfieImage":"c2VsZmll"
                                }
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/integration/kyc/sessions/" + sessionId + "/submit")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {
                                  "challengeId":"%s",
                                  "idImage":"aWQx",
                                  "selfieImage":"c2VsZmll",
                                  "name":"Ada Lovelace"
                                }
                                """
                                        .formatted(challengeId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETE"));

        String scoreRequest = """
                {"externalCustomerId":"ext-1001","externalTransactionId":"sutura-contract-42",
                 "amount":100.00,"currency":"GMD","channel":"api","location":"GM"}
                """;
        mockMvc.perform(post("/api/integration/transactions/score")
                        .contentType(MediaType.APPLICATION_JSON).content(scoreRequest))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/integration/transactions/score")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(scoreRequest))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.externalCustomerId").value("ext-1001"))
                .andExpect(jsonPath("$.externalTransactionId").value("sutura-contract-42"))
                .andExpect(jsonPath("$.transactionId").isNotEmpty())
                .andExpect(jsonPath("$.recommendation").value("ALLOW"))
                .andExpect(jsonPath("$.explanation").isNotEmpty())
                .andExpect(jsonPath("$.shapTopFeatures").isEmpty());

        mockMvc.perform(post("/api/integration/transactions/score")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(scoreRequest.replace("100.00", "101.00")))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/integration/transactions/score")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY)
                        .contentType(MediaType.APPLICATION_JSON).content(scoreRequest))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/integration/kyc/sessions/" + sessionId)
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETE"));
    }
}
