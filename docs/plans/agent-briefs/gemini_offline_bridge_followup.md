# Follow-up for Gemini: after the Nov 9 round

Your Nov 9 round was reviewed on 2026-11-09: Waves 3.1, 3.3 and 3.5, T9 cache-first boot, the `HUMAN_ORIGINS` allowlist, the `download_zip` caps, the offline protected-file case, boot during a network drop, conflict files out of packs, and the md-db groundwork. Most of it holds up. Claude fixed four problems in two patches that land before the release. This brief says what changed in your code, then what comes next.

The roadmap now has four goalposts: a) review ready, b) demo ready, c) 1.0, d) after 1.0. Your track's priorities, in order: hardening Claude hands you explicitly (this brief's section 2), then the tracker on md-db, then chat and agent. God-object waves fill the gaps between them, except where they touch the same files. Anything that gives the agent new powers still waits for S5, S7 and S9.

## 1. What Claude changed in your code (read before touching these files)

- **T9 staging (`sutram/js/sw-core.js`, `sutram/js/offline.js`).** A complete newer build is now recorded as pending in a `sutram-meta` cache, not switched to. The running page keeps its own build, including extensions imported after boot, until the next page load; the service worker promotes the pending build on a navigation request and deletes the other build caches then. The active build's name is also kept in `sutram-meta`, so a service worker restart (frequent on iOS) never picks the newest cache by key order. The `activate` handler keeps the recorded active build, a pending build and `sutram-meta`. Test 14b in `test_sutram_registry.py` checks the staging.
- **No build ID route.** The `/api/system/build_id` in `engine_system.py` returned the daemon's start time, which never matches the page's content build ID, so every load looked like a new build; it was removed. The one in `app.py` sat behind authentication and the staging fetch sends no token, so it always returned 401; it was removed too, along with `serverBuildIdUrl` in `system.js`. The build ID comes from the `/` response (the `X-InSetu-Build-ID` header and the meta tag), computed by `compute_build_id` in `app.py`.
- **Staging bypasses the service worker** (`sw-core.js`, `offline.js`). Away from localhost the worker answers cache-first, so the staging check's own `fetch('/')` and asset fetches got the cached shell: build IDs always matched and no update was ever found, and a found update would have been filled with cached files. Staging requests now carry `X-Sutram-Revalidate: 1`, and the worker passes those to the network. Normal navigations stay cache-first. Verified on the user's phone setup 2026-11-10: edit, reload shows "Update ready", next reload runs the new build.
- **Conflict files.** `topology.audit_upkeep` is read-only again: it reports `conflict_files` and skips `node_modules`, `__pycache__` and virtualenvs. Deleting moved to a new human-only route, `topology/clean_conflicts` (POST, `mcp_expose=False`, in `ROUTINE_BANNED_CAPABILITIES`). It takes the exact files a person reviewed and refuses any path that is not a `*.conflict_*` file. A conflict file holds the other side of a concurrent save, so an agent must never be able to delete one.
- **Confirm & Commit (`agent.js`).** It now sends `repair_mode` `'algorithmic'` (or `'off'`) and `auto_heal: false`. AI repair stays a dry-run step, so healed code is always seen before it is written.
- **Telemetry context.** `compile_ai_telemetry_context` no longer runs after every commit; it runs on demand through `bridge.compile_telemetry`.

## 2. Hardening handed to you

