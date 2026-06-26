---
title: "Phase 1.5: V1 Tech Debt & Standards Compliance"
status: "Todo"
type: "Architecture"
created: "2026-06-26"
---
# Tech Debt Cleanup

Address the three lingering violations of the `01_engineering_standards.md` document before embarking on the massive V2 architectural migrations.

### Action Items
- [ ] **Hardcoded Spatial Physics (Rule 1):** Update the `/api/system/workspaces` route in `app.py` to use `_resolve_workspace_physics()` from `utils_core.py` rather than hardcoding the `os.getcwd()` path.
- [ ] **The Cartography Contract (Rule 1):** Refactor the Smart Resolution Engine's `os.walk` loop in `app.py` to pull its directory exclusions dynamically from the active config's `ignore_dirs` instead of relying on a hardcoded tuple.
- [ ] **DRY Utility Centralization (Rule 1):** Eradicate raw `json.load()` and `json.loads()` calls in `app.py` and `engine_format.py` (specifically in `api_fs_save`, `api_workspaces`, and `run_formatter`), forcing them to route through the safe JSON handlers in `utils_core.py`.
- [ ] **Immutable Recovery Bootloader:** Intercept the main Flask app boot sequence. If a `SyntaxError` or `ImportError` occurs, boot a "Recovery OS" that explicitly mounts an isolated, known-working copy of the patch bridge (e.g., `fallback_bridge.py`) so the system can heal itself even if the primary `engine_bridge.py` is corrupted.
- [ ] **The Lifeboat FS:** Within the `fallback_bridge.py` monolith, implement a zero-dependency HTML file browser and download router (`send_file`). This ensures that if the workspace is irreparably bricked, the user can still navigate `localhost:5005` to manually download and evacuate their files.