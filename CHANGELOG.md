# CHANGELOG

<!-- version list -->

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
