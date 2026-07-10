---
repo: "insetu"
type: "todo"
status: "logged"
id: INS-QUEUE-20260701_1030_DOWNLOAD_PIPELINE_UNIFICATION
title: "Unify Extension Download Patterns via downloadFile Pipeline"
created_at: 2026-07-01T10:30:00
closed_at: 2026-07-02T23:51:00
sub_bucket: "None"
---

## Description
The file download interfaces are currently split across fragmented implementations. While `fs.js` exposes a parameterized, platform-aware `downloadFile` method capable of handling adaptive mobile device sharing (Web Share API for iOS/Android sheets), modules like `app.js` (`fetchAndDownloadState`) and sections of `ext_git.js` still compile files via direct unparameterized fetch loops or raw string transformations.

## Action Items
- [ ] Refactor `fetchAndDownloadState` in `app.js` to funnel file data transactions straight to the updated `downloadFile` pipeline wrapper.
- [ ] Sweep all running extension views to replace hardcoded window click link elements with standard `downloadFile(url, filename, options)` method parameters.
- [x] Verify clean, unified share-sheet activation on mobile target environments (Android/iOS) for prompt libraries, workspace files, and document publications.

## Notes / Execution Log
* **Resolution (2026-07-02):** `fetchAndDownloadState` in `app.js` was successfully refactored to route transactions directly through the `downloadFile` pipeline in `fs.js`. This guarantees that mobile share-sheet activations and standard desktop download behaviors are harmonized across the application.