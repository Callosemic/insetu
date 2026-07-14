---
repo: "insetu"
type: "todo"
status: "open"
id: "INS-TODO-20260713_1325_FILESYSTEM_OBSERVER"
title: "Abstract NonGitDirectoryWatcher into core FileSystemObserver macro"
created_at: "2026-07-13T13:25:00"
closed_at: null
sub_bucket: "None"
delivery_date: "2026-08-23"
tags: ["Architecture", "Backend", "SDK"]
---

## Description
Abstract the highly localized `NonGitDirectoryWatcher` substrate currently housed in `workers.py` into a generalized core system macro (e.g., `utils_core.FileSystemObserver`). 

### Objectives
* Generalize the watcher footprint so it is no longer strictly bound to updating the `nongit_fixtures` table.
* Expose an extensible API enabling dynamic functional extensions to hook host system filesystem events directly.
* Prevent optional or decoupled extensions from spinning up redundant, independent thread pools or file-watching daemons.

## Notes / Execution Log