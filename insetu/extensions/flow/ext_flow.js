import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {}, utils: {} };
const AppStore = window.inSetu.stores.App;
export function canonicalizeFlowUri(uri) {
    return window.inSetu.utils.InSetuURI.canonicalize(uri);
}
export function resolveFlowPromptUri(rawPrompt) {
    if (!rawPrompt) return '';
    const opts = FlowStore.getState().availableOptions || {};
    const prompts = opts.prompts || [];
    if (prompts.includes(rawPrompt)) return rawPrompt;
    const base = new window.inSetu.utils.InSetuURI(rawPrompt).basename;
    return prompts.find(p => p.endsWith(rawPrompt) || p.endsWith('/' + base)) || canonicalizeFlowUri(rawPrompt.includes('://') ? rawPrompt : `ctx://prompts/${rawPrompt}`);
}
export function classifyFlowTargetUri(rawInc) {
    if (!rawInc || typeof rawInc !== 'string') {
        return { healedUri: '', isUndefined: true, isCleanDiff: false, isSystem: false, candidate: null };
    }
    const appState = AppStore.getState ? AppStore.getState() : {};
    const manifestCtx = appState.manifest?.ctx || {};
    const vfsFiles = appState.derivedVfsFiles || [];
    const allRepos = appState.allRepos || [];
    const flowState = FlowStore.getState ? FlowStore.getState() : {};
    const opts = flowState.availableOptions || {};
    const availContexts = opts.contexts || [];
    const availDiffs = opts.diffs || [];
    const availPrompts = opts.prompts || [];
    const batches = flowState.batches || [];
    const availWorkflows = batches.map(b => `ctx://workflows/workflow_${b.id}_context.txt`);
    const allDefinedSystemUris = [...availDiffs, ...availContexts, ...availPrompts, ...availWorkflows];
    const uriObj = new window.inSetu.utils.InSetuURI(rawInc);
    const inc = uriObj.isDir ? `${uriObj.toString()}/` : uriObj.toString();
    const isSystem = uriObj.scheme === 'ctx' || uriObj.scheme === 'ws';
    const isDiff = inc.startsWith('ctx://diffs/') || inc.endsWith('_diffs.txt');
    const isWorkflow = inc.startsWith('ctx://workflows/') || (uriObj.basename.startsWith('workflow_') && uriObj.basename.endsWith('_context.txt'));
    const isPrompt = inc.startsWith('ctx://prompts/') || uriObj.volume === 'prompts';
    const isGatherContext = isSystem && !isDiff && !isWorkflow && !isPrompt;

    const hasTopologyLoaded = availContexts.length > 0 || availDiffs.length > 0 || allRepos.length > 0;
    let isUndefined = false;

    if (hasTopologyLoaded) {
        if (isDiff) {
            isUndefined = !availDiffs.includes(inc);
        } else if (isGatherContext) {
            isUndefined = !availContexts.includes(inc) && !manifestCtx[inc];
        } else if (isWorkflow) {
            isUndefined = batches.length > 0 && !availWorkflows.includes(inc);
        } else if (isPrompt) {
            isUndefined = availPrompts.length > 0 && !availPrompts.includes(inc);
        } else if (uriObj.scheme === 'vfs') {
            if (uriObj.repo && allRepos.length > 0 && !allRepos.includes(uriObj.repo)) {
                isUndefined = true;
            }
        }
    }

    const isCleanDiff = isDiff && !isUndefined && !manifestCtx[inc];
    let candidate = null;
    if (isUndefined) {
        const base = uriObj.basename;
        candidate = allDefinedSystemUris.find(f => f === `ctx://contexts/${base}` || f === `ctx://diffs/${base}` || f.endsWith('/' + base) || f.endsWith('_' + base)) || null;
    }

    return { healedUri: inc, isUndefined, isCleanDiff, isSystem, isDiff, candidate };
}

