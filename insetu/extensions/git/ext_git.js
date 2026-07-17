import {
    executeSystemCompile,
    setContextManifest,
    createFileCard,
    fetchAndDownloadState,
    fetchAndCopy
} from '../app.js';
import { AppStore } from '../store.js';
import { createExtensionStore } from '../sdk.js';

export const GitStore = createExtensionStore('Git', {
    reposStatus: {},
    fetchStatus: async () => {
        try {
            const res = await window.inSetu.api.workspace('git/status');
            if (res.ok) {
                const data = await res.json();
                GitStore.setState({ reposStatus: data.repos || {} });
            }
        } catch(e) { console.error("Failed to fetch git status", e); }
    }
});
window.inSetu.stores.Git = GitStore;

export async function generateDiffs(force = false) {
    const { cachedDiffFiles, dirtyDiffRepos } = AppStore.getState();
    const targetRepos = (force || !cachedDiffFiles || (dirtyDiffRepos && dirtyDiffRepos.has("ALL"))) 
        ? null 
        : (dirtyDiffRepos && dirtyDiffRepos.size > 0 ? Array.from(dirtyDiffRepos) : null);

    if (!targetRepos && !force && cachedDiffFiles && !(dirtyDiffRepos && dirtyDiffRepos.has("ALL"))) {
        return;
    }
    try {
        const res = await window.inSetu.api.workspace(`git/diffs/generate?_t=${Date.now()}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_repos: targetRepos })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Diff generation request failed.");
        }
        const data = await res.json();
        AppStore.setState({ activeDiffJobId: data.job_id, diffJobError: null });

        window.inSetu.utils.pollJob(data.job_id, {
            onProgress: (msg) => AppStore.setState({ diffJobMessage: msg }),
            onComplete: (statusData) => {
                const newFiles = statusData.artifact.files || [];
                const targetReposRes = statusData.artifact.target_repos;
                const prevCachedFiles = AppStore.getState().cachedDiffFiles || [];
                const updatedDirtyRepos = new Set(AppStore.getState().dirtyDiffRepos);

                const updatedCachedFiles = (() => {
                        if (!targetReposRes) {
                                updatedDirtyRepos.clear();
                                return newFiles;
                        } else {
                                targetReposRes.forEach(r => updatedDirtyRepos.delete(r));
                                const filtered = prevCachedFiles.filter(f => {
                                        const repo = typeof f === 'object' ? f.repo : null;
                                        return !repo || !targetReposRes.includes(repo);
                                });
                                return filtered.concat(newFiles);
                        }
                })();
                AppStore.setState({  
                        activeDiffJobId: null, 
                        cachedDiffFiles: updatedCachedFiles,
                        dirtyDiffRepos: updatedDirtyRepos,
                        diffJobMessage: null,
                        diffJobError: null
                    });
                window.dispatchEvent(new CustomEvent('git-diffs-refreshed'));

                const deltas = statusData.artifact.manifest_deltas || {};
                const currentManifest = { ...AppStore.getState().manifest };

                Object.keys(currentManifest).forEach(k => {
                    if (k.endsWith('_diffs.txt')) {
                        const repo = currentManifest[k].meta?.repo;
                        if (!targetReposRes || targetReposRes.includes(repo)) {
                            delete currentManifest[k];
                        }
                    }
                });

                Object.assign(currentManifest, deltas);
                AppStore.setState({ manifest: currentManifest });
            },
            onError: (err) => {
                AppStore.setState({ activeDiffJobId: null, diffJobError: err.message, diffJobMessage: null });
            }
        });

    } catch (error) {
        AppStore.setState({ diffJobError: error.message });
    }
}
window.generateDiffs = generateDiffs;
import { html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
import { InSetuElement } from '../sdk.js';

export class InSetuExtGitDiffs extends InSetuElement {
    static properties = {
        cachedDiffFiles: { type: Array },
        activeDiffJobId: { type: String },
        diffJobMessage: { type: String },
        diffJobError: { type: String },
        searchQuery: { type: String },
        categoryOrder: { type: Array },
        hiddenOutputs: { type: Array },
        pushModalOpen: { type: Boolean },
        pushChangelogs: { type: Array },
        sweepFiles: { type: Object },
        selectedSweepFiles: { type: Object },
        sweepExpandedRepos: { type: Object },
        sweepLoading: { type: Boolean },
        gitPushMessage: { type: String },
        currentPushRepo: { type: String },
        currentPushDiffFile: { type: String },
        activePushJobId: { type: String },
        chunkModalOpen: { type: Boolean },
        activeChunkFile: { type: String },
        pinnedRepos: { type: Object },
        allRepos: { type: Array },
        _showFilters: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.cachedDiffFiles = [];
        this.activeDiffJobId = null;
        this.diffJobMessage = null;
        this.diffJobError = null;
        this.searchQuery = '';
        this.categoryOrder = [];
        this.hiddenOutputs = [];
        this.pushModalOpen = false;
        this.pushChangelogs = [];
        this.sweepFiles = {};
        this.selectedSweepFiles = {};
        this.sweepExpandedRepos = new Set();
        this.sweepLoading = false;
        this.gitPushMessage = '';
        this.currentPushRepo = '';
        this.currentPushDiffFile = '';
        this.activePushJobId = null;
        this.chunkModalOpen = false;
        this.activeChunkFile = null;
        this.pinnedRepos = new Set(['ALL']);
        this.allRepos = [];
    }
    async _downloadTarget(targetFile) {
        const explicitUrl = `/download/${targetFile}`;
        await fetchAndDownloadState(targetFile, explicitUrl);
    }

    async _copyTarget(targetFile) {
        const explicitUrl = `/download/${targetFile}`;
        await fetchAndCopy(targetFile, explicitUrl);
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(AppStore, (state) => {
            this.cachedDiffFiles = state.cachedDiffFiles || [];
            this.activeDiffJobId = state.activeDiffJobId;
            this.diffJobMessage = state.diffJobMessage;
            this.diffJobError = state.diffJobError;
            this.categoryOrder = state.categoryOrder || [];
            this.hiddenOutputs = state.hiddenOutputs || [];
            this.activePushJobId = state.activePushJobId;
            this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
            this.allRepos = state.allRepos || [];
            this.requestUpdate();
        });
        this.subscribe(GitStore, state => state.reposStatus, (reposStatus) => {
            this.requestUpdate();
        });
        const state = AppStore.getState();
        this.cachedDiffFiles = state.cachedDiffFiles || [];
        this.activeDiffJobId = state.activeDiffJobId;
        this.diffJobMessage = state.diffJobMessage;
        this.diffJobError = state.diffJobError;
        this.categoryOrder = state.categoryOrder || [];
        this.hiddenOutputs = state.hiddenOutputs || [];
        this.activePushJobId = state.activePushJobId;
        this.pinnedRepos = state.pinnedRepos || new Set(['ALL']);
        this.allRepos = state.allRepos || [];

        // Secure boundary event listeners to allow external triggers (e.g. from file cards)
        this._boundHandleOpenPush = this._handleOpenPush.bind(this);
        this._boundRefreshSweep = this._fetchSweepStatusSilent.bind(this);
        window.addEventListener('open-push-modal', this._boundHandleOpenPush);
        window.addEventListener('git-diffs-refreshed', this._boundRefreshSweep);
        this._fetchSweepStatusSilent();
        GitStore.getState().fetchStatus();
}
disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('open-push-modal', this._boundHandleOpenPush);
        window.removeEventListener('git-diffs-refreshed', this._boundRefreshSweep);
}

    onWorkspaceChanged(newWorkspaceId) {
        this._fetchSweepStatusSilent();
        GitStore.getState().fetchStatus();
    }

    async _handleOpenPush(e) {
        const { diffFile, repo } = e.detail;
        this.currentPushDiffFile = diffFile;
        this.currentPushRepo = repo;
        this.gitPushMessage = '';
        this.pushChangelogs = [];
        this.pushModalOpen = true;
        try {
            const res = await window.inSetu.api.workspace(`git/changelogs?repo=${encodeURIComponent(repo || '')}&t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.changelogs && data.changelogs.length > 0) {
                    this.pushChangelogs = data.changelogs;
                    this.gitPushMessage = data.changelogs[0].title;
                }
            }
        } catch (err) {
            console.error("Failed to load changelogs.");
        }
    }
    async _executePush() {
        const msg = this.gitPushMessage.trim();
        if (!msg) return alert("Please enter a commit message.");
        if (!this.currentPushRepo) return alert("Repository context missing.");
        try {
            const res = await this.api.post('push', {
                repo: this.currentPushRepo,
                message: msg,
                diff_file: this.currentPushDiffFile
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Push request failed.");
            }
            const data = await res.json();
            AppStore.setState({ activePushJobId: data.job_id });
            this.pushModalOpen = false;
            this.api.pollJob(data.job_id, {
                onProgress: (progressMsg) => {
                    this.gitPushMessage = progressMsg || "Pushing to remote... please wait.";
                },
                onComplete: async (statusData) => {
                    const { currentPushRepo, dirtyDiffRepos } = AppStore.getState();
                    const newDirty = new Set(dirtyDiffRepos);
                    newDirty.add(currentPushRepo);
                    AppStore.setState({ activePushJobId: null, dirtyDiffRepos: newDirty });

                    alert(`✅ Successfully pushed ${currentPushRepo}!\n\n${statusData.message}`);
                    this.pushModalOpen = false;
                    try {
                        if(window.executeSystemCompile) await window.executeSystemCompile();
                    } catch (refreshErr) {
                        console.warn("Background refresh failed:", refreshErr);
                    } finally {
                        window.generateDiffs(true);
                    }
                },
                onError: (err) => {
                    AppStore.setState({ activePushJobId: null });
                    alert(`❌ Push failed:\n\n${err.message}`);
                }
            });

        } catch (err) {
            alert("Network error executing push: " + err.message);
        }
    }
    async _fetchSweepStatusSilent() {
        this.sweepLoading = true;
        try {
            const res = await this.api.post('sweep/status', {});
            if (!res.ok) throw new Error("Failed to start scan");
            const data = await res.json();
            this.api.pollJob(data.job_id, {
                onProgress: () => {},
                onComplete: (statusData) => {
                    this.sweepFiles = statusData.artifact.repos || {};
                    // Auto-select all discovered files by default
                    const selections = {};
                    Object.entries(this.sweepFiles).forEach(([r, files]) => {
                        selections[r] = files.map(f => f.path);
                    });
                    this.selectedSweepFiles = selections;
                    this.sweepLoading = false;
                    this.requestUpdate();
                },
                onError: (err) => {
                    console.error("Error scanning workspaces: ", err.message);
                    this.sweepLoading = false;
                }
            });
        } catch (err) {
            console.error("Error starting scan: ", err.message);
            this.sweepLoading = false;
        }
    }

    async _executeRepoSweep(repo) {
        const files = this.selectedSweepFiles[repo] || [];
        if (files.length === 0) return alert("No files selected to sweep.");

        const msg = prompt(`Enter a commit message to sweep metadata for ${repo}:`, "chore: sweep remaining state");
        if (!msg) return; // Cancelled

        const selections = { [repo]: files };

        try {
            const res = await this.api.post('sweep/push', { selections, message: msg });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Sweep request failed.");
            }
            const data = await res.json();

            this.api.pollJob(data.job_id, {
                onProgress: (progressMsg) => {
                    if (window.setGlobalStatus) window.setGlobalStatus(progressMsg || "Sweeping repo...");
                },
                onComplete: async (statusData) => {
                    const { dirtyDiffRepos } = AppStore.getState();
                    const newDirty = new Set(dirtyDiffRepos);
                    newDirty.add("ALL");
                    AppStore.setState({ dirtyDiffRepos: newDirty });

                    alert(`✅ Sweep successful for ${repo}:\n\n${statusData.message}`);
                    if (window.executeSystemCompile) {
                        window.executeSystemCompile().then(() => window.generateDiffs(true));
                    } else {
                        window.generateDiffs(true);
                    }
                },
                onError: (err) => {
                    alert(`❌ Sweep failed for ${repo}:\n\n${err.message}`);
                }
            });
        } catch (e) {
            alert("Network error executing sweep: " + e.message);
        }
    }
    render() {
        const categories = {};
        const repoFilteredFiles = this.cachedDiffFiles.filter(f => {
            if (this.pinnedRepos.has('ALL')) return true;
            const fileStr = typeof f === 'string' ? f : f.filename;
            const repoDir = typeof f === 'object' ? f.repo : null;
            if (repoDir && this.pinnedRepos.has(repoDir)) return true;
            return Array.from(this.pinnedRepos).some(repo => fileStr.startsWith(repo + '_') || fileStr.includes('_' + repo + '_'));
        });
        const sq = this.searchQuery;
        const filteredFiles = sq ? window.inSetu.utils.fuzzyFilterObjects(repoFilteredFiles, sq, f => (typeof f === 'string' ? f : `${f.repo || ''} ${f.filename}`)) : repoFilteredFiles;

        filteredFiles.forEach(fileObj => {
            const file = typeof fileObj === 'string' ? fileObj : fileObj.filename;
            const repoDir = typeof fileObj === 'object' ? fileObj.repo : null;
            if (this.hiddenOutputs && this.hiddenOutputs.includes(file)) return;
            const safeFile = file.split('/').pop();
            const baseFile = safeFile.replace('_diffs.txt', '_context.txt');
            const contextManifestObj = AppStore.getState().manifest[baseFile] || {};
            const diffManifestObj = AppStore.getState().manifest[safeFile] || {};

            const contextMeta = contextManifestObj.meta || { title: safeFile, domain: "Workspaces", desc: "Pending diff payload." };
            const diffMeta = diffManifestObj.meta || {};

            const extMeta = (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) 
                ? window.ExtensionRegistry.executeUIHook('zone:context-metadata', baseFile) 
                : null;
            const finalCat = extMeta ? extMeta.cat : contextMeta.domain;
            const finalDesc = extMeta ? extMeta.desc : diffMeta.desc || contextMeta.desc;
            const finalTitle = extMeta ? extMeta.displayName.replace('.txt', '_diffs.txt') : contextMeta.title + " (Diffs)";

            let sizeStr = "";
            if (diffMeta.chunk_sizes && diffMeta.chunk_sizes.length > 1) {
                const sizes = diffMeta.chunk_sizes.map(s => Math.round(s / 1024) + "kb");
                sizeStr = "( " + sizes.join(' + ') + " )";
            } else if (diffMeta.size_bytes !== undefined) {
                const kb = Math.round(diffMeta.size_bytes / 1024);
                sizeStr = kb > 1024 ? (kb / 1024).toFixed(1) + " mb" : kb + " kb";
            }
            if (!categories[finalCat]) categories[finalCat] = [];
            categories[finalCat].push({
                filename: file,
                displayName: finalTitle,
                description: finalDesc,
                detailText: sizeStr ? `${repoDir ? `[${repoDir}] ` : ''}${file} | ${sizeStr}` : `${repoDir ? `[${repoDir}] ` : ''}${file}`,
                isFS: false,
                repoDir: repoDir,
                branch: repoDir ? GitStore.getState().reposStatus[repoDir]?.current : null
            });
        });
        const sortedCats = Object.keys(categories).sort((a, b) => {
            if (a === "Quick-Pack Clipboard") return -1;
            if (b === "Quick-Pack Clipboard") return 1;
            const iA = this.categoryOrder.indexOf(a) === -1 ? 999 : this.categoryOrder.indexOf(a);
            const iB = this.categoryOrder.indexOf(b) === -1 ? 999 : this.categoryOrder.indexOf(b);
            if (iA !== iB) return iA - iB;
            return a.localeCompare(b);
        });

        const activeFilters = [];
        this.pinnedRepos.forEach(r => { if (r !== 'ALL') activeFilters.push(r); });
        const filterBtnText = activeFilters.length > 0 ? `Filters: ${activeFilters.slice(0, 2).join(', ')}${activeFilters.length > 2 ? '...' : ''}` : 'Filters';

        return html`
            <div class="sticky-header" style="padding: 0; display: flex; flex-direction: column; border-bottom: 1px solid var(--border); background: var(--bg);">
                <div style="display: flex; align-items: center; gap: 10px; padding-right: 12px;">
                    <insetu-search-bar 
                        style="flex: 1;"
                        placeholder="🔍 Fuzzy search pending diffs..." 
                        .value=${this.searchQuery} 
                        @search-changed=${e => this.searchQuery = e.detail.value}>
                    </insetu-search-bar>
                    <insetu-filter-dropdown filterText=${filterBtnText}>
                        <insetu-repo-filter
                            label="📌 Repos:"
                            .repos=${this.allRepos}
                            .activeRepos=${Array.from(this.pinnedRepos)}
                            @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                        </insetu-repo-filter>
                    </insetu-filter-dropdown>
                </div>
            </div>
            ${this.activeDiffJobId ? html`<div class="spinner" style="display: block;">${this.diffJobMessage || "Analyzing Git trees across sister repositories... please wait."}</div>` : ''}
            ${this.diffJobError ? html`<div style="color: var(--intent-danger); margin-top: 15px;">Error analyzing diffs: ${this.diffJobError}</div>` : ''}
            <div style="display: flex; flex-direction: column; margin-top: 15px;">
                ${!this.activeDiffJobId && this.cachedDiffFiles.length === 0 ? html`
                    <div style="background: var(--input-bg); border: 1px dashed var(--border); border-radius: 6px; padding: 25px 15px; text-align: center; margin-bottom: 15px;">
                        <div style="font-size: 2rem; margin-bottom: 10px;">✨</div>
                        <h3 style="margin: 0 0 10px 0; color: var(--text);">Working Tree Clean</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0 0 20px 0;">All major tracked code diffs have been committed or none were found.</p>
                        <button class="btn-sm" style="background: var(--intent-primary); font-weight: bold; padding: 10px 20px; font-size: 1rem;" @click=${() => window.dispatchEvent(new CustomEvent('open-sweep-modal'))}>
                            🧹 Sweep Remaining State Files
                        </button>
                    </div>
                ` : ''}
                ${sortedCats.map(catName => html`
                    <insetu-category-section titleText=${catName}>
                        ${categories[catName].map(f => html`
                            <insetu-card
                                .filename=${f.filename}
                                .titleText=${f.displayName}
                                .descriptionText=${f.description}
                                .detailText=${f.detailText}
                                icon="📦"
                                intentColor="var(--intent-highlight)"
                                entityType="file:diff"
                                .entityData=${{ filepath: f.filename, repoDir: f.repoDir, isFS: f.isFS }}
                                @card-clicked=${() => { if(window.viewAndCopy) window.viewAndCopy(f.filename); }}>
                                ${f.branch ? html`<span slot="header-tags" class="task-tag" style="background: transparent; border: 1px solid var(--border);">🌿 ${f.branch}</span>` : ''}
${(() => {
    const chunks = AppStore.getState().manifest[f.filename]?.meta?.chunks;
    const hasChunks = chunks && chunks.length > 1;
    if (hasChunks) {
        return html`
            <button slot="actions" class="btn-sm" style="background: var(--intent-primary); margin: 0; color: white; border: none; cursor: pointer;"
                @click=${(e) => {
                    e.stopPropagation();
                    this.activeChunkFile = f.filename;
                    this.chunkModalOpen = true;
                }}>
                📦 View Parts
            </button>
        `;
    }
    return '';
})()}
                            </insetu-card>
                        `)}
                    </insetu-category-section>
                `)}
                ${!this.activeDiffJobId && this.cachedDiffFiles.length > 0 ? html`<p style="color: var(--text-muted); font-style: italic; margin-top: 15px;">Diffs automatically map when this tab is opened.</p>` : ''}
                ${!this.activeDiffJobId && Object.keys(this.sweepFiles).some(r => this.pinnedRepos.has('ALL') || this.pinnedRepos.has(r)) ? html`
                    <insetu-category-section titleText="🧹 Sweepable State">
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: -10px; margin-bottom: 15px; padding-left: 5px;">Untracked metadata, tracker items, and configuration files ready for commit.</p>
                        ${Object.entries(this.sweepFiles).filter(([r, _]) => this.pinnedRepos.has('ALL') || this.pinnedRepos.has(r)).map(([repo, files]) => {
                            const branch = GitStore.getState().reposStatus[repo]?.current;
                            return html`
                            <insetu-card
                            .filename=${repo}
                            .titleText=${repo}
                            .descriptionText=${`${files.length} untracked or excluded files pending.`}
                            icon="📦"
                            intentColor="var(--intent-neutral)"
                            entityType="repo"
                            .entityData=${{ repoDir: repo }}
                            @card-clicked=${() => {
                                const newSet = new Set(this.sweepExpandedRepos);
                                newSet.has(repo) ? newSet.delete(repo) : newSet.add(repo);
                                this.sweepExpandedRepos = newSet;
                                this.requestUpdate();
                            }}>
                            ${branch ? html`<span slot="header-tags" class="task-tag" style="background: transparent; border: 1px solid var(--border);">🌿 ${branch}</span>` : ''}
                        </insetu-card>

                        ${this.sweepExpandedRepos.has(repo) ? html`
                            <div style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; padding: 10px; margin-top: -8px; margin-bottom: 15px; margin-left: 15px;">
                                ${files.map(f => html`
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                        <input type="checkbox" 
                                            .checked=${(this.selectedSweepFiles[repo] || []).includes(f.path)}
                                            @change=${(e) => {
                                                const isChecked = e.target.checked;
                                                const currentList = this.selectedSweepFiles[repo] || [];
                                                this.selectedSweepFiles = {
                                                    ...this.selectedSweepFiles,
                                                    [repo]: isChecked ? [...currentList, f.path] : currentList.filter(p => p !== f.path)
                                                };
                                                this.requestUpdate();
                                            }}>
                                        <span style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">[${f.status}] ${f.path}</span>
                                    </div>
                                `)}
                            </div>
                        ` : ''}
                    `;})}
                    </insetu-category-section>
                ` : ''}

                ${!this.activeDiffJobId && this.cachedDiffFiles.length === 0 && Object.keys(this.sweepFiles).length === 0 && !this.sweepLoading ? html`
                    <div style="background: var(--input-bg); border: 1px dashed var(--border); border-radius: 6px; padding: 30px 15px; text-align: center; margin-top: 20px;">
                        <div style="font-size: 2.5rem; margin-bottom: 10px;">✨</div>
                        <h3 style="margin: 0 0 5px 0; color: var(--text);">Working Tree Clean</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">No diffs or untracked metadata detected.</p>
                    </div>
                ` : ''}
            </div>
            <insetu-modal ?open=${this.chunkModalOpen} titleText="📦 Diff Parts" maxWidth="500px" @modal-closed=${() => this.chunkModalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 10px;">
                    ${(this.activeChunkFile ? (AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunks || []) : []).map((chunk, idx) => html`
                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px;">
                            <span style="font-weight: bold; font-family: monospace; font-size: 0.85rem; color: var(--text);">📄 Part ${idx + 1} ${(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes && AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx]) ? `(${Math.round(AppStore.getState().manifest[this.activeChunkFile]?.meta?.chunk_sizes[idx] / 1024)}kb)` : ''}</span>
                            <div style="display: flex; gap: 8px;">
                                <insetu-async-btn label="📋 Copy" intent="neutral" .onClick=${() => this._copyTarget(chunk)}></insetu-async-btn>
                                <insetu-async-btn label="⬇️ Download" intent="primary" .onClick=${() => this._downloadTarget(chunk)}></insetu-async-btn>
                            </div>
                        </div>
                    `)}
                </div>
            </insetu-modal>

            <insetu-modal ?open=${this.pushModalOpen} titleText="🚀 Commit & Push" @modal-closed=${() => this.pushModalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column;">
                    <label style="font-weight: bold; margin-bottom: 5px; font-size: 0.9rem;">Recent Changelogs:</label>
                    <select style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); margin-bottom: 15px; font-weight: bold;" @change=${(e) => this.gitPushMessage = e.target.value}>
                        <option value="">-- Type a custom message below --</option>
                        ${this.pushChangelogs.map(cl => html`<option value="${cl.title}" ?selected=${this.gitPushMessage === cl.title}>${cl.title}</option>`)}
                    </select>
                    <label style="font-weight: bold; margin-bottom: 5px; font-size: 0.9rem;">Commit Message:</label>
                    <textarea placeholder="Enter commit message..." .value=${this.gitPushMessage} @input=${(e) => this.gitPushMessage = e.target.value} style="margin-bottom: 15px; padding: 10px; font-weight: bold; height: 80px; width: 100%; box-sizing: border-box;"></textarea>
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;" @click=${this._executePush}>🚀 Execute Push</button>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-ext-git-diffs', InSetuExtGitDiffs);
export class InSetuExtGitCtrl extends InSetuElement {
    static properties = {
        reposStatus: { type: Object },
        allRepos: { type: Array },
        branchModalOpen: { type: Boolean },
        activeRepo: { type: String },
        newBranchName: { type: String },
        activePullJobId: { type: String },
        pullMessage: { type: String },
        previewModalOpen: { type: Boolean },
        previewRepo: { type: String },
        previewMessage: { type: String },
        _runtimeStrategy: { type: String },
        _repoStrategies: { type: Object }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.reposStatus = {};
        this.allRepos = [];
        this.branchModalOpen = false;
        this.activeRepo = '';
        this.newBranchName = '';
        this.activePullJobId = null;
        this.pullMessage = '';
        this.previewModalOpen = false;
        this.previewRepo = '';
        this.previewMessage = '';
        this._runtimeStrategy = 'rebase';
        this._repoStrategies = {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(GitStore, state => state.reposStatus, (reposStatus) => {
            this.reposStatus = reposStatus || {};
            this.requestUpdate();
        });
        this.subscribe(AppStore, state => state.allRepos, (allRepos) => {
            this.allRepos = allRepos || [];
            this.requestUpdate();
        });
        this.allRepos = AppStore.getState().allRepos || [];
        this.reposStatus = GitStore.getState().reposStatus || {};
        GitStore.getState().fetchStatus();
        this._loadSettings();
    }

    onWorkspaceChanged(newWorkspaceId) {
        GitStore.getState().fetchStatus();
        this._loadSettings();
    }
    async _loadSettings() {
        try {
            const res = await this.api.get('settings');
            if (res.ok) {
                const data = await res.json();
                const strategies = {};
                Object.keys(data).forEach(key => {
                    if (key.startsWith('strategy_')) {
                        const repo = key.replace('strategy_', '');
                        strategies[repo] = data[key];
                    }
                });
                this._repoStrategies = strategies;
            }
        } catch(e) { console.error("Failed to load extension settings", e); }
    }
    async _previewPull(repo) {
        try {
            this.pullMessage = `Initializing fetch for ${repo}...`;
            this.activePullJobId = 'starting';

            const res = await this.api.post('fetch_preview', { repo });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Fetch failed");
            }
            const data = await res.json();

            this.activePullJobId = data.job_id;
            this.pullMessage = `Fetching remote for ${repo}...`;
            this.api.pollJob(data.job_id, {
                onProgress: (msg) => {
                    this.pullMessage = msg;
                    if (window.setGlobalStatus) window.setGlobalStatus(`⏳ ${msg}`, null);
                },
                onComplete: (statusData) => {
                    this.activePullJobId = null;
                    if (window.setGlobalStatus) window.setGlobalStatus(`✅ Fetch complete.`, 2000);

                    this.previewRepo = repo;
                    this.previewMessage = statusData.message || 'Already up to date.';
                    this.previewModalOpen = true;
                },
                onError: (err) => {
                    this.activePullJobId = null;
                    alert(`❌ Fetch failed for ${repo}\n\n${err.message}`);
                }
            });
        } catch (err) {
            this.activePullJobId = null;
            alert(`Network error fetching ${repo}: ${err.message}`);
        }
    }
    async _initRepo(repo) {
        try {
            const res = await this.api.post('init', { repo });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Init failed");
            }
            const data = await res.json();

            this.activePullJobId = data.job_id;
            this.pullMessage = `Initializing ${repo}...`;

            this.api.pollJob(data.job_id, {
                onProgress: (msg) => this.pullMessage = msg,
                onComplete: (statusData) => {
                    this.activePullJobId = null;
                    alert(`✅ ${statusData.message}`);
                    GitStore.getState().fetchStatus();
                },
                onError: (err) => {
                    this.activePullJobId = null;
                    alert(`❌ Init failed for ${repo}\n\n${err.message}`);
                }
            });
        } catch (err) {
            alert(`Network error initializing ${repo}: ${err.message}`);
        }
    }
    async _executePull() {
        const repo = this.previewRepo;
        this.previewModalOpen = false;

        const currentStrategy = this._repoStrategies?.[repo] || 'rebase';
        const strategy = (currentStrategy === 'runtime') ? this._runtimeStrategy : currentStrategy;
        try {
            this.pullMessage = `Initializing pull for ${repo}...`;
            this.activePullJobId = 'starting';

            const res = await this.api.post('pull', { repo, strategy });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Pull failed");
            }
            const data = await res.json();
            this.activePullJobId = data.job_id;
            this.pullMessage = `Pulling ${repo}...`;
            this.api.pollJob(data.job_id, {
                onProgress: (msg) => {
                    this.pullMessage = msg;
                    if (window.setGlobalStatus) window.setGlobalStatus(`⏳ ${msg}`, null);
                },
                onComplete: (statusData) => {
                    this.activePullJobId = null;
                    if (window.setGlobalStatus) window.setGlobalStatus(`✅ Pull complete.`, 2000);
                    alert(`✅ Pull successful for ${repo}\n\n${statusData.message}`);
                    GitStore.getState().fetchStatus();
                },
                onError: (err) => {
                    this.activePullJobId = null;
                    alert(`❌ Pull failed for ${repo}\n\n${err.message}`);
                }
            });
        } catch (err) {
            alert(`Network error pulling ${repo}: ${err.message}`);
        }
    }
    async _checkoutBranch(repo, branch, createNew = false) {
        try {
            const res = await this.api.post('checkout', { repo, branch, create_new: createNew });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Checkout failed");
            }
            const data = await res.json();

            this.activePullJobId = data.job_id; // Reuse the loading spinner state variable
            this.pullMessage = `Checking out ${branch}...`;

            this.api.pollJob(data.job_id, {
                onProgress: (msg) => this.pullMessage = msg,
                onComplete: (statusData) => {
                    this.activePullJobId = null;
                    alert(`✅ Checkout successful for ${repo}\n\n${statusData.message}`);
                    this.branchModalOpen = false;
                    GitStore.getState().fetchStatus();
                },
                onError: (err) => {
                    this.activePullJobId = null;
                    alert(`❌ Checkout failed for ${repo}\n\n${err.message}`);
                }
            });
        } catch (err) {
            alert(`Network error during checkout for ${repo}: ${err.message}`);
        }
    }

    render() {
        return html`
            <div style="display: flex; flex-direction: column; gap: 15px; padding: 15px;">
                ${this.activePullJobId ? html`<div class="spinner" style="display: block;">${this.pullMessage || 'Pulling from remote...'}</div>` : ''}

                ${this.allRepos.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic;">No repositories tracked.</div>` : ''}
                ${this.allRepos.map(repo => {
                    const status = this.reposStatus[repo] || {};

                    if (status.is_git === false) {
                        return html`
                            <insetu-card titleText=${repo} descriptionText="Not a Git repository." icon="📁" intentColor="var(--intent-neutral)">
                                <button slot="actions" class="btn-sm" style="background: var(--intent-success); margin: 0;" @click=${() => this._initRepo(repo)}>✨ Initialize Git Repo</button>
                            </insetu-card>
                        `;
                    }
                    const currentBranch = status.current || 'unknown';
                    const syncStatus = status.sync_status ? html`<span slot="header-tags" class="task-tag" style="background: transparent; border: 1px solid var(--border); margin-left: 5px;">${status.sync_status}</span>` : '';
                    const currentStrategy = this._repoStrategies?.[repo] || 'rebase';
                    const conflicts = status.conflicts || [];
                    const conflictBadge = conflicts.length > 0 ? html`<span slot="header-tags" class="task-tag" style="background: var(--intent-danger); color: white; border: 1px solid var(--intent-danger); margin-left: 5px;">⚠️ ${conflicts.length} Conflict${conflicts.length > 1 ? 's' : ''}</span>` : '';

                    return html`
                        <insetu-card titleText=${repo} descriptionText="Current Branch: ${currentBranch}" icon="📦" intentColor="${conflicts.length > 0 ? 'var(--intent-danger)' : 'var(--intent-neutral)'}">
                            <span slot="header-tags" class="task-tag" style="background: transparent; border: 1px solid var(--border);">🌿 ${currentBranch}</span>
                            ${syncStatus}
                            ${conflictBadge}

                            <button slot="actions" class="btn-sm" style="background: var(--intent-primary); margin: 0 5px 0 0;" @click=${() => this._previewPull(repo)}>⬇️ Fetch & Pull...</button>
                            <button slot="actions" class="btn-sm" style="background: var(--intent-highlight); margin: 0;" @click=${() => {
                                this.activeRepo = repo;
                                this.newBranchName = '';
                                this.branchModalOpen = true;
                            }}>🌿 Switch Branch</button>
                        </insetu-card>
                    `;
                })}
            </div>

            <insetu-modal ?open=${this.branchModalOpen} titleText="Branch Management: ${this.activeRepo}" @modal-closed=${() => this.branchModalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px;">
                    <div>
                        <label style="font-weight: bold; font-size: 0.9rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Switch to Existing Branch:</label>
                        <select style="width: 100%; padding: 10px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);" @change=${(e) => {
                            if (e.target.value) this._checkoutBranch(this.activeRepo, e.target.value, false);
                            e.target.value = "";
                        }}>
                            <option value="">-- Select Branch --</option>
                            ${(this.reposStatus[this.activeRepo]?.branches || []).map(b => html`<option value="${b}">${b}</option>`)}
                        </select>
                    </div>
                    <hr style="border: 0; border-top: 1px solid var(--border); width: 100%;">
                    <div>
                        <label style="font-weight: bold; font-size: 0.9rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Create New Branch:</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" placeholder="new-feature-branch" .value=${this.newBranchName} @input=${e => this.newBranchName = e.target.value} style="flex: 1; padding: 10px; font-weight: bold; box-sizing: border-box;">
                            <button class="btn-sm" style="background: var(--intent-success); margin: 0;" @click=${() => {
                                if(this.newBranchName) this._checkoutBranch(this.activeRepo, this.newBranchName, true);
                            }}>➕ Create & Switch</button>
                        </div>
                    </div>
                </div>
            </insetu-modal>

            <insetu-modal ?open=${this.previewModalOpen} titleText="Incoming Changes: ${this.previewRepo}" @modal-closed=${() => this.previewModalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px;">
                    <pre style="margin: 0; background: var(--bg); color: var(--text); border: 1px solid var(--border); padding: 10px; border-radius: 4px; overflow-y: auto; max-height: 40vh; white-space: pre-wrap; font-size: 0.85rem;">${this.previewMessage}</pre>

                    ${(() => {
                        const currentStrategy = this._repoStrategies?.[this.previewRepo] || 'rebase';
                        if (currentStrategy === 'runtime') {
                            return html`
                                <div style="display: flex; align-items: center; gap: 10px; background: var(--input-bg); padding: 10px; border-radius: 4px; border: 1px solid var(--border); margin-top: 5px;">
                                    <label style="font-size: 0.85rem; color: var(--text); font-weight: bold;">Reconciliation Strategy:</label>
                                    <select style="padding: 4px 8px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; font-family: var(--font-mono); font-size: 0.8rem;"
                                        .value=${this._runtimeStrategy}
                                        @change=${(e) => this._runtimeStrategy = e.target.value}>
                                        <option value="rebase">Rebase (--rebase)</option>
                                        <option value="merge">Merge (--no-rebase)</option>
                                        <option value="ff_only">Fast-Forward Only (--ff-only)</option>
                                    </select>
                                </div>
                            `;
                        }
                        return '';
                    })()}
                </div>
                <button slot="footer" style="background: var(--intent-danger); color: white;" @click=${() => this.previewModalOpen = false}>Cancel</button>
                <button slot="footer" style="background: var(--intent-primary); color: white;" @click=${() => this._executePull()}>⬇️ Confirm & Pull</button>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-ext-git-ctrl', InSetuExtGitCtrl);
window.ExtensionRegistry.registerExtension('git', {
    name: "Version Control",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'diff',
            id: 'git-push',
            label: 'Push',
            icon: '🚀',
            intent: 'highlight',
            order: 10,
            onClick: (data, e) => {
                window.dispatchEvent(new CustomEvent('open-push-modal', { detail: { diffFile: data.filepath, repo: data.repoDir } }));
            }
        },
        {
            targetEntity: 'repo',
            id: 'git-sweep',
            label: 'Sweep Repo',
            icon: '🚀',
            intent: 'highlight',
            order: 10,
            onClick: (data, e) => {
                const gitEl = document.querySelector('insetu-ext-git-diffs');
                if (gitEl) gitEl._executeRepoSweep(data.repoDir);
            }
        },
        {
            targetEntity: 'repo',
            id: 'git-resolve-conflicts',
            label: 'Resolve Conflicts',
            icon: '⚠️',
            intent: 'danger',
            order: 5,
            match: (data) => {
                const status = window.inSetu.stores.Git.getState().reposStatus[data.repoDir];
                return status && status.conflicts && status.conflicts.length > 0;
            },
            onClick: (data, e) => {
                const status = window.inSetu.stores.Git.getState().reposStatus[data.repoDir];
                if (status && status.conflicts && status.conflicts.length > 0) {
                    const firstConflict = status.conflicts[0];
                    if (window.viewSourceFile) {
                        window.viewSourceFile(`${data.repoDir}/${firstConflict}`, true);
                    }
                }
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "ctrl",
            label: "Ctrl",
            order: 6
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "ctrl",
            id: "git",
            label: "Git",
            order: 2,
            component: "insetu-ext-git-ctrl"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "context",
            id: "diffs",
            label: "Diffs",
            order: 2,
            component: "insetu-ext-git-diffs"
        }
    ]
});
if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
    const markRepoDirty = (filepath) => {
        if (!filepath) return false;
        const repo = filepath.split('/')[0];
        if (repo) {
            const { dirtyDiffRepos } = AppStore.getState();
            const newDirty = new Set(dirtyDiffRepos);
            newDirty.add(repo);
            AppStore.setState({ dirtyDiffRepos: newDirty });
        }
        return false;
    };

    window.inSetu.extensions.Registry.registerUIHook('zone:post-file-save', markRepoDirty);
    window.inSetu.extensions.Registry.registerUIHook('zone:post-file-delete', markRepoDirty);
    window.inSetu.extensions.Registry.registerUIHook('zone:subtab-changed', (data) => {
        if (data.parentId === 'context' && data.subId === 'diffs') {
            generateDiffs(data.forceRefresh);
        }
        return false;
    });
    window.inSetu.extensions.Registry.registerUIHook('zone:tab-changed', (tabId) => {
        const diffsTab = document.getElementById('sub-diffs');
        if (tabId === 'context' && diffsTab && diffsTab.classList.contains('active')) {
            generateDiffs();
        }
        return false;
    });
}
// Legacy zone:file-card-actions hook for git removed in favor of entityActions