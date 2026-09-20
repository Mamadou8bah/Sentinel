package com.sentinel.websocket.dto;

import java.util.Map;

/** STOMP payload for case events pushed to staff clients. */
public record CaseEventMessage(String event, Long tenantId, Map<String, Object> payload) {}
