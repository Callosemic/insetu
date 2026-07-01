---
id: INSETU-QUEUE-20260622_0442_BLUEPRINTS
title: "Backend Maintainability: Modularize Flask App with Blueprints"
created_at: 2026-06-22T04:42:00
closed_at: 2026-07-01T07:25:00
tags: [backend, maintainability, architecture]
---
## Description
Break the monolithic `app.py` into smaller, logical Flask Blueprints (e.g., `routes/fs.py`, `routes/git.py`, `routes/bridge.py`). This will decouple the various inSetu backend domains and improve code navigability.

## Notes / Execution Log