1. **T9's build ID misses files.** `compute_build_id` covers `templates/index.html`, `static/sw.js`, `static/vendor.json`, `static/js/app.js` and the `*.js` under `core/` and `extensions/`. It misses the vendored sutram files under `static/vendor/` (other than `vendor.json`), CSS, and other templates, so a sutram-only update goes unnoticed under cache-first. Hash every file the service worker caches, by content rather than mtime so two installs of one release agree.
2. **The 426 branch in `api.js` never runs.** The server never sends 426. Either remove it or make the server send it on a real version mismatch. The update notice that works is `onUpdateReady` in `system.js`.
3. **sutram backend adapter Sprint 1** (`docs/plans/2026-11-09-sutram-backend-adapter-and-akasa-transport-contract.md`): akasa stamps the build ID on every response and on the bootstrap envelope, so it no longer depends on `app.py` rendering the shell. (`/api/system/build_id` and `serverBuildIdUrl` are already gone.) Sprints 2 to 4 are at 1.0.
4. **Test T9 through the real service worker.** Its tests mocked `fetch` directly, which is how the cache-first bypass bug got past them. Add a Node test that loads `sw-core.js`'s fetch handler with a fake `caches` and network and runs the staging check through it: a cached build plus a newer server build must stage the server's files, an unmarked navigation must still be answered from the cache, and an unreachable server must leave the active build untouched.
5. *(Removed 2026-11-10: "Update ready" becomes an N1 notice from a browser-side source, in Claude's N1 Sprint 1. Leave the status message as it is until then.)*

6. **Pay back the size ceilings.** The Nov 9 round grew eleven modules past the `MODULE_LINE_RATCHET` ceilings you had just set. To unblock the release, Claude raised them to the real sizes and marked each "Nov 9" in `tests/fitness/rules_python.py`. Bring the big ones back down by splitting, not trimming:
    - `agent.js` (1,276; was 1,085): move the Staged Patch Stacks and helper-mode panels into their own components.
    - `engine_bridge.py` (1,023; was 825): move `compile_ai_telemetry_context`, its route and the heal-audit logging into a `bridge_telemetry.py`.
    - `bridge_fuzzy.py` (974; was 815): the sandwich fuzzy anchor into its own module.
    - `engine_llm.py` (921; was 812): LLM call telemetry next to `llm_drivers.py`.
    - `orchestrator.py` (1,902; was 1,771): Wave 3.2, with agent plan Sprint 1.
    - The small overruns (`engine_topology.py`, `ui_system_settings.js`, `bridge_vfs.py`, `system.js`, `bridge.js`, `engine_agent.py`) come down as those files are next touched.
    Lower each ceiling to the new size in the same change.
7. **What else the test run found** (fixed by Claude, so you know): `MarkdownLanguageProvider` lacked `call_sites`; its wikilink pattern had `\vert` where `|` was meant; registering it for `.md` made the cartographer map document headings into CODE_INDEX.md, so providers now declare `indexes_code_symbols` (False for Markdown); mustache interpolation lost nested fallbacks, now resolved inside out with values never rescanned; `compaction_strategy` and `rag_strategy` were still read after being removed from the schema.

## 3. P19: helper modes (chat and agent, small)

Replace the single `helper_mode` choice with three: `deterministic`, `ai_assisted`, `custom`. `custom` shows one setting per helper:

- the context scout (`blast_radius` or `llm_scout`);
- history compaction (`deterministic` or `llm_compactor`);
- routine patch repair (`off`, `algorithmic` or `ai_assisted`), used by a routine's `bridge.sync` step.

The Yomama (Bridge) page's repair mode is a separate setting and stays separate: `helper_mode` must never change it, and the Bridge page must never read `helper_mode`. Read the three effective values in one place on the server (one helper that returns them, used by `orchestrator.py` and `engine_agent.py`), not with three `if helper_mode in (...)` fallbacks as now. The orchestrator currently falls back to `ai_assisted` while compaction falls back to empty; one function fixes that. The default is `ai_assisted` (decided 2026-11-09). With no API key or provider configured it must short-circuit to deterministic: put that in the same helper, so every caller gets it, and show it in the settings ("Deterministic: no API key") rather than leaving a silent difference between the setting and what runs. Add a test for the no-key case. A key that hits its quota or rate limit also falls back to deterministic for that turn, with a notice, instead of failing the turn.

## 4. P20: the tracker on md-db (first big item)

`docs/plans/2026-11-09-mddb-and-tracker-streamlining.md`, Sprints 1 to 4. Its "Roadmap placement" section was empty; Claude filled it (demo ready, first on your track). The minimum demo needs Sprints 1 to 3; Sprint 4's full verification suite can follow. The point: the tracker had fallen back to an after-the-fact change log, and a clear md-db contract should make it a daily tool again. Notes from the review:

- The migration keeps today's tracker entries readable: make it reversible, or keep reading the old layout for one release.
- Add the per-save event count to `tests/performance/` before Sprint 2 (see below), not after.

- `apply_declarative_schema`'s `__constraints__` only apply when a table is created; an existing table never gets them. Either say so in the schema docstring and plan, or add a migration path that rebuilds a table when its constraints change.
- `ctx://` and `ws://` mutations now enter `topology_resolved` as `ctx_events`. Keep compiled `ctx://contexts/` and `ctx://diffs/` out, and bound them with the per-save count (events per save, log lines per save).
- Sprint 4's verification suite should include the md-db parity entry if any md-db logic runs in the browser (the parallel-logic rule, `tests/parity/`).

## 5. P18: the agent sandbox and loop

There is now one plan for it: `docs/plans/2026-11-10-agent-loop-and-sandbox.md` (roadmap P1, P18 and P19). It replaces the separate design note this brief asked for earlier. Wait for the user to answer its OPEN questions before starting Sprint 1. Its Sprint 0 (git plumbing into `insetu/core/git/`, and the git extension renamed Bonsai with a one-release migration) comes first and does not depend on the open questions; start it after P20's Sprint 3. Claude reviews the core git interface before Sprint 1 builds on it. Wave 3.2 (splitting `orchestrator.py`) lands with Sprint 1, along the run's seams. Sprint 2's rebase waits for Claude's merge fix (issue #18).

Until Sprint 1 lands, a routine's `bridge.sync` step keeps its current behaviour (issue #19 in `claude/preexisting-issues.md`).

## 6. Then

P1's loop features that add no new powers (budgets, stop conditions, transcripts, resumable sessions); after that, the 1.0 steps on the Roadmap tab.

## What to send back

The diff per repository and a short summary as before, plus the output of a full unit and fitness run on the changed tree. The Nov 9 round shipped with an import error (`MarkdownLanguageProvider` lacked the abstract `call_sites`) that broke 25 test modules and put core into degraded mode at boot, and with module size ceilings set below the files' final sizes; a run before sending would have caught both. For P19 and P20, include the default you and the user picked, and the test names that prove each sprint's done-when.
