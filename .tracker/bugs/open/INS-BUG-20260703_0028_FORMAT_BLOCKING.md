---
repo: "insetu"
type: "bug"
status: "open"
id: INS-BUG-20260703_0028_FORMAT_BLOCKING
title: "I/O Block Ban Violation: Async Pandoc Document Compilation"
created_at: 2026-07-03T00:28:00
closed_at: null
sub_bucket: "None"
---
## Description
The new `compile_document_payload` function in `engine_format.py` relies on a heavy, synchronous `subprocess.run(['pandoc', ...])` call. Because this is executed synchronously by the `/api/<workspace_id>/fs/compile-document` REST route, PDF and Word Document rendering will block the ASGI/Flask event loop entirely. This creates significant hang risks for other users navigating the OS during document compilation. 

## Action Items
- [ ] Offload document compilation to the Metronome Dispatcher or the Background ThreadPool queue.
- [ ] Return a `202 Accepted` response with a job ID and implement a polling/notification mechanism for the client.