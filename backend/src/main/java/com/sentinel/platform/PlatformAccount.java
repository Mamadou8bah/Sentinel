package com.sentinel.platform;

import jakarta.persistence.*;
import java.time.Instant;

/** Platform operators have no tenant and cannot become tenant staff implicitly. */
@Entity @Table(name = "platform_accounts")
public class PlatformAccount {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true, length = 64) private String username;
    @Column(nullable = false) private String passwordHash;
    @Column(nullable = false) private boolean enabled = true;
    @Column(nullable = false) private long sessionVersion;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    public Long getId() { return id; }
    public String getUsername() { return username; }
    public void setUsername(String value) { username = value; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String value) { passwordHash = value; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean value) { enabled = value; }
    public long getSessionVersion() { return sessionVersion; }
    public void revokeSessions() { sessionVersion++; }
    public Instant getCreatedAt() { return createdAt; }
}
