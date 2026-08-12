# CHANGELOG

<!-- version list -->

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
