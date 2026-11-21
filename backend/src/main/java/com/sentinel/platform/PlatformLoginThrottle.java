package com.sentinel.platform;

import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Component
public class PlatformLoginThrottle {
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private record Window(long expiresAt, int attempts) {}
    public synchronized void check(String remoteAddress) {
        long now = System.currentTimeMillis();
        windows.entrySet().removeIf(e -> e.getValue().expiresAt() <= now);
        Window previous = windows.get(remoteAddress);
        if ((previous != null && previous.attempts() >= 10) || (previous == null && windows.size() >= 10000))
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many sign-in attempts. Try again in 15 minutes.");
        windows.put(remoteAddress, new Window(previous == null ? now + 900000 : previous.expiresAt(),
                previous == null ? 1 : previous.attempts() + 1));
    }
}
