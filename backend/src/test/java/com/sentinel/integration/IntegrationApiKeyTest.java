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

        mockMvc.perform(get("/api/integration/kyc/sessions/" + sessionId)
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETE"));
    }
}
