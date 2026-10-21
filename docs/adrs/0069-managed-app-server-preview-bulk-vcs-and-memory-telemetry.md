# ADR 0069: Managed App Server & Web Preview Extension, Bulk VCS Commit Architecture, and Backend Memory Telemetry

## Status
Accepted (2026-10-19)

## Context
As the inSetu Developer OS broadened support for full-stack, data-science, and documentation repositories, developers lacked an integrated, managed supervisor to run and preview applications:
1. **Unmanaged Local App Servers**: Running web applications (e.g., Vite, Hugo, MkDocs, Streamlit, FastAPI, Flask) required operators to open external terminal windows, manually allocate ports, resolve CORS/iframe issues, and handle process termination. When restarting or switching workspaces, orphaned server processes remained bound to host ports.
2. **Repetitive VCS Commit Sequences**: When collaborating across multiple diff buckets or sibling repositories, committing and pushing required sequential, single-diff modal flows. Operators lacked the ability to multi-select diff cards and execute a unified, atomic bulk commit and push.
3. **Backend Memory Telemetry Visibility**: While ADR 0068 introduced `/api/<workspace_id>/system/memory` and glibc `malloc_trim` controls, the Developer Dashboard (`dev`) lacked an integrated UI tab to visualize live RSS, virtual heap, active threads, and garbage collection object pools.
4. **Tailscale Serve Boot Deadlocks**: When the Tailscale daemon was stopped, unauthenticated, or missing, the `@hooks.on('topology_boot_complete')` auto-bind worker triggered long subprocess timeouts and raised unhandled exceptions, degrading boot responsiveness.
5. **Cross-Extension Settings Drift**: Several frontend extension stores (`git`, `skills`, `tracker`, `update`) lacked reactive listeners for settings updates dispatched from the unified Settings Hub.

## Decision
1. **Managed App Server & Web Preview Extension (`engine_preview.py`, `ext_preview.js`)**:
   - Implemented `preview` as a Tier 3 domain extension supporting 13 execution profiles: `auto`, `static` (featuring `NoCacheCORSHandler` HTTP server), `uvicorn`, `flask`, `django`, `streamlit` (iframe unblocked), `gradio`, `marimo`, `vite`, `storybook`, `mkdocs`, `hugo`, and `custom`.
   - Built sticky port allocation (`_allocate_free_port`) dedicating persistent ports in the `5100–5199` range to repositories in `.insetu/repo.settings.json`. If a port is occupied externally, the supervisor adopts it in `status: "external"` mode.
   - Built passive framework auto-detection (`_detect_repo_mode`) and repository-scoped virtualenv Python binary discovery (`_resolve_repo_python`).
   - Integrated a 1.5-second readiness and crash probe capturing startup tracebacks into an in-memory ring buffer (`collections.deque(maxlen=200)`).
   - Integrated automated Tailscale HTTPS serve binding (`tailscale serve --bg --https=<port>`) and opt-in boot auto-start (`auto_start: true`).
   - Managed lifecycle hooks: `@hooks.on('topology_boot_complete')` auto-boots pinned servers, while `@hooks.on('workspace_shutdown')` and `@hooks.on('system_shutdown')` terminate process groups cleanly via `os.killpg(pgid, signal.SIGTERM)`.
   - Developed `<insetu-ext-preview>` component featuring live iframe rendering, debounced auto-reload upon relevant VFS file mutations, subpath navigation, configuration drawer, server log drawer, and the `preview-html-file` polymorphic action with spatial pop-out capability (`allow_popout: true`).
   - Added unit test suite in `tests/unit/test_ext_preview_unit.py`.
2. **Bulk VCS Commit and Push Architecture (`engine_git.py`, `ext_git.js`)**:
   - Extended `_background_git_push` to accept `targets: Optional[list]`, allowing multiple diff buckets across single or multiple repositories to be staged and committed with a single commit message.
   - Replaced `concurrent.futures.ThreadPoolExecutor` in `generate_diff_context` with the shared Kernel I/O pool (`ctx.jobs.map_parallel`), and capped diff cache retention at 250 items to minimize heap fragmentation.
   - Registered `git-push` as a bulkable polymorphic action (`bulkable: true`, `targetEntities: ['diff']`, `bulkGroupKey: 'git-push'`) and updated `InSetuGitPushProjection` to render multi-target badges.
3. **Backend Memory & Heap Profiler UI (`ext_dev.js`)**:
   - Built `<insetu-ext-dev-memory>` under the `dev` extension (`dev:memory` sub-tab), inspecting live resident set size (VmRSS), heap arenas (VmData), active OS threads, VFS read cache, and JSON config cache.
   - Added collapsible breakdowns for active thread groupings, top Python object types in GC by shallow size, tracemalloc allocations, and one-click glibc `malloc_trim(0)` execution.
   - Added `user-select: text` and clipboard copy actions to developer dashboard system error cards.
4. **Tailscale Connection State Verification (`engine_tailscale.py`)**:
   - Implemented `_get_tailscale_backend_state` inspecting `tailscale status --json` before triggering `tailscale serve`. If the daemon is unconfigured, not logged in, or stopped, the boot hook fail-softly skips execution without timeout blocks.
5. **Cross-Extension Settings Reactivity**:
   - Subscribed `ext_git.js`, `ext_skills.js`, `ext_tracker.js`, and `ext_update.js` to `insetu-*-settings-changed` events, ensuring in-memory states rehydrate immediately when settings are updated in the Settings Hub.
6. **Flow Batch and Ingest Context Passing Fixes**:
   - In `engine_flow.py`, canonicalized prompt paths with `InSetuURI.canonicalize` and fixed `InSetuFlowEditProjection` to cleanly separate diffs from contexts, preventing false missing-file warnings.
   - In `engine_research.py`, updated `_extract_markdown_from_url` to pass `ctx` to the ingest parser.

## Consequences
* **Positive**: Fluid, zero-configuration local application server management and live web previewing inside the inSetu Developer OS.
* **Positive**: High-velocity bulk commits and pushes across multiple diff buckets with zero repetitive modal overhead.
* **Positive**: Real-time memory and thread observability with on-demand glibc heap trimming.
* **Positive**: Complete boot stability on machines without active Tailscale daemons.
* **Negative**: Managed development servers consume host ports and background system resources when running.