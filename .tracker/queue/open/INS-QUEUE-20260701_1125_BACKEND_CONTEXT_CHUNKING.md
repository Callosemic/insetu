---
id: INS-QUEUE-20260701_1125_BACKEND_CONTEXT_CHUNKING
title: "Offload RAG Context File Chunking to Backend Compilation Pipeline"
created_at: 2026-07-01T11:25:00
closed_at: null
sub_bucket: "None"
tags: [backend, performance, gather, optimization, memory]
---

## Description
The context file download engine currently routes unsegmented, monolithic text payloads across the rest layer. The frontend (`fs.js`) attempts to execute synchronous regex slicing strings into ~300kb parts to preserve safety boundaries. For larger workspaces (15mb+), this implementation risks thread stuttering, interface latency, and sudden memory exhaustion crashes on mobile runtimes, violating the *Low Memory Footprint Mandate*.

## Execution Plan
- **Backend Stream Serialization (`engine_gather.py`):**
    - Refactor `generate_context_file` and `compile_batch` loops to track running content length bytes during disk consolidation.
    - Implement a parameterized configuration limit (e.g., default `300000` characters per block).
    - Automatically fragment single massive batch text allocations into sequential file structures on disk: `[batch_id]_context_part_1.txt`, `[batch_id]_context_part_2.txt`.
- **Manifest Architecture Mapping:**
    - Ensure the backend automatically includes each distinct subset path in the output `manifest.json` matrix generation tracking array.
- **Frontend Cleanup (`fs.js`):**
    - Completely remove the manual text parsing arrays and dynamic sub-card DOM insertions from the `createFileCard` wrapper.
    - Simplify the card to map direct individual download buttons per manifest piece, relying on standard backend streaming channels.