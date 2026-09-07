# CHANGELOG

<!-- version list -->

## v0.19.0 (2026-09-07)

### Bug Fixes

- **core**: Canonicalize vfs:// URI event payloads, resolve topology repo paths, and add ruamel.yaml
  frontmatter parsing
  ([`d4cec72`](https://github.com/Callosemic/insetu/commit/d4cec72e6c15a683841b40ab5610d99b34137a02))

### Features

- **cronic**: Add Cronic Job Manager extension and optimize ecosystem API & VFS boundaries
  ([`681d445`](https://github.com/Callosemic/insetu/commit/681d445b25b9cf4de798003789c008ddf341970c))

- **fitness**: Integrate Tree-sitter AST JavaScript linter, ruamel.yaml frontmatter engine, and
  dual-root manifest partitioning
  ([`caa4c15`](https://github.com/Callosemic/insetu/commit/caa4c157c2a1ee2141310f8e3ac6283f1201a45d))

- **sdk**: Integrate js-yaml frontmatter engine, offline outbox recovery, and storage quota
  management
  ([`966988f`](https://github.com/Callosemic/insetu/commit/966988f8f74354ac77ccaef4756ecdd31e2e2b6d))

- **vfs**: Add tree-sitter AST validation, OCC save conflicts, and workspace boot schema
  provisioning
  ([`bbb57b8`](https://github.com/Callosemic/insetu/commit/bbb57b8c7c236cfedf037f9e99bd43ff9bf036bd))


## v0.18.0 (2026-09-04)

### Features

- Implement offline outbox reconciliation, SW core vendorization, and security gate UI
  ([`fdf6ac6`](https://github.com/Callosemic/insetu/commit/fdf6ac698f81a05e2e1fd4c4459d41be85ea97dd))

- **client**: Implement offline SDK wrap, Sutram offline provider, and offline management engine
  ([`d917ebf`](https://github.com/Callosemic/insetu/commit/d917ebf0c865ae0cc1c7d16402ca98c89ab0c299))

- **extensions**: Standardize offline resilience, namespaced event dispatches, dev logs, and publish
  compilation
  ([`46c3462`](https://github.com/Callosemic/insetu/commit/46c34625160f404ee6dd3ee20697128c2faba13a))

- **kernel**: Add offline engine substrate, topology directory expansion, and content-hash gather
  idempotency
  ([`f0e501a`](https://github.com/Callosemic/insetu/commit/f0e501af41a7629a676a24454f8b4016190e1482))


## v0.17.0 (2026-08-31)

### Features

- **update**: Add GitHub token support and standardize release execution helpers
  ([`7a8d3b6`](https://github.com/Callosemic/insetu/commit/7a8d3b61fb034d42a6ee64c70fd09bb30f5f1abc))


## v0.17.0-beta.1 (2026-08-31)

### Bug Fixes

- **core**: Resolve bridge revert snapshot lookup and external repo logical path mapping
  ([`dcca1ff`](https://github.com/Callosemic/insetu/commit/dcca1ff706e9bfd90c5b2322fa7fc2d4882ceb40))

### Features

- Add explicit one-shot job scheduling, Stale-While-Revalidate caching, and sub-navigation fallback
  resolution
  ([`3f91277`](https://github.com/Callosemic/insetu/commit/3f91277a546f18a1325cb94e42f03ea8e4744be2))

- Standardize extension spinners, add terminal gestures, and enhance tracker dependencies
  ([`11ac2f7`](https://github.com/Callosemic/insetu/commit/11ac2f7cd0e567a331bcb7457146da5303b6f959))

### Refactoring

- **client-sdk**: Enforce non-destructive loading, Web Share API resilience, and ADR 0041 entity
  action purity
  ([`f577531`](https://github.com/Callosemic/insetu/commit/f577531cb453defe4cacd511d62124a1ed48c0e1))


## v0.16.1-beta.1 (2026-08-22)

### Bug Fixes

- Harden localhost auth csrf check, fix json vfs save mtime, and standardize extension workspace
  load lifecycle
  ([`7cf6b9a`](https://github.com/Callosemic/insetu/commit/7cf6b9ad3fe6a79adb28e9a1526392ed9e904ee9))

- **core**: Harden REST route error boundaries and align workspace CRUD with save_json_file
  ([`e70bcd9`](https://github.com/Callosemic/insetu/commit/e70bcd9642c690426d730061c113c31032ff5aac))

- **update**: Prerelease token
  ([`63be025`](https://github.com/Callosemic/insetu/commit/63be025cb5da4b9e999ad707b512be5d561ad494))

- **update**: Use —as-prerelease instead of —prerelease
  ([`b894373`](https://github.com/Callosemic/insetu/commit/b8943738aea618c981805bb5d01535cc60fc14cb))

### Documentation

- **core**: Align hook_vfs_resolve_path docstring with ADR 0042 vfs:// URI scheme
  ([`e8c47d6`](https://github.com/Callosemic/insetu/commit/e8c47d6b421cd188ede14338729f11c17dff392e))

### Refactoring

- **extensions**: Complete sutram form control migration, adr 0041 uihooks deprecation, and api
  gateway alignment
  ([`36323d8`](https://github.com/Callosemic/insetu/commit/36323d828e6af1120f2d920118d19be94e3cff25))

- **extensions**: Standardize onWorkspaceLoad lifecycle hook, expand tracker columns, and add
  pre-release update engine
  ([`f371004`](https://github.com/Callosemic/insetu/commit/f371004f5ce4369006786bf24e51c72e78448e81))

- **sdk**: Deprecate legacy zone hooks, centralize artifact size formatting, and enforce semantic
  API routing
  ([`0c6761f`](https://github.com/Callosemic/insetu/commit/0c6761f09c9c7923e2de91f056711d1930b22f67))

- **sdk**: Harmonize component lifecycle hooks, offload deep search polling, and polish system
  settings UI
  ([`79f872c`](https://github.com/Callosemic/insetu/commit/79f872c8c800d7cb8455e57d32b94e915617aa87))

- **ui/fitness**: Purge CSS !important overrides, align ADR 0041 event hooks, and deduplicate
  fitness file collectors
  ([`91ff55c`](https://github.com/Callosemic/insetu/commit/91ff55c3493f3a8c1fb3de4a07c7ee4a41ede0e2))


## v0.16.0 (2026-08-18)

### Bug Fixes

- Remove banned CDN imports and fix bridge telemetry path resolution
  ([`a902911`](https://github.com/Callosemic/insetu/commit/a9029116c9ea846967cfc73d1ca24b8b67667fe4))

- Sanitize target repo paths and emit core settings refresh hook
  ([`87c8e42`](https://github.com/Callosemic/insetu/commit/87c8e424c2146016b185970d9239f5b41f89e9cf))

- Standardize defaults template file extensions, harden shortcut router shadow DOM context
  discovery, and sync VFS mutation emissions
  ([`9ad0465`](https://github.com/Callosemic/insetu/commit/9ad0465a090c16a6053492fbed4976e4613bad14))

- Update extension PyPI query fix
  ([`a7aed02`](https://github.com/Callosemic/insetu/commit/a7aed02832e7e7f20583beaed89faf58f8b9d535))

- Update extension reactivity after PyPI push (Step 2 button not showing)
  ([`844726e`](https://github.com/Callosemic/insetu/commit/844726e867a80a31776ca4cf9f8d8330d9f2b7c2))

- **core**: Heal compilation event traps, synchronize upload VFS mutations, enforce topology
  extension filters, and add per-file editor preferences
  ([`84abecd`](https://github.com/Callosemic/insetu/commit/84abecd0221b8b81e7825e605b2a9ae91402b593))

- **kernel**: Enforce settings write barrier, expand compile timeout, and sanitize config paths
  ([`8e9ca53`](https://github.com/Callosemic/insetu/commit/8e9ca53643da5b4c06551a1ec5b70899d4f44185))

- **sdk**: Offload gateway job polling and refine parts browser modal viewing lifecycle
  ([`6ba57f5`](https://github.com/Callosemic/insetu/commit/6ba57f56119bca6771dd7513e403196beea13abd))

- **term**: Inject self-destructing PROMPT_COMMAND trap for terminal PTY sessions
  ([`86885ee`](https://github.com/Callosemic/insetu/commit/86885ee1aa004845e3eadcf3f54a473bb5ee037f))

### Documentation

- **schema**: Update extension type definitions, placeholder styling, and code index
  ([`f5ae699`](https://github.com/Callosemic/insetu/commit/f5ae6992d2a6238bb62f9501fae61ae7c26fda9c))

### Features

- **config**: Decouple gather context exclusions and add repository bucketing diagnostic actions
  ([`25d7412`](https://github.com/Callosemic/insetu/commit/25d74126476201966d70e7648bfb9cb5c61adaba))

- **editor**: Add prose writing mode and shortcut metadata tracking
  ([`a43b0c8`](https://github.com/Callosemic/insetu/commit/a43b0c806c8b13e6f6bc41fad58d34a728c2533d))

- **gather**: Add timestamp header stamping and smart chunk path resolution
  ([`073045e`](https://github.com/Callosemic/insetu/commit/073045e3d9fc36be1c593cf04667c3f6fec5ea2a))

- **sdk**: Enhance repo setup UX, settings action routing, and custom editor integration
  ([`273f19f`](https://github.com/Callosemic/insetu/commit/273f19ff77e89dd38183906edbe5d521eb3d8e3c))

- **term**: Add terminal status check endpoint, fallback UI banner for missing flask-sock, and
  preserve original PS1 prompt
  ([`979e929`](https://github.com/Callosemic/insetu/commit/979e9296e96eb101e53542f59fed93be5ab4ba71))

- **topology**: Standardize main bucket naming, refine repo-level ignore overrides, and add
  bucketing test endpoint
  ([`9e3c80f`](https://github.com/Callosemic/insetu/commit/9e3c80fe53233b9b3471349512d802b5311b55c6))

- **tracker,favorites**: Add ticket template spawning, focus mode, hierarchy view, and dynamic
  schema path resolution
  ([`708a9e7`](https://github.com/Callosemic/insetu/commit/708a9e713bb95c14ba2ddf473fcc5e87ea86cbcf))

- **update**: Add last publish timestamp persistence and PyPI indexing status indicator
  ([`93100e6`](https://github.com/Callosemic/insetu/commit/93100e677f783ec806417938ca79395cf74268cc))

### Refactoring

- **docs**: Synchronize code index comments and document semantic API requirements
  ([`f3f576b`](https://github.com/Callosemic/insetu/commit/f3f576b059d72d561bfcc6d855bf5f694540a028))

- **extensions**: Deprecate uiHooks for ADR 0041, adopt vacuum_manifest_artifacts, and expand
  hierarchical tracker schemas
  ([`eec1662`](https://github.com/Callosemic/insetu/commit/eec1662076d3f7af5be7d63be8a94267a811f3e6))

- **git,tracker**: Standardize diff bucket naming and contribute declarative diff exclusion options
  ([`72f171d`](https://github.com/Callosemic/insetu/commit/72f171d5bf02a0f74541b2a42bc7406d8d195548))

- **sdk**: Standardize client API gateway calls with semantic HTTP methods
  ([`82fa88c`](https://github.com/Callosemic/insetu/commit/82fa88c7f3bcdd12bc9a06538d42840ae28fc1f1))

- **update**: Extract distribution build pipeline and enforce sutram toggles
  ([`e31ad6c`](https://github.com/Callosemic/insetu/commit/e31ad6c2345d07126699dc15ce1aa09e00617d57))

- **vendor**: Bundle CodeMirror 6 locally and harden CDN import linter
  ([`5eb80cc`](https://github.com/Callosemic/insetu/commit/5eb80cc61ddae958ac23e342f22faac76441c127))

- **vfs**: Standardize vfs:// logical URI resolution and purge legacy path heuristics
  ([`c7bcbf3`](https://github.com/Callosemic/insetu/commit/c7bcbf36b8dd1a9a2a12679a90ee0f2d3c6c5423))


## v0.15.1 (2026-08-12)

### Bug Fixes

- In update extension, clear dist/ before new build
  ([`cdef22e`](https://github.com/Callosemic/insetu/commit/cdef22eaf792c63c5f3302bcfce6f39014dcb678))

### Code Style

- **extensions**: Standardize entity actions scrolling, remove deprecated modal styles, and enhance
  release preview captions
  ([`a101a14`](https://github.com/Callosemic/insetu/commit/a101a14dc958a2d68a154ef307feb46925b2d04d))

### Refactoring

- **ui**: Migrate controls to Sutram primitives, optimize file tree parsing, and standardize action
  bar scrolling
  ([`d1f05c9`](https://github.com/Callosemic/insetu/commit/d1f05c9ae658dab566eb45c630ba9a911276258b))


## v0.15.0 (2026-08-12)

### Bug Fixes

- Persist bridge candidate path confirmations and refine config extension input parsing
  ([`fa09c6b`](https://github.com/Callosemic/insetu/commit/fa09c6b68f24511a1d1b52fabaea228d96dba3b0))

- **core**: Enrich bridge overwrite telemetry, soft-delete manifest entries, and support exact
  filename topology inclusions
  ([`12e2ac0`](https://github.com/Callosemic/insetu/commit/12e2ac0a2c1152f64243fc909c21ecad0bd135b1))

- **extensions**: Refine extension manifest extraction, YAML tag parsing, and component reactivity
  ([`6781b3d`](https://github.com/Callosemic/insetu/commit/6781b3dca97365ec43eec5aafc0918990ab5cc47))

- **manifest**: Handle 404 deleted context entries in manifest sync and refine build package
  excludes
  ([`1c09004`](https://github.com/Callosemic/insetu/commit/1c09004f6c8a11f90a074ea53c754472709b2416))

- **update**: Default repository build command to python -m build
  ([`53f8633`](https://github.com/Callosemic/insetu/commit/53f8633e434d4f6d36d334e2a8068598f3b86d89))

### Features

- Add semantic update distribution targets and dropdown auto-sync
  ([`2d683d0`](https://github.com/Callosemic/insetu/commit/2d683d06873107d18cb213c37e11cff5931da0fe))

- Add semantic update distribution targets and dropdown sync
  ([`678266e`](https://github.com/Callosemic/insetu/commit/678266edde1edb29be3c154b8981eb8a719a58a3))

- **client**: Implement InSetuBlobViewer modal, core_text_blobs entity actions, and Sync Bridge diff
  viewer integration
  ([`d6f9c06`](https://github.com/Callosemic/insetu/commit/d6f9c060f272d9d9f90e817238ff3aeb686e29b5))

- **ui**: Adopt text blob viewer and entity actions across tracker and update extensions
  ([`3318dee`](https://github.com/Callosemic/insetu/commit/3318dee935944acc7853a448fd80fb5ba34a0f5a))

- **ui**: Enforce VIEW_TEXT_BLOB_MANDATE linter rule and update architectural mappings
  ([`4182582`](https://github.com/Callosemic/insetu/commit/4182582d01762cff871ab743fa17e6a833beaa6c))

### Refactoring

- Extract topology ledger repo accessor and refine bridge idempotency
  ([`9a33da3`](https://github.com/Callosemic/insetu/commit/9a33da3bddcd38017627633c99547d2449c56600))

- **vfs**: Centralize manifest domain extraction and DRY file view refreshes
  ([`b65ad58`](https://github.com/Callosemic/insetu/commit/b65ad58d53eb99521c2ac154fb7ee8a1b80c66b4))


## v0.14.0 (2026-08-11)

### Bug Fixes

- **app-shell**: Enforce monotonic boot progress calculation
  ([`67c251a`](https://github.com/Callosemic/insetu/commit/67c251ab06229cbed3e75ea1719c0782246888cf))

- **bridge**: Enforce explicit X+1 backtracking in fuzzy search anchor matching
  ([`4713c55`](https://github.com/Callosemic/insetu/commit/4713c55375ac1f89d1b3ab3dc7396e1d2079a1e9))

### Features

- **update**: Add initial release dry-run preview and modernize Sutram UI controls
  ([`db613ec`](https://github.com/Callosemic/insetu/commit/db613ec46797ed957ee22c8ae458aaf07dad3f29))


## v0.13.2 (2026-08-11)

### Bug Fixes

- **security**: Implement global master key migration and settings error handling
  ([`ff679ec`](https://github.com/Callosemic/insetu/commit/ff679ec5b5baf864b253bd6971fb9df2b5f7fbcc))

- **ui**: Surface detailed server error messages on settings save failure
  ([`8ebc6fc`](https://github.com/Callosemic/insetu/commit/8ebc6fc10bb80989105d49fadc9a145c060b4456))


## v0.13.1 (2026-08-11)

### Bug Fixes

- **update**: Harden PyPI distribution token validation and button state guards
  ([`58e227a`](https://github.com/Callosemic/insetu/commit/58e227a93813b5386b7c67a9744e13a9deddc869))


## v0.13.0 (2026-08-11)

### Bug Fixes

- **bridge**: Enable granular single-patch deselection in Yomama telemetry view
  ([`8a4c572`](https://github.com/Callosemic/insetu/commit/8a4c57254ed74a68b7a9bf3f95fb57a98d480b6a))

### Features

- **update**: Add initial PyPI release pipeline, PyPI publishing verification, and VCS release
  controls
  ([`b597929`](https://github.com/Callosemic/insetu/commit/b5979292f3cd26d4814bb2caddf6a98b2a38906c))


## v0.12.0 (2026-08-11)

### Bug Fixes

- **core**: Enforce topology buffer read consistency and dual-root manifest extraction
  ([`f18bcef`](https://github.com/Callosemic/insetu/commit/f18bcefbaa0ca35b7346096c0db2b4a44ecdc4b3))

### Features

- **sdk**: Standardize EntityData type contracts, isolate Stage 1 VFS manifest, and add declarative
  shortcuts
  ([`b1346f6`](https://github.com/Callosemic/insetu/commit/b1346f640bab5f28a1c821619f350e03ca197ceb))

### Refactoring

- Extract publish extension, deprecate legacy UI zones, and standardize context accessors
  ([`2f545a0`](https://github.com/Callosemic/insetu/commit/2f545a0fbd44e959dabffabbe6a8004b76c8bcfd))

- **core**: Standardize ExtensionContext accessors, handle multi-chunk reverts, and debounce
  watchdog VFS observers
  ([`f70ab4b`](https://github.com/Callosemic/insetu/commit/f70ab4b4eb556dd5243f3ad600a792f6b76fdcce))

- **kernel**: Standardize type contracts, optional dependencies, and settings scope linter
  ([`fa960f0`](https://github.com/Callosemic/insetu/commit/fa960f08feb77f803542c3e12c3d2a1316eedb1d))


## v0.11.0 (2026-08-10)

### Features

- Migrate system configuration to system.json and implement multi-scoped settings
  ([`67b6611`](https://github.com/Callosemic/insetu/commit/67b6611e8172d92a664892774181a711b82db9ff))

- **core**: Encapsulate core system settings and establish editor preferences extension
  ([`cd6c25f`](https://github.com/Callosemic/insetu/commit/cd6c25f1a70df3f3bca80a5916779323b602ddb5))

- **extensions**: Update settings scoping, add release publish preview, and fix terminal PTY stream
  decoding
  ([`39712ba`](https://github.com/Callosemic/insetu/commit/39712ba00ccdd35fe2d234ad39145e90bb681f3d))

### Refactoring

- **ui**: Modernize settings hub layout and migrate editor preferences to backend api
  ([`0b3e109`](https://github.com/Callosemic/insetu/commit/0b3e109824cb527e329d0593555237917b3888a3))


## v0.10.1 (2026-08-09)

### Bug Fixes

- **bridge,core**: Resolve candidate path confirmations and standardize extension context retrieval
  ([`11b563b`](https://github.com/Callosemic/insetu/commit/11b563b47f930b4c6f8ee6c1a62b3414fdb589b6))

- **ui**: Refine Yomama bridge candidate confirmation overrides and VFS explorer reactive manifest
  refresh
  ([`5a2d293`](https://github.com/Callosemic/insetu/commit/5a2d29344eca3eec102b457dbf24873ce6f65f84))

### Refactoring

- **extensions**: Standardize extension context accessors and fix flow batch editing reactivity
  ([`04fe927`](https://github.com/Callosemic/insetu/commit/04fe9275f463b9187e55f9dff0bc9d93559420bc))


## v0.10.0 (2026-08-07)

### Bug Fixes

- **update**: Enforce initial release tag baseline before enabling bump and release actions
  ([`debed46`](https://github.com/Callosemic/insetu/commit/debed46571d51a682931652c1db9db418d8403a4))

- **update**: Enforce major_on_zero = false in 0.x semantic-release scaffolding
  ([`07a3210`](https://github.com/Callosemic/insetu/commit/07a3210b4e08b44b9caf79dbfec5db68b734c0c4))

### Features

- **update**: Add release notes parsing and modal tab switching to semantic update preview
  ([`75ad168`](https://github.com/Callosemic/insetu/commit/75ad1683a4be6dc2597237200d88d87a0a995ddf))
## v0.9.0 (2026-08-07)

- Initial Release


## v0.8.0 (2026-08-06)

### Features

- **client**: Implement client-side offline SDK wrap, Sutram offline provider, and offline UI engine
- **kernel**: Add offline engine substrate, topology directory expansion, and content-hash gather idempotency
- **extensions**: Standardize offline resilience, namespaced event dispatches, dev daemon logs, and publish pipeline hardening
- **topology**: Establish decoupled topology core engine (`engine_topology.py`) as SSOT for physical workspace files
- **manifest**: Add decentralized manifest signature sync, signature providers, and dual-root VFS manifest support
- **gather**: Implement IoC topology declarations (`gather_declare_topology`), compilation step chaining, and Stage 2 slew limiter

### Bug Fixes

- **bridge**: Fix Yomama sync bridge chunk parsing, chevron delimiter checks, and anchor failure diff generation
- **flow**: Implement context tombstoning and vacuuming for orphaned workflow artifacts
- **git**: Implement diff vacuuming and manifest synchronization for stale diff files
- **term**: Harden WebSocket error handling against BrokenPipeError on disconnects and resolve hot-swap race conditions

### Refactoring

- **sdk**: Implement client SDK API extension enablement gatekeeper and Sutram registry active extension filtering
- **vfs**: Standardize virtual URI scheme normalization to `ctx://` and enforce transactional deletion
- **workers**: Restore Watchdog filesystem observer with pre-event-bus pattern filtering and CPU optimization


## v0.7.0 (2026-08-04)

### Features

- **tailscale**: Implement Tailscale Network Manager extension (`engine_tailscale.py`) for automated HTTPS port binding
- **bridge**: Deploy Yomama Sync Bridge v3 pipeline, chevron healing, JSON telemetry, and forward-replay reversion API
- **security**: Integrate Fernet master key management (`secrets.json`) and secure settings encryption vaulting
- **ui**: Add system reboot action trigger, declarative reboot overlay, and frontmatter editor Lit component
- **gather**: Add boot-time offline mutation guard heuristic to auto-heal context index after offline mutations

### Bug Fixes

- **bridge**: Clean trailing markdown/chevron decay and isolate contiguous anchor matching in fuzzy engine
- **workers**: Refactor VFS barrier synchronization loop from rigid `queue.join()` to abortable polling loop

### Refactoring

- **sdk**: Standardize SDK V2 action binding (`this.api.bindJobAction`) and offload heavy tasks to background workers
- **hooks**: Add thread-local re-entrancy tracking and enforce tenant hook authorization rules
- **cli**: Add extension scaffolding CLI (`insetu create-extension <name>`)


## v0.6.0 (2026-07-30)

### Features

- **vendor**: Vendorize Sutram micro-kernel presentation layer, app shell layout, Zustand store creation, and shortcut routing
- **dev**: Create Developer Dashboard extension (`dev`) with real-time file telemetry and Yomama Sync Bridge error logging
- **notes**: Introduce Notes extension (`notes`) with Markdown note indexing, RAG context compilation, and frontmatter editing
- **auth**: Introduce API client gateway 401 re-authentication with session bootstrap retry
- **recovery**: Add zero-JS recovery console (`/recovery`) and panic lock escape hatch

### Bug Fixes

- **vfs**: Inject idempotency gatekeeper in `execute_vfs_save_physical` to drop phantom writes before touching hardware storage
- **term**: Add fatal exception wrapper in PTY WebSocket stream and mutex lock on socket sends
- **bridge**: Integrate non-blocking background event emissions on patch anchoring and syntax validation errors

### Refactoring

- **kernel**: Extract Tier 1 framework chassis into `insetu/kernel/` (`auth`, `db`, `extension`, `hooks`, `utils`, `vfs`, `workers`)
- **core**: Extract Tier 2 Developer OS physics into `insetu/core/` and core UI scripts into `insetu/static/js/core/`
- **ui**: Migrate extension modals and presentation primitives from `<yenvui-*>` to vendorized `<sutram-*>` tags


## v0.5.0 (2026-07-25)

### Features

- **router**: Deploy Zero-Bundler SPA Hash Router with URL hash state synchronization (`#/{workspace_id}/{tab}/{sub-tab}`)
- **tray**: Implement Global Multi-Select Selection Tray ("Shopping Cart") and non-blocking selection worker
- **auth**: Deploy unified security token gatehouse (`insetu/auth.py`) enforcing REST and WebSocket token validation
- **events**: Centralize fail-safe event bus and hook broadcasting via `window.inSetu.events` substrate
- **ui**: Add `<insetu-toast-container>` web component and missing configuration banner primitive

### Bug Fixes

- **favorites**: Fix folder favoriting and un-favoriting payload ambiguity
- **modal**: Inject teardown event guards to prevent child component bubbling from closing parent modals
- **vfs**: Refactor VFS commit pipeline drain safeguard to drain pending write queue before honoring shutdown signals

### Refactoring

- **actions**: Migrate extension entity actions to declarative `emitEvent` schema
- **git**: Standardize polymorphic card URIs to `system://` / `ctx://` schemes and eliminate imperative DOM querying
- **fitness**: Modularize architectural fitness subsystem into `tests/fitness/` package (`rules_python`, `rules_javascript`, `rules_css`)


## v0.4.0 (2026-07-22)

### Features

- **hooks**: Deploy Automation Hooks extension (`engine_hooks.py` / `ext_hooks.js`) for VFS mutation triggered shell automation
- **freshdesk**: Deploy Freshdesk Support extension (`engine_freshdesk.py` / `ext_freshdesk.js`) with async ticket streaming
- **editor**: Add interactive markdown link widgets and hover tooltip overlays in CodeMirror 6
- **ui**: Abstract `<insetu-standard-toolbar>` and full-width system action filter dropdowns

### Bug Fixes

- **git**: Fix false-positive prefix matching in diff context generation and sanitize quoted porcelain path lines
- **bridge**: Refine patch chunk regex anchoring to enforce multiline line-boundary constraints
- **term**: Safely sever WebSocket handlers upon element disconnection to prevent cross-tenant view leaks

### Refactoring

- **pathlib**: Systematically refactor all core chassis modules to comply with Pathlib Mandate (ADR 0013)
- **sdk**: Eradicate ES6 cross-boundary imports across frontend extensions and migrate to structured SDK getters
- **workers**: Migrate backend extensions to blueprint-level `@blueprint.worker` decorator tracking framework


## v0.3.0 (2026-07-16)

### Features

- **registry**: Graduate extensions to Polymorphic Entity-Action Card Registry framework (ADR 0023)
- **term**: Upgrade terminal interface to native PTY pipeline using `pty`, `select`, `fcntl`, and `flask_sock`
- **vfs**: Establish unified OS Event Ledger (`vfs_event_log`) and off-thread multi-file upload subsystem
- **cache**: Implement deep-copy configuration caching (`_MUTATED_CONFIG_CACHE`) to eliminate redundant config reads

### Bug Fixes

- **git**: Add pre-flight conflict controls and headless SSH batch configurations to prevent process deadlocks
- **tracker**: Enforce workspace change state isolation to clear memory profiles during tenant hot-swaps
- **bridge**: Split Yomama patch payloads into discrete, toggleable cells with individual chunk tracking

### Refactoring

- **editor**: Upgrade `<insetu-markdown-editor>` with dynamic CodeMirror 6 plugin dynamic loading
- **spatial**: Isolate `SettingsManager` and `StoreManager` asset paths strictly to `get_tenant_control_dir()`


## v0.2.0 (2026-07-10)

### Features

- **sdk**: Ship Extension SDK V2 (`InSetuExtension`, `InSetuElement`, `VFSTransaction`, `DatabaseWrapper`)
- **api**: Establish explicit `window.inSetu.api` client gateway for workspace and system fetch capabilities
- **db**: Implement auto-migrating declarative SQLite schemas (`register_schema`) on system boot
- **jobs**: Offload heavy context compilation and quick-pack operations to SQLite `immediate_jobs` worker queue
- **workspace**: Add GUI-driven workspace management via `<insetu-workspace-editor>` Lit component

### Bug Fixes

- **gather**: Re-anchor gather engine to listen to `post_file_save` and `post_file_delete` hooks for CQRS parity
- **zustand**: Replace mutative reference assignments in frontend stores with pristine clones for UDF compliance
- **terminal**: Fix connection-drop behaviors and WebSocket termination handlers on active tenant swaps

### Refactoring

- **editor**: Fully replace legacy EasyMDE/CM5 with modular CodeMirror 6 web component (`<insetu-markdown-editor>`)
- **components**: Transition extension components to LitElement Web Components and `createExtensionStore`


## v0.1.0 (2026-07-01)

### Features

- **components**: Deploy global `<insetu-card>`, `<insetu-file-tree>`, `<insetu-folder-browser>`, and `<insetu-modal>` LitElements
- **bridge**: Implement Yomama sync bridge idempotency guardrails and async job offloading
- **recovery**: Implement recovery bootloader and Lifeboat VFS escape hatch (`fallback_bridge.py`)
- **fitness**: Introduce `tests/fitness_functions.py` AST/Regex compliance scanner and linter guardrails
- **namespace**: Initialize unified `window.inSetu` namespace object for global state and UI factories

### Bug Fixes

- **security**: Replace naive regex script stripping with DOMPurify sanitization in markdown previews
- **pathlib**: Convert string-based path concatenations across Python micro-kernel to POSIX `pathlib.Path`
- **memory**: Replace `innerHTML = ''` clearing patterns across JavaScript modules with native `replaceChildren()`
- **vfs**: Encapsulate file deletion, archiving, and movement within asynchronous `_VFS_WRITE_QUEUE`

### Refactoring

- **udf**: Complete Zustand UDF migration and eliminate direct DOM reading across extension stores
- **tokens**: Replace hardcoded hexadecimal color values across JS payloads with CSS semantic tokens

### Migration

- Officially combined `gather` and `yomama` into inSetu in its own repo and project
