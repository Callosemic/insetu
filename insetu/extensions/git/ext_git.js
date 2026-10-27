import { html, css } from 'lit';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/insetu_sdk.js';

const AppStore = window.inSetu.stores.App;
export const GitStore = createExtensionStore('Git', {
    reposStatus: {},
    currentPushRepo: '',
    currentPushDiffFile: '',
    currentPushTargets: [],
    pushChangelogs: [],
    gitPushMessage: '',
    activeRepo: '',
    newBranchName: '',
    branchModalOpen: false,
    runtimeStrategy: 'rebase',
    repoStrategies: {},
    activeRemoteRepo: '',
    remoteUrlInput: '',
    remoteConflict: false,
    remoteModalOpen: false,
    activeSweepJobId: null,
    activePushJobId: null,
    activeDiffJobId: null,
    diffJobError: null,
    fetchStatus: window.inSetu.utils.coalescedAsync(async () => {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('git')) return;
        try {
            const res = await window.inSetu.api.get('git/status');
            if (res.ok) {
                const data = await res.json();
                GitStore.setState({ reposStatus: data.repos || {} });
            }
        } catch(e) { 
            console.error("Failed to fetch git status", e); 
        }
    })
}, {
    onEvict: {
        'git:push': { currentPushRepo: '', currentPushDiffFile: '', currentPushTargets: [], gitPushMessage: '', pushChangelogs: [] },
        'git:preview': { runtimeStrategy: 'rebase' }
    }
});
window.inSetu.stores.Git = GitStore;

