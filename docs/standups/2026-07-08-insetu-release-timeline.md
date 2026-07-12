## 📅 The 3-Month Hardening Timeline (Summer/Fall 2026)
### 🚀 Phase 1: API Gateway & Foundation Polish

**Execution Window:** July 13, 2026 – July 26, 2026

* **Explicit API Client (ADR 0016)**: Build `window.inSetu.api` and migrate existing extensions off the greedy fetch rewriter.
* **Extension SDK Blueprint (`INS-TODO-20260709_2219_EXTENSION_SDK`)**: Scaffold `InSetuElement`, the Flask `Extension` wrapper, and declarative SQLite schemas.
* **Native Hash Routing (`INS-QUEUE-20260707_1938_NATIVE_HASH_ROUTER`)**: Establish `window.location.hash` as the SSOT for browser-side state using the format `#/{workspace_id}/{tab}/{sub-tab}/{deep_path}`.
* **Bug Fixes**: Resolve broken archive routes (`INS-BUG-20260708_1654`), Citations UDF Bleed (`INS-BUG-20260710_1143`), and Config Editor refresh failures (`INS-TODO-20260709_1738`).
---

### 🛡️ Phase 2: Secure Identity & UI Primitives

**Execution Window:** July 27, 2026 – August 9, 2026

* **The Offline Typewriter (`INS-QUEUE-20260704_1700_OFFLINE_TYPEWRITER`)**: Build an IndexedDB fallback layer and queue. Benefits from the new API Client intercept.
* **The Unified Token Gatehouse**: Wire up the unauthenticated `/auth/bootstrap` to verify Tailscale Unix socket user profiles.
* **Tier 2 Credentials Vaulting (`INS-TODO-20260703_1300_TIER2_CONFIG_EDITOR`)**: Securely manage global API keys in `~/.insetu/global_settings.json`.
* **UI DRY Primitives (`INS-QUEUE-20260709_1120_UI_DRY_PRIMITIVES`)**: Extract repeating layout strings into `<insetu-input-group>`, `<insetu-spinner>`, and `<insetu-dropdown>`.
* **Universal Repo Pins (`INS-TODO-20260709_1121`)**: Standardize repository filter pills across the ecosystem.
---

### 🏛️ Phase 3: Async Core Engines & Data Layer

**Execution Window:** August 10, 2026 – August 23, 2026

* **Manifest SQLite CQRS Migration (`INS-QUEUE-20260710_1221_MANIFEST_CQRS`)**: Deprecate `manifest.json` in favor of an embedded SQLite ledger and delta payload synchronization.
* **Thread/Search Starvation Fixes**: Offload URL ingestion, Quick-Packs, and Deep Link searches to the `immediate_jobs` ledger (`INS-QUEUE-20260708_1605_THREAD_STARVATION`, `INS-QUEUE-20260708_1610_SEARCH_STARVATION`).
* **Async Streaming & VFS Masterpiece (`phase-4-async-io-streaming`, `phase-5-virtual-file-system`)**: Finalize async Git Push operations and AST syntax protections.
* **Automated OpenAPI Spec (`INS-QUEUE-20260701_1140`)**: Implement offline compile-time OpenAPI generation via AST docstring inspection.
---

### 🎨 Phase 4: UX Polish, Diffing & Yomama Expansion

**Execution Window:** August 24, 2026 – September 20, 2026 *(Expanded to ensure quality)*

* **CM6 Side-by-Side Diff Viewer (`INS-QUEUE-20260710_0145`)**: Implement `@codemirror/merge` for robust bridge collision visualization.
* **Dynamic Quick-Packs (`INS-QUEUE-20260710_1221`)**: Refactor quick-packs to store rule templates for JIT assembly.
* **Yomama Capabilities Expansion**: Implement Regex Anchoring (`INSETU-QUEUE-20260702_0907_06`), granular patch controls (`INS-QUEUE-20260708_0943`), skip no-ops (`INS-TODO-20260708_0940`), and paste sanitization (`INS-TODO-20260709_1032`).
---

### 📦 Phase 5: Infrastructure & Open Source Launch

**Execution Window:** September 21, 2026 – October 4, 2026

* **Cross-Platform Daemon (`INS-TODO-20260703_1045_CROSS_PLATFORM_DAEMON`)**: Deploy a macOS `launchd` service architecture inside `cli.py`.
* **Docker Environment (`INS-QUEUE-20260703_1200_DOCKER_ENVIRONMENT`)**: Multi-stage dependency lockdown for Pandoc, LaTeX, and Headless Chrome.
* **Release Management UI (`feature-release-ui-extension`)**: Inject a domain-specific extension to handle automated `bump-my-version` Git tagging.
* **Open Source Release (`milestone-open-source-release`)**: Sanitize internal tokens, build the `insetu init` onboarding wizard, and push the master repository to Callosemic.
---

## 🛠️ Detailed Schedule Matrix

| Target Window | Core Technical Milestones | Key Verification Check | Linked Tickets |
| --- | --- | --- | --- |
| **July 13 – July 26** | Build Explicit API Client.<br>Deploy Extension SDK (`InSetuElement`, `Extension`).<br>Deploy native hash routing. | Raw `fetch` usage throws linter errors.<br>State persists natively on manual reloads. | `ADR-0016`<br>`INS-TODO-20260709_2219_EXTENSION_SDK`<br>`INS-QUEUE-20260707_1938_NATIVE_HASH_ROUTER` |
| **July 27 – August 9** | Integrate Offline Typewriter (IndexedDB).<br>Wire up Tailscale whois checks.<br>UI DRY Abstractions. | Offline DB queues writes safely.<br>Unauthorized requests drop (401).<br>Tokens vault to `global_settings.json`. | `INS-QUEUE-20260704_1700_OFFLINE_TYPEWRITER`<br>`INS-QUEUE-20260708_1555_TOKEN_GATEHOUSE`<br>`INS-QUEUE-20260709_1120_UI_DRY_PRIMITIVES` |
| **August 10 – August 23** | Manifest CQRS Migration.<br>Thread/Search Starvation Cured.<br>Complete Async I/O & VFS Masterpiece. | Manifest reads from SQLite.<br>REST threads respond instantly.<br>Corrupted patches fail AST. | `INS-QUEUE-20260710_1221_MANIFEST_CQRS`<br>`INS-QUEUE-20260708_1605_THREAD_STARVATION`<br>`phase-4-async-io-streaming`<br>`phase-5-virtual-file-system` |
| **August 24 – Sept 20** | CM6 Diff Viewer.<br>Yomama Regex Anchoring & granular controls.<br>Dynamic Quick-Packs. | Visual diffs render cleanly.<br>LLM hallucination reverts work intuitively. | `INS-QUEUE-20260710_0145`<br>`INSETU-QUEUE-20260702_0907_06`<br>`INS-QUEUE-20260708_0943`<br>`INS-QUEUE-20260710_1221` |
| **Sept 21 – October 4** | macOS launchd Daemon.<br>Package multi-stage Docker environment.<br>Build Release Management UI.<br>Open Source Launch. | Container runs via compose.<br>Public repository is scrubbed of internal keys. | `INS-TODO-20260703_1045_CROSS_PLATFORM_DAEMON`<br>`INS-QUEUE-20260703_1200_DOCKER_ENVIRONMENT`<br>`feature-release-ui-extension`<br>`milestone-open-source-release` |

