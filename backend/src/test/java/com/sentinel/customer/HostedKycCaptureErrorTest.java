package com.sentinel.customer;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import com.sentinel.customer.service.KycService;
import com.sentinel.customer.controller.HostedKycController;
import com.sentinel.customer.exception.KycCaptureException;
import com.sentinel.common.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class HostedKycCaptureErrorTest {
    @Test
    void captureFailureKeepsChallengeUsableAndReportsCorrectRetakeStep() throws Exception {
        var service = mock(KycService.class);
        when(service.submitHosted(eq("fixture"), any())).thenThrow(new KycCaptureException("DOCUMENT_NO_FACE"));
        var mvc = MockMvcBuilders.standaloneSetup(new HostedKycController(service))
            .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(post("/api/kyc/hosted/fixture/submit").contentType(MediaType.APPLICATION_JSON)
            .content("{\"idImage\":\"aWQ=\",\"videoBase64\":\"dmlkZW8=\"}"))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("DOCUMENT_NO_FACE"))
            .andExpect(jsonPath("$.retryFrom").value("document"))
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("document")));
        verify(service, never()).expireHostedChallenge(any());
    }
}
