package com.sentinel.websocket.security;

import com.sentinel.auth.security.SentinelUserDetails;
import com.sentinel.auth.service.JwtService;
import com.sentinel.auth.service.SentinelUserDetailsService;
import io.jsonwebtoken.Claims;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

/**
 * Authenticates STOMP CONNECT with a staff JWT and scopes SUBSCRIBE to the caller's tenant topic.
 */
@Component
public class AuthChannelInterceptor implements ChannelInterceptor {

    private final JwtService jwtService;
    private final SentinelUserDetailsService userDetailsService;

    public AuthChannelInterceptor(JwtService jwtService, SentinelUserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            Authentication auth = authenticate(accessor);
            accessor.setUser(auth);
            return message;
        }

        if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            enforceTenantTopic(accessor);
        }

        return message;
    }

    private Authentication authenticate(StompHeaderAccessor accessor) {
        String header = firstHeader(accessor, HttpHeaders.AUTHORIZATION);
        if (header == null) {
            header = firstHeader(accessor, "authorization");
        }
        if (header == null || !header.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Missing Bearer token for WebSocket CONNECT");
        }

        Claims claims = jwtService.parseAccessToken(header.substring(7));
        Long tenantId = JwtService.tenantIdFrom(claims);
        String username = claims.getSubject();
        SentinelUserDetails details =
                (SentinelUserDetails) userDetailsService.loadUserByTenantIdAndUsername(tenantId, username);
        return new UsernamePasswordAuthenticationToken(details, null, details.getAuthorities());
    }

    private void enforceTenantTopic(StompHeaderAccessor accessor) {
        if (!(accessor.getUser() instanceof UsernamePasswordAuthenticationToken auth)
                || !(auth.getPrincipal() instanceof SentinelUserDetails details)) {
            throw new IllegalArgumentException("WebSocket subscription requires authenticated staff");
        }

        String destination = accessor.getDestination();
        if (destination == null) {
            throw new IllegalArgumentException("Missing subscription destination");
        }

        String allowed = "/topic/tenants." + details.getTenantId() + ".cases";
        if (!allowed.equals(destination)) {
            throw new IllegalArgumentException("Subscription not allowed for this tenant");
        }
    }

    private static String firstHeader(StompHeaderAccessor accessor, String name) {
        List<String> values = accessor.getNativeHeader(name);
        return values == null || values.isEmpty() ? null : values.get(0);
    }
}
