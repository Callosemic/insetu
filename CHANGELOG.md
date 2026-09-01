# CHANGELOG

<!-- version list -->

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