export const FlowStore = createExtensionStore('Flow', {
    batches: [],
    availableOptions: { contexts: [], diffs: [], prompts: [], artifactsDir: '.insetu/data', profileDir: '.insetu' },
    loading: false,
    searchQuery: '',
    editingBatch: null,
    editForm: {},
    viewingBatch: null,
    viewingBatchPromptText: '',
    responseContent: '',
    showSelectContexts: false,
    tempContexts: [],
    selectingFor: 'includes',
    contextSearchQuery: '',
    fetchBatches: async () => {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('flow')) return;
        if ((FlowStore.getState().batches || []).length === 0) {
            FlowStore.setState({ loading: true });
        }
        try {
            const res = await window.inSetu.api.get('flow/batches');
            if (res.ok) {
                const data = await res.json();
                const nextOptions = {
                    contexts: data.available_contexts || [],
                    diffs: data.available_diffs || [],
                    prompts: data.available_prompts || [],
                    artifactsDir: data.artifacts_dir || '.insetu/data',
                    profileDir: data.profile_dir || '.insetu'
                };
                FlowStore.setState({
                    batches: data.batches || [],
                    availableOptions: nextOptions
                });
            }
        } catch (e) {
            console.error("Error loading batches:", e);
        } finally {
            FlowStore.setState({ loading: false });
        }
    },
    duplicateBatch: async (sourceBatch) => {
        if (!sourceBatch) return;
        const rawTitle = String(sourceBatch.title || sourceBatch.id || 'Workflow').replace(/^\[🌐[^\]]+\]\s*/, '');
        const newTitleInput = prompt("Enter a title for the copied workflow batch:", `${rawTitle} (Copy)`);
        if (!newTitleInput || !newTitleInput.trim()) return;
        const title = newTitleInput.trim();

        const currentBatches = FlowStore.getState().batches || [];
        const baseId = window.inSetu.utils.slugify(title) || `batch_${Date.now()}`;
        const isTaken = (id) => currentBatches.some(b => b.id === id);
        const newId = !isTaken(baseId)
            ? baseId
            : (Array.from({ length: 100 }).map((_, i) => `${baseId}_${i + 1}`).find(id => !isTaken(id)) || `${baseId}_${Date.now()}`);
        const payload = {
            id: newId,
            title,
            domain: (sourceBatch.domain || 'Workflows').trim() || 'Workflows',
            includes: Array.isArray(sourceBatch.includes) ? [...sourceBatch.includes] : []
        };
        if (Array.isArray(sourceBatch.show_if_exists) && sourceBatch.show_if_exists.length > 0) {
            payload.show_if_exists = [...sourceBatch.show_if_exists];
        }
        if (Array.isArray(sourceBatch.show_if_missing) && sourceBatch.show_if_missing.length > 0) {
            payload.show_if_missing = [...sourceBatch.show_if_missing];
        }
        if (sourceBatch.include_prompt) payload.include_prompt = sourceBatch.include_prompt;
        if (sourceBatch.response_path) payload.response_path = sourceBatch.response_path;
        if (sourceBatch.archive_path) payload.archive_path = sourceBatch.archive_path;

        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.closeWindow('flow:view');
            layout.closeWindow('flow:edit');
        }

        try {
            const res = await window.inSetu.api.post('flow/batches/save', payload, { collapseKey: `flow:batch:save:${newId}` });
            if (res.ok) {
                const responseData = await res.json();
                if (Array.isArray(responseData.batches)) {
                    FlowStore.setState({ batches: responseData.batches });
                } else {
                    FlowStore.setState({ batches: [...currentBatches, payload] });
                }
                if (window.inSetu.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus(`✅ Created batch "${title}"`, 2500);
                }
                if (responseData.job_id && window.inSetu.utils?.pollJob) {
                    window.inSetu.utils.pollJob(responseData.job_id, {
                        onComplete: async () => {
                            if (window.inSetu.sys?.refreshManifest) await window.inSetu.sys.refreshManifest();
                            await FlowStore.getState().fetchBatches();
                        }
                    });
                } else if (window.inSetu.sys?.refreshManifest) {
                    await window.inSetu.sys.refreshManifest();
                }
            } else {
                const err = await res.json().catch(() => ({}));
                alert("Failed to copy batch: " + (err.error || res.statusText));
            }
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
}, {
    onEvict: {
        'flow:view': { viewingBatch: null, viewingBatchPromptText: '', responseContent: '' },
        'flow:edit': { editingBatch: null, editForm: {}, showSelectContexts: false }
    }
});
window.inSetu.stores.Flow = FlowStore;
export class InSetuExtFlow extends InSetuElement {
    static get extensionName() { return 'flow'; }
    static properties = {
        batches: { type: Array },
        loading: { type: Boolean },
        activeModules: { type: Array },
        pendingModules: { type: Array },
        isPipelineActive: { type: Boolean },
        searchQuery: { type: String },
        _showFilters: { type: Boolean },
        _applyVisibilityFilter: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; background: var(--bg); box-sizing: border-box; container-type: inline-size; }
    `];
    constructor() {
        super();
        this.batches = [];
        this.loading = false;
        this.searchQuery = '';
        this._applyVisibilityFilter = true;
    }
    onViewActivated() {
        FlowStore.getState().fetchBatches();
    }
    async onForceRefresh() {
        if (this.compileSystem) {
            await this.compileSystem(null, true, 'flow_workflows');
        }
        await FlowStore.getState().fetchBatches();
    }
    getBatchRepos(batch) {
        if (!batch || !batch.includes) return [];
        const manifestCtx = AppStore.getState()?.manifest?.ctx || {};
        const repos = new Set();
        batch.includes.forEach(uri => {
            if (uri.startsWith('ctx://')) {
                const meta = manifestCtx[uri]?.meta || {};
                const itemRepos = meta.repos || (meta.repo ? [meta.repo] : []);
                itemRepos.forEach(r => repos.add(r));
            } else {
                const parsedRepo = new this.utils.InSetuURI(uri).repo;
                if (parsedRepo) repos.add(parsedRepo);
            }
        });
        return Array.from(repos);
    }
    connectedCallback() {
        super.connectedCallback();
        this._debouncedManifestRefresh = this._debouncedManifestRefresh || this.utils.debounce(() => {
            if (window.inSetu.sys && window.inSetu.sys.refreshManifest) window.inSetu.sys.refreshManifest();
        }, 1000);
        this._debouncedFetchBatches = this._debouncedFetchBatches || this.utils.debounce(() => {
            FlowStore.getState().fetchBatches();
        }, 500);
        this.bindStore(
            FlowStore,
            state => ({
                batches: state.batches || [],
                loading: state.loading || false,
                searchQuery: state.searchQuery || ''
            }),
            { autoFetch: 'fetchBatches' }
        );
        this.registerGlobalListener('insetu:flow:edit-batch', window, (e) => this.openEditBatchModal(e.detail));
        this.registerGlobalListener('insetu:flow:copy-batch', window, (e) => FlowStore.getState().duplicateBatch(e.detail));
        this.registerGlobalListener('insetu:flow:refresh-prompt', window, () => {
            const vb = FlowStore.getState().viewingBatch;
            if (vb) this._refreshBatchPromptText(vb);
        });
        this.registerGlobalListener('insetu:git:diffs-refreshed', window, () => {
            this._debouncedManifestRefresh();
        });
        this.subscribe(
            AppStore,
            state => ({
                activeModules: state.activeModules || [],
                pendingModules: state.pendingModules || [],
                isPipelineActive: state.isPipelineActive || false,
                manifestCtx: state.manifest?.ctx,
                dirtyBuckets: state.dirtyBuckets
            }),
            (slice) => {
                this.activeModules = slice.activeModules;
                this.pendingModules = slice.pendingModules;
                this.isPipelineActive = slice.isPipelineActive;
                this.requestUpdate();
            }
        );
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            const payload = e.detail;
            if (!payload || !payload.mutations) return;
            const vb = FlowStore.getState().viewingBatch;
            if (!vb || !vb.include_prompt) return;
            const promptBase = new this.utils.InSetuURI(vb.include_prompt).basename;
            const promptTouched = payload.mutations.some(m => m.filepath && (m.filepath.includes('prompts') || m.filepath.includes('.templates') || (promptBase && m.filepath.endsWith(promptBase))));
            if (promptTouched) {
                this._refreshBatchPromptText(vb);
            }
        });
        this.registerGlobalListener('insetu:ensure-fresh-artifact', window, (e) => {
            const filePath = e.detail?.filepath || '';
            if (!filePath.startsWith('ctx://workflows/')) return;
            if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('flow')) return;
            const baseUri = filePath.replace(/_part\d+\.txt$/, '.txt');
            const appState = AppStore.getState();
            const dirtyRepos = appState.dirtyRepos || new Set();
            const dirtyBuckets = appState.dirtyBuckets || new Set();
            const manifestObj = appState.manifest?.ctx?.[baseUri] || appState.manifest?.ctx?.[filePath];
            const meta = manifestObj?.meta || {};
            const itemRepos = Array.isArray(meta.repos) ? meta.repos : (meta.repo ? [meta.repo] : []);
            const isMissing = !manifestObj;
            const hasUpstreamDirty = itemRepos.some(r => dirtyRepos.has(r) || Array.from(dirtyBuckets).some(b => b.startsWith(`${r}::`)));
            const isDirty = isMissing || hasUpstreamDirty || dirtyBuckets.has('global::workflows') || dirtyBuckets.has(baseUri);
            if (isDirty && window.inSetu.stores?.Gather && Array.isArray(e.inSetuResponses)) {
                e.inSetuResponses.push((async () => {
                    if (window.inSetu.ui?.setGlobalStatus) {
                        window.inSetu.ui.setGlobalStatus("⏳ Compiling fresh workflow...", null);
                    }
                    const targetRepos = (!isMissing && itemRepos.length > 0) ? itemRepos : null;
                    await window.inSetu.stores.Gather.getState().executeCompile(null, isMissing, null, targetRepos);
                })());
            }
        });
        this.registerGlobalListener('sutram-sync-complete', window, () => {
            FlowStore.getState().fetchBatches();
        });
        this.registerGlobalListener('insetu:compile-step-complete', window, (e) => {
            if (e.detail?.ext_name === 'flow') {
                this._debouncedManifestRefresh();
                this._debouncedFetchBatches();
            }
        });
    }
    disconnectedCallback() {
        super.disconnectedCallback();
    }
    openEditBatchModal(batch = null) {
        const savedPrompt = batch && batch.include_prompt ? batch.include_prompt : '';
        const matchedPrompt = savedPrompt ? resolveFlowPromptUri(savedPrompt) : '';

        const editForm = {
            id: batch ? batch.id : '',
            title: batch ? batch.title : '',
            domain: batch && batch.domain ? batch.domain : 'Workflows',
            includes: batch && batch.includes ? [...batch.includes] : [],
            showIfExists: batch && batch.show_if_exists ? [...batch.show_if_exists] : [],
            showIfMissing: batch && batch.show_if_missing ? [...batch.show_if_missing] : [],
            hasPrompt: batch ? !!batch.include_prompt : false,
            prompt: matchedPrompt,
            hasResponse: batch ? !!batch.response_path : false,
            responsePath: batch && batch.response_path ? batch.response_path : '',
            archivePath: batch && batch.archive_path ? batch.archive_path : ''
        };
        FlowStore.setState({ editingBatch: batch, editForm });
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.openWindow({
                id: 'flow:edit',
                component: 'insetu-flow-edit-projection',
                label: editForm.id ? `Edit Batch: ${editForm.title}` : 'Create New Batch',
                icon: 'edit-3',
                intent: 'primary',
                extName: 'flow',
                windowOnly: true
            }, layout.focusedColumn || 'center', 1);
        }
    }
    _refreshBatchPromptText(batch) {
        if (!batch || !batch.include_prompt) return;
        const promptPath = resolveFlowPromptUri(batch.include_prompt);
        this.api.get(`prompts/resolve?file=${encodeURIComponent(promptPath)}`)
            .then(res => res.ok ? res.text() : Promise.reject(new Error("Prompt resolution failed")))
            .then(text => { FlowStore.setState({ viewingBatchPromptText: text }); })
            .catch(err => { FlowStore.setState({ viewingBatchPromptText: `[Error: ${err.message}]` }); });
    }
    openBatchModal(batch) {
        const existingVb = FlowStore.getState().viewingBatch;
        const preserveResponse = existingVb && existingVb.id === batch.id ? FlowStore.getState().responseContent : '';
        FlowStore.setState({
            viewingBatch: batch,
            viewingBatchPromptText: batch.include_prompt ? 'Loading prompt...' : '',
            responseContent: preserveResponse
        });
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.openWindow({
                id: 'flow:view',
                component: 'insetu-flow-view-projection',
                label: `Batch Workflow: ${batch.title || batch.id}`,
                icon: 'workflow',
                intent: 'primary',
                extName: 'flow',
                windowOnly: true
            }, layout.focusedColumn || 'center', 1);
        }
        if (batch.include_prompt) {
            this._refreshBatchPromptText(batch);
        }
        if (batch.id && window.inSetu?.vfs?.ensureFreshContext) {
            const baseFile = `ctx://workflows/workflow_${batch.id}_context.txt`;
            (async () => {
                try {
                    await window.inSetu.vfs.ensureFreshContext(baseFile);
                    const chunks = window.inSetu.vfs.getChunks ? window.inSetu.vfs.getChunks(baseFile) : [baseFile];
                    const targets = (chunks && chunks.length > 0) ? chunks : [baseFile];
                    const activeWs = window.inSetu.utils.getActiveWorkspace();
                    for (const fp of targets) {
                        if (!window.inSetu.vfs.shareTextCache.has(fp)) {
                            const fetchUrl = window.inSetu.vfs.resolveFileFetchUrl(fp, false);
                            const text = await window.inSetu.api.fetchImmutableText(fetchUrl, { onlyIfMissing: true }, activeWs);
                            window.inSetu.vfs.shareTextCache.set(fp, text);
                        }
                    }
                } catch (_) {}
            })();
        }
    }
    render() {
        const isPipelineRunning = (this.activeModules || []).includes('flow') || (this.pendingModules || []).includes('flow');
        const isFlowLoading = this.loading || isPipelineRunning;

        const appStore = window.inSetu?.stores?.App || (typeof AppStore !== 'undefined' ? AppStore : null);
            const appState = appStore?.getState ? appStore.getState() : {};
            const categoryOrder = appState?.categoryOrder || [];
            const manifest = appState?.manifest?.ctx || {};
            const gatherOptions = FlowStore.getState().availableOptions || {};
            const repoFilteredBatches = this.batches.map(b => {
                const actualFilename = `ctx://workflows/workflow_${b.id}_context.txt`;
                const manifestObj = manifest[actualFilename] || {};
                const repos = (manifestObj.meta?.repos && manifestObj.meta.repos.length > 0)
                    ? manifestObj.meta.repos
                    : this.getBatchRepos(b);
                return { ...b, _repos: repos, _filename: actualFilename };
            }).filter(b => {
                if (this._applyVisibilityFilter) {
                    // Literal existence check: Must be physically present in the active manifest or prompt list
                    const checkLiteralExists = (f) => {
                        if (manifest[f]) return true;
                        return (gatherOptions?.prompts || []).includes(f) || (gatherOptions?.prompts || []).some(p => p.endsWith(f));
                    };
                    const existsArr = Array.isArray(b.show_if_exists) ? b.show_if_exists : (b.show_if_exists ? [b.show_if_exists] : []);
                    if (existsArr.length > 0) {
                        if (!existsArr.some(checkLiteralExists)) return false;
                    }
                    const missingArr = Array.isArray(b.show_if_missing) ? b.show_if_missing : (b.show_if_missing ? [b.show_if_missing] : []);
                    if (missingArr.length > 0) {
                        if (!missingArr.every(f => !checkLiteralExists(f))) return false;
                    }
                }
                const activePins = Array.from(this.ecosystem?.pinnedRepos || ['ALL']);
                if (activePins.includes('ALL')) return true;
                return activePins.some(pr => 
                    (b._repos && b._repos.includes(pr)) || 
                    b.id.includes(pr) || 
                    (b.title && b.title.toLowerCase().includes(pr.toLowerCase()))
                );
            });
            const filteredBatches = this.filterItems(repoFilteredBatches, {
                pinnedRepos: new Set(['ALL']),
                searchQuery: this.searchQuery,
                searchFields: b => `${(b._repos || []).join(' ')} ${b.title} ${b.id} ${b.domain}`
            });
            const activeRepoPinsArr = Array.from(this.ecosystem?.pinnedRepos || ['ALL']);
            try {
                return html`
                    <sutram-toolbar
                        searchPlaceholder="Fuzzy search workflows..."
                    .searchQuery=${this.searchQuery}
                    @search-changed=${(e) => FlowStore.setState({ searchQuery: e.detail.value })}
                    .enableFilterDropdown=${true}
                    .activeFilters=${[...activeRepoPinsArr, ...(this._applyVisibilityFilter ? ['Visibility: ON'] : [])]}>
                    <div slot="filters" style="display: flex; flex-direction: column;">
                        <insetu-repo-filter
                            label="📌 Repos:"
                            .repos=${this.ecosystem?.allRepos || []}
                            .activeRepos=${activeRepoPinsArr}
                            @repo-filter-changed=${(e) => AppStore.getState().setPinnedRepos(new Set(e.detail.activeRepos))}>
                        </insetu-repo-filter>
                        <div style="padding: 10px 15px; display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--border);">
                            <sutram-toggle
                                label="Apply Visibility Requirements"
                                ?flush=${true}
                                .checked=${this._applyVisibilityFilter}
                                @sutram-input-changed=${(e) => { this._applyVisibilityFilter = e.detail.value; this.requestUpdate(); }}>
                            </sutram-toggle>
                        </div>
                    </div>
                </sutram-toolbar>
            <sutram-scroll-view>
                        ${this.batches.length === 0 ? html`<div style="padding: 20px 0;"><sutram-empty-state text="No workflow batches defined."></sutram-empty-state></div>` : ''}
                        ${this.batches.length > 0 && filteredBatches.length === 0 ? html`<div style="padding: 20px 0;"><sutram-empty-state text="All workflows hidden by current filters."></sutram-empty-state></div>` : ''}
                        ${(() => {
                            const groups = {};
                            filteredBatches.forEach(b => {
                                const cat = b.domain || 'Workflows';
                                if (!groups[cat]) groups[cat] = [];
                                groups[cat].push(b);
                            });
                            const sortedCats = Object.keys(groups).sort((a, b) => {
                                const idxA = categoryOrder.indexOf(a);
                                const idxB = categoryOrder.indexOf(b);
                                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                                if (idxA !== -1) return -1;
                                if (idxB !== -1) return 1;
                                return a.localeCompare(b);
                            });
                            return sortedCats.map(cat => html`
                                <sutram-collapsible 
                                    titleText=${cat} 
                                    intent="neutral" 
                                    ?open=${true}>
                                    <div style="display: flex; flex-direction: column; gap: 8px;">
                                        ${groups[cat].map(b => {
                                            const filename = b._filename;
                                            const manifestCtx = AppStore.getState().manifest?.ctx || {};
                                            const manifestObj = manifestCtx[filename];
                                            const isCompiledInManifest = Boolean(manifestObj && manifestObj.meta);
                                            const meta = manifestObj?.meta || {};
                                            const sizeStr = this.utils.formatArtifactSize(meta);
                                            const repoStr = b._repos && b._repos.length > 0 ? `[${b._repos.join(', ')}] ` : '';
                                            const isDirty = (() => {
                                                if (!isCompiledInManifest) return true;
                                                const dirtySet = AppStore.getState().dirtyBuckets || new Set();
                                                if (dirtySet.has(filename)) return true;
                                                const addr = window.inSetu.utils.BucketAddress.fromFilepath(filename, meta);
                                                if (dirtySet.has(String(addr.key).toLowerCase()) || dirtySet.has(addr.key)) return true;
                                                return (b.includes || []).some(inc => {
                                                    if (dirtySet.has(inc)) return true;
                                                    const uri = new window.inSetu.utils.InSetuURI(inc);
                                                    const incAddr = (uri.scheme === 'vfs')  
                                                        ? window.inSetu.utils.BucketAddress.fromVfsPath(inc) 
                                                        : window.inSetu.utils.BucketAddress.fromFilepath(inc, manifestCtx[inc]?.meta);
                                                    const normIncKey = String(incAddr.key).toLowerCase();
                                                    return dirtySet.has(normIncKey) || dirtySet.has(incAddr.key);
                                                });
                                            })();
                                            const isLocked = isFlowLoading && isDirty;
                                            const statusIcon = isLocked ? 'loader' : (isDirty ? 'construction' : 'package');
                                            return html`
                                                <sutram-card
                                                        style="opacity: ${isLocked ? '0.6' : '1'}; pointer-events: ${isLocked ? 'none' : 'auto'}; transition: opacity 0.2s ease;"
                                                        .filename=${b.id}
                                                        .titleText=${b.title || b.id}
                                                        .descriptionText=${`${(b.includes || []).length} files mapped. ${b.include_prompt ? 'Includes Prompt.' : ''} ${b.response_path ? 'Expects Response.' : ''}`}
                                                        .detailPrefix=${repoStr}
                                                        .detailText=${filename}
                                                        .detailSuffix=${sizeStr ? ` | ${sizeStr}` : ''}
                                                        icon=${statusIcon}
                                                        intent=${isDirty ? "warning" : "primary"}
                                                        .entityType=${'file:workflow_batch'}
                                                        .entityData=${{  
                                                            ...b, 
                                                            filepath: filename,
                                                            outdated: isDirty,
                                                            suppress: ['file-edit']
                                                        }}
                                                        @card-clicked=${() => this.openBatchModal(b)}>
                                                </sutram-card>
                                            `;
                                        })}
                                    </div>
                                </sutram-collapsible>
                            `);
                        })()}
            </sutram-scroll-view>
        `;
    } catch (err) {
            console.error("Flow UI Render Crash:", err);
            return html`
                <div style="padding: 20px; color: var(--intent-danger); background: var(--input-bg); border: 1px solid var(--intent-danger); border-radius: 6px; margin: 20px;">
                    <h3 style="margin-top: 0;">💥 UI Render Crash</h3>
                    <p>The Flow interface encountered a fatal data corruption error and could not render.</p>
                    <pre style="background: var(--bg); padding: 10px; border-radius: 4px; overflow-x: auto;">${err.stack || err.message}</pre>
                </div>
            `;
        }
    }
}
customElements.define('insetu-ext-flow', InSetuExtFlow);
export class InSetuFlowViewProjection extends InSetuElement {
    static get extensionName() { return 'flow'; }
    static properties = {
        viewingBatch: { type: Object },
        viewingBatchPromptText: { type: String },
        responseContent: { type: String }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            box-sizing: border-box;
        }
        .flow-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
        }
        .flow-section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .flow-section-title {
            margin: 0;
            font-size: 0.9rem;
            font-weight: 700;
            color: var(--text);
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .flow-include-list {
            display: flex;
            flex-direction: column;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            max-height: 220px;
            overflow-y: auto;
            padding: 4px 12px;
        }
        .flow-include-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 6px 0;
            border-bottom: 1px solid var(--border);
            font-family: var(--font-mono);
            font-size: 0.82rem;
            word-break: break-all;
        }
        .flow-include-item:last-child {
            border-bottom: none;
        }
    `];
    constructor() {
        super();
        const st = FlowStore.getState();
        this.viewingBatch = st.viewingBatch || null;
        this.viewingBatchPromptText = st.viewingBatchPromptText || '';
        this.responseContent = st.responseContent || '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FlowStore,
            state => ({
                viewingBatch: state.viewingBatch,
                viewingBatchPromptText: state.viewingBatchPromptText || '',
                responseContent: state.responseContent || ''
            }),
            ({ viewingBatch, viewingBatchPromptText, responseContent }) => {
                this.viewingBatch = viewingBatch;
                this.viewingBatchPromptText = viewingBatchPromptText;
                this.responseContent = responseContent;
                this.requestUpdate();
            }
        );
    }
    async saveBatchResponse() {
        const content = this.responseContent || '';
        if (!content.trim()) return alert('Please paste a response.');

        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, -1);
        const dStr = localISOTime.replace(/-/g, '').replace(/:/g, '').replace('T', '_').split('.')[0];
        const finalPath = this.viewingBatch.response_path.replace('{date}', dStr);
        const normPath = this.vfs?.normalizeVfsURI ? this.vfs.normalizeVfsURI(finalPath) : `vfs://${finalPath.replace(/^\/+/, '')}`;

        const payload = {
            filepath: normPath,
            content: content,
            original_response_path: this.viewingBatch.response_path
        };
        if (this.viewingBatch.archive_path) {
            payload.archive_path = this.vfs?.normalizeVfsURI
                ? this.vfs.normalizeVfsURI(this.viewingBatch.archive_path)
                : `vfs://${this.viewingBatch.archive_path.replace(/^\/+/, '')}`;
        }

        try {
            await this.sys.executeWorkspaceMutation('fs/save', payload);
            if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("✅ Success!", 2000);
            if (window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow('flow:view');
            }
        } catch (e) {
            console.error("Batch save failed", e);
        }
    }
    render() {
        if (!this.viewingBatch) return html``;
        const includesList = this.viewingBatch.includes || [];
        return html`
            <div style="padding: 10px 16px; background: var(--input-bg); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <sutram-tag text=${this.viewingBatch.domain || 'Workflows'} intent="primary"></sutram-tag>
                    <span style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ctx://workflows/workflow_${this.viewingBatch.id}_context.txt
                    </span>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                    <sutram-btn size="sm" intent="neutral" icon="copy" label="Copy Batch" style="margin: 0;" @click=${() => FlowStore.getState().duplicateBatch(this.viewingBatch)}></sutram-btn>${!this.viewingBatch.is_shared ? html`
                        <sutram-btn size="sm" intent="primary" icon="edit-3" label="Edit Batch" style="margin: 0;" @click=${() => {
                            const b = this.viewingBatch;
                            if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('flow:view');
                            this.dispatch('insetu:flow:edit-batch', b);
                        }}></sutram-btn>
                    ` : ''}
                </div>
            </div>

            <sutram-scroll-view padding="16px">
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="flow-section">
                        <div class="flow-section-header">
                            <h4 class="flow-section-title">
                                <yv-icon name="package" style="width: 15px; height: 15px; color: var(--intent-primary);"></yv-icon>
                                <span>1. Compiled Context Payload</span>
                            </h4>
                            <sutram-tag text="${includesList.length}${includesList.length === 1 ? 'source' : 'sources'}" intent="neutral"></sutram-tag>
                        </div>

                        <div class="flow-include-list">
                            ${includesList.length > 0 ? includesList.map(inc => {
                                const { healedUri, isUndefined, isCleanDiff, isSystem } = classifyFlowTargetUri(inc);
                                const iconName = healedUri.includes('diffs/') ? "git-pull-request" : (healedUri.includes('contexts/') || healedUri.includes('workflows/') ? "package" : (healedUri.endsWith('/') || (!isSystem && !healedUri.includes('.')) ? "folder" : "file-text"));
                                return html`
                                    <div class="flow-include-item">
                                        <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                                            <yv-icon name="${iconName}" style="width: 13px; height: 13px; color: var(--text-muted); flex-shrink: 0;"></yv-icon>
                                            <span style="color: ${isUndefined ? 'var(--intent-danger)' : (isCleanDiff ? 'var(--text-muted)' : (isSystem ? 'var(--intent-primary)' : 'var(--text)'))}; text-decoration: ${isUndefined ? 'line-through' : 'none'}; opacity: ${isUndefined ? '0.75' : '1'};">${healedUri}</span>
                                        </div>
                                        ${isUndefined ? html`<span style="font-size: 0.7rem; color: var(--intent-danger); border: 1px solid var(--intent-danger); padding: 1px 6px; border-radius: 999px; font-weight: bold; flex-shrink: 0;">Undefined</span>` : ''}
                                        ${isCleanDiff ? html`<span style="font-size: 0.7rem; color: var(--text-muted); border: 1px solid var(--border); padding: 1px 6px; border-radius: 999px; font-style: italic; flex-shrink: 0;">Clean (no diffs)</span>` : ''}
                                    </div>
                                `;
                            }) : html`<div style="padding: 12px 0; color: var(--intent-danger); font-size: 0.85rem; text-align: center;">No files mapped to this batch.</div>`}
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; width: 100%; padding-top: 2px;">
                            ${(() => {
                                const baseFile = `ctx://workflows/workflow_${this.viewingBatch.id}_context.txt`;
                                return html`
                                    <sutram-entity-actions 
                                        ?scrollable=${true}
                                        .entityType=${'file'} 
                                        .entityData=${{ 
                                            filepath: baseFile, 
                                            isFS: false,
                                            showOnly: ['file-copy', 'file-download', 'file-share', 'file-view-parts']
                                        }}>
                                    </sutram-entity-actions>
                                `;
                            })()}
                        </div>
                    </div>

                    ${this.viewingBatch.include_prompt ? html`
                        <div class="flow-section">
                            <div class="flow-section-header">
                                <h4 class="flow-section-title">
                                    <yv-icon name="terminal" style="width: 15px; height: 15px; color: var(--intent-highlight);"></yv-icon>
                                    <span>2. Instruction Prompt</span>
                                </h4>
                                <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted);">${resolveFlowPromptUri(this.viewingBatch.include_prompt)}</span>
                            </div>
                            <sutram-textarea readonly ?flush=${true} .monospace=${true} style="width: 100%; min-height: 140px; --bg-input: var(--bg);" .value=${this.viewingBatchPromptText}></sutram-textarea>
                            <div style="display: flex; gap: 8px; padding-top: 2px;">
                                ${(() => {
                                    const promptPath = resolveFlowPromptUri(this.viewingBatch.include_prompt);
                                    const resolvedText = (this.viewingBatchPromptText && this.viewingBatchPromptText !== 'Loading prompt...') ? this.viewingBatchPromptText : undefined;
                                    return html`
                                        <sutram-entity-actions 
                                            ?scrollable=${true}
                                            .entityType=${'file:prompt'} 
                                            .entityData=${{ 
                                                filepath: promptPath, 
                                                isFS: !promptPath.includes('/.templates/') || promptPath.includes('/.templates/user/'),
                                                supportsMacroPreview: true,
                                                showOnly: ['file-copy', 'file-copy-expanded', 'file-edit']
                                            }}>
                                        </sutram-entity-actions>
                                    `;
                                })()}
                            </div>
                        </div>
                    ` : ''}

                    ${this.viewingBatch.response_path ? html`
                        <div class="flow-section">
                            <div class="flow-section-header">
                                <h4 class="flow-section-title">
                                    <yv-icon name="file-check-2" style="width: 15px; height: 15px; color: var(--intent-success);"></yv-icon>
                                    <span>3. LLM Response Integration</span>
                                </h4>
                            </div>
                            <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; background: var(--bg); padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border);">
                                <div>Save Target: <code style="word-break: break-all; color: var(--intent-success); font-family: var(--font-mono);">${this.viewingBatch.response_path}</code></div>
                                ${this.viewingBatch.archive_path ? html`
                                    <div>Archive Prior To: <code style="word-break: break-all; color: var(--intent-highlight); font-family: var(--font-mono);">${this.viewingBatch.archive_path}</code></div>
                                ` : ''}
                            </div>
                            <sutram-textarea id="batch-response-text" ?flush=${true} placeholder="Paste LLM response here..." .value=${this.responseContent || ''} .monospace=${true} .rows=${8} style="--bg-input: var(--bg);" @sutram-input-changed=${(e) => FlowStore.setState({ responseContent: e.detail.value })}></sutram-textarea>
                            <sutram-async-btn intent="success" icon="save" label="Save Response" style="width: 100%; display: block; margin: 0;" .onClick=${this.saveBatchResponse.bind(this)}></sutram-async-btn>
                        </div>
                    ` : ''}
                </div>
            </sutram-scroll-view>
        `;
    }
}
customElements.define('insetu-flow-view-projection', InSetuFlowViewProjection);

export class InSetuFlowEditProjection extends InSetuElement {
    static get extensionName() { return 'flow'; }
    static properties = {
        editingBatch: { type: Object },
        editForm: { type: Object },
        showSelectContexts: { type: Boolean },
        tempContexts: { type: Array },
        selectingFor: { type: String },
        contextSearchQuery: { type: String }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            overflow: hidden;
            background: var(--bg);
            box-sizing: border-box;
        }
        .flow-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
        }
        .flow-section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .flow-section-title {
            margin: 0;
            font-size: 0.9rem;
            font-weight: 700;
            color: var(--text);
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .flow-list-box {
            display: flex;
            flex-direction: column;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 4px 12px;
        }
    `];
    constructor() {
        super();
        const st = FlowStore.getState();
        this.editingBatch = st.editingBatch || null;
        this.editForm = st.editForm || {};
        this.showSelectContexts = !!st.showSelectContexts;
        this.tempContexts = st.tempContexts || [];
        this.selectingFor = st.selectingFor || 'includes';
        this.contextSearchQuery = st.contextSearchQuery || '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            FlowStore,
            state => ({
                editingBatch: state.editingBatch,
                editForm: state.editForm || {},
                showSelectContexts: !!state.showSelectContexts,
                tempContexts: state.tempContexts || [],
                selectingFor: state.selectingFor || 'includes',
                contextSearchQuery: state.contextSearchQuery || ''
            }),
            (slice) => {
                this.editingBatch = slice.editingBatch;
                this.editForm = slice.editForm;
                this.showSelectContexts = slice.showSelectContexts;
                this.tempContexts = slice.tempContexts;
                this.selectingFor = slice.selectingFor;
                this.contextSearchQuery = slice.contextSearchQuery;
                this.requestUpdate();
            }
        );
    }
    _updateForm(patch) {
        FlowStore.setState(s => ({ editForm: { ...(s.editForm || {}), ...patch } }));
    }
    async deleteEditBatch() {
        const targetId = this.editingBatch?.id;
        if (!targetId || !confirm("Delete this workflow batch?")) return;
        try {
            const res = await this.api.post('flow/batches/delete', { id: targetId }, { collapseKey: `flow:batch:delete:${targetId}` });
            if (res.ok) {
                const responseData = await res.json();
                if (Array.isArray(responseData.batches)) {
                    FlowStore.setState({ batches: responseData.batches });
                } else {
                    FlowStore.setState(s => ({ batches: (s.batches || []).filter(b => b.id !== targetId) }));
                }
                if (window.Sutram?.stores?.Layout) {
                    window.Sutram.stores.Layout.getState().closeWindow('flow:edit');
                }
                if (responseData.job_id && this.api.pollJob) {
                    this.api.pollJob(responseData.job_id, {
                        onComplete: async () => {
                            if (window.inSetu.sys?.refreshManifest) await window.inSetu.sys.refreshManifest();
                            await FlowStore.getState().fetchBatches();
                        }
                    });
                } else if (window.inSetu.sys?.refreshManifest) {
                    await window.inSetu.sys.refreshManifest();
                }
            } else {
                const err = await res.json().catch(() => ({}));
                alert("Failed to delete batch: " + (err.error || res.statusText));
            }
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
    async saveEditBatch() {
        const originalId = (this.editingBatch?.id || '').trim();
        const title = (this.editForm.title || '').trim();
        const domain = (this.editForm.domain || '').trim() || "Workflows";

        if (!title) return alert("Title is required.");

        const currentBatches = FlowStore.getState().batches || [];
        const baseId = this.utils.slugify(title) || `batch_${Date.now()}`;
        const newId = (() => {
            const isTaken = (id) => currentBatches.some(b => b.id === id && b.id !== originalId);
            if (!isTaken(baseId)) return baseId;
            return Array.from({length: 100}).map((_, i) => `${baseId}_${i+1}`).find(id => !isTaken(id)) || `${baseId}_${Date.now()}`;
        })();

        const payload = { id: newId, title, domain, includes: [...(this.editForm.includes || [])] };
        if (originalId) payload.original_id = originalId;

        if (this.editForm.showIfExists && this.editForm.showIfExists.length > 0) payload.show_if_exists = [...this.editForm.showIfExists];
        if (this.editForm.showIfMissing && this.editForm.showIfMissing.length > 0) payload.show_if_missing = [...this.editForm.showIfMissing];
        if (this.editForm.hasPrompt && this.editForm.prompt) payload.include_prompt = this.editForm.prompt;
        if (this.editForm.hasResponse && this.editForm.responsePath) {
            payload.response_path = this.editForm.responsePath.trim();
            if (this.editForm.archivePath) payload.archive_path = this.editForm.archivePath.trim();
        }
        try {
            const res = await this.api.post('flow/batches/save', payload, { collapseKey: `flow:batch:save:${newId}` });
            if (res.ok) {
                const responseData = await res.json();
                const savedBatch = { ...payload };
                delete savedBatch.original_id;

                if (Array.isArray(responseData.batches)) {
                    FlowStore.setState({ batches: responseData.batches });
                } else {
                    const isExisting = Boolean(originalId) && currentBatches.some(b => b.id === originalId);
                    if (isExisting) {
                        FlowStore.setState({ batches: currentBatches.map(b => b.id === originalId ? savedBatch : b) });
                    } else {
                        FlowStore.setState({ batches: [...currentBatches, savedBatch] });
                    }
                }
                if (window.Sutram?.stores?.Layout) {
                    window.Sutram.stores.Layout.getState().closeWindow('flow:edit');
                }
                if (responseData.job_id && this.api.pollJob) {
                    this.api.pollJob(responseData.job_id, {
                        onComplete: async () => {
                            if (window.inSetu.sys?.refreshManifest) await window.inSetu.sys.refreshManifest();
                            await FlowStore.getState().fetchBatches();
                        }
                    });
                } else if (window.inSetu.sys?.refreshManifest) {
                    await window.inSetu.sys.refreshManifest();
                }
            } else {
                const err = await res.json().catch(() => ({}));
                alert("Failed to save batch: " + (err.error || res.statusText));
            }
        } catch (e) {
            alert("Network error: " + e.message);
        }
    }
    render() {
        const appState = AppStore.getState ? AppStore.getState() : {};
        const manifest = appState?.manifest?.ctx || {};
        const gatherOptions = FlowStore.getState().availableOptions || {};
        const allFiles = [
            ...(gatherOptions?.diffs || []), 
            ...(gatherOptions?.contexts || []),
            ...(gatherOptions?.prompts || [])
        ];
        const includes = this.editForm?.includes || [];
        const showIfExists = this.editForm?.showIfExists || [];
        const showIfMissing = this.editForm?.showIfMissing || [];
        const renderIncludeRow = (rawInc, idx, listKey, totalLen) => {
            const { healedUri: inc, isUndefined: isMissing, isCleanDiff, isSystem, candidate } = classifyFlowTargetUri(rawInc);
            const iconName = inc.includes('diffs/') ? "git-pull-request" : (inc.includes('contexts/') || inc.includes('workflows/') ? "package" : (inc.endsWith('/') || (!isSystem && !inc.includes('.')) ? "folder" : "file-text"));
            const isLast = idx === totalLen - 1;

            return html`
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: ${isLast ? 'none' : '1px solid var(--border)'}; gap: 8px;">
                    <div style="display: flex; align-items: center; flex: 1; min-width: 0; gap: 8px; flex-wrap: wrap;">
                        <yv-icon name="${iconName}" style="width: 14px; height: 14px; color: var(--text-muted); flex-shrink: 0;"></yv-icon>
                        <span style="font-family: var(--font-mono); font-size: 0.82rem; color: ${isMissing ? 'var(--intent-danger)' : (isSystem ? 'var(--intent-primary)' : 'var(--text)')}; word-break: break-all; text-decoration: ${isMissing ? 'line-through' : 'none'}; opacity: ${isMissing ? '0.8' : '1'}; font-weight: ${isSystem ? 'bold' : 'normal'};">${inc}</span>${isMissing ? html`<span style="font-size: 0.7rem; background: transparent; color: var(--intent-danger); border: 1px solid var(--intent-danger); padding: 1px 6px; border-radius: 999px; font-weight: bold; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;"><yv-icon name="alert-triangle" style="width: 10px; height: 10px;"></yv-icon> Undefined</span>` : ''}${isCleanDiff ? html`<span style="font-size: 0.7rem; color: var(--text-muted); border: 1px solid var(--border); padding: 1px 6px; border-radius: 999px; white-space: nowrap; font-style: italic;">Clean</span>` : ''}
                        ${candidate ? html`
                            <sutram-btn size="sm" intent="success" icon="sparkles" label="Fix → ${candidate}" style="margin: 0; padding: 2px 8px; font-size: 0.75rem;" @click=${() => {
                                const nextList = [...(this.editForm[listKey] || [])];
                                nextList[idx] = candidate;
                                this._updateForm({ [listKey]: nextList });
                            }}></sutram-btn>
                        ` : ''}
                    </div>
                    <sutram-btn size="sm" variant="text" intent="danger" label="×" style="margin: 0; padding: 0 6px; flex-shrink: 0;" @click=${() => {
                        const nextList = [...(this.editForm[listKey] || [])];
                        nextList.splice(idx, 1);
                        this._updateForm({ [listKey]: nextList });
                    }}></sutram-btn>
                </div>
            `;
        };

        return html`
            <sutram-scroll-view padding="16px">
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div class="flow-section">
                        <div class="flow-section-header">
                            <h4 class="flow-section-title">
                                <yv-icon name="sliders" style="width: 15px; height: 15px; color: var(--intent-primary);"></yv-icon>
                                <span>Batch Identity</span>
                            </h4>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                            <sutram-input ?flush=${true} label="Batch Title" .value=${this.editForm?.title || ''} placeholder="e.g. API Wrap-Up" style="--bg-input: var(--bg);"
                                @sutram-input-changed=${(e) => {
                                    this._updateForm({ title: e.detail.value });
                                }}></sutram-input>
                            <sutram-input ?flush=${true} label="Domain Category" .value=${this.editForm?.domain || 'Workflows'} placeholder="e.g. Workflows" style="--bg-input: var(--bg);"
                                @sutram-input-changed=${(e) => this._updateForm({ domain: e.detail.value })}></sutram-input>
                        </div>
                    </div>

                    <div class="flow-section">
                        <div class="flow-section-header">
                            <h4 class="flow-section-title">
                                <yv-icon name="package" style="width: 15px; height: 15px; color: var(--intent-primary);"></yv-icon>
                                <span>1. Includes (Contexts, Diffs & VFS Paths)</span>
                            </h4>
                            <sutram-tag text="${includes.length} mapped" intent="neutral"></sutram-tag>
                        </div>
                        <div class="flow-list-box">
                            ${includes.length === 0 ? html`<sutram-empty-state text="No files selected."></sutram-empty-state>` : includes.map((inc, idx) => renderIncludeRow(inc, idx, 'includes', includes.length))}
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                            <sutram-btn size="sm" intent="primary" icon="package" label="Select Contexts" style="margin: 0;" @click=${() => FlowStore.setState({ selectingFor: 'includes', tempContexts: [...includes], showSelectContexts: true })}></sutram-btn>
                            <sutram-btn size="sm" intent="neutral" icon="file-plus" label="Add File" style="margin: 0;" @click=${() => {
                                if (this.ui && this.ui.openWorkspaceBrowser) {
                                    this.ui.openWorkspaceBrowser({
                                        mode: 'file',
                                        title: 'Select File',
                                        callback: (filepath) => {
                                            if (filepath) {
                                                const uri = canonicalizeFlowUri(filepath);
                                                if (!includes.includes(uri)) {
                                                    this._updateForm({ includes: [...includes, uri] });
                                                }
                                            }
                                        }
                                    });
                                }
                            }}></sutram-btn>
                            <sutram-btn size="sm" intent="neutral" icon="folder-plus" label="Add Folder" style="margin: 0;" @click=${() => {
                                if (this.ui && this.ui.openWorkspaceBrowser) {
                                    this.ui.openWorkspaceBrowser({
                                        mode: 'folder',
                                        title: 'Select Folder',
                                        callback: (folderpath) => {
                                            if (folderpath) {
                                                let uri = canonicalizeFlowUri(folderpath);
                                                if (!uri.endsWith('/')) uri += '/';
                                                if (!includes.includes(uri)) {
                                                    this._updateForm({ includes: [...includes, uri] });
                                                }
                                            }
                                        }
                                    });
                                }
                            }}></sutram-btn>
                        </div>
                    </div>

                    <div class="flow-section">
                        <div class="flow-section-header">
                            <h4 class="flow-section-title">
                                <yv-icon name="eye" style="width: 15px; height: 15px; color: var(--intent-highlight);"></yv-icon>
                                <span>2. Visibility Prerequisites (Optional)</span>
                            </h4>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Show ONLY if at least one of these exists:</span>
                                <sutram-btn size="sm" intent="neutral" icon="plus" label="Add Required" style="margin: 0;" @click=${() => FlowStore.setState({ selectingFor: 'exists', tempContexts: [...showIfExists], showSelectContexts: true })}></sutram-btn>
                            </div>
                            <div class="flow-list-box">
                                ${showIfExists.length === 0 ? html`<div style="padding: 8px 0; font-size: 0.8rem; color: var(--text-muted); font-style: italic; text-align: center;">No existence requirements.</div>` : showIfExists.map((inc, idx) => renderIncludeRow(inc, idx, 'showIfExists', showIfExists.length))}
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px dashed var(--border); padding-top: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Show ONLY if all of these are missing:</span>
                                <sutram-btn size="sm" intent="neutral" icon="plus" label="Add Missing" style="margin: 0;" @click=${() => FlowStore.setState({ selectingFor: 'missing', tempContexts: [...showIfMissing], showSelectContexts: true })}></sutram-btn>
                            </div>
                            <div class="flow-list-box">
                                ${showIfMissing.length === 0 ? html`<div style="padding: 8px 0; font-size: 0.8rem; color: var(--text-muted); font-style: italic; text-align: center;">No missing requirements.</div>` : showIfMissing.map((inc, idx) => renderIncludeRow(inc, idx, 'showIfMissing', showIfMissing.length))}
                            </div>
                        </div>
                    </div>

                    <div class="flow-section">
                        <div class="flow-section-header">
                            <h4 class="flow-section-title">
                                <yv-icon name="terminal" style="width: 15px; height: 15px; color: var(--intent-highlight);"></yv-icon>
                                <span>3. Instruction Prompt</span>
                            </h4>
                            <sutram-toggle ?flush=${true} .checked=${this.editForm?.hasPrompt} @sutram-input-changed=${(e) => this._updateForm({ hasPrompt: e.detail.value })}></sutram-toggle>
                        </div>
                        ${this.editForm?.hasPrompt ? html`
                            <sutram-select ?flush=${true} style="width: 100%; --bg-input: var(--bg);" .value=${this.editForm.prompt} .options=${[{value: '', label: '-- Select a Prompt --'}, ...(gatherOptions.prompts || []).map(p => { const canon = canonicalizeFlowUri(p.includes('://') ? p : `ctx://prompts/${p}`); return {value: canon, label: canon}; })]} @sutram-input-changed=${(e) => this._updateForm({ prompt: e.detail.value })}></sutram-select>
                        ` : html`<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Toggle on to attach a reusable instruction prompt to this workflow.</span>`}
                    </div>

                    <div class="flow-section">
                        <div class="flow-section-header">
                            <h4 class="flow-section-title">
                                <yv-icon name="file-check-2" style="width: 15px; height: 15px; color: var(--intent-success);"></yv-icon>
                                <span>4. Response Text Box</span>
                            </h4>
                            <sutram-toggle ?flush=${true} .checked=${this.editForm?.hasResponse} @sutram-input-changed=${(e) => this._updateForm({ hasResponse: e.detail.value })}></sutram-toggle>
                        </div>
                        ${this.editForm?.hasResponse ? html`
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                <sutram-input ?flush=${true} label="Response Save Path" .value=${this.editForm.responsePath} placeholder="e.g. sotu/sotu_{date}.current.md" style="font-family: var(--font-mono); --bg-input: var(--bg);" @sutram-input-changed=${(e) => this._updateForm({ responsePath: e.detail.value })}></sutram-input>
                                <sutram-input ?flush=${true} label="Archive Path (Optional)" .value=${this.editForm.archivePath} placeholder="e.g. sotu/archive/" style="font-family: var(--font-mono); --bg-input: var(--bg);" @sutram-input-changed=${(e) => this._updateForm({ archivePath: e.detail.value })}></sutram-input>
                            </div>
                        ` : html`<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Toggle on to save pasted LLM responses directly to a target file path.</span>`}
                    </div>
                </div>
            </sutram-scroll-view>
            <div style="padding: 12px 16px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; flex-shrink: 0; align-items: center;">
                ${this.editingBatch?.id ? html`
                    <sutram-async-btn intent="danger" icon="trash-2" label="Delete" style="flex: 1; margin: 0;" .onClick=${this.deleteEditBatch.bind(this)}></sutram-async-btn>
                    <sutram-btn intent="neutral" icon="copy" label="Copy" style="flex: 1; margin: 0;" @click=${() => FlowStore.getState().duplicateBatch({
                        ...this.editingBatch,
                        title: this.editForm.title || this.editingBatch.title,
                        domain: this.editForm.domain || this.editingBatch.domain,
                        includes: this.editForm.includes || [],
                        show_if_exists: this.editForm.showIfExists || [],
                        show_if_missing: this.editForm.showIfMissing || [],
                        include_prompt: this.editForm.hasPrompt ? this.editForm.prompt : undefined,
                        response_path: this.editForm.hasResponse ? this.editForm.responsePath : undefined,
                        archive_path: this.editForm.hasResponse ? this.editForm.archivePath : undefined
                    })}></sutram-btn>
                ` : ''}
                <sutram-async-btn intent="primary" icon="save" label="Save Batch" style="flex: 2; margin: 0;" .onClick=${this.saveEditBatch.bind(this)}></sutram-async-btn>
            </div>
            ${this.showSelectContexts ? html`
                <sutram-modal ?open=${true} titleText="Select Contexts" @sutram-modal-closed=${() => FlowStore.setState({ showSelectContexts: false, contextSearchQuery: '' })}>
                    <div slot="body" style="display: contents;">
                        <sutram-input placeholder="Fuzzy search contexts..." .value=${this.contextSearchQuery} @sutram-input-changed=${(e) => FlowStore.setState({ contextSearchQuery: e.detail.value })}></sutram-input>
                        <div style="display: flex; flex-direction: column; gap: 5px; overflow-y: auto; flex: 1;">
                            ${this.filterItems(allFiles, { pinnedRepos: new Set(['ALL']), searchQuery: this.contextSearchQuery, searchFields: f => String(f) }).map(file => {
                                const systemUri = file;
                                const isChecked = this.tempContexts.includes(systemUri);
                                const isDiff = file.includes('diffs/');
                                const manifestObj = manifest[file] || {};
                                const meta = manifestObj.meta || {};
                                const sizeStr = this.utils.formatArtifactSize(meta);

                                return html`
                                    <div style="display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid var(--border); background: var(--bg);">
                                        <sutram-toggle
                                            ?flush=${true}
                                            .checked=${isChecked}
                                            @sutram-input-changed=${() => {
                                                const set = new Set(this.tempContexts);
                                                set.has(systemUri) ? set.delete(systemUri) : set.add(systemUri);
                                                FlowStore.setState({ tempContexts: Array.from(set) });
                                            }}>
                                        </sutram-toggle>
                                        <div style="display: flex; flex-direction: column; flex: 1; cursor: pointer;" @click=${() => {
                                            const set = new Set(this.tempContexts);
                                            set.has(systemUri) ? set.delete(systemUri) : set.add(systemUri);
                                            FlowStore.setState({ tempContexts: Array.from(set) });
                                        }}>
                                            <div style="display: flex; justify-content: space-between;">
                                                <span style="font-family: monospace; font-size: 0.9rem; color: var(--intent-primary); font-weight: bold;">${systemUri}</span>
                                                <span style="font-size: 0.75rem; color: var(--text-muted);">${sizeStr}</span>
                                            </div>
                                            <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                                                <yv-icon name="${isDiff ? 'git-pull-request' : 'package'}" style="width: 12px; height: 12px;"></yv-icon>
                                                <span>${isDiff ? 'Git Working Tree Diffs' : `Context Payload (${meta.repos ? meta.repos.join(', ') : 'Generated'})`}</span>
                                            </span>
                                        </div>
                                    </div>
                                `;
                            })}
                        </div>
                    </div>
                    <sutram-btn slot="footer" intent="primary" icon="check" label="Confirm Selection" @click=${() => {
                        if (this.selectingFor === 'exists') this._updateForm({ showIfExists: [...this.tempContexts] });
                        else if (this.selectingFor === 'missing') this._updateForm({ showIfMissing: [...this.tempContexts] });
                        else this._updateForm({ includes: [...this.tempContexts] });
                        FlowStore.setState({ showSelectContexts: false, contextSearchQuery: '' });
                    }}></sutram-btn>
                </sutram-modal>
            ` : ''}
        `;
    }
}
customElements.define('insetu-flow-edit-projection', InSetuFlowEditProjection);
function _buildFlowMenuActions() {
    return [
        {
            label: 'New Batch',
            icon: 'package',
            onClick: () => window.inSetu?.events?.emit('insetu:flow:edit-batch', null)
        }
    ];
}

window.ExtensionRegistry.registerExtension('flow', {
    name: "Workflows",
    version: "2.0.0",
    offline_mode: "full",
    entityActions: [
        {
            targetEntity: 'workflow_batch',
            id: 'flow-edit',
            label: 'Edit',
            icon: 'edit-3',
            intent: 'primary',
            group: 'edit',
            vfsBound: false,
            order: 10,
            match: (data) => !data?.is_shared,
            emitEvent: (data) => ({ name: 'insetu:flow:edit-batch', detail: data })
        },
        {
            targetEntity: 'workflow_batch',
            id: 'flow-duplicate',
            label: 'Copy Batch',
            icon: 'copy',
            intent: 'neutral',
            group: 'edit',
            vfsBound: false,
            order: 11,
            emitEvent: (data) => ({ name: 'insetu:flow:copy-batch', detail: data })
        }
    ],
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "context",
            id: "flow",
            label: "Flow",
            icon: "workflow",
            intent: "primary",
            order: 2,
            menuActions: _buildFlowMenuActions,
            component: "insetu-ext-flow"
        }
    ],
});
