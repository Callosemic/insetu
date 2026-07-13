---
repo: "insetu"
type: "bug"
status: "logged"
id: INS-BUG-20260703_0028_FORMAT_BLOCKING
title: "I/O Block Ban Violation: Async Pandoc Document Compilation"
created_at: 2026-07-03T00:28:00
closed_at: 2026-07-05T01:49:15
sub_bucket: "None"
---
## Description
The `compile_document_payload` function in `engine_format.py` relied on a heavy, synchronous `subprocess.run(['pandoc', ...])` call.
## Resolution
Document formatting was successfully isolated to the background worker pool using `submit_immediate_job`. The REST controller now immediately releases the HTTP thread with a `202 Accepted` payload. The frontend (`ext_format.js`) polls the job status via the central metronome and triggers the unified `downloadFile` pipeline upon completion.