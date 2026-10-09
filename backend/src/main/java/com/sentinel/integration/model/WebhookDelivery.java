package com.sentinel.integration.model;
import jakarta.persistence.*;
import java.time.Instant;
@Entity @Table(name="webhook_deliveries")
public class WebhookDelivery {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
 @Column(nullable=false,unique=true,length=64) public String eventId;
 @Column(nullable=false) public Long tenantId;
 @Column(nullable=false,columnDefinition="TEXT") public String payload;
 @Column(nullable=false) public Instant createdAt;
 @Column(nullable=false) public Instant nextAttemptAt;
 public Instant deliveredAt;
 public int attempts;
}
