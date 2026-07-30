---
repo: "insetu"
type: "bug"
status: "closed"
id: INS-BUG-20260708_1615_CITATION_CACHE_LOOP
title: "Citation Metadata Cache Re-Indexing O(N) Loop"
created_at: 2026-07-08T16:15:00
closed_at: 2026-07-29T09:38:39
sub_bucket: "None"
tags: ["Backend", "Performance"]
---

## Description
In `engine_citations.py`, `_rebuild_metadata_cache()` triggers on every citation import or deletion. It reads the *entire* SQLite citations table into memory, parsing every JSON blob to rebuild the unique authors and publications lists in an O(N) loop. 
This needs to be converted to a targeted SQL `UPSERT` against a separate relational mapping table, or the metadata of the single incoming/outgoing record must be surgically appended to the cache object in memory.

## Notes / Execution Log