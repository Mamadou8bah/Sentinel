package com.sentinel.platform;
import java.security.Principal;
public record PlatformPrincipal(Long id, String username) implements Principal {
    @Override public String getName() { return username; }
}
