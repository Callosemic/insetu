---
title: "Phase 4: Asynchronous I/O & Streaming"
status: "Todo"
type: "Architecture"
created: "2026-06-26"
---
# Asynchronous I/O & Streaming

Prevent the web server from hanging during heavy workspace compilation.

### Action Items
- [ ] Move `engine_gather.py` and `compiler.py` executions into asynchronous background task queues.
- [ ] Add a WebSocket or Server-Sent Events (SSE) layer to `app.py`.
- [ ] Update frontend to receive streaming progress events (e.g., "Compressing JS...") via the reactive `store.js`.
- [ ] Replace blocking HTTP wait states with instant `202 Accepted` responses.