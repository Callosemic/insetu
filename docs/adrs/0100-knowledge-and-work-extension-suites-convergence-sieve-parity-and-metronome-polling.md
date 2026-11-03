# ADR 0100: Knowledge & Content and Work & Automation Suites Convergence, Sieve Parity, and Metronome Polling Unification

## Status
Accepted (2026-11-03)

## Context
Following the completion of the Core Substrate (ADR 0098) and DevOps Suite (ADR 0099) modernization passes, the remaining 11 Tier 3 domain extensions across the Knowledge & Content suite (`citations`, `freshdesk`, `ingest`, `notes`, `publish`, `research`, `skills`) and the Work & Automation suite (`cronic`, `favorites`, `hooks`, `tracker`) required formal audit and closeout verification:
1. **Zero-CSS Presentation Standard**: Verify that all 11 extensions adhere to `CUSTOM_COMPONENT_CSS_BAN` and compose interfaces strictly via Sutram Lego primitives (`<sutram-view>`, `<sutram-stack>`, `<sutram-surface>`, `<sutram-card>`, `<sutram-modal>`) and `sharedStyles`.
2. **Topology Sieve & Diff Parity**: Ensure that domain markdown assets contained in `.insetu-data/` sub-buckets correctly enforce `exclude_from_diffs: True`, routing working-tree modifications to the Sweepable State tray rather than code-review diffs.
3. **Metronome Polling Hygiene**: Eradicate unmanaged `while(true)` polling loops in client scripts to resolve outstanding technical debt from `INSETU-QUEUE-20260806_1453`.
4. **Single-File Membrane Boundaries**: Confirm zero direct `akasa.*` imports in backend engines and zero direct vendor substrate imports outside `insetu_sdk.js`.

## Decision
1. **Zero-CSS & Sutram Lego Component Parity**:
   - Confirmed that all 11 domain extensions across Knowledge, Content, Work, and Automation declare `static styles = [sharedStyles];` with zero custom CSS template literals.
   - Standardized modals, toolbars, cards, and projections on declarative Sutram primitives.
2. **Topology Sieve & Sweepable State Integration**:
   - Both `tracker` and `notes` enforce `exclude_from_diffs: True` on `.insetu-data/` sub-buckets.
   - Working tree modifications to tickets and notes are excluded from `ctx://diffs/` context payloads by `diffable_changes` and route exclusively to the Sweepable State tray.
3. **Metronome Polling Unification**:
   - Remediated the unmanaged `while(true)` polling loop in `ext_citations.js` (`_openCitationNotes`), routing asynchronous search job polling through `window.inSetu.utils.pollJob`.
4. **Single-File Membrane Enforcement**:
   - All 11 engines import framework primitives strictly from `insetu.core.sdk` or `insetu.core.utils_core`.
   - All 11 frontend extensions import presentation primitives, state factories, and styles strictly from `/static/extensions/system/insetu_sdk.js`.

## Consequences
* **Positive**: Complete repository-wide compliance with Zero-CSS presentation standards across all 16 Tier 3 extensions.
* **Positive**: Elimination of rogue `while(true)` client polling loops.
* **Positive**: Perfect isolation of domain metadata from Git code-review diffs.
* **Positive**: 100% adherence to single-file membrane boundaries.
