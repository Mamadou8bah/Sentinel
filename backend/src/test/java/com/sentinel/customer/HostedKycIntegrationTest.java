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

    @Autowired private MockMvc mockMvc;

    @Autowired private ObjectMapper objectMapper;
    @Autowired private com.sentinel.customer.repository.CustomerRepository customers;
    @Autowired private com.sentinel.customer.service.KycService kycService;

    @Test
    void bankStartsSessionAndCustomerCompletesViaHostedToken() throws Exception {
        MvcResult started =
                mockMvc.perform(
                                post("/api/integration/kyc/sessions")
                                        .header("X-Api-Key", DataSeeder.DEMO_API_KEY)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                """
                                {
                                  "externalCustomerId":"ext-hosted-1",
                                  "returnUrl":"https://bank.example/continue",
                                  "fullName":"Bank Supplied Name"
                                }
                                """))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.publicToken").isNotEmpty())
                        .andExpect(
                                jsonPath("$.hostedUrl")
                                        .value(org.hamcrest.Matchers.containsString("/kyc/")))
                        .andReturn();

        JsonNode body = objectMapper.readTree(started.getResponse().getContentAsString());
        String token = body.get("publicToken").asText();

        mockMvc.perform(get("/api/kyc/hosted/" + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tenantCode").value("demo-bank"))
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.accountNameProvided").value(true))
                .andExpect(jsonPath("$.returnUrl").value("https://bank.example/continue"));

        mockMvc.perform(
                        post("/api/kyc/hosted/" + token + "/submit")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                {
                                  "idImage":"aWQx",
                                  "selfieImage":"c2VsZmll",
                                  "name":"Untrusted Browser Name",
                                  "documentType":"PASSPORT"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETE"))
                .andExpect(jsonPath("$.documentType").value("PASSPORT"))
                .andExpect(jsonPath("$.kycStatus").isNotEmpty());
        org.assertj.core.api.Assertions.assertThat(customers.findAll().stream()
                .filter(customer -> "ext-hosted-1".equals(customer.getExternalCustomerId()))
                .findFirst().orElseThrow().getName()).isEqualTo("Bank Supplied Name");
    }

    @Test
    void mixedRecordingAndStillEvidenceIsRejected() throws Exception {
        mockMvc.perform(
                        post("/api/kyc/hosted/invalid/submit")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"idImage\":\"aWQ=\",\"selfieImage\":\"aWQ=\",\"videoBase64\":\"video\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void oversizedRecordingRequestIsRejectedBeforeParsing() throws Exception {
        mockMvc.perform(
                        post("/api/kyc/hosted/invalid/submit")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(new byte[18000001]))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void photoBetweenThreeAndFiveMegabytesPassesDtoValidation() throws Exception {
        String photo = java.util.Base64.getEncoder().encodeToString(new byte[5_000_000]);
        mockMvc.perform(post("/api/kyc/hosted/invalid/submit")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(java.util.Map.of(
                        "idImage", photo, "selfieImage", "aWQ=", "documentType", "ID_CARD"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void unsupportedDocumentTypeIsRejected() throws Exception {
        mockMvc.perform(post("/api/kyc/hosted/invalid/submit")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"idImage\":\"aWQ=\",\"selfieImage\":\"aWQ=\",\"documentType\":\"OTHER\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void lostModelChallengeCanBeReplacedWithoutWaitingForOriginalExpiry() {
        var first = kycService.startSession(1L, "lost-challenge-customer", null, "Account Name");
        kycService.expireHostedChallenge(first.getPublicToken());
        var replacement = kycService.startSession(1L, "lost-challenge-customer", null, "Account Name");
        org.assertj.core.api.Assertions.assertThat(replacement.getId()).isNotEqualTo(first.getId());
        org.assertj.core.api.Assertions.assertThat(replacement.getPublicToken()).isNotEqualTo(first.getPublicToken());
    }
}
