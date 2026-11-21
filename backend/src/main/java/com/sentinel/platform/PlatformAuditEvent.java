package com.sentinel.platform;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "platform_audit_events")
public class PlatformAuditEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 64) private String actor;
    @Column(nullable = false, length = 64) private String action;
    private Long tenantId;
    @Column(nullable = false, length = 1000) private String detail;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    protected PlatformAuditEvent() {}
    public PlatformAuditEvent(String actor, String action, Long tenantId, String detail) {
        this.actor = actor; this.action = action; this.tenantId = tenantId; this.detail = detail;
    }
    public Long getId() { return id; }
    public String getActor() { return actor; }
    public String getAction() { return action; }
    public Long getTenantId() { return tenantId; }
    public String getDetail() { return detail; }
    public Instant getCreatedAt() { return createdAt; }
}
