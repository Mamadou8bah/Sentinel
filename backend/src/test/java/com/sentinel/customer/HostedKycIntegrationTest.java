package com.sentinel.customer;

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
class HostedKycIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void bankStartsSessionAndCustomerCompletesViaHostedToken() throws Exception {
        MvcResult started = mockMvc.perform(post("/api/integration/kyc/sessions")
                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {
                                  "externalCustomerId":"ext-hosted-1",
                                  "returnUrl":"https://bank.example/continue"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.publicToken").isNotEmpty())
                .andExpect(jsonPath("$.hostedUrl").value(org.hamcrest.Matchers.containsString("/kyc/")))
                .andReturn();

        JsonNode body = objectMapper.readTree(started.getResponse().getContentAsString());
        String token = body.get("publicToken").asText();

        mockMvc.perform(get("/api/kyc/hosted/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tenantCode").value("demo-bank"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.returnUrl").value("https://bank.example/continue"));

        mockMvc.perform(post("/api/kyc/hosted/" + token + "/submit")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                                """
                                {
                                  "idImage":"aWQx",
                                  "selfieImage":"c2VsZmll",
                                  "name":"Hosted User"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETE"))
                .andExpect(jsonPath("$.kycStatus").isNotEmpty());
    }
}
