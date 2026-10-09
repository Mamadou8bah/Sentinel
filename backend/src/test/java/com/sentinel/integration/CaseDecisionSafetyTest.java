package com.sentinel.integration;

import com.sentinel.audit.service.AuditService;
import com.sentinel.auth.repository.UserRepository;
import com.sentinel.casemanagement.model.*;
import com.sentinel.casemanagement.repository.CaseRepository;
import com.sentinel.casemanagement.service.CaseService;
import com.sentinel.integration.service.WebhookPublisher;
import com.sentinel.risk.service.RiskEngine;
import com.sentinel.websocket.service.CaseEventPublisher;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CaseDecisionSafetyTest {
    @Test void resolvedCaseCannotPublishAConflictingDecision() {
        var repository = mock(CaseRepository.class);
        var audit = mock(AuditService.class);
        var events = mock(CaseEventPublisher.class);
        var webhooks = mock(WebhookPublisher.class);
        var service = new CaseService(repository, mock(RiskEngine.class), audit,
                mock(UserRepository.class), events, webhooks);
        var resolved = new CaseEntity();
        resolved.setStatus(CaseStatus.RESOLVED);
        resolved.setDecision(CaseDecision.APPROVE);
        when(repository.findForDecision(9L, 1L)).thenReturn(Optional.of(resolved));
        assertThatThrownBy(() -> service.decide(1L, 9L, CaseDecision.REJECT, "Contradictory decision", null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode().value()).isEqualTo(409));
        verifyNoInteractions(audit, events, webhooks);
        verify(repository, never()).save(any());
        assertThat(resolved.getDecision()).isEqualTo(CaseDecision.APPROVE);
    }
}
