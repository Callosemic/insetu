"""Behavioral unit tests executing real frontend ES modules via the zero-dependency Node ESM loader (js_loader.mjs)."""

import shutil
import unittest
from pathlib import Path
from insetu.core.utils_core import execute_binary

LOADER_PATH = (Path(__file__).resolve().parent / "js_loader.mjs").resolve()


class TestJsBehavioralUnits(unittest.TestCase):
    """Executes real inSetu frontend ES modules in Node.js to verify URI, file tree, manifest, and Bridge state machines."""

    def test_real_frontend_modules_via_node_esm_loader(self):
        if not shutil.which("node"):
            self.skipTest("Node.js binary is not installed in PATH")

        node_script = """
import assert from 'node:assert/strict';
import { InSetuURI, BucketAddress, InSetuElement, resolveDirectoryState } from '/static/extensions/system/insetu_sdk.js';
import { AppStore } from '/static/extensions/system/store.js';
import { buildUriFileTree } from '/static/extensions/system/components/ui_file_tree.js';
import { pruneSubsumedTargets, updateManifestState } from '/static/extensions/fs/fs.js';
import { BridgeStore } from '/static/extensions/bridge/bridge.js';

// 1. InSetuURI & BucketAddress behavioural contracts
const u = new InSetuURI('vfs://insetu/insetu/core/fs/fs.js');
assert.equal(u.scheme, 'vfs');
assert.equal(u.repo, 'insetu');
assert.equal(u.relativePath, 'insetu/core/fs/fs.js');
assert.equal(u.basename, 'fs.js');
assert.equal(u.withName('engine_fs.py'), 'vfs://insetu/insetu/core/fs/engine_fs.py');
assert.equal(InSetuURI.canonicalize('repo/.insetu-data/settings/topology.md'), 'vfs://repo/.insetu-data/settings/topology.md');
assert.equal(InSetuURI.canonicalize('settings/topology.md'), 'ctx://settings/topology.md');

const addr = BucketAddress.fromKey('Axoneme::Docs');
assert.equal(addr.key, 'axoneme::Docs');
assert.equal(addr.contextUri, 'ctx://contexts/axoneme_Docs_context.txt');
assert.equal(addr.diffUri, 'ctx://diffs/axoneme_Docs_diffs.txt');

// 2. buildUriFileTree & resolveDirectoryState (ignores .gitkeep and drills down cleanly)
const tree = buildUriFileTree([
    'vfs://alpha/.gitkeep',
    'vfs://alpha/src/main.py',
    'vfs://alpha/src/utils.py',
    'vfs://alpha/README.md'
], 'vfs://');
const rootState = resolveDirectoryState(tree, ['alpha'], { hideFiles: false, ignoreDotKeep: true });
assert.deepEqual(rootState.validPath, ['alpha']);
assert.deepEqual(rootState.entries.map(e => e.name), ['src', 'README.md']);

// 3. pruneSubsumedTargets drops child files/folders when parent directory is selected
const pruned = pruneSubsumedTargets([
    { filepath: 'vfs://alpha/src/', isDir: true },
    { filepath: 'vfs://alpha/src/main.py', isDir: false },
    { filepath: 'vfs://alpha/src/sub/helper.py', isDir: false },
    { filepath: 'vfs://alpha/README.md', isDir: false }
]);
assert.deepEqual(pruned.map(t => t.path), ['vfs://alpha/src', 'vfs://alpha/README.md']);

// 4. updateManifestState (Two-View VFS invariant: updates existing tracked files, deletes removed files, never speculatively inserts unknown vfs:// files)
AppStore.setState({
    manifest: {
        vfs: {
            'alpha::main': {
                files: ['vfs://alpha/tracked.py', 'vfs://alpha/to_delete.py'],
                source_ts: 100
            }
        },
        ctx: {}
    }
});
updateManifestState([
    { filepath: 'vfs://alpha/tracked.py', operation: 'save' },
    { filepath: 'vfs://alpha/untracked_ignored.tmp', operation: 'save' },
    { filepath: 'vfs://alpha/to_delete.py', operation: 'delete' }
]);
const afterFiles = AppStore.getState().manifest.vfs['alpha::main'].files;
assert.deepEqual(afterFiles, ['vfs://alpha/tracked.py']);
assert.ok(AppStore.getState().manifest.vfs['alpha::main'].source_ts > 100);

// 5. BridgeStore.parseAndAppendCells & swapCell (parses multi-directive payloads cleanly)
BridgeStore.getState().clearPayload();
const rawYomama = [
    '<<<<<<< FILE: vfs://alpha/src/main.py',
    '<<<<<<< COMMENT',
    'Update main return value',
    '<<<<<<< SEARCH',
    'return 1',
    '=======',
    'return 2',
    '>>>>>>> REPLACE',
    '',
    '<<<<<<< FILE: vfs://alpha/README.md',
    '<<<<<<< TEXTEDIT',
    'Hello {{-world}}{{+inSetu}}!',
    '>>>>>>> REPLACE'
].join('\\n');
BridgeStore.getState().parseAndAppendCells(rawYomama);
const cells = BridgeStore.getState().cells;
assert.equal(cells.length, 2);
assert.equal(cells[0].file, 'vfs://alpha/src/main.py');
assert.equal(cells[1].file, 'vfs://alpha/README.md');

BridgeStore.getState().swapCell(cells[0].id);
const swappedContent = BridgeStore.getState().cells[0].content;
assert.match(swappedContent, /<<<<<<< SEARCH\\nreturn 2\\n=======\\nreturn 1\\n>>>>>>> REPLACE/);

// 5b. BridgeStore optimistic skip & Smart Replace-on-Paste
const c0Id = cells[0].id;
const c1Id = cells[1].id;
BridgeStore.setState({
    telemetry: {
        transaction_id: 'tx_test_opt',
        mode: 'dry_run',
        status: 'action_required',
        can_commit: false,
        summary: { total_patches: 2, resolved: 1, auto_skipped: 0, action_required: 0, failed: 1 },
        patches: [
            { cell_id: c0Id, patch_index: 0, resolved_file: 'vfs://alpha/src/main.py', status: 'failed', error_message: 'Anchor mismatch' },
            { cell_id: c1Id, patch_index: 1, resolved_file: 'vfs://alpha/README.md', status: 'resolved' }
        ]
    }
});
// Smart Replace-on-Paste: pasting a repaired block for vfs://alpha/src/main.py replaces the failed cell c0Id in-place!
BridgeStore.getState().parseAndAppendCells([
    '<<<<<<< FILE: vfs://alpha/src/main.py',
    '<<<<<<< SEARCH',
    'return 10',
    '=======',
    'return 20',
    '>>>>>>> REPLACE'
].join('\\n'));
const cellsAfterPaste = BridgeStore.getState().cells;
assert.equal(cellsAfterPaste.length, 2, 'Smart Replace-on-Paste must replace failed cell in-place rather than duplicating');
assert.equal(cellsAfterPaste[0].id, c1Id);
assert.match(cellsAfterPaste[1].content, /return 20/);

// Optimistic skip: skipping a failed patch updates telemetry.can_commit to true in 0ms without a backend round-trip
const newMainCellId = cellsAfterPaste[1].id;
BridgeStore.setState({
    telemetry: {
        transaction_id: 'tx_test_opt_2',
        mode: 'dry_run',
        status: 'action_required',
        can_commit: false,
        summary: { total_patches: 2, resolved: 1, auto_skipped: 0, action_required: 0, failed: 1 },
        patches: [
            { cell_id: c1Id, patch_index: 0, resolved_file: 'vfs://alpha/README.md', status: 'resolved' },
            { cell_id: newMainCellId, patch_index: 1, resolved_file: 'vfs://alpha/src/main.py', status: 'failed' }
        ]
    }
});
BridgeStore.getState().skipCellOptimistic(newMainCellId);
assert.equal(BridgeStore.getState().telemetry.can_commit, true, 'Optimistic skip of sole failed patch must immediately flip can_commit to true');
assert.equal(BridgeStore.getState().telemetry.summary.resolved, 1);
assert.equal(BridgeStore.getState().telemetry.summary.failed, 0);

// 5c. BridgeStore preserves <<<<<<< ID: headers and applyHealedCells updates in-place by cell.id even on partial heals
BridgeStore.getState().clearPayload();
BridgeStore.getState().parseAndAppendCells([
    '<<<<<<< FILE: vfs://alpha/src/main.py',
    '<<<<<<< ID: cell_explicit_42',
    '<<<<<<< SEARCH',
    'old_line = 1',
    '=======',
    'new_line = 2',
    '>>>>>>> REPLACE'
].join('\\n'));
assert.equal(BridgeStore.getState().cells[0].id, 'cell_explicit_42');
const healedCount = BridgeStore.getState().applyHealedCells({
    cell_explicit_42: {
        id: 'cell_explicit_42',
        file: 'vfs://alpha/src/main.py',
        content: '<<<<<<< SEARCH\\nreal_line = 1\\n=======\\nnew_line = 2\\n>>>>>>> REPLACE'
    }
});
assert.equal(healedCount, 1);
assert.equal(BridgeStore.getState().cells[0].id, 'cell_explicit_42');
assert.match(BridgeStore.getState().cells[0].content, /real_line = 1/);

// 6. InSetuElement.prototype.filterItems (repo pinning + fuzzy search)
const sampleItems = [
    { title: 'Alpha Service', repo: 'alpha', filepath: 'vfs://alpha/service.py' },
    { title: 'Beta Worker', repo: 'beta', filepath: 'vfs://beta/worker.py' }
];
const dummyEl = Object.create(InSetuElement.prototype);
dummyEl.ecosystem = { pinnedRepos: new Set(['alpha']) };
dummyEl.searchQuery = '';
const filteredByPin = dummyEl.filterItems(sampleItems);
assert.equal(filteredByPin.length, 1);
assert.equal(filteredByPin[0].repo, 'alpha');

// 7. VFS LRU/TTL share text cache & selective invalidation
const { cacheShareText, getCachedShareText, invalidateShareCache } = await import('/static/extensions/fs/fs_store.js');
invalidateShareCache();
cacheShareText('vfs://alpha/service.py', 'service body');
cacheShareText('ctx://contexts/alpha_context.txt', 'repo bucket');
cacheShareText('ctx://contexts/quickpack_123_context.txt', 'quickpack snapshot');
assert.equal(getCachedShareText('vfs://alpha/service.py'), 'service body');
invalidateShareCache('vfs://alpha/service.py');
assert.equal(getCachedShareText('vfs://alpha/service.py'), null);
assert.equal(getCachedShareText('ctx://contexts/alpha_context.txt'), null, 'Topological context must invalidate when a vfs:// file mutates');
assert.equal(getCachedShareText('ctx://contexts/quickpack_123_context.txt'), 'quickpack snapshot', 'Point-in-time Quickpack snapshot must survive');

// 8. Sprint U2: Send variant set, family defaults, multi-part pack fallback, Publish section, bulk Send, and Core prompts
await import('/static/extensions/gather/gather.js');
const { getRegisteredCorePrompts } = await import('/static/extensions/prompts/prompts.js');
await import('/static/extensions/publish/ext_publish.js');

// 8a. Core prompts includes the Yomama patch protocol declared by bridge.js
const corePrompts = getRegisteredCorePrompts();
assert.ok(corePrompts.includes('ctx://prompts/.templates/bridge/yomama_patch_protocol.md'));

// 8b. Single markdown file gets Send variant set with Raw, Expanded (when hasMacros), and Publish sections; default is Copy Raw
const mdFileActions = window.ExtensionRegistry.getEntityActions('file', {
    filepath: 'vfs://alpha/README.md',
    isFS: true,
    hasMacros: true
});
const sendSetMd = mdFileActions.find(a => a.kind === 'variant-set' && a.setId === 'send');
assert.ok(sendSetMd, 'Expected collapsed send variant set on file entity');
assert.equal(sendSetMd.surfaced, 1);
assert.equal(sendSetMd.defaultVariant.id, 'file-copy');
assert.equal(sendSetMd.defaultVariant.label, 'Copy Raw');
assert.equal(sendSetMd.defaultVariant.successLabel, 'Copied');
assert.deepEqual(sendSetMd.sections, ['Raw', 'Expanded', 'Publish']);

// 8c. Single-part vs Multi-part pack (file:context): single-part defaults to Copy Raw; multi-part hides Copy Raw and falls back to Download Raw
const singlePartPackActions = window.ExtensionRegistry.getEntityActions('file:context', {
    filepath: 'ctx://contexts/single_context.txt',
    isFS: false,
    chunks: ['ctx://contexts/single_context.txt']
});
const sendSetSinglePack = singlePartPackActions.find(a => a.kind === 'variant-set' && a.setId === 'send');
assert.equal(sendSetSinglePack.defaultVariant.id, 'file-copy');

const multiPartPackActions = window.ExtensionRegistry.getEntityActions('file:context', {
    filepath: 'ctx://contexts/multi_context.txt',
    isFS: false,
    chunks: ['ctx://contexts/multi_context_part1.txt', 'ctx://contexts/multi_context_part2.txt']
});
const sendSetMultiPack = multiPartPackActions.find(a => a.kind === 'variant-set' && a.setId === 'send');
assert.ok(!sendSetMultiPack.variants.some(v => v.id === 'file-copy'), 'Copy Raw must be hidden for multi-part context packs');
assert.equal(sendSetMultiPack.defaultVariant.id, 'file-download');
assert.equal(sendSetMultiPack.defaultVariant.label, 'Download Raw');

// 8d. Folder entity resolves Send default to Download Raw (ZIP)
const folderActions = window.ExtensionRegistry.getEntityActions('folder', {
    filepath: 'vfs://alpha/src/',
    folderpath: 'vfs://alpha/src',
    isDir: true
});
const sendSetFolder = folderActions.find(a => a.kind === 'variant-set' && a.setId === 'send');
assert.ok(sendSetFolder, 'Expected send variant set on folder entity');
assert.equal(sendSetFolder.defaultVariant.id, 'vfs-download-zip');
assert.equal(sendSetFolder.defaultVariant.label, 'Download Raw');

// 8e. Bulk selection tray aggregates gather-pack-copy and gather-pack-download into bulk Send variant set
const bulkTrayActions = window.ExtensionRegistry.getAggregatableActions([
    { entityType: 'file:prompt', data: { filepath: 'ctx://prompts/.templates/bridge/yomama_patch_protocol.md' } },
    { entityType: 'file:context', data: { filepath: 'ctx://contexts/single_context.txt', chunks: ['ctx://contexts/single_context.txt'] } }
], { group: 'share' });
const bulkSendSet = bulkTrayActions.find(a => a.kind === 'variant-set' && a.setId === 'send');
assert.ok(bulkSendSet, 'Expected bulk send variant set in selection tray');
assert.equal(bulkSendSet.defaultVariant.variantId, 'gather-pack-copy');
assert.equal(bulkSendSet.defaultVariant.label, 'Copy Raw');

// 8f. Files sub-tab menu (group: 'file') preserves bulk Download ZIP across regular files and folders
const bulkFileMenuActions = window.ExtensionRegistry.getAggregatableActions([
    { entityType: 'file', data: { filepath: 'vfs://alpha/src/main.py', isFS: true } },
    { entityType: 'file', data: { filepath: 'vfs://alpha/src/utils.py', isFS: true } }
], { group: 'file' });
assert.ok(bulkFileMenuActions.some(a => a.variantId === 'vfs-bulk-download-zip'), 'Files sub-tab menu must offer Download ZIP for multi-file selections');

// 8g. VFS_PUBLIC_API projects all fs_store.js helpers (getCachedShareText, cacheShareText, fetchArtifactText, isMultiPartArtifact) onto window.inSetu.vfs
assert.equal(typeof window.inSetu.vfs.getCachedShareText, 'function');
assert.equal(typeof window.inSetu.vfs.cacheShareText, 'function');
assert.equal(typeof window.inSetu.vfs.fetchArtifactText, 'function');
assert.equal(typeof window.inSetu.vfs.isMultiPartArtifact, 'function');

// 8h. Polymorphic getChunks & isMultiPartArtifact 3-way resolution contract (manifest vs ephemeral inline vs manifest override)
const { getChunks, isMultiPartArtifact, resolveEntityExportTarget } = window.inSetu.vfs;
// Case 1: Ephemeral/un-manifested multi-part pack (not in AppStore.manifest.ctx, but data.chunks has 2 parts)
const ephemeralMulti = {
    filepath: 'ctx://contexts/ephemeral_query_context.txt',
    chunks: ['ctx://contexts/ephemeral_query_context_part1.txt', 'ctx://contexts/ephemeral_query_context_part2.txt']
};
assert.equal(isMultiPartArtifact(ephemeralMulti), true);
assert.deepEqual(getChunks(ephemeralMulti), ephemeralMulti.chunks);
assert.deepEqual(resolveEntityExportTarget(ephemeralMulti).chunks, ephemeralMulti.chunks);

// Case 2: Manifest-backed multi-part pack where card .entityData only passes { filepath }
AppStore.setState({
    manifest: {
        vfs: AppStore.getState().manifest?.vfs || {},
        ctx: {
            'ctx://contexts/manifest_multi_context.txt': {
                chunks: ['ctx://contexts/manifest_multi_context_part1.txt', 'ctx://contexts/manifest_multi_context_part2.txt'],
                meta: { timestamp: 200 }
            }
        }
    }
});
assert.equal(isMultiPartArtifact({ filepath: 'ctx://contexts/manifest_multi_context.txt' }), true);
// Case 3: Live manifest (2 parts) overrides stale 1-part inline data.chunks snapshot
const staleInline = {
    filepath: 'ctx://contexts/manifest_multi_context.txt',
    chunks: ['ctx://contexts/manifest_multi_context.txt']
};
assert.equal(isMultiPartArtifact(staleInline), true);
assert.equal(getChunks(staleInline).length, 2);

// 9. Sprint U3: Sutram registry helpers, ws:// pre-collapse action filter, copyTextFromPromise (ClipboardItem), post-confirmation tray clear, and default workspace layout
assert.ok(Array.isArray(window.ExtensionRegistry.getExtensionNames({ activeOnly: false })));
assert.ok(window.ExtensionRegistry.getExtensionNames({ activeOnly: false }).includes('fs'));
const corePromptEntries = window.ExtensionRegistry.getManifestEntries('corePrompts');
assert.ok(corePromptEntries.some(e => e.extName === 'bridge'));

// 9a. Shared ws:// asset hides mutative actions (file-edit, vfs-move, vfs-rename, vfs-archive, vfs-delete) via ExtensionRegistry.setActionFilter
const wsFileActions = window.ExtensionRegistry.getEntityActions('file', {
    filepath: 'ws://peer_ws/prompts/shared.md',
    isFS: true
});
assert.ok(!wsFileActions.some(a => a.id === 'file-edit' || a.id === 'vfs-delete'), 'Mutative actions must be filtered out on ws:// items');

// 9b. copyTextFromPromise uses ClipboardItem with a Promise<Blob> when available (Safari gesture rule)
const { copyTextFromPromise } = window.inSetu.vfs;
let capturedClipboardItems = null;
const origClipboard = globalThis.navigator.clipboard;
const OrigClipboardItem = globalThis.ClipboardItem;
class MockClipboardItem {
    constructor(items) { this.items = items; }
}
globalThis.ClipboardItem = MockClipboardItem;
Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: {
        write: async (items) => { capturedClipboardItems = items; },
        writeText: async () => { throw new Error('Should have used ClipboardItem.write'); }
    },
    configurable: true
});
const resolvedCopyText = await copyTextFromPromise(async () => 'safari-gesture-safe-payload');
assert.equal(resolvedCopyText, 'safari-gesture-safe-payload');
assert.equal(capturedClipboardItems?.length, 1);
const writtenBlob = await capturedClipboardItems[0].items['text/plain'];
assert.equal(await writtenBlob.text(), 'safari-gesture-safe-payload');

// Single-card Copy Raw on a stale ctx://diffs/* pack triggers insetu:ensure-fresh-artifact inside the ClipboardItem factory
let freshHookFired = 0;
const onEnsureFresh = (ev) => {
    if (ev.detail?.filepath === 'ctx://diffs/alpha_diffs.txt' && Array.isArray(ev.inSetuResponses)) {
        ev.inSetuResponses.push((async () => {
            freshHookFired++;
            await Promise.resolve(); // the recompile writes the file on the server; nothing re-warms the cache
        })());
    }
};
window.addEventListener('insetu:ensure-fresh-artifact', onEnsureFresh);
try {
    const diffCardActions = window.ExtensionRegistry.getEntityActions('file:diff', {
        filepath: 'ctx://diffs/alpha_diffs.txt',
        isFS: false,
        outdated: true
    });
    const diffSendSet = diffCardActions.find(a => a.kind === 'variant-set' && a.setId === 'send');
    cacheShareText('ctx://diffs/alpha_diffs.txt', 'stale-diff-payload-from-before-the-recompile');
    window.inSetu.api = window.inSetu.api || {};
    const origApiRequest = window.inSetu.api.request;
    window.inSetu.api.request = async () => new Response('freshly-compiled-diff-payload', { status: 200 });
    capturedClipboardItems = null;
    try {
        await diffSendSet.defaultVariant.asyncAction({ filepath: 'ctx://diffs/alpha_diffs.txt', isFS: false });
    } finally {
        window.inSetu.api.request = origApiRequest;
    }
    assert.equal(freshHookFired, 1, 'Single-card Copy Raw must compile stale diff/context artifacts before reading');
    const diffBlob = await capturedClipboardItems[0].items['text/plain'];
    assert.equal(await diffBlob.text(), 'freshly-compiled-diff-payload');
} finally {
    window.removeEventListener('insetu:ensure-fresh-artifact', onEnsureFresh);
}

// 9c. Tray bulk Copy Raw delegates selection clearing to SutramSelectionTray (ignores unrelated window events until tray action settles)
const { SelectionStore } = await import('/static/extensions/system/store.js');
SelectionStore.getState().clearSelection();
SelectionStore.getState().toggleSelection('vfs://alpha/README.md', 'file', { filepath: 'vfs://alpha/README.md' });
assert.equal(SelectionStore.getState().selectedItems.size, 1);

window.inSetu.api = window.inSetu.api || {};
const origApiPost = window.inSetu.api.post;
const origPollJob = window.inSetu.utils.pollJob;
window.inSetu.api.post = async (path) => {
    if (path === 'gather/pack_selection') {
        return new Response(JSON.stringify({ job_id: 'job_qp_u3' }), { status: 202 });
    }
    return origApiPost ? origApiPost(path) : new Response('{}', { status: 200 });
};
window.inSetu.utils.pollJob = (jobId, opts) => {
    opts.onComplete({
        artifact: {
            base_filename: 'ctx://contexts/quickpack_u3_context.txt',
            chunks: ['ctx://contexts/quickpack_u3_context.txt'],
            manifest_entry: {
                files: ['vfs://alpha/README.md'],
                chunks: ['ctx://contexts/quickpack_u3_context.txt'],
                meta: { timestamp: 300 }
            }
        }
    });
};
cacheShareText('ctx://contexts/quickpack_u3_context.txt', 'packed-quickpack-u3-body');

const bulkActionsForCopy = window.ExtensionRegistry.getAggregatableActions([
    { entityType: 'file', data: { filepath: 'vfs://alpha/README.md' } }
], { group: 'share' });
const sendSetTray = bulkActionsForCopy.find(a => a.kind === 'variant-set' && a.setId === 'send');
await sendSetTray.defaultVariant.asyncAction({ target: {} });
assert.equal(SelectionStore.getState().selectedItems.size, 1, 'bulkAction must leave SelectionStore intact while "Copied" confirmation shows');
window.dispatchEvent(new CustomEvent('yenvui-action-confirmed', { detail: { phase: 'settled' } }));
assert.equal(SelectionStore.getState().selectedItems.size, 1, 'Unrelated window yenvui-action-confirmed events must not prematurely clear tray selection');

// Selection ownership: the tray or view menu clears after an action settles; actions that hand off to a dialog keep it
const fsBulkActions = window.ExtensionRegistry.getEntityActions('file', { filepath: 'vfs://alpha/README.md', isFS: true });
['vfs-move', 'vfs-archive', 'vfs-delete'].forEach(id => {
    const act = fsBulkActions.find(a => a.id === id) || window.ExtensionRegistry.getAggregatableActions([{ entityType: 'file', data: { filepath: 'vfs://alpha/README.md' } }]).find(a => a.id === id);
    assert.equal(Boolean(act?.keepSelection), true, `${id} opens a dialog, so it must declare keepSelection and clear on the dialog's success`);
});

// toggleRepoInPinSet SSOT invariants
const { toggleRepoInPinSet } = window.inSetu.utils;
assert.deepEqual(Array.from(toggleRepoInPinSet(['ALL'], 'alpha')), ['alpha']);
assert.deepEqual(Array.from(toggleRepoInPinSet(['alpha'], 'beta')), ['alpha', 'beta']);
assert.deepEqual(Array.from(toggleRepoInPinSet(['alpha'], 'alpha')), ['ALL']);
assert.deepEqual(Array.from(toggleRepoInPinSet(['alpha', 'beta'], 'ALL')), ['ALL']);
SelectionStore.getState().clearSelection();

window.inSetu.api.post = origApiPost;
window.inSetu.utils.pollJob = origPollJob;
globalThis.ClipboardItem = OrigClipboardItem;
Object.defineProperty(globalThis.navigator, 'clipboard', { value: origClipboard, configurable: true });

// 9d. Default layout for new workspaces: Col 1 Prompts (active) + Files, Col 2 Gather, Col 3 Yomama, mobileViewport = 1; never overwrites a saved layout
const { ensureDefaultWorkspaceLayout } = await import('/static/extensions/system/system.js');
const LayoutStore = window.Sutram.stores.Layout;
LayoutStore.setState({
    focusedColumn: 'center',
    mobileViewportIndex: 0,
    windows: [],
    columns: {
        left: { pinned: [], active: null, history: [] },
        center: { pinned: [], active: null, history: [] },
        right: { pinned: [], active: null, history: [] }
    }
});
const appliedDefault = ensureDefaultWorkspaceLayout({ hasExplicitHashTarget: false });
assert.equal(appliedDefault, true);
const lState = LayoutStore.getState();
assert.deepEqual(lState.columns.left.pinned.map(p => p.rawId || p.id), ['prompts', 'files']);
assert.ok(String(lState.columns.left.active).endsWith('prompts'), 'Prompts must be the active tab in Column 1');
assert.deepEqual(lState.columns.center.pinned.map(p => p.rawId || p.id), ['gather']);
assert.deepEqual(lState.columns.right.pinned.map(p => p.rawId || p.id), ['bridge']);
assert.equal(lState.mobileViewportIndex, 1, 'Phone viewport must open on Column 2 (index 1)');
assert.equal(lState.focusedColumn, 'center');

// Calling ensureDefaultWorkspaceLayout again when a layout is already saved must be a no-op
const appliedSecondTime = ensureDefaultWorkspaceLayout({ hasExplicitHashTarget: false });
assert.equal(appliedSecondTime, false, 'Saved layout must never be replaced');

console.log('JS_BEHAVIORAL_UNITS_OK');
"""
        res = execute_binary(
            ["node", "--import", LOADER_PATH.as_posix(), "--input-type=module", "-e", node_script],
            capture_output=True,
            text=True,
            timeout=15.0,
        )
        self.assertEqual(
            res.returncode,
            0,
            f"Node behavioral unit suite failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}",
        )
        self.assertIn("JS_BEHAVIORAL_UNITS_OK", res.stdout)


if __name__ == "__main__":
    unittest.main()