export async function generateDiffs(force = false) {
    const gitStoreObj = typeof GitStore !== 'undefined' ? GitStore : window.inSetu?.stores?.Git;
    if (!gitStoreObj || !gitStoreObj.getState) return;
    const { activeDiffJobId } = gitStoreObj.getState();
    if (activeDiffJobId) return; // Prevent concurrent diff generation loops

    const manifestCtx = AppStore?.getState?.()?.manifest?.ctx || {};
    const hasCachedDiffs = Object.keys(manifestCtx).some(k => k.endsWith('_diffs.txt'));
    const dirtyBuckets = AppStore?.getState?.()?.dirtyBuckets || new Set();

    // Check if any dirty buckets belong to git tracked diff repos
    const hasDirtyRepos = dirtyBuckets.size > 0; // Simple fallback

    // Skip recompiling if not forced, no repos are marked dirty, and diffs exist in manifest
    if (!force && hasCachedDiffs && !hasDirtyRepos) {
        return;
    }

    const targetRepos = (force || !hasCachedDiffs || dirtyBuckets.has("global::main") || dirtyBuckets.has("ALL")) 
        ? null 
        : (hasDirtyRepos ? Array.from(new Set(Array.from(dirtyBuckets).map(b => b.split('::')[0]))).filter(r => r !== 'global') : null);

    gitStoreObj.setState({ activeDiffJobId: 'starting', diffJobError: null });
    if (window.inSetu?.stores?.Gather) {
        try {
            await window.inSetu.stores.Gather.getState().executeCompile(null, force, 'git_diffs', targetRepos);
            gitStoreObj.setState({    
                activeDiffJobId: null, 
                diffJobError: null
            });
            window.inSetu.events.emit('insetu:git:diffs-refreshed');
        } catch (error) {
            gitStoreObj.setState({ activeDiffJobId: null, diffJobError: error.message });
        }
    }
}
export class InSetuExtGitDiffs extends InSetuElement {
    static get extensionName() { return 'git'; }
    static properties = {
        activeDiffJobId: { type: String },
        diffJobError: { type: String },
        searchQuery: { type: String },
        categoryOrder: { type: Array },
        hiddenOutputs: { type: Array },
        sweepFiles: { type: Object },
        selectedSweepFiles: { type: Object },
        sweepExpandedRepos: { type: Object },
        sweepLoading: { type: Boolean },
        activePushJobId: { type: String },
        activeModules: { type: Array },
        pendingModules: { type: Array },
        isPipelineActive: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
    `];
    constructor() {
        super();
        this.activeDiffJobId = null;
        this.diffJobError = null;
        this.searchQuery = '';
        this.categoryOrder = [];
        this.hiddenOutputs = [];
        this.sweepFiles = {};
        this.selectedSweepFiles = {};
        this.sweepExpandedRepos = new Set();
        this.sweepLoading = false;
        this.activePushJobId = null;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            GitStore,
            state => ({
                activeDiffJobId: state.activeDiffJobId,
                diffJobError: state.diffJobError,
                activePushJobId: state.activePushJobId
            }),
            (slice) => {
                this.activeDiffJobId = slice.activeDiffJobId;
                this.diffJobError = slice.diffJobError;
                this.activePushJobId = slice.activePushJobId;
                this.requestUpdate();
            }
        );
        this.subscribe(
            AppStore,
            state => ({
                activeModules: state.activeModules || [],
                pendingModules: state.pendingModules || [],
                isPipelineActive: state.isPipelineActive || false,
                categoryOrder: state.categoryOrder || [],
                hiddenOutputs: state.hiddenOutputs || []
            }),
            (slice) => {
                this.activeModules = slice.activeModules;
                this.pendingModules = slice.pendingModules;
                this.isPipelineActive = slice.isPipelineActive;
                this.categoryOrder = slice.categoryOrder;
                this.hiddenOutputs = slice.hiddenOutputs;
                this.requestUpdate();
            }
        );
        const gitState = GitStore.getState();
        const appState = AppStore.getState();
        this.activeDiffJobId = gitState.activeDiffJobId;
        this.diffJobError = gitState.diffJobError;
        this.activePushJobId = gitState.activePushJobId;
        this.categoryOrder = appState.categoryOrder || [];
        this.hiddenOutputs = appState.hiddenOutputs || [];
        this.registerGlobalListener('insetu:git:generate-diffs', window, (e) => generateDiffs(e.detail?.force));
        this.registerGlobalListener('insetu:git:open-push-modal', window, this._handleOpenPush.bind(this));
        this.registerGlobalListener('insetu:git:diffs-refreshed', window, () => {
            this._fetchSweepStatusSilent();
            this.requestUpdate();
        });
        this.registerGlobalListener('insetu:git:sweep-repo', window, (e) => this._executeRepoSweep(e.detail.repoDir));
        this.registerGlobalListener('sutram-sync-complete', window, () => {
            this._fetchSweepStatusSilent();
            GitStore.getState().fetchStatus();
        });
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (payload && payload.ext_name === 'git' && payload.next_job_id) {
                GitStore.setState({ activeDiffJobId: payload.next_job_id });
            }
        });
        this.registerGlobalListener('insetu:compile-step-complete', window, (e) => {
            const detail = e.detail;
            if (detail.ext_name === 'git') {
                if (detail.artifact?.step_id === 'git_diffs' || detail.artifact?.step_id === 'compile_diffs_task') {
                    if (window.inSetu.sys && window.inSetu.sys.refreshManifest) {
                        window.inSetu.sys.refreshManifest().then(() => {
                            window.inSetu.events.emitHook('insetu:git:diffs-refreshed');
                        });
                    }
                }

                // Reactive Orchestration: Listen for background Git mutations and automatically re-sync
                if (detail.artifact?.git_state_mutated) {
                    GitStore.getState().fetchStatus();
                    generateDiffs(true);
                }
            }
        });
        this.registerGlobalListener('insetu:ensure-fresh-artifact', window, (e) => {
            const filePath = e.detail?.filepath || '';
            if (!filePath.startsWith('ctx://diffs/')) return;
            if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('git')) return;
            const baseUri = filePath.replace(/_part\d+\.txt$/, '.txt');
            const appState = AppStore.getState();
            const dirtyRepos = appState.dirtyRepos || new Set();
            const dirtyBuckets = appState.dirtyBuckets || new Set();
            const manifestObj = appState.manifest?.ctx?.[baseUri] || appState.manifest?.ctx?.[filePath];
            const addr = window.inSetu.utils.BucketAddress ? window.inSetu.utils.BucketAddress.fromFilepath(baseUri, manifestObj?.meta) : null;
            const isDirty = !manifestObj ||
                            (addr && addr.key && dirtyBuckets.has(addr.key)) ||
                            (addr && addr.repo && dirtyRepos.has(addr.repo)) ||
                            dirtyBuckets.has(baseUri) ||
                            dirtyBuckets.has(filePath);
            if (isDirty && Array.isArray(e.inSetuResponses)) {
                e.inSetuResponses.push((async () => {
                    if (window.inSetu.ui?.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus("⏳ Compiling fresh diffs...", null);
                    }
                    await generateDiffs(!manifestObj);
                })());
            }
        });
        this._fetchSweepStatusSilent();
        GitStore.getState().fetchStatus();
    }
disconnectedCallback() {
        super.disconnectedCallback();
}
    onViewActivated() {
        this._fetchSweepStatusSilent();
        GitStore.getState().fetchStatus();
    }
    onWorkspaceLoad(workspaceId) {
        this._fetchSweepStatusSilent();
        GitStore.getState().fetchStatus();
    }
    onForceRefresh() {
        generateDiffs(true);
    }
    _resolveDiffRepo(diffFile, explicitRepo = '') {
        if (explicitRepo) return explicitRepo;
        if (!diffFile) return '';
        const manifestObj = AppStore.getState().manifest?.ctx?.[diffFile];
        if (manifestObj?.meta?.repo) return manifestObj.meta.repo;
        const allRepos = AppStore.getState().allRepos || [];
        const base = new this.utils.InSetuURI(diffFile).basename.replace('_diffs.txt', '');
        return allRepos.find(r => r.replace(/-/g, '_').toLowerCase() === base.toLowerCase() || base.toLowerCase().startsWith(r.replace(/-/g, '_').toLowerCase() + '_')) || '';
    }

    async _handleOpenPush(e) {
        const { diffFile, repo, targets } = e.detail || {};
        let resolvedTargets = [];
        if (Array.isArray(targets) && targets.length > 0) {
            resolvedTargets = targets.map(t => ({
                diff_file: t.diff_file || t.filepath,
                repo: this._resolveDiffRepo(t.diff_file || t.filepath, t.repo || t.repoDir)
            })).filter(t => t.repo);
        } else {
            const singleRepo = this._resolveDiffRepo(diffFile, repo);
            if (singleRepo) {
                resolvedTargets = [{ repo: singleRepo, diff_file: diffFile }];
            }
        }

        const uniqueRepos = Array.from(new Set(resolvedTargets.map(t => t.repo)));
        const resolvedRepo = uniqueRepos[0] || '';
        const winLabel = resolvedTargets.length > 1
            ? `Bulk Commit & Push (${resolvedTargets.length} diffs in ${uniqueRepos.join(', ')})`
            : `Commit & Push: ${resolvedRepo || repo || ''}`;

        GitStore.setState({
            currentPushDiffFile: diffFile || (resolvedTargets[0]?.diff_file || ''),
            currentPushRepo: resolvedRepo,
            currentPushTargets: resolvedTargets,
            gitPushMessage: '',
            pushChangelogs: []
        });
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.openWindow({
                id: 'git:push',
                component: 'insetu-git-push-projection',
                label: winLabel,
                icon: 'send',
                intent: 'highlight',
                extName: 'git',
                windowOnly: true
            }, layout.focusedColumn || 'center', 1);
        }
        try {
            const allChangelogs = [];
            for (const r of uniqueRepos) {
                const res = await this.api.get(`git/changelogs?repo=${encodeURIComponent(r)}&t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data.changelogs)) {
                        allChangelogs.push(...data.changelogs);
                    }
                }
            }
            if (allChangelogs.length > 0) {
                GitStore.setState({
                    pushChangelogs: allChangelogs,
                    gitPushMessage: allChangelogs[0].title
                });
            }
        } catch (err) {
            console.error("Failed to load changelogs.");
        }
    }
    async _fetchSweepStatusSilent() {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('git')) return;
        this.sweepLoading = true;
        try {
            const res = await this.api.post('git/sweep/status', {});
            if (!res.ok) throw new Error("Failed to start scan");
            const data = await res.json();
            window.inSetu.utils.pollJob(data.job_id, {
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
                    this.sweepLoading = false;
                    this.requestUpdate();
                }
            });
        } catch (err) {
            // Silently swallow network/boot errors for background telemetry
            this.sweepLoading = false;
        }
    }
    _getSweepAllAction() {
        return this.api.bindJobAction('git/sweep/push', () => {
            const selections = {};
            const totalFiles = Object.keys(this.sweepFiles).reduce((acc, repo) => {
                if (this.ecosystem.pinnedRepos.has('ALL') || this.ecosystem.pinnedRepos.has(repo)) {
                    const selected = this.selectedSweepFiles[repo] || [];
                    if (selected.length > 0) { selections[repo] = selected; return acc + selected.length; }
                }
                return acc;
            }, 0);
            if (totalFiles === 0) throw new Error("No files selected to sweep.");
            const msg = prompt(`Enter a commit message to sweep ${totalFiles} file(s) across multiple repositories:`, "chore: global workspace sweep");
            if (!msg) throw new Error("Commit message required.");
            return { selections, message: msg };
        }, {
            onProgress: (msg) => { if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`${msg || "Sweeping workspaces..."}`, null); },
            onComplete: async (statusData) => {
                alert(`Global Sweep successful:\n\n${statusData.message}`, 'success');
            },
            onError: (err) => alert(`Global Sweep failed:\n\n${err.message}`, 'danger')
        });
    }
    _getRepoSweepAction(repo) {
        return this.api.bindJobAction('git/sweep/push', () => {
            const files = this.selectedSweepFiles[repo] || [];
            if (files.length === 0) throw new Error("No files selected to sweep.");
            const msg = prompt(`Enter a commit message to sweep metadata for ${repo}:`, "chore: sweep remaining state");
            if (!msg) throw new Error("Cancelled by user.");
            return { selections: { [repo]: files }, message: msg };
        }, {
            onProgress: (msg) => { if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(msg || "Sweeping repo..."); },
            onComplete: async (statusData) => {
                // Optimistically purge swept files from memory so the card heals immediately
                delete this.sweepFiles[repo];
                delete this.selectedSweepFiles[repo];
                this.requestUpdate();

                alert(`Sweep successful for ${repo}:\n\n${statusData.message}`, 'success');
                this._fetchSweepStatusSilent();
            },
            onError: (err) => alert(`Sweep failed for ${repo}:\n\n${err.message}`, 'danger')
        });
    }

    async _executeRepoSweep(repo) {
        try { await this._getRepoSweepAction(repo)(); } catch(e) {}
    }
    render() {
        const manifestCtx = AppStore.getState().manifest?.ctx || {};
        const diffFiles = Object.keys(manifestCtx).filter(k => k.endsWith('_diffs.txt')).map(k => ({
            filename: k,
            repo: manifestCtx[k].meta?.repo
        }));

        const categories = {};
        const filteredFiles = this.filterItems(diffFiles, {
            repoField: 'repo',
            searchQuery: this.searchQuery,
            searchFields: f => typeof f === 'string' ? f : `${f.repo || ''} ${f.filename}`
        });
        filteredFiles.forEach(fileObj => {
            const file = typeof fileObj === 'string' ? fileObj : fileObj.filename;
            const repoDir = typeof fileObj === 'object' ? fileObj.repo : null;
            if (this.hiddenOutputs && this.hiddenOutputs.includes(file)) return;
            const safeFile = new this.utils.InSetuURI(file).basename;
            const baseFileUri = file.replace('ctx://diffs/', 'ctx://contexts/').replace('_diffs.txt', '_context.txt');
            const ctxManifest = AppStore.getState().manifest?.ctx || {};
            const contextManifestObj = ctxManifest[baseFileUri] || {};
            const diffManifestObj = ctxManifest[file] || {};
            const diffMeta = diffManifestObj.meta || {};
            const repoCfg = (this.ecosystem?.targetConfigs || []).find(r => r && r.repo_dir === repoDir);
            const parentDomain = (repoCfg?.domain || '').trim() || 'Workspaces';
            const contextMeta = contextManifestObj.meta || { title: diffMeta.title || safeFile, domain: (diffMeta.domain || '').trim() || parentDomain, desc: "Pending diff payload." };
            const extMeta = window.inSetu.events.emitHook('insetu:context-metadata', baseFileUri);
            const finalCat = (extMeta ? extMeta.cat : (contextMeta.domain || diffMeta.domain || '')).trim() || parentDomain;
            const finalDesc = extMeta ? extMeta.desc : diffMeta.desc || contextMeta.desc;
            const finalTitle = extMeta ? extMeta.displayName.replace('.txt', '_diffs.txt') : contextMeta.title + (contextMeta.title.includes('(Diffs)') ? '' : " (Diffs)");
            const sizeStr = this.utils.formatArtifactSize(diffMeta);
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
            const iA = this.categoryOrder.indexOf(a) === -1 ? 999 : this.categoryOrder.indexOf(a);
            const iB = this.categoryOrder.indexOf(b) === -1 ? 999 : this.categoryOrder.indexOf(b);
            if (iA !== iB) return iA - iB;
            return a.localeCompare(b);
        });
        const isPipelineRunning = (this.activeModules || []).includes('git') || (this.pendingModules || []).includes('git');
        const isGitLoading = this.activeDiffJobId || isPipelineRunning;
        return html`
            <sutram-toolbar
                searchPlaceholder="Fuzzy search pending diffs..."
                .searchQuery=${this.searchQuery}
                @search-changed=${(e) => this.searchQuery = e.detail.value}
                .enableFilterDropdown=${true}
                .activeFilters=${Array.from(this.ecosystem.pinnedRepos)}>
                <insetu-repo-filter
                    slot="filters"
                    .repos=${this.ecosystem.allRepos}
                    .activeRepos=${Array.from(this.ecosystem.pinnedRepos)}
                    @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                </insetu-repo-filter>
            </sutram-toolbar>
            <sutram-scroll-view>
            ${this.diffJobError ? html`<div style="color: var(--intent-danger); padding: 10px 0;">Error analyzing diffs: ${this.diffJobError}</div>` : ''}
            <div style="display: flex; flex-direction: column;">
                ${sortedCats.map(catName => html`
                    <sutram-collapsible 
                        titleText=${catName} 
                        intent="neutral" 
                        ?open=${true}>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${categories[catName].map(f => {
                                const descText = f.branch ? `Branch: ${f.branch}` : f.description;
                                const repoStr = f.repoDir ? `[${f.repoDir}] ` : '';
                                // Extract sizes if previously stuffed into detailText
                                const sizeStr = (f.detailText && f.detailText.includes(' | ')) ? f.detailText.split(' | ')[1] : "";
                                const isDirty = (() => {
                                    const dirtySet = AppStore.getState().dirtyBuckets || new Set();
                                    if (dirtySet.has(f.filename)) return true;
                                    const manifestObj = AppStore.getState().manifest?.ctx?.[f.filename];
                                    const addr = window.inSetu.utils.BucketAddress.fromFilepath(f.filename, manifestObj?.meta);
                                    return dirtySet.has(String(addr.key).toLowerCase()) || dirtySet.has(addr.key);
                                })();
                                const isLocked = isGitLoading && isDirty;
                                return html`
                                <sutram-card
                                    style="opacity: ${isLocked ? '0.6' : '1'}; pointer-events: ${isLocked ? 'none' : 'auto'}; transition: opacity 0.2s ease;"
                                    .filename=${f.filename}
                                    .titleText=${f.displayName}
                                    .descriptionText=${descText}
                                    .detailPrefix=${repoStr}
                                    .detailText=${f.filename}
                                    .detailSuffix=${sizeStr ? ` | ${sizeStr}` : ''}
                                    icon=${isLocked ? "loader" : (isDirty ? "construction" : "package")}
                                    intent=${isDirty ? "warning" : "highlight"}
                                    entityType="file:diff"
                                    .entityData=${{ 
                                        filepath: f.filename, 
                                        repoDir: f.repoDir, 
                                        isFS: f.isFS,
                                        outdated: isDirty
                                    }}
                                    @card-clicked=${() => { if(this.vfs && this.vfs.viewAndCopy) this.vfs.viewAndCopy(f.filename); }}>
                                </sutram-card>
                            `;})}
                        </div>
                    </sutram-collapsible>
                `)}
                ${!isGitLoading && Object.keys(this.sweepFiles).some(r => this.ecosystem.pinnedRepos.has('ALL') || this.ecosystem.pinnedRepos.has(r)) ? html`
                    <sutram-collapsible 
                        titleText="Sweepable State" 
                        intent="neutral" 
                        ?open=${true}>
                        <sutram-async-btn slot="actions" icon="send" label="Sweep All" intent="primary" style="margin: 0;" .onClick=${this._getSweepAllAction()}></sutram-async-btn>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${Object.entries(this.sweepFiles).filter(([r, _]) => this.ecosystem.pinnedRepos.has('ALL') || this.ecosystem.pinnedRepos.has(r)).map(([repo, files]) => {
                                const isLocked = this.sweepLoading;
                                const branch = GitStore.getState().reposStatus[repo]?.current;
                                const descText = branch ? `Branch: ${branch} -${files.length} untracked or excluded files pending.` : `${files.length} untracked or excluded files pending.`;
                                return html`
                                <sutram-card
                                    style="opacity: ${isLocked ? '0.6' : '1'}; pointer-events: ${isLocked ? 'none' : 'auto'}; transition: opacity 0.2s ease;"
                                    .filename=${repo}
                                    .titleText=${repo}
                                    .descriptionText=${descText}
                                    icon=${isLocked ? "loader" : "package"}
                                    intent="neutral"
                                    entityType="repo"
                                    .entityData=${{ 
                                        repoDir: repo, 
                                        has_untracked_files: files.length > 0,
                                        outdated: this.sweepLoading
                                    }}
                                    @card-clicked=${() => {
                                        const newSet = new Set(this.sweepExpandedRepos);
                                        newSet.has(repo) ? newSet.delete(repo) : newSet.add(repo);
                                        this.sweepExpandedRepos = newSet;
                                        this.requestUpdate();
                                    }}>
                                </sutram-card>
                                ${this.sweepExpandedRepos.has(repo) ? html`
                                    <div style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; padding: 10px; margin-top: -8px; margin-bottom: 15px; margin-left: 15px;">
                                        ${files.map(f => {
                                            const isChecked = (this.selectedSweepFiles[repo] || []).includes(f.path);
                                            return html`
                                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                                    <sutram-toggle 
                                                        .checked=${isChecked}
                                                        @sutram-input-changed=${(e) => {
                                                            const checked = e.detail.value;
                                                            const currentList = this.selectedSweepFiles[repo] || [];
                                                            this.selectedSweepFiles = {
                                                                ...this.selectedSweepFiles,
                                                                [repo]: checked ? [...currentList, f.path] : currentList.filter(p => p !== f.path)
                                                            };
                                                            this.requestUpdate();
                                                        }}>
                                                    </sutram-toggle>
                                                    <span style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">[${f.status}] ${f.path}</span>
                                                </div>
                                            `;
                                        })}
                                    </div>
                                ` : ''}
                            `;})}
                        </div>
                    </sutram-collapsible>
                ` : ''}
                ${!isGitLoading && diffFiles.length === 0 && Object.keys(this.sweepFiles).length === 0 && !this.sweepLoading ? html`
                    <div style="background: var(--input-bg); border: 1px dashed var(--border); border-radius: 6px; padding: 30px 15px; text-align: center; margin: 20px; display: flex; flex-direction: column; align-items: center;">
                        <yv-icon name="sparkles" style="width: 36px; height: 36px; color: var(--intent-success); margin-bottom: 10px;"></yv-icon>
                        <h3 style="margin: 0 0 5px 0; color: var(--text);">Working Tree Clean</h3>
                        <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">No diffs or untracked metadata detected.</p>
                    </div>
                ` : ''}
            </sutram-scroll-view>
            </div>
        `;
    }
}
customElements.define('insetu-ext-git-diffs', InSetuExtGitDiffs);
export class InSetuGitPushProjection extends InSetuElement {
    static get extensionName() { return 'git'; }
    static properties = {
        currentPushRepo: { type: String },
        currentPushDiffFile: { type: String },
        currentPushTargets: { type: Array },
        pushChangelogs: { type: Array },
        gitPushMessage: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; }
    `];
    constructor() {
        super();
        const st = GitStore.getState();
        this.currentPushRepo = st.currentPushRepo || '';
        this.currentPushDiffFile = st.currentPushDiffFile || '';
        this.currentPushTargets = st.currentPushTargets || [];
        this.pushChangelogs = st.pushChangelogs || [];
        this.gitPushMessage = st.gitPushMessage || '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            GitStore,
            state => ({
                currentPushRepo: state.currentPushRepo || '',
                currentPushDiffFile: state.currentPushDiffFile || '',
                currentPushTargets: state.currentPushTargets || [],
                pushChangelogs: state.pushChangelogs || [],
                gitPushMessage: state.gitPushMessage || ''
            }),
            (slice) => {
                this.currentPushRepo = slice.currentPushRepo;
                this.currentPushDiffFile = slice.currentPushDiffFile;
                this.currentPushTargets = slice.currentPushTargets;
                this.pushChangelogs = slice.pushChangelogs;
                this.gitPushMessage = slice.gitPushMessage;
                this.requestUpdate();
            }
        );
    }
    _getPushAction() {
        let pushedLabel = '';
        return this.api.bindJobAction('git/push', () => {
            const msg = (this.gitPushMessage || '').trim();
            const repo = (this.currentPushRepo || '').trim();
            const diffFile = this.currentPushDiffFile || '';
            const targets = Array.isArray(this.currentPushTargets) && this.currentPushTargets.length > 0
                ? this.currentPushTargets
                : (repo ? [{ repo, diff_file: diffFile }] : []);
            if (!msg) throw new Error("Please enter a commit message.");
            if (targets.length === 0) throw new Error("Repository context missing.");
            pushedLabel = Array.from(new Set(targets.map(t => t.repo))).join(', ');
            if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('git:push');
            if (window.inSetu?.stores?.Selection) {
                window.inSetu.stores.Selection.getState().clearSelection();
            }
            return { repo: targets[0].repo, message: msg, diff_file: targets[0].diff_file, targets };
        }, {
            onProgress: (progressMsg) => {
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`${progressMsg || "Pushing to remote..."}`, null);
            },
            onComplete: async (statusData) => {
                alert(`Successfully pushed ${pushedLabel}!\n\n${statusData.message}`, 'success');
            },
            onError: (err) => alert(`Push failed:\n\n${err.message}`, 'danger')
        });
    }
    render() {
        const selectValue = this.pushChangelogs.some(cl => cl.title === this.gitPushMessage) ? this.gitPushMessage : '';
        return html`
            <sutram-scroll-view padding="15px" style="gap: 12px;">
                ${this.currentPushTargets && this.currentPushTargets.length > 1 ? html`
                    <div style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px; font-size: 0.8rem;">
                        <div style="font-weight: bold; color: var(--intent-highlight); margin-bottom: 6px;">Selected Diff Buckets (${this.currentPushTargets.length}):</div>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; font-family: var(--font-mono);">
                            ${this.currentPushTargets.map(t => html`
                                <span style="background: var(--bg); border: 1px solid var(--border); padding: 2px 8px; border-radius: 4px;">[${t.repo}]${new this.utils.InSetuURI(t.diff_file || '').basename}</span>
                            `)}
                        </div>
                    </div>
                ` : ''}
                <sutram-select 
                    label="Recent Changelogs"
                    .value=${selectValue}
                    .options=${[{ value: '', label: '-- Type a custom message below --' }, ...this.pushChangelogs.map(cl => ({ value: cl.title, label: cl.title }))]}
                    @sutram-input-changed=${(e) => GitStore.setState({ gitPushMessage: e.detail.value })}>
                </sutram-select>
                <sutram-textarea  
                    label="Commit Message"
                    placeholder="Enter commit message..."
                    .value=${this.gitPushMessage}
                    @sutram-input-changed=${(e) => GitStore.setState({ gitPushMessage: e.detail.value })}>
                </sutram-textarea>
            </sutram-scroll-view>
            <div style="padding: 12px 15px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; flex-shrink: 0;">
                <sutram-btn intent="neutral" icon="x" label="Cancel" style="flex: 1; margin: 0;" @click=${() => {
                    if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('git:push');
                }}></sutram-btn>
                <sutram-async-btn icon="send" label="Execute Push" intent="primary" style="flex: 2; margin: 0;" .onClick=${this._getPushAction()}></sutram-async-btn>
            </div>
        `;
    }
}
customElements.define('insetu-git-push-projection', InSetuGitPushProjection);
export class InSetuExtGitCtrl extends InSetuElement {
    static get extensionName() { return 'git'; }
    static properties = {
        reposStatus: { type: Object },
        branchModalOpen: { type: Boolean },
        remoteModalOpen: { type: Boolean },
        activeRepo: { type: String },
        newBranchName: { type: String },
        activeRemoteRepo: { type: String },
        remoteUrlInput: { type: String },
        remoteConflict: { type: Boolean },
        activePullJobId: { type: String },
        pullMessage: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; container-type: inline-size; }
    `];
    constructor() {
        super();
        this.reposStatus = {};
        this.branchModalOpen = false;
        this.remoteModalOpen = false;
        this.activeRepo = '';
        this.newBranchName = '';
        this.activeRemoteRepo = '';
        this.remoteUrlInput = '';
        this.remoteConflict = false;
        this.activePullJobId = null;
        this.pullMessage = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            GitStore,
            state => ({
                reposStatus: state.reposStatus || {},
                branchModalOpen: !!state.branchModalOpen,
                remoteModalOpen: !!state.remoteModalOpen,
                activeRepo: state.activeRepo || '',
                newBranchName: state.newBranchName || '',
                activeRemoteRepo: state.activeRemoteRepo || '',
                remoteUrlInput: state.remoteUrlInput || '',
                remoteConflict: !!state.remoteConflict
            }),
            (slice) => {
                this.reposStatus = slice.reposStatus;
                this.branchModalOpen = slice.branchModalOpen;
                this.remoteModalOpen = slice.remoteModalOpen;
                this.activeRepo = slice.activeRepo;
                this.newBranchName = slice.newBranchName;
                this.activeRemoteRepo = slice.activeRemoteRepo;
                this.remoteUrlInput = slice.remoteUrlInput;
                this.remoteConflict = slice.remoteConflict;
                this.requestUpdate();
            }
        );
        this.registerGlobalListener('insetu:git:ctrl-init', window, (e) => {
            const branch = prompt(`Initialize Git repository for '${e.detail.repoDir}' on branch:`, 'main');
            if (branch) this._initRepo(e.detail.repoDir, branch.trim());
        });
        this.registerGlobalListener('insetu:git:ctrl-remote', window, (e) => {
            GitStore.setState({
                activeRemoteRepo: e.detail.repoDir,
                remoteUrlInput: '',
                remoteConflict: false,
                remoteModalOpen: true
            });
        });
        this.registerGlobalListener('insetu:git:ctrl-pull', window, (e) => {
            this._previewPull(e.detail.repoDir);
        });
        this.registerGlobalListener('insetu:git:ctrl-branch', window, (e) => {
            GitStore.setState({
                activeRepo: e.detail.repoDir,
                newBranchName: '',
                branchModalOpen: true
            });
        });
        this.registerGlobalListener('insetu-git-settings-changed', window, () => {
            this._loadSettings();
        });
        this.reposStatus = GitStore.getState().reposStatus || {};
        GitStore.getState().fetchStatus();
        this._loadSettings();
    }
    onWorkspaceLoad(workspaceId) {
        GitStore.getState().fetchStatus();
        this._loadSettings();
    }
    onViewActivated() {
        GitStore.getState().fetchStatus();
        this._loadSettings();
    }
    onForceRefresh() {
        GitStore.getState().fetchStatus();
        this._loadSettings();
    }
    async _loadSettings() {
        try {
            const repos = this.ecosystem?.allRepos || AppStore.getState()?.allRepos || [];
            const strategies = {};
            await Promise.all(
                repos.map(async (repo) => {
                    const res = await this.api.get(`git/settings?repo=${encodeURIComponent(repo)}`);
                    if (res.ok) {
                        const data = await res.json();
                        strategies[repo] = data.pull_strategy || 'rebase';
                    }
                })
            );
            this._repoStrategies = strategies;
            GitStore.setState({ repoStrategies: strategies });
        } catch(e) { console.error("Failed to load extension settings", e); }
    }
    _getPreviewPullAction(repo) {
        return this.api.bindJobAction('git/fetch_preview', { repo }, {
            onProgress: (msg) => {
                this.pullMessage = msg;
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`⏳ ${msg}`, null);
            },
            onComplete: (statusData) => {
                this.activePullJobId = null;
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`✅ Fetch complete.`, 2000);
                if (window.Sutram?.stores?.Layout) {
                    const layout = window.Sutram.stores.Layout.getState();
                    const closeWin = () => layout.closeWindow('git:preview');
                    const currentStrategy = GitStore.getState().repoStrategies?.[repo] || 'rebase';
                    const extraControls = currentStrategy === 'runtime' ? html`
                        <div style="background: var(--input-bg); padding: 12px; border-radius: 6px; border: 1px solid var(--border);">
                            <sutram-select 
                                label="Reconciliation Strategy"
                                ?flush=${true}
                                .value=${GitStore.getState().runtimeStrategy || 'rebase'}
                                .options=${[
                                    { value: 'rebase', label: 'Rebase (--rebase)' },
                                    { value: 'merge', label: 'Merge (--no-rebase)' },
                                    { value: 'ff_only', label: 'Fast-Forward Only (--ff-only)' }
                                ]}
                                @sutram-input-changed=${(e) => GitStore.setState({ runtimeStrategy: e.detail.value })}>
                            </sutram-select>
                        </div>
                    ` : null;
                    const executePull = this.api.bindJobAction('git/pull', () => {
                        closeWin();
                        const strat = (currentStrategy === 'runtime') ? (GitStore.getState().runtimeStrategy || 'rebase') : currentStrategy;
                        return { repo, strategy: strat };
                    }, {
                        onProgress: (msg) => {
                            if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`⏳ ${msg}`, null);
                        },
                        onComplete: (resData) => {
                            if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`✅ Pull complete.`, 2000);
                            alert(`✅ Pull successful for ${repo}\n\n${resData.message}`);
                            GitStore.getState().fetchStatus();
                        },
                        onError: (err) => {
                            alert(`❌ Pull failed for ${repo}\n\n${err.message}`);
                        }
                    });

                    layout.openWindow({
                        id: 'git:preview',
                        component: 'sutram-report-projection',
                        label: `Incoming Changes: ${repo}`,
                        icon: 'download',
                        intent: 'primary',
                        extName: 'git',
                        windowOnly: true,
                        props: {
                            content: statusData.message || 'Already up to date.',
                            suggestedFilename: `git_preview_${repo}_${Date.now()}.txt`,
                            extraContent: extraControls,
                            actions: [
                                { label: 'Cancel', icon: 'x', intent: 'danger', onClick: closeWin },
                                { label: 'Confirm & Pull', icon: 'download', intent: 'primary', primary: true, asyncAction: executePull }
                            ]
                        }
                    }, layout.focusedColumn || 'center', 1);
                }
            },
            onError: (err) => {
                this.activePullJobId = null;
                alert(`❌ Fetch failed for ${repo}\n\n${err.message}`);
            }
        });
    }
    async _checkoutBranch(repo, branch, createNew = false) {
        const action = this.api.bindJobAction('git/checkout', { repo, branch, create_new: createNew }, {
            onComplete: (statusData) => {
                alert(`✅ Checkout successful for ${repo}\n\n${statusData.message}`);
                GitStore.setState({ branchModalOpen: false });
                GitStore.getState().fetchStatus();
            },
            onError: (err) => alert(`❌ Checkout failed for ${repo}\n\n${err.message}`)
        });
        try { await action(); } catch(e) {}
    }
    _getConnectRemoteAction(resolution = null) {
        return this.api.bindJobAction('git/remote/add', () => {
            const repo = this.activeRemoteRepo;
            const url = (this.remoteUrlInput || '').trim();
            if (!url) throw new Error("Please enter a valid Git URL.");
            return { repo, url, resolution };
        }, {
            onComplete: (statusData) => {
                GitStore.setState({ remoteModalOpen: false, remoteConflict: false });
                alert(`✅ Remote connected and pushed successfully!\n\n${statusData.message}`);
                GitStore.getState().fetchStatus();
            },
            onError: (err) => {
                if (err.message.includes('fetch first') || err.message.includes('contains work that you do not have locally') || err.message.includes('non-fast-forward') || err.message.includes('branch tip is behind') || err.message.includes('Updates were rejected')) {
                    GitStore.setState({ remoteConflict: true });
                } else {
                    alert(`❌ Failed to connect remote for ${this.activeRemoteRepo}\n\n${err.message}`);
                }
            }
        });
    }
    async _previewPull(repo) {
        this.pullMessage = `Initializing fetch for ${repo}...`;
        this.activePullJobId = 'starting';
        try { await this._getPreviewPullAction(repo)(); } catch(e) { this.activePullJobId = null; }
    }
    _getInitRepoAction(repo, branch = 'main') {
        return this.api.bindJobAction('git/init', { repo, branch }, {
            onProgress: (msg) => this.pullMessage = msg,
            onComplete: (statusData) => {
                this.activePullJobId = null;
                alert(`${statusData.message}`, 'success');
                GitStore.getState().fetchStatus();
            },
            onError: (err) => {
                this.activePullJobId = null;
                alert(`Init failed for ${repo}\n\n${err.message}`, 'danger');
            }
        });
    }
    async _initRepo(repo, branch = 'main') {
        this.pullMessage = `Initializing ${repo}...`;
        this.activePullJobId = 'starting';
        try { await this._getInitRepoAction(repo, branch)(); } catch(e) { this.activePullJobId = null; }
    }

    render() {
        return html`
            <sutram-scroll-view padding="15px" style="gap: 15px;">
                ${this.activePullJobId ? html`<div class="spinner" style="display: block;">${this.pullMessage || 'Pulling from remote...'}</div>` : ''}

                ${this.ecosystem.allRepos.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic;">No repositories tracked.</div>` : ''}
                ${this.ecosystem.allRepos.map(repo => {
                    const status = this.reposStatus[repo] || {};
                    if (status.is_git === false) {
                        return html`
                            <sutram-card 
                                titleText=${repo} 
                                descriptionText="Not a Git repository." 
                                icon="folder" 
                                intent="neutral"
                                ?disableSelection=${true}
                                entityType="repo"
                                .entityData=${{ repoDir: repo, isGitCtrl: true, status }}>
                            </sutram-card>
                        `;
                    }
                    const currentBranch = status.current || 'unknown';
                    const syncText = status.sync_status ? ` | ${status.sync_status}` : '';
                    const descText = `Branch: ${currentBranch}${syncText}`;
                    const conflicts = status.conflicts || [];
                    const conflictBadge = conflicts.length > 0 ? html`<span slot="header-tags" class="task-tag" style="background: var(--intent-danger); color: white; border: 1px solid var(--intent-danger); margin-left: 5px;">${conflicts.length} Conflict${conflicts.length > 1 ? 's' : ''}</span>` : '';
                    return html`
                        <sutram-card 
                            titleText=${repo} 
                            descriptionText=${descText} 
                            icon="package" 
                            intent="${conflicts.length > 0 ? 'danger' : 'neutral'}"
                            ?disableSelection=${true}
                            entityType="repo"
                            .entityData=${{ repoDir: repo, isGitCtrl: true, status }}>${conflictBadge}
                        </sutram-card>
                    `;
                })}
            </sutram-scroll-view>

            ${this.branchModalOpen ? html`
                <sutram-modal ?open=${true} titleText="Branch Management: ${this.activeRepo}" @sutram-modal-closed=${() => GitStore.setState({ branchModalOpen: false })}>
                    <div slot="body" style="display: contents;">
                        <sutram-select 
                            label="Switch to Existing Branch"
                            .value=""
                            .options=${[{ value: '', label: '-- Select Branch --' }, ...(this.reposStatus[this.activeRepo]?.branches || []).map(b => ({ value: b, label: b }))]}
                            @sutram-input-changed=${(e) => {
                                if (e.detail.value) this._checkoutBranch(this.activeRepo, e.detail.value, false);
                            }}>
                        </sutram-select>
                        <hr style="border: 0; border-top: 1px solid var(--border); width: 100%; margin: 15px 0;">
                        <div style="display: flex; gap: 10px; align-items: flex-end;">
                            <sutram-input label="Create New Branch" placeholder="new-feature-branch" .value=${this.newBranchName} @sutram-input-changed=${e => GitStore.setState({ newBranchName: e.detail.value })} ?flush=${true} style="flex: 1; margin: 0;"></sutram-input>
                            <sutram-btn intent="success" icon="plus" label="Create & Switch" style="margin: 0;" @click=${() => {
                                if (this.newBranchName) this._checkoutBranch(this.activeRepo, this.newBranchName, true);
                            }}></sutram-btn>
                        </div>
                    </div>
                </sutram-modal>
            ` : ''}

            ${this.remoteModalOpen ? html`
                <sutram-modal ?open=${true} titleText="Connect Remote: ${this.activeRemoteRepo}" @sutram-modal-closed=${() => GitStore.setState({ remoteModalOpen: false })}>
                    <div slot="body" style="display: contents;">
                        ${this.remoteConflict ? html`
                            <div style="background: var(--input-bg); border: 1px solid var(--intent-danger); border-radius: 6px; padding: 15px;">
                                <h4 style="margin: 0 0 10px 0; color: var(--intent-danger); display: flex; align-items: center; gap: 6px;"><yv-icon name="alert-triangle" style="width: 16px; height: 16px;"></yv-icon> Remote Contains Unmerged Work</h4>
                                <p style="font-size: 0.85rem; color: var(--text); margin: 0 0 10px 0;">The repository you created on GitHub likely has an initial README or License file. Git rejected the push to prevent overwriting it.</p>
                                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;"><strong>Option 1 (Recommended):</strong> Pull those remote files down and merge them with your local code.<br><strong>Option 2:</strong> Force push your local code, completely overwriting whatever is currently on the remote.</p>
                            </div>
                        ` : html`
                            <div>
                                <sutram-input label="Remote Git URL" placeholder="git@github.com:user/repo.git" .value=${this.remoteUrlInput} @sutram-input-changed=${e => GitStore.setState({ remoteUrlInput: e.detail.value })}></sutram-input>
                                <sutram-btn size="sm" intent="neutral" icon="refresh-cw" label="Convert to SSH" style="margin-top: 8px; white-space: nowrap;" @click=${() => {
                                    const url = (this.remoteUrlInput || '').trim();
                                    const match = url.match(/^https:\/\/(github\.com|gitlab\.com|bitbucket\.org)\/(.+?)(?:\.git)?\/?$/);
                                    if (match) {
                                        GitStore.setState({ remoteUrlInput: 'git@' + match[1] + ':' + match[2] + '.git' });
                                    } else if (url.startsWith('https://')) {
                                        alert("Could not auto-convert. Ensure it is a standard GitHub, GitLab, or Bitbucket HTTPS URL.");
                                    }
                                }}></sutram-btn>
                                <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 8px;">We will set this as the 'origin' remote and push the current branch to establish upstream tracking. <b style="color: var(--intent-warning);">Use an SSH URL to avoid headless authentication errors.</b></p>
                            </div>
                        `}
                    </div>
                    <div slot="footer" style="display: flex; gap: 10px; width: 100%;">
                        ${this.remoteConflict ? html`
                            <sutram-async-btn icon="alert-triangle" label="Force Push (Overwrite)" intent="danger" style="flex: 1; margin: 0;" .onClick=${this._getConnectRemoteAction('force')}></sutram-async-btn>
                            <sutram-async-btn icon="download" label="Pull & Merge" intent="success" style="flex: 1; margin: 0;" .onClick=${this._getConnectRemoteAction('pull')}></sutram-async-btn>
                        ` : html`
                            <sutram-btn intent="neutral" icon="x" label="Cancel" style="flex: 1; margin: 0;" @click=${() => GitStore.setState({ remoteModalOpen: false })}></sutram-btn>
                            <sutram-async-btn icon="cloud" label="Connect & Push" intent="success" style="flex: 2; margin: 0;" .onClick=${this._getConnectRemoteAction()}></sutram-async-btn>
                        `}
                    </div>
                </sutram-modal>
            ` : ''}
        `;
    }
}
customElements.define('insetu-ext-git-ctrl', InSetuExtGitCtrl);

window.ExtensionRegistry.registerExtension('git', {
    name: "Version Control",
    version: "2.0.0",
    offline_mode: "read_only",
    entityActions: [
        {
            targetEntity: 'diff',
            targetEntities: ['diff'],
            id: 'git-push',
            bulkGroupKey: 'git-push',
            label: 'Push',
            bulkLabel: (items) => `Commit & Push (${items.length})`,
            icon: 'send',
            intent: 'highlight',
            group: 'vcs',
            vfsBound: true,
            bulkable: true,
            order: 10,
            emitEvent: (data) => ({ name: 'insetu:git:open-push-modal', detail: { diffFile: data.filepath, repo: data.repoDir } }),
            bulkAction: async (items) => {
                const targets = (items || []).map(item => {
                    const d = item.data || item;
                    return { diff_file: d.filepath, repo: d.repoDir };
                }).filter(t => t.diff_file);
                window.inSetu.events.emit('insetu:git:open-push-modal', { targets });
            }
        },
        {
            targetEntity: 'repo',
            id: 'git-sweep',
            label: 'Sweep Repo',
            icon: 'send',
            intent: 'highlight',
            group: 'share',
            vfsBound: true,
            order: 10,
            match: (data) => !!data?.has_untracked_files,
            emitEvent: (data) => ({ name: 'insetu:git:sweep-repo', detail: { repoDir: data.repoDir } })
        },
        {
            targetEntity: 'repo',
            id: 'git-ctrl-init',
            label: 'Initialize',
            icon: 'sparkles',
            intent: 'success',
            group: 'tools',
            vfsBound: false,
            order: 11,
            match: (data) => {
                if (!data?.isGitCtrl) return false;
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status && status.is_git === false;
            },
            emitEvent: (data) => ({ name: 'insetu:git:ctrl-init', detail: { repoDir: data.repoDir } })
        },
        {
            targetEntity: 'repo',
            id: 'git-ctrl-remote',
            label: (data) => {
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status?.has_remote === false ? 'Connect Remote' : 'Publish / Fix Remote';
            },
            icon: (data) => {
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status?.has_remote === false ? 'cloud' : 'upload-cloud';
            },
            intent: (data) => {
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status?.has_remote === false ? 'primary' : 'warning';
            },
            group: 'share',
            vfsBound: false,
            order: 12,
            match: (data) => {
                if (!data?.isGitCtrl) return false;
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status && status.is_git !== false && (status.has_remote === false || status.sync_status === '☁️ Local Only');
            },
            emitEvent: (data) => ({ name: 'insetu:git:ctrl-remote', detail: { repoDir: data.repoDir } })
        },
        {
            targetEntity: 'repo',
            id: 'git-ctrl-pull',
            label: 'Fetch & Pull...',
            icon: 'download',
            intent: 'primary',
            group: 'share',
            vfsBound: true,
            order: 13,
            match: (data) => {
                if (!data?.isGitCtrl) return false;
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status && status.is_git !== false && status.has_remote !== false && status.sync_status !== '☁️ Local Only';
            },
            emitEvent: (data) => ({ name: 'insetu:git:ctrl-pull', detail: { repoDir: data.repoDir } })
        },
        {
            targetEntity: 'repo',
            id: 'git-ctrl-branch',
            label: 'Switch Branch',
            icon: 'git-branch',
            intent: 'highlight',
            group: 'tools',
            vfsBound: true,
            order: 14,
            match: (data) => {
                if (!data?.isGitCtrl) return false;
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status && status.is_git !== false;
            },
            emitEvent: (data) => ({ name: 'insetu:git:ctrl-branch', detail: { repoDir: data.repoDir } })
        },
        {
            targetEntity: 'repo',
            id: 'git-state-continue',
            label: 'Continue',
            icon: 'play',
            intent: 'success',
            group: 'tools',
            vfsBound: false,
            order: 6,
            match: (data) => {
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status && status.pending_operation && (!status.conflicts || status.conflicts.length === 0);
            },
            onClick: async (data, e) => {
                try {
                    const res = await window.inSetu.api.post('git/resolve_state', { repo: data.repoDir, action: 'continue' });
                    if (res.ok) {
                        const resData = await res.json();
                        window.inSetu.utils.pollJob(resData.job_id, {
                            onComplete: () => {
                                alert(`✅ Successfully continued operation in ${data.repoDir}.`);
                            },
                            onError: (err) => alert(`❌ Failed to continue:\n\n${err.message}`)
                        });
                    }
                } catch (err) {
                    alert("Network error: " + err.message);
                }
            }
        },
        {
            targetEntity: 'repo',
            id: 'git-state-abort',
            label: 'Abort',
            icon: 'octagon',
            intent: 'danger',
            group: 'tools',
            vfsBound: false,
            order: 7,
            match: (data) => {
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status && status.pending_operation;
            },
            onClick: async (data, e) => {
                const op = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir]?.pending_operation || 'operation';
                if (!confirm(`Abort the current ${op} for ${data.repoDir}? All conflict resolutions will be lost.`)) return;
                try {
                    const res = await window.inSetu.api.post('git/resolve_state', { repo: data.repoDir, action: 'abort' });
                    if (res.ok) {
                        const resData = await res.json();
                        window.inSetu.utils.pollJob(resData.job_id, {
                            onComplete: () => {
                                alert(`✅ Successfully aborted ${op} in ${data.repoDir}.`);
                            },
                            onError: (err) => alert(`❌ Failed to abort:\n\n${err.message}`)
                        });
                    }
                } catch (err) {
                    alert("Network error: " + err.message);
                }
            }
        },
        {
            targetEntity: 'repo',
            id: 'git-resolve-conflicts',
            label: 'Resolve Conflicts',
            icon: 'alert-triangle',
            intent: 'danger',
            group: 'edit',
            vfsBound: false,
            order: 5,
            match: (data) => {
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                return status && status.conflicts && status.conflicts.length > 0;
            },
            onClick: (data, e) => {
                const status = window.inSetu?.stores?.Git?.getState?.()?.reposStatus?.[data.repoDir];
                if (status && status.conflicts && status.conflicts.length > 0) {
                    const firstConflict = status.conflicts[0];
                    if (window.inSetu.vfs && window.inSetu.vfs.viewSourceFile) {
                        window.inSetu.vfs.viewSourceFile(`vfs://${data.repoDir}/${firstConflict}`, true);
                    }
                }
            }
        }
    ],
    repoConfigOptions: [
        {
            id: 'git-repo-exclude',
            order: 20,
            component: ({ repo, updateCallback }) => html`
                <sutram-toggle 
                    label="Exclude from Git Diffs" 
                    .checked=${!!repo.exclude_from_diffs} 
                    ?flush=${true}
                    @sutram-input-changed=${(e) => { 
                        repo.exclude_from_diffs = e.detail.value; 
                        updateCallback(); 
                    }}>
                </sutram-toggle>
            `
        }
    ],
    bucketConfigOptions: [
        {
            id: 'git-exclude',
            order: 20,
            component: ({ bucket, updateCallback }) => html`
                <sutram-toggle 
                    label="Exclude from Git Diffs" 
                    .checked=${!!bucket.exclude_from_diffs} 
                    ?flush=${true}
                    @sutram-input-changed=${(e) => { 
                        bucket.exclude_from_diffs = e.detail.value; 
                        updateCallback(); 
                    }}>
                </sutram-toggle>
            `
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
            icon: "git-branch",
            intent: "primary",
            order: 2,
            component: "insetu-ext-git-ctrl"
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "context",
            id: "diffs",
            label: "Diffs",
            icon: "git-pull-request",
            intent: "warning",
            order: 2,
            bulkActionGroup: "vcs",
            bulkEntityTypes: ["diff"],
            menuActions: [
                {
                    label: "Recompile Diffs",
                    icon: "refresh-cw",
                    onClick: () => generateDiffs(true)
                },
                {
                    label: "Rescan Sweepable State",
                    icon: "search",
                    emitEvent: "insetu:git:diffs-refreshed"
                }
            ],
            component: "insetu-ext-git-diffs"
        }
    ]
});
