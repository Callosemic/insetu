---
title: "Phase 1.5: V1 Tech Debt & Standards Compliance"
status: "closed"
type: "Architecture"
created: "2026-06-26"
closed_at: "2026-06-28T19:54:17"
---
# Tech Debt Cleanup

Address the three lingering violations of the `01_engineering_standards.md` document before embarking on the massive V2 architectural migrations.
### Action Items
- [x] ~~**Hardcoded Spatial Physics (Rule 1):**~~ *(Invalidated: workspaces.json must remain strictly anchored to the host daemon's OS working directory to prevent circular dependency lockouts during profile swaps).*
- [x] ~~**The Cartography Contract (Rule 1):**~~ *(Invalidated: Yomama must bypass strict Cartography filters to retain its omniscient ability to patch arbitrary filetypes not yet mapped to the active configuration).*
- [x] ~~**DRY Utility Centralization (Rule 1):**~~ *(Invalidated: Yomama requires strict, unforgiving parsing on the Write-Path to trigger atomic rollbacks and protect the disk. Failing gracefully here would commit hallucinated garbage to disk. The run_formatter script will be handled on an ad-hoc basis).*
- [x] **Immutable Recovery Bootloader:** Intercept the main Flask app boot sequence. If a `SyntaxError` or `ImportError` occurs, boot a "Recovery OS" that explicitly mounts an isolated, known-working copy of the patch bridge (e.g., `fallback_bridge.py`) so the system can heal itself even if the primary `engine_bridge.py` is corrupted.
- [x] **The Lifeboat FS:** Within the `fallback_bridge.py` monolith, implement a zero-dependency HTML file browser and download router (`send_file`). This ensures that if the workspace is irreparably bricked, the user can still navigate `localhost:5005` to manually download and evacuate their files.