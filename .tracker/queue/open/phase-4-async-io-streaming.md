---
title: "Phase 4: Asynchronous I/O & Streaming"
status: "Todo"
type: "Architecture"
created: "2026-06-26"
sub_bucket: "None"
---

## Description
# Asynchronous I/O & Streaming

Prevent the web server from hanging during heavy workspace compilation.
### Action Items
- [ ] Move `engine_gather.py` and `compiler.py` executions into asynchronous background task queues.
- [ ] Offload the thread-blocking `api_generate_diffs()` handler in `app.py` to the metronome task queue to prevent HTTP event loop starvation during deep workspace sweeps.
- [ ] Add a WebSocket or Server-Sent Events (SSE) layer to `app.py`.
- [ ] Eradicate long-polling debt by removing the 3-second layout refresher loop (`setInterval`) inside the `research` extension panel and porting it to use Server-Sent Events.
- [ ] Update frontend to receive streaming progress events (e.g., "Compressing JS...") via the reactive `store.js`. [cite: 3154]
- [ ] Replace blocking HTTP wait states with instant `202 Accepted` responses. [cite: 3155]
