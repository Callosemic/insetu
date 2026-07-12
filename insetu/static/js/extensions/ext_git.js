import {
    executeSystemCompile,
    setContextManifest,
    createFileCard
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
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const res = await window.inSetu.api.workspace(`git/diffs/generate?_t=${Date.now()}`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Workspace-ID': activeWs },
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
        sweepModalOpen: { type: Boolean },
        pushChangelogs: { type: Array },
        sweepFiles: { type: Object },
        selectedSweepFiles: { type: Object },
        sweepLoading: { type: Boolean },
        gitPushMessage: { type: String },
        gitSweepMessage: { type: String },
        currentPushRepo: { type: String },
        currentPushDiffFile: { type: String },
        activePushJobId: { type: String },
        activeSweepJobId: { type: String }
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
        this.sweepModalOpen = false;
        this.pushChangelogs = [];
        this.sweepFiles = {};
        this.selectedSweepFiles = {};
        this.sweepLoading = false;
        this.gitPushMessage = '';
        this.gitSweepMessage = '';
        this.currentPushRepo = '';
        this.currentPushDiffFile = '';
        this.activePushJobId = null;
        this.activeSweepJobId = null;
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
            this.activeSweepJobId = state.activeSweepJobId;
        });
        const state = AppStore.getState();
        this.cachedDiffFiles = state.cachedDiffFiles || [];
        this.activeDiffJobId = state.activeDiffJobId;
        this.diffJobMessage = state.diffJobMessage;
        this.diffJobError = state.diffJobError;
        this.categoryOrder = state.categoryOrder || [];
        this.hiddenOutputs = state.hiddenOutputs || [];
        this.activePushJobId = state.activePushJobId;
        this.activeSweepJobId = state.activeSweepJobId;

        // Secure boundary event listeners to allow external triggers (e.g. from file cards)
        this._boundHandleOpenPush = this._handleOpenPush.bind(this);
        this._boundHandleOpenSweep = this._handleOpenSweep.bind(this);
        window.addEventListener('open-push-modal', this._boundHandleOpenPush);
        window.addEventListener('open-sweep-modal', this._boundHandleOpenSweep);
    }
    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('open-push-modal', this._boundHandleOpenPush);
        window.removeEventListener('open-sweep-modal', this._boundHandleOpenSweep);
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
    async _handleOpenSweep() {
        this.gitSweepMessage = '';
        this.sweepModalOpen = true;
        this.sweepLoading = true;
        this.sweepFiles = {};
        this.selectedSweepFiles = {};
        try {
            const res = await this.api.post('sweep/status', {});
            if (!res.ok) throw new Error("Failed to start scan");
            const data = await res.json();
            this.api.pollJob(data.job_id, {
                onProgress: () => {},
                onComplete: (statusData) => {
                    this.sweepFiles = statusData.artifact.repos || {};
                    this.sweepLoading = false;
                },
                onError: (err) => {
                    alert("Error scanning workspaces: " + err.message);
                    this.sweepLoading = false;
                }
            });
        } catch (err) {
            alert("Error starting scan: " + err.message);
            this.sweepLoading = false;
        }
    }
    async _executeSweep() {
        const msg = this.gitSweepMessage.trim();
        if (!msg) return alert("Please enter a commit message for this sweep.");

        // Filter out empty arrays to ensure we only send repos with actual selections
        const selections = {};
        Object.keys(this.selectedSweepFiles).forEach(repo => {
            if (this.selectedSweepFiles[repo] && this.selectedSweepFiles[repo].length > 0) {
                selections[repo] = this.selectedSweepFiles[repo];
            }
        });
        if (Object.keys(selections).length === 0) return alert("No files selected.");

        try {
            const res = await this.api.post('sweep/push', { selections, message: msg });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Sweep request failed.");
            }
            const data = await res.json();
            AppStore.setState({ activeSweepJobId: data.job_id });
            this.sweepModalOpen = false;
            this.api.pollJob(data.job_id, {
                onProgress: (progressMsg) => {
                    this.gitSweepMessage = progressMsg || "Committing and pushing...";
                },
                onComplete: async (statusData) => {
                    this.gitSweepMessage = '';

                    const { dirtyDiffRepos } = AppStore.getState();
                    const newDirty = new Set(dirtyDiffRepos);
                    newDirty.add("ALL");
                    AppStore.setState({ activeSweepJobId: null, dirtyDiffRepos: newDirty });

                    if (window.loadSweepFiles) await window.loadSweepFiles(); 
                    if (window.executeSystemCompile) {
                        window.executeSystemCompile().then(() => window.generateDiffs());
                    } else {
                        window.generateDiffs();
                    }
                    alert(`✅ Sweep successful:\n\n${statusData.message}`);
                },
                onError: (err) => {
                    AppStore.setState({ activeSweepJobId: null });
                    alert(`❌ Sweep failed:\n\n${err.message}`);
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

            if (!categories[finalCat]) categories[finalCat] = [];
            categories[finalCat].push({
                filename: file,
                displayName: finalTitle,
                description: finalDesc,
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
                <div class="fuzzy-search-wrapper" style="margin: 0; border: none; border-radius: 0; background: transparent;">
                    <input type="text" placeholder="🔍 Fuzzy search pending diffs..." .value=${this.searchQuery} 
                        style="border: none; background: transparent; padding: 10px 12px; margin: 0; border-radius: 0; outline: none; box-shadow: none; width: 100%; box-sizing: border-box;"
                        @input=${e => this.searchQuery = e.target.value}>
                    ${this.searchQuery ? html`<button class="fuzzy-search-clear" @click=${() => this.searchQuery = ''}>Clear</button>` : ''}
                </div>
            </div>
            ${this.activeDiffJobId ? html`<div class="spinner" style="display: block;">${this.diffJobMessage || "Analyzing Git trees across sister repositories... please wait."}</div>` : ''}
            ${this.diffJobError ? html`<div style="color: var(--intent-danger); margin-top: 15px;">Error analyzing diffs: ${this.diffJobError}</div>` : ''}

            <div style="display: flex; flex-direction: column; margin-top: 15px;">
                ${!this.activeDiffJobId && this.cachedDiffFiles.length === 0 ? html`<p style="color: var(--text-muted);">No pending changes detected across tracked repositories.</p>` : ''}
                ${sortedCats.map(catName => html`
                    <div class="category-heading">${catName}</div>
                    ${categories[catName].map(f => html`
                        <insetu-card
                            .filename=${f.filename}
                            .titleText=${f.displayName}
                            .descriptionText=${f.description}
                            icon="📦"
                            intentColor="var(--intent-highlight)"
                            @card-clicked=${() => { if(window.viewAndCopy) window.viewAndCopy(f.filename); }}>
                            <insetu-file-actions slot="actions" .filepath=${f.filename} .repoDir=${f.repoDir} .isFS=${f.isFS}></insetu-file-actions>
                            <button slot="actions" class="btn-sm" style="background: var(--intent-primary); margin: 0;" @click=${(e) => {
                                e.stopPropagation();
                                if (window.fetchAndDownloadState) {
                                    window.fetchAndDownloadState(f.filename, e.target);
                                }
                            }}>⬇️ Download</button>
                        </insetu-card>
                    `)}
                `)}
                ${!this.activeDiffJobId && this.cachedDiffFiles.length > 0 ? html`<p style="color: var(--text-muted); font-style: italic; margin-top: 15px;">Diffs automatically map when this tab is opened.</p>` : ''}
            </div>

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

            <insetu-modal ?open=${this.sweepModalOpen} titleText="🧹 Selective Sweep" maxWidth="700px" @modal-closed=${() => this.sweepModalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1;">
                    ${this.sweepLoading ? html`<div class="spinner" style="display:block; margin-top:0; margin-bottom:15px;">Scanning workspaces...</div>` : html`
                        <div style="flex: 1; overflow-y: auto; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; padding: 10px; margin-bottom: 15px; min-height: 200px;">
                            ${Object.keys(this.sweepFiles).length === 0 ? html`<p style="color: var(--intent-success); font-weight: bold; text-align: center; margin-top: 20px;">✨ Working tree clean! Nothing to sweep.</p>` : ''}
                            ${Object.entries(this.sweepFiles).map(([repo, files]) => html`
                                <h4 style="margin: 10px 0 5px 0; color: var(--intent-primary); border-bottom: 1px solid var(--border); padding-bottom: 3px;">📦 ${repo}</h4>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; margin-left: 5px;">
                                    <input type="checkbox" 
                                        .checked=${this.selectedSweepFiles?.[repo]?.length === files.length && files.length > 0}
                                        @change=${(e) => {
                                        const isChecked = e.target.checked;
                                        this.selectedSweepFiles = {
                                            ...this.selectedSweepFiles,
                                            [repo]: isChecked ? files.map(f => f.path) : []
                                        };
                                    }}>
                                    <label style="font-size: 0.8rem; font-weight: bold; color: var(--text-muted); cursor: pointer;">Select All</label>
                                </div>
                                ${files.map(f => html`
                                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px; margin-left: 15px;">
                                        <input type="checkbox" 
                                            .checked=${(this.selectedSweepFiles?.[repo] || []).includes(f.path)}
                                            @change=${(e) => {
                                                const isChecked = e.target.checked;
                                                const currentList = this.selectedSweepFiles?.[repo] || [];
                                                this.selectedSweepFiles = {
                                                    ...this.selectedSweepFiles,
                                                    [repo]: isChecked 
                                                        ? [...currentList, f.path] 
                                                        : currentList.filter(p => p !== f.path)
                                                };
                                            }}>
                                        <label style="font-family: monospace; font-size: 0.85rem; word-break: break-all; cursor: pointer;">[${f.status}] ${f.path}</label>
                                    </div>
                                `)}
                            `)}
                        </div>
                    `}
                    <label style="font-weight: bold; margin-bottom: 5px; font-size: 0.9rem;">Commit Message:</label>
                    <textarea placeholder="e.g. chore: format, lint, and clear orphans" .value=${this.gitSweepMessage} @input=${(e) => this.gitSweepMessage = e.target.value} style="margin-bottom: 15px; padding: 10px; font-weight: bold; height: 60px; resize: none; width: 100%; box-sizing: border-box;"></textarea>
                </div>
                <div slot="footer">
                    <button class="btn-sm" style="flex: 1; padding: 15px; background: var(--intent-primary); color: white; border: none; font-weight: bold; cursor: pointer;" ?disabled=${this.sweepLoading} @click=${this._executeSweep}>🚀 Commit & Push Selected</button>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-ext-git-diffs', InSetuExtGitDiffs);
export class InSetuExtGitActions extends InSetuElement {
    get extName() { return 'git'; }
    static properties = { hasChanges: { type: Boolean } };
    static styles = [sharedStyles];
    constructor() { super(); this.hasChanges = false; }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(AppStore, state => {
            this.hasChanges = !!(state.cachedDiffFiles && state.cachedDiffFiles.length > 0);
        });
        this.hasChanges = !!(AppStore.getState().cachedDiffFiles && AppStore.getState().cachedDiffFiles.length > 0);
    }
    _openMenu(e) {
        if (!window.inSetu?.ui.Factory?.createDropdown) return;
        const items = [];
        if (this.hasChanges) {
            items.push({ label: 'Sweep Remaining', icon: '🧹', onClick: () => window.dispatchEvent(new CustomEvent('open-sweep-modal')) });
        } else {
            items.push({ label: 'No changes to sweep', icon: '✨', onClick: () => {} });
        }
        window.inSetu.ui.Factory.createDropdown({ anchor: e.target, items });
    }
    render() { return html`<button class="system-action-btn" @click=${this._openMenu}>☰</button>`; }
}
customElements.define('insetu-ext-git-actions', InSetuExtGitActions);

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
        },
        {
            slot: "slots:sub-navigation-actions",
            targetParent: "context",
            targetSub: "diffs",
            component: "insetu-ext-git-actions",
            order: 1
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