package com.sentinel.websocket.service;

import com.sentinel.websocket.dto.CaseEventMessage;
import java.util.Map;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class CaseEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public CaseEventPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void caseOpened(Long tenantId, Map<String, Object> payload) {
        publish(tenantId, "CASE_OPENED", payload);
    }

    public void caseUpdated(Long tenantId, Map<String, Object> payload) {
        publish(tenantId, "CASE_UPDATED", payload);
    }

    private void publish(Long tenantId, String event, Map<String, Object> payload) {
        CaseEventMessage message = new CaseEventMessage(event, tenantId, payload);
        messagingTemplate.convertAndSend("/topic/tenants." + tenantId + ".cases", message);
    }
}
