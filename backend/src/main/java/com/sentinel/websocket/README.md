# WebSocket module

**Owns:** real-time push to the **staff** ops desk.  
**Requirements:** FR-25 · NFR-2.

## What this module is

When KYC/document/TX jobs finish and cases open, compliance UIs need live updates without polling. STOMP over `/ws`, topic `/topic/cases`. Bank systems use **webhooks** (P1), not this channel.

## What’s here now

Scaffold (`spring-boot-starter-websocket` on classpath). Broker + publisher with case APIs.
