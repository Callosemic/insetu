## 📅 The 2-Month Hardening Timeline (Summer 2026)

### 🚀 Weeks 1–2: UI Component Graduation, Native Hash Routing & Offline Resilience

**Execution Window:** July 13, 2026 – July 26, 2026

* **UI Component Graduation**: Systematically refactor `citations`, `format`, `ingest`, and `term` into declarative LitElement components, stripping legacy DOM manipulations.
* **Shifting to the Hash Router (`INS-QUEUE-20260707_1938_NATIVE_HASH_ROUTER`)**: Establish `window.location.hash` as the SSOT for browser-side state using the format `#/{workspace_id}/{tab}/{sub-tab}/{deep_path}`.
* **The Offline Typewriter (`INS-QUEUE-20260704_1700_OFFLINE_TYPEWRITER`)**: Build an IndexedDB fallback layer to allow seamless offline markdown writing and queued save mutations.
* **JS Formatter Hooks (`INS-QUEUE-20260705_0141_FORMATTER_HOOKS`)**: Expose the Python JS Formatter in the UI and via Git pre-commit hooks.
---

### 🛡️ Weeks 3–4: Secure Identity Foundations, Global Vault & OpenAPI
    
**Execution Window:** July 27, 2026 – August 9, 2026

* **The Unified Token Gatehouse**: Wire up the unauthenticated `/auth/bootstrap` to verify Tailscale Unix socket user profiles.
* **Tier 2 Credentials Vaulting (`INS-TODO-20260703_1300_TIER2_CONFIG_EDITOR`)**: Securely manage global API keys in `~/.insetu/global_settings.json`.
* **Automated OpenAPI Spec (`INS-QUEUE-20260701_1140`)**: Implement offline compile-time OpenAPI generation via AST docstring inspection.
* **Cross-Platform Daemon (`INS-TODO-20260703_1045_CROSS_PLATFORM_DAEMON`)**: Deploy a macOS `launchd` service architecture inside `cli.py`.
---

### 🏛️ Weeks 5–6: Asynchronous Core Engines & The VFS Masterpiece

**Execution Window:** August 10, 2026 – August 23, 2026

* **Async Streaming (`phase-4-async-io-streaming`)**: Move context compilations into the `immediate_jobs` ledger.
* **The Virtual File System (`phase-5-virtual-file-system`)**: Run native Python AST evaluations before physical IO flushing to guarantee rollback isolation.
* **Yomama Capabilities Expansion**: Implement Regex Anchoring (`INSETU-QUEUE-20260702_0907_06`), granular patch controls (`INS-QUEUE-20260708_0943`), skip no-ops (`INS-TODO-20260708_0940`), and Genesis Patch warnings (`API-TODO-20260706_1603`).
---

### 📦 Weeks 7–8: Open-Source Hardening & Platform Launch

**Execution Window:** August 24, 2026 – September 6, 2026

* **Docker Environment (`INS-QUEUE-20260703_1200_DOCKER_ENVIRONMENT`)**: Multi-stage dependency lockdown for Pandoc, LaTeX, and Headless Chrome.
* **Release Management UI (`feature-release-ui-extension`)**: Inject a domain-specific extension to handle automated `bump-my-version` Git tagging.
* **Open Source Release (`milestone-open-source-release`)**: Sanitize internal tokens, build the `insetu init` onboarding wizard, and push the master repository to Callosemic.

---

## 🛠️ Detailed Schedule Matrix

| Target Window | Core Technical Milestones | Key Verification Check | Linked Tickets |
| --- | --- | --- | --- |
| **July 13 – July 26** | Convert `citations`, `format`, `ingest`, `term` to Lit.<br>Deploy native hash routing.<br>Integrate Offline Typewriter (IndexedDB).<br>Evaluate JS Formatter Hooks. | State persists natively on manual reloads.<br>Offline DB queues writes safely. | `INS-QUEUE-20260707_1938_NATIVE_HASH_ROUTER`<br>`INS-QUEUE-20260704_1700_OFFLINE_TYPEWRITER`<br>`INS-QUEUE-20260705_0141_FORMATTER_HOOKS` |
| **July 27 – August 9** | Wire up Tailscale whois checks.<br>Build Global Credentials Tier 2 vault.<br>Automated OpenAPI Spec.<br>macOS launchd Daemon. | Unauthorized requests drop (401).<br>Tokens vault to `global_settings.json`. | `INS-TODO-20260703_1300_TIER2_CONFIG_EDITOR`<br>`INS-QUEUE-20260701_1140`<br>`INS-TODO-20260703_1045_CROSS_PLATFORM_DAEMON` |
| **August 10 – August 23** | Complete Async I/O & VFS Masterpiece.<br>Yomama Regex Anchoring.<br>Granular patch controls.<br>Skip no-ops & Genesis warnings. | Corrupted patches fail AST.<br>REST threads respond instantly. | `phase-4-async-io-streaming`<br>`phase-5-virtual-file-system`<br>`INSETU-QUEUE-20260702_0907_06`<br>`INS-QUEUE-20260708_0943`<br>`INS-TODO-20260708_0940`<br>`API-TODO-20260706_1603` |
| **August 24 – September 6** | Package multi-stage Docker environment.<br>Build Release Management UI.<br>Perform `insetu init` onboarding setup & Open Source Launch. | Container runs via compose.<br>Public repository is scrubbed of internal keys. | `INS-QUEUE-20260703_1200_DOCKER_ENVIRONMENT`<br>`feature-release-ui-extension`<br>`milestone-open-source-release` |

