# WebSocket module

**Owns:** real-time push to the **staff** ops desk (FR-25 · NFR-2).

## What’s here now

- STOMP endpoint `/ws` (native + SockJS)
- Simple broker topics: `/topic/cases`, `/topic/tenants.{tenantId}.cases`
- `CaseEventPublisher` fires on case open / decide

Bank systems should use **webhooks**, not this channel.
