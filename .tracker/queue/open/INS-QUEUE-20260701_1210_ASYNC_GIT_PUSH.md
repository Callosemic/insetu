---
id: INS-QUEUE-20260701_1210
title: "Offload Git Push Transactions to Non-Blocking Background Worker"
created_at: 2026-07-01T12:10:00
closed_at: null
sub_bucket: "None"
tags: [backend, architecture, git, performance, asynchronous]
---

## Description
Executing remote repository synchronization operations synchronously within the `/api/git/push` transaction thread blocks the main HTTP event loop, violating the *I/O Block Ban*. If an SSH connection handshake or object upload sequence takes more than a few seconds, the browser drops the silent network socket prematurely, resulting in a false-negative "Network Error" display even when the underlying OS command completes successfully.

## Action Items
- [ ] **Refactor Git Push Execution Layer:** Modify `api_git_push` and `api_git_sweep_push` to accept incoming parameters, perform pre-flight checks, and immediately dispatch a background task receipt.
- [ ] **Leverage Non-Blocking Status Blocks:** Change the HTTP response strategy to issue an instant `202 Accepted` packet to release the client thread immediately.
- [ ] **UI Progress Feedback Handling:** Update the frontend push modal to listen for server-sent event pulses or utilize non-blocking polling tickers to monitor the background synchronization completion safely.