import {
    executeSystemCompile,
    setContextManifest,
    createFileCard,
    fetchAndDownloadState,
    fetchAndCopy
} from '../app.js';
import { AppStore } from '../store.js';
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
        activeChunkFile: { type: String }
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
    }
    async _downloadTarget(targetFile, btnComponent = null) {
        const explicitUrl = `/download/${targetFile}`;
        if (btnComponent) {
            await fetchAndDownloadState(targetFile, btnComponent, explicitUrl);
        } else {
            const dummyBtn = document.createElement('button');
            await fetchAndDownloadState(targetFile, dummyBtn, explicitUrl);
        }
    }

    async _copyTarget(targetFile, btnElement) {
        const explicitUrl = `/download/${targetFile}`;
        await fetchAndCopy(targetFile, btnElement, explicitUrl);
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
        });
        const state = AppStore.getState();
        this.cachedDiffFiles = state.cachedDiffFiles || [];
        this.activeDiffJobId = state.activeDiffJobId;
        this.diffJobMessage = state.diffJobMessage;
        this.diffJobError = state.diffJobError;
        this.categoryOrder = state.categoryOrder || [];
        this.hiddenOutputs = state.hiddenOutputs || [];
        this.activePushJobId = state.activePushJobId;

        // Secure boundary event listeners to allow external triggers (e.g. from file cards)
        this._boundHandleOpenPush = this._handleOpenPush.bind(this);
        this._boundRefreshSweep = this._fetchSweepStatusSilent.bind(this);
        window.addEventListener('open-push-modal', this._boundHandleOpenPush);
        window.addEventListener('git-diffs-refreshed', this._boundRefreshSweep);

        this._fetchSweepStatusSilent();
}
disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('open-push-modal', this._boundHandleOpenPush);
        window.removeEventListener('git-diffs-refreshed', this._boundRefreshSweep);
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
        const sq = this.searchQuery;
        const filteredFiles = sq ? window.inSetu.utils.fuzzyFilterObjects(this.cachedDiffFiles, sq, f => (typeof f === 'string' ? f : f.filename)) : this.cachedDiffFiles;

        filteredFiles.forEach(fileObj => {
            const file = typeof fileObj === 'string' ? fileObj : fileObj.filename;
            const repoDir = typeof fileObj === 'object' ? fileObj.repo : null;
            if (this.hiddenOutputs && this.hiddenOutputs.includes(file)) return;

            const safeFile = file.split('/').pop();
            const baseFile = safeFile.replace('_diffs.txt', '_context.txt');
            const manifestObj = AppStore.getState().manifest[baseFile] || {};
            const meta = manifestObj.meta || { title: safeFile, domain: "Workspaces", desc: "Pending diff payload." };

            const extMeta = (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) 
                ? window.ExtensionRegistry.executeUIHook('zone:context-metadata', baseFile) 
                : null;
            const finalCat = extMeta ? extMeta.cat : meta.domain;
            const finalDesc = extMeta ? extMeta.desc : meta.desc;
            const finalTitle = extMeta ? extMeta.displayName.replace('.txt', '_diffs.txt') : meta.title + " (Diffs)";

            let sizeStr = "";
            if (meta.chunk_sizes && meta.chunk_sizes.length > 1) {
                const sizes = meta.chunk_sizes.map(s => Math.round(s / 1024) + "kb");
                sizeStr = "( " + sizes.join(' + ') + " )";
            } else if (meta.size_bytes !== undefined) {
                const kb = Math.round(meta.size_bytes / 1024);
                sizeStr = kb > 1024 ? (kb / 1024).toFixed(1) + " mb" : kb + " kb";
            }

            if (!categories[finalCat]) categories[finalCat] = [];
            categories[finalCat].push({
                filename: file,
                displayName: finalTitle,
                description: finalDesc,
                detailText: sizeStr ? `${file} | ${sizeStr}` : file,
                isFS: false,
                repoDir: repoDir
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
        return html`
            <div class="sticky-header" style="padding: 0; border-bottom: 1px solid var(--border); background: var(--bg);">
                <insetu-search-bar 
                    placeholder="🔍 Fuzzy search pending diffs..." 
                    .value=${this.searchQuery} 
                    @search-changed=${e => this.searchQuery = e.detail.value}>
                </insetu-search-bar>
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
                                @card-clicked=${() => { if(window.viewAndCopy) window.viewAndCopy(f.filename); }}>
                                <insetu-file-actions slot="actions" .filepath=${f.filename} .repoDir=${f.repoDir} .isFS=${f.isFS}></insetu-file-actions>
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
    } else {
        return html`
            <button slot="actions" class="btn-sm" style="background: var(--intent-primary); margin: 0;" @click=${(e) => {
                e.stopPropagation();
                this._downloadTarget(f.filename, e.target);
            }}>⬇️ Download</button>
        `;
    }
})()}
                            </insetu-card>
                        `)}
                    </insetu-category-section>
                `)}
                ${!this.activeDiffJobId && this.cachedDiffFiles.length > 0 ? html`<p style="color: var(--text-muted); font-style: italic; margin-top: 15px;">Diffs automatically map when this tab is opened.</p>` : ''}
                ${!this.activeDiffJobId && Object.keys(this.sweepFiles).length > 0 ? html`
                    <insetu-category-section titleText="🧹 Sweepable State">
                        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: -10px; margin-bottom: 15px; padding-left: 5px;">Untracked metadata, tracker items, and configuration files ready for commit.</p>
                        
                        ${Object.entries(this.sweepFiles).map(([repo, files]) => html`
                            <insetu-card
                            .filename=${repo}
                            .titleText=${repo}
                            .descriptionText=${`${files.length} untracked or excluded files pending.`}
                            icon="📦"
                            intentColor="var(--intent-neutral)"
                            @card-clicked=${() => {
                                const newSet = new Set(this.sweepExpandedRepos);
                                newSet.has(repo) ? newSet.delete(repo) : newSet.add(repo);
                                this.sweepExpandedRepos = newSet;
                                this.requestUpdate();
                            }}>
                            <button slot="actions" class="btn-sm" style="background: var(--intent-highlight); margin: 0; color: white; border: none; cursor: pointer;" 
                                @click=${(e) => { e.stopPropagation(); this._executeRepoSweep(repo); }}>🚀 Sweep Repo</button>
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
                    `)}
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
                                <button class="btn-sm" style="background: var(--intent-neutral); margin: 0;" @click=${(e) => this._copyTarget(chunk, e.target)}>📋 Copy</button>
                                <button class="btn-sm" style="background: var(--intent-primary); margin: 0;" @click=${(e) => this._downloadTarget(chunk, e.target)}>⬇️ Download</button>
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

window.ExtensionRegistry.registerExtension('git', {
    name: "Version Control",
    version: "2.0.0",
    layoutSlots: [
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
        if (tabId === 'context' && localStorage.getItem('insetu_subtab_context') === 'diffs') {
            generateDiffs();
        }
        return false;
    });
}
if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerUIHook) {
    window.inSetu.extensions.Registry.registerUIHook('zone:file-card-actions', (data) => {
        if (data.filepath && data.filepath.endsWith('_diffs.txt')) {
            return html`
                <button slot="actions" class="btn-sm" style="background: var(--intent-highlight); margin: 0 5px 0 0;" @click=${(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('open-push-modal', { detail: { diffFile: data.filepath, repo: data.repoDir } }));
                }}>🚀 Push</button>
            `;
        }
        return null; 
    });
}