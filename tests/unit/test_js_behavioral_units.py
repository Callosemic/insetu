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
