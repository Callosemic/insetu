---
id: INS-QUEUE-20260628_2157
title: "Feature: Visual Configuration Editor Extension"
created_at: 2026-06-28T21:57:39
closed_at: null
sub_bucket: "None"
tags: [feature, ui, extension]
---

## Description
Build a visual Configuration Editor extension to eliminate the need for manual `config.json` manipulation.

**Execution Blueprint:**
1. **Settings Hook Injection:** Utilize the newly minted `zone:settings-menu` hook to inject a "Manage Workspace" and "Global Settings" button into the core OS settings dropdown.
2. **The Two-Tier Matrix:**
    * **Tier 1 (Workspace):** Provide a UI to toggle active extensions, define `target_repos`, map `sub_buckets`, and update `ignore_dirs` for the current profile.
    * **Tier 2 (Global):** Provide a secure vault UI for managing cross-workspace credentials (e.g., OpenAI keys, Jina Reader tokens) in `global_settings.json`.
3. **Data Safety:** The extension must validate the payload before writing to disk to prevent corrupted JSON from bricking the workspace on the next boot cycle.

## Notes / Execution Log