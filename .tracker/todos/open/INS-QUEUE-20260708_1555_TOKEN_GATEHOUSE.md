---
repo: "insetu"
type: "todo"
status: "open"
id: INS-QUEUE-20260708_1555_TOKEN_GATEHOUSE
title: "The Unified Token Gatehouse & Tailscale Auth"
created_at: 2026-07-08T15:55:00
closed_at: null
sub_bucket: "None"
delivery_date: "2026-08-09"
tags: ["Security", "Backend", "Auth"]
---

## Description
Build out the unauthenticated \`/auth/bootstrap\` routing endpoint.
Configure it to check incoming connection addresses natively against the server's local Tailscale Unix socket daemon (\`/var/run/tailscale/tailscaled.sock\`) to verify user profiles.
Hand down a rolling, in-memory browser session token to immunize your open local REST paths from Localhost Drive-By CSRF vulnerabilities.

## Notes / Execution Log
