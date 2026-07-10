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
        const res = await window.inSetu.api.workspace('diffs/generate', { 
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
    } catch (error) {
        AppStore.setState({ diffJobError: error.message });
    }
}
window.generateDiffs = generateDiffs;
import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';

export class InSetuExtGitDiffs extends LitElement {
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
        this._unsub = AppStore.subscribe((state) => {
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
        if (this._unsub) this._unsub();
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
            const res = await window.inSetu.api.workspace('git/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    repo: this.currentPushRepo,
                    message: msg,
                    diff_file: this.currentPushDiffFile
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Push request failed.");
            }
            const data = await res.json();
            AppStore.setState({ activePushJobId: data.job_id });
            this.pushModalOpen = false;
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
            const res = await window.inSetu.api.workspace('git/sweep/status');
            if (!res.ok) throw new Error("Failed to fetch status");
            const data = await res.json();
            this.sweepFiles = data.repos || {};
        } catch (err) {
            alert("Error scanning workspaces: " + err.message);
        } finally {
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
            const res = await window.inSetu.api.workspace('git/sweep/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ selections, message: msg })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Sweep request failed.");
            }
            const data = await res.json();
            AppStore.setState({ activeSweepJobId: data.job_id });
            this.sweepModalOpen = false;
        } catch (e) {
            alert("Network error executing sweep: " + e.message);
        }
    }

    render() {
        const categories = {};
        const sq = this.searchQuery;
        const filteredFiles = sq ? window.fuzzyFilterObjects(this.cachedDiffFiles, sq, f => (typeof f === 'string' ? f : f.filename)) : this.cachedDiffFiles;

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
            <div class="sticky-header">
                <div class="fuzzy-search-wrapper" style="margin-bottom: 0;">
                    <input type="text" placeholder="🔍 Fuzzy search pending diffs..." .value=${this.searchQuery} @input=${e => this.searchQuery = e.target.value}>
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
export class InSetuExtGitActions extends LitElement {
    static properties = { hasChanges: { type: Boolean } };
    static styles = [sharedStyles];
    constructor() { super(); this.hasChanges = false; }
    connectedCallback() {
        super.connectedCallback();
        this._unsub = AppStore.subscribe(state => {
            this.hasChanges = !!(state.cachedDiffFiles && state.cachedDiffFiles.length > 0);
        });
        this.hasChanges = !!(AppStore.getState().cachedDiffFiles && AppStore.getState().cachedDiffFiles.length > 0);
    }
    disconnectedCallback() { super.disconnectedCallback(); if (this._unsub) this._unsub(); }
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

if (window.inSetu.extensions.Registry && window.inSetu.extensions.Registry.registerTick) {
    window.inSetu.extensions.Registry.registerTick('git', 1000, async () => {
        const { activeSweepJobId, activePushJobId, activeDiffJobId } = AppStore.getState();
        // Sweep Job Polling
        if (activeSweepJobId) {
            try {
                const statusRes = await window.inSetu.api.system(`jobs/${activeSweepJobId}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    const spinner = document.getElementById('sweep-push-spinner');
                    const btn = document.getElementById('execute-sweep-btn');

                    if (spinner) spinner.innerText = statusData.message || "Committing and pushing...";
                    if (statusData.status === 'completed') {
                        const sweepMsgEl = document.getElementById('sweep-message');
                        if (sweepMsgEl) sweepMsgEl.value = '';
                        AppStore.setState({ gitSweepMessage: '' });

                        const { dirtyDiffRepos } = AppStore.getState();
                        const newDirty = new Set(dirtyDiffRepos);
                        newDirty.add("ALL");
                        AppStore.setState({ activeSweepJobId: null, dirtyDiffRepos: newDirty });

                        await loadSweepFiles(); 
                        executeSystemCompile().then(() => generateDiffs());
                        alert(`✅ Sweep successful:\n\n${statusData.message}`);
                        if (btn) btn.style.display = 'block';
                        if (spinner) {
                            spinner.style.display = 'none';
                            spinner.innerText = "Committing and pushing...";
                        }
                    } else if (statusData.status === 'failed') {
                        AppStore.setState({ activeSweepJobId: null });
                        alert(`❌ Sweep failed:\n\n${statusData.message}`);
                        if (btn) btn.style.display = 'block';
                        if (spinner) {
                            spinner.style.display = 'none';
                            spinner.innerText = "Committing and pushing...";
                        }
                    }
                }
            } catch (e) {
                console.error("Sweep polling error:", e);
            }
        }
        // Push Job Polling
        if (activePushJobId) {
            try {
                const statusRes = await window.inSetu.api.system(`jobs/${activePushJobId}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    const spinner = document.getElementById('push-spinner');
                    const btn = document.getElementById('execute-push-btn');

                    if (spinner) spinner.innerText = statusData.message || "Pushing to remote... please wait.";
                    if (statusData.status === 'completed') {
                        const { currentPushRepo, dirtyDiffRepos } = AppStore.getState();

                        const newDirty = new Set(dirtyDiffRepos);
                        newDirty.add(currentPushRepo);
                        AppStore.setState({ activePushJobId: null, dirtyDiffRepos: newDirty });

                        alert(`✅ Successfully pushed ${currentPushRepo}!\n\n${statusData.message}`);
                        window.inSetu.ui.Factory.closeModal('push-modal');
                        try {
                            await executeSystemCompile();
                        } catch (refreshErr) {
                            console.warn("Background refresh failed:", refreshErr);
                        } finally {
                            generateDiffs(true);
                        }
                    } else if (statusData.status === 'failed') {
                        window._activePushJobId = null;
                        alert(`❌ Push failed:\n\n${statusData.message}`);
                        if (btn) btn.style.display = 'block';
                        if (spinner) spinner.style.display = 'none';
                    }
                }
            } catch (e) {
                console.error("Push polling error:", e);
            }
        }
        // Diff Generation Polling
        if (activeDiffJobId) {
                try {
                        const statusRes = await window.inSetu.api.system(`jobs/${activeDiffJobId}`);
                        if (statusRes.ok) {
                                const statusData = await statusRes.json();
                                AppStore.setState({ diffJobMessage: statusData.message });

                                if (statusData.status === 'completed') {
                                        const newFiles = statusData.artifact.files || [];
                                        const targetRepos = statusData.artifact.target_repos;

                                        const prevCachedFiles = AppStore.getState().cachedDiffFiles || [];
                                        const updatedDirtyRepos = new Set(AppStore.getState().dirtyDiffRepos);
                                        const updatedCachedFiles = (() => {
                                                if (!targetRepos) {
                                                        updatedDirtyRepos.clear();
                                                        return newFiles;
                                                } else {
                                                        targetRepos.forEach(r => updatedDirtyRepos.delete(r));
                                                        const filtered = prevCachedFiles.filter(f => {
                                                                const repo = typeof f === 'object' ? f.repo : null;
                                                                return !repo || !targetRepos.includes(repo);
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
                                } else if (statusData.status === 'failed') {
                                        AppStore.setState({ 
                                                activeDiffJobId: null, 
                                                diffJobError: statusData.message,
                                                diffJobMessage: null
                                        });
                                }
                        }
                } catch (e) {
                        console.error("Diff polling error:", e);
                }
        }
    });
}

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