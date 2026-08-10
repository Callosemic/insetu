import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
export const UpdateStore = createExtensionStore('Update', {
    targetRepo: '',
    repoVersion: null,
    repoConfigured: false,
    hasPyproject: true,
    isClean: true,
    hasRelease: false,
    repoBuildCommand: 'false',
    missingDependencies: [],
    missingBinaries: [],
    eligibleRepos: {},
    previewModalOpen: false,
    previewOutput: '',
    previewChangelog: '',
    previewTab: 'changelog',
    previewActionType: 'bump',
    previewBump: async (repo) => {
        if (!repo) return;
        const res = await window.inSetu.api.post('update/preview_bump', { repo });
        if (res.status === 202) {
            const data = await res.json();
            return new Promise((resolve, reject) => {
                window.inSetu.utils.pollJob(data.job_id, {
                    onProgress: (msg) => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null);
                    },
                    onComplete: (statusData) => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`✅ Preview ready.`, 2000);
                        UpdateStore.setState({ 
                            previewOutput: statusData.artifact.output || 'No changes to release.',
                            previewChangelog: statusData.artifact.changelog || 'No changelog notes generated.',
                            previewActionType: 'bump',
                            previewModalOpen: true,
                            previewTab: 'changelog'
                        });
                        resolve();
                    },
                    onError: (err) => {
                        alert(`Preview Error: ${err.message}`);
                        reject(err);
                    }
                });
            });
        } else {
            throw new Error("Failed to start preview");
        }
    },
    previewPublish: async (repo) => {
        if (!repo) return;
        const res = await window.inSetu.api.post('update/preview_publish', { repo });
        if (res.status === 202) {
            const data = await res.json();
            return new Promise((resolve, reject) => {
                window.inSetu.utils.pollJob(data.job_id, {
                    onProgress: (msg) => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`⏳ ${msg}`, null);
                    },
                    onComplete: (statusData) => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`✅ Publish preview ready.`, 2000);
                        UpdateStore.setState({ 
                            previewOutput: statusData.artifact.output || 'No publish operations required.',
                            previewChangelog: 'N/A (Publish Phase)',
                            previewActionType: 'publish',
                            previewModalOpen: true,
                            previewTab: 'full'
                        });
                        resolve();
                    },
                    onError: (err) => {
                        alert(`Preview Error: ${err.message}`);
                        reject(err);
                    }
                });
            });
        } else {
            throw new Error("Failed to start preview");
        }
    },
    fetchEligibleRepos: async () => {
        try {
            const res = await window.inSetu.api.workspace('update/eligible_repos');
            if (res.ok) {
                const data = await res.json();
                const eligibility = data.eligibility || {};

                const currentRepo = UpdateStore.getState().targetRepo;
                const allRepos = window.inSetu.stores.App.getState().allRepos || [];
                const withToml = allRepos.filter(r => eligibility[r]);

                let nextRepo = currentRepo;

                if (!currentRepo && withToml.length > 0) {
                    nextRepo = withToml[0];
                } else if (currentRepo && !eligibility[currentRepo] && withToml.length > 0) {
                    nextRepo = withToml[0];
                }

                // Batch the state update so the UI evaluates the new repository and the new dropdown sorting simultaneously
                const updates = { eligibleRepos: eligibility };
                if (nextRepo && nextRepo !== currentRepo) {
                    updates.targetRepo = nextRepo;
                }
                UpdateStore.setState(updates);
            }
        } catch (e) {
            console.warn("Failed to fetch eligible repos:", e);
        }
    },
    checkDependencies: async () => {
        try {
            const res = await window.inSetu.api.system('config');
            if (res.ok) {
                const data = await res.json();
                const extMeta = (data.meta?.available_extensions || []).find(e => e.id === 'update');
                if (extMeta) {
                    UpdateStore.setState({ 
                        missingDependencies: extMeta.missing_externals || [],
                        missingBinaries: extMeta.missing_binaries || []
                    });
                }
            }
        } catch (e) {
            console.warn("Failed to check dependencies:", e);
        }
    },
    fetchRepoStatus: async (repo) => {
        if (!repo) return;
        UpdateStore.setState({ repoVersion: null }); // Clear while loading
        try {
            const res = await window.inSetu.api.post('update/status', { repo });
            if (res.status === 202) {
                const data = await res.json();
                const activeWs = window.inSetu.utils.getActiveWorkspace();
                window.inSetu.utils.pollJob(data.job_id, {
                    onComplete: (statusData) => {
                        if (window.inSetu.utils.getActiveWorkspace() !== activeWs) return;
                        UpdateStore.setState({ 
                            repoVersion: statusData.artifact.version, 
                            repoConfigured: statusData.artifact.configured,
                            hasPyproject: statusData.artifact.has_pyproject !== false,
                            isClean: statusData.artifact.is_clean !== false,
                            hasRelease: statusData.artifact.has_release === true,
                            repoBuildCommand: statusData.artifact.build_command || 'false'
                        });
                    },
                    onError: (err) => {
                        if (window.inSetu.utils.getActiveWorkspace() !== activeWs) return;
                        console.error("Status check failed:", err.message);
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus(`❌ Status Error: ${err.message}`, 5000, true);
                        }
                    }
                });
            }
        } catch (e) {
            console.error("Failed to queue status job:", e);
        }
    },
    createDummyToml: async (repo, initialVersion) => {
        if (!repo) return;
        try {
            const res = await window.inSetu.api.post('update/create_dummy_toml', { repo, initial_version: initialVersion || '0.1.0' });
            if (res.status === 202) {
                const data = await res.json();
                window.inSetu.utils.pollJob(data.job_id, {
                    onComplete: () => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus(`✅ Created basic TOML for ${repo}.`, 3000);
                        }
                        UpdateStore.getState().fetchRepoStatus(repo);
                        UpdateStore.getState().fetchEligibleRepos();

                        // Notify the Git extension to clear out staged diffs
                        if (window.inSetu.events && window.inSetu.events.emit) {
                            window.inSetu.events.emit('insetu:git:generate-diffs', { force: true });
                        }
                    },
                    onError: (err) => alert(`Error: ${err.message}`)
                });
            }
        } catch (e) {
            alert(`Network error: ${e.message}`);
        }
    },
    updateTomlConfig: async (repo, buildCommand) => {
        if (!repo) return;
        try {
            const res = await window.inSetu.api.post('update/update_toml_config', { repo, build_command: buildCommand });
            if (res.status === 202) {
                const data = await res.json();
                return new Promise((resolve, reject) => {
                    window.inSetu.utils.pollJob(data.job_id, {
                        onComplete: () => {
                            if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`✅ Build command updated.`, 2000);
                            UpdateStore.getState().fetchRepoStatus(repo);
                            resolve();
                        },
                        onError: (err) => {
                            alert(`Error: ${err.message}`);
                            reject(err);
                        }
                    });
                });
            } else {
                throw new Error("Failed to update build command.");
            }
        } catch (e) {
            alert(`Network error: ${e.message}`);
            throw e;
        }
    },
    forceVersion: async (repo, version) => {
        if (!repo || !version) return;
        try {
            const res = await window.inSetu.api.post('update/force_version', { repo, version });
            if (res.status === 202) {
                const data = await res.json();
                window.inSetu.utils.pollJob(data.job_id, {
                    onComplete: () => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus(`✅ Version forced to v${version}.`, 3000);
                        }
                        UpdateStore.getState().fetchRepoStatus(repo);
                    },
                    onError: (err) => alert(`Error: ${err.message}`)
                });
            }
        } catch (e) {
            alert(`Network error: ${e.message}`);
        }
    },
    scaffoldRepo: async (repo, initialVersion) => {
        if (!repo) return;
        try {
            const res = await window.inSetu.api.post('update/scaffold', { repo, initial_version: initialVersion });
            if (res.status === 202) {
                const data = await res.json();
                window.inSetu.utils.pollJob(data.job_id, {
                    onComplete: () => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus(`✅ Successfully scaffolded versioning for ${repo}.`, 3000);
                        }
                        UpdateStore.getState().fetchRepoStatus(repo);
                        UpdateStore.getState().fetchEligibleRepos();

                        // Notify the Git extension to clear out staged diffs
                        if (window.inSetu.events && window.inSetu.events.emit) {
                            window.inSetu.events.emit('insetu:git:generate-diffs', { force: true });
                        }
                    },
                    onError: (err) => alert(`Error: ${err.message}`)
                });
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`Failed to scaffold: ${err.error || "Unknown error"}`);
            }
        } catch (e) {
            alert(`Network error: ${e.message}`);
        }
    }
});

window.inSetu.stores.Update = UpdateStore;

export class InSetuExtUpdate extends InSetuElement {
    static get extensionName() { return 'update'; }
    static properties = {
        targetRepo: { type: String },
        repoVersion: { type: String },
        repoConfigured: { type: Boolean },
        hasPyproject: { type: Boolean },
        isClean: { type: Boolean },
        hasRelease: { type: Boolean },
        repoBuildCommand: { type: String },
        allRepos: { type: Array },
        missingDependencies: { type: Array },
        missingBinaries: { type: Array },
        eligibleRepos: { type: Object },
        previewModalOpen: { type: Boolean },
        previewOutput: { type: String },
        previewChangelog: { type: String },
        previewTab: { type: String },
        previewActionType: { type: String }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow-y: auto; background: var(--bg); box-sizing: border-box; padding: 20px; }
        .output-box { font-family: var(--font-mono); background: var(--input-bg); border: 1px solid var(--border); padding: 12px; border-radius: 4px; font-size: 0.85rem; color: var(--text); white-space: pre-wrap; overflow-y: auto; flex: 1; min-height: 150px; margin-top: 15px; }
    `];
    constructor() {
        super();
        this.targetRepo = '';
        this.repoVersion = null;
        this.repoConfigured = false;
        this.hasPyproject = true;
        this.isClean = true;
        this.hasRelease = false;
        this.repoBuildCommand = 'false';
        this.allRepos = [];
        this.missingDependencies = [];
        this.missingBinaries = [];
        this.eligibleRepos = {};
        this.previewModalOpen = false;
        this.previewOutput = '';
        this.previewChangelog = '';
        this.previewTab = 'changelog';
        this.previewActionType = 'bump';
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(UpdateStore, state => {
            const previousRepo = this.targetRepo;
            this.targetRepo = state.targetRepo;
            this.repoVersion = state.repoVersion;
            this.repoConfigured = state.repoConfigured;
            this.hasPyproject = state.hasPyproject !== false;
            this.isClean = state.isClean !== false;
            this.hasRelease = state.hasRelease === true;
            this.repoBuildCommand = state.repoBuildCommand || 'false';
            this.missingDependencies = state.missingDependencies || [];
            this.missingBinaries = state.missingBinaries || [];
            this.eligibleRepos = state.eligibleRepos || {};
            this.previewModalOpen = state.previewModalOpen;
            this.previewOutput = state.previewOutput;
            this.previewChangelog = state.previewChangelog || '';
            this.previewTab = state.previewTab || 'changelog';
            this.previewActionType = state.previewActionType || 'bump';
            this.requestUpdate();

            // Fetch status when the selected repo changes
            if (this.targetRepo && this.targetRepo !== previousRepo) {
                UpdateStore.getState().fetchRepoStatus(this.targetRepo);
            }
        });
        this.subscribe(AppStore, state => {
            this.allRepos = state.allRepos || [];
            if (!this.targetRepo && this.allRepos.length > 0) {
                UpdateStore.setState({ targetRepo: this.allRepos[0] });
            }
        });

        const appState = AppStore.getState();
        this.allRepos = appState.allRepos || [];
        if (!this.targetRepo && this.allRepos.length > 0) {
            UpdateStore.setState({ targetRepo: this.allRepos[0] });
        } else if (this.targetRepo) {
            UpdateStore.getState().fetchRepoStatus(this.targetRepo);
        }
        UpdateStore.getState().checkDependencies();
        UpdateStore.getState().fetchEligibleRepos();
    }
    onWorkspaceChanged(newWorkspaceId) {
        if (this.targetRepo) {
            UpdateStore.getState().fetchRepoStatus(this.targetRepo);
        }
        UpdateStore.getState().fetchEligibleRepos();
    }
    onForceRefresh() {
        if (this.targetRepo) {
            UpdateStore.getState().fetchRepoStatus(this.targetRepo);
        }
        UpdateStore.getState().fetchEligibleRepos();
        UpdateStore.getState().checkDependencies();
    }
    _getBumpAction() {
        return this.api.bindJobAction('bump', { repo: this.targetRepo }, {
            onProgress: (msg) => {
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`⏳ ${msg}`, null);
            },
            onComplete: (statusData) => {
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`✅ Bump complete.`, 2000);
                console.log("Bump Output:\n", statusData.artifact?.output || statusData.message);
            },
            onError: (err) => {
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`❌ Bump failed: ${err.message}`, 5000, true);
                console.error("Bump Error:\n", err);
            }
        });
    }

    _getPublishAction() {
        return this.api.bindJobAction('publish', { repo: this.targetRepo }, {
            onProgress: (msg) => {
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`⏳ ${msg}`, null);
            },
            onComplete: (statusData) => {
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`✅ Publish complete.`, 2000);
                console.log("Publish Output:\n", statusData.artifact?.output || statusData.message);
            },
            onError: (err) => {
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus(`❌ Publish failed: ${err.message}`, 5000, true);
                console.error("Publish Error:\n", err);
            }
        });
    }
    render() {
        return html`
            <div style="display: flex; flex-direction: column; height: 100%;">
                ${this.missingDependencies.length > 0 ? html`
                    <div style="background: var(--input-bg); border: 1px solid var(--intent-warning); border-radius: 4px; padding: 12px 15px; margin-bottom: 15px; display: flex; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 1.2rem; line-height: 1;">⚠️</span>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-weight: bold; color: var(--intent-warning); font-size: 0.95rem;">Missing Dependencies</span>
                            <span style="font-size: 0.85rem; color: var(--text);">Run the following command to install required Python packages:</span>
                            <code style="background: var(--bg); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); font-family: var(--font-mono); font-size: 0.8rem; color: var(--text); user-select: all; margin-top: 4px;">pip install ${this.missingDependencies.join(' ')}</code>
                        </div>
                    </div>
                ` : ''}
                ${this.missingBinaries.length > 0 ? html`
                    <div style="background: var(--input-bg); border: 1px solid var(--intent-danger); border-radius: 4px; padding: 12px 15px; margin-bottom: 15px; display: flex; align-items: flex-start; gap: 10px;">
                        <span style="font-size: 1.2rem; line-height: 1;">🚨</span>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-weight: bold; color: var(--intent-danger); font-size: 0.95rem;">Missing System Binaries</span>
                            <span style="font-size: 0.85rem; color: var(--text);">The following required system binaries are missing from your host environment:</span>
                            <code style="background: var(--bg); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); font-family: var(--font-mono); font-size: 0.8rem; color: var(--text); user-select: all; margin-top: 4px;">${this.missingBinaries.join(', ')}</code>
                        </div>
                    </div>
                ` : ''}
                <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: var(--text);">Semantic Update</h3>
                    <span style="font-size: 0.85rem; color: var(--text-muted);">Automated semantic versioning and package distribution pipeline.</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                    <label style="font-weight: bold; font-size: 0.9rem; color: var(--text-muted);">Target Repository:</label>
                    <select style="flex: 1; padding: 8px; border-radius: 4px; background: var(--input-bg); color: var(--text); border: 1px solid var(--border);"
                        .value=${this.targetRepo}
                        @change=${e => UpdateStore.setState({ targetRepo: e.target.value })}>
                        ${(() => {
                            const withToml = this.allRepos.filter(r => this.eligibleRepos[r]);
                            const withoutToml = this.allRepos.filter(r => !this.eligibleRepos[r]);
                            return html`
                                ${withToml.map(r => html`<option value="${r}" ?selected=${this.targetRepo === r}>${r}</option>`)}
                                ${withToml.length > 0 && withoutToml.length > 0 ? html`<option disabled>──────────</option>` : ''}
                                ${withoutToml.map(r => html`<option value="${r}" ?selected=${this.targetRepo === r}>${r}</option>`)}
                            `;
                        })()}
                    </select>
                </div>
                <div style="padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">Current Version</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-family: var(--font-mono); font-size: 1.1rem; color: ${this.repoVersion ? 'var(--intent-primary)' : 'var(--text-muted)'}; font-weight: bold;">
                                    ${this.repoVersion ? `v${this.repoVersion}` : 'Unversioned'}
                                </span>
                                ${this.repoConfigured ? html`
                                    <button style="background: transparent; border: 1px dashed var(--intent-warning); color: var(--intent-warning); border-radius: 4px; padding: 2px 6px; font-size: 0.7rem; font-weight: bold; cursor: pointer;"
                                        title="Force version override"
                                        @click=${() => {
                                            const newVer = prompt("Force version override to (e.g., 0.5.0):", this.repoVersion || "0.1.0");
                                            if (newVer) {
                                                UpdateStore.getState().forceVersion(this.targetRepo, newVer.trim());
                                            }
                                        }}>
                                        Force Override
                                    </button>
                                ` : ''}
                            </div>
                            ${this.repoConfigured && !this.hasRelease ? html`
                                <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                                    <span style="font-size: 0.75rem; color: var(--intent-warning); font-style: italic;">⚠️ Local version configured, but no Git release tag has been established.</span>
                                    <button class="btn-sm" style="background: var(--intent-primary); color: #fff; border: none; padding: 6px 12px; font-weight: bold; font-size: 0.8rem; border-radius: 4px; cursor: pointer; align-self: flex-start;"
                                        @click=${() => {
                                            const ver = this.repoVersion || "0.1.0";
                                            if (confirm(`Establish and tag initial baseline release v${ver}?`)) {
                                                UpdateStore.getState().forceVersion(this.targetRepo, ver);
                                            }
                                        }}>
                                        🏷️ Tag and Sync Initial Version
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                        ${this.repoConfigured ? html`
                            <span style="font-size: 0.75rem; color: var(--intent-success); border: 1px solid var(--intent-success); padding: 2px 6px; border-radius: 10px; font-weight: bold;">
                                ✅ Configured
                            </span>
                        ` : ''}
                    </div>

                    ${!this.isClean && this.repoConfigured ? html`
                        <div style="background: var(--bg); border: 1px dashed var(--intent-warning); border-radius: 4px; padding: 8px 12px; margin-top: 10px; color: var(--intent-warning); font-size: 0.85rem; font-weight: bold; text-align: center;">
                            ⚠️ Working tree is not clean. Commit changes before releasing.
                        </div>
                    ` : ''}
                    ${!this.hasPyproject ? html`
                        <div style="background: var(--bg); border: 1px dashed var(--intent-warning); border-radius: 4px; padding: 8px 12px; margin-bottom: 10px; color: var(--intent-warning); font-size: 0.85rem; font-weight: bold; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                            <span>⚠️ Missing pyproject.toml in this repository.</span>
                            <button class="btn-sm" style="background: var(--intent-warning); color: #000; border: none; padding: 4px 10px; font-weight: bold; font-size: 0.75rem; border-radius: 4px; cursor: pointer;"
                                @click=${() => {
                                    const initVer = prompt("Enter initial semantic version (e.g., 0.1.0):", "0.1.0");
                                    if (initVer) {
                                        UpdateStore.getState().createDummyToml(this.targetRepo, initVer.trim());
                                    }
                                }}>
                                📄 Create Basic TOML and Tag
                            </button>
                            <span style="font-size: 0.7rem; font-weight: normal; font-style: italic; opacity: 0.9;">The TOML file will be initialized with Python build disabled to accommodate versioning for all project types. This action will also instantly create a Git tag to establish your baseline version. Update manually as needed.</span>
                        </div>
                    ` : ''}
                    ${!this.repoConfigured ? html`
                        <button class="btn-sm" style="background: var(--intent-success); margin: 0; padding: 10px; font-weight: bold; width: 100%; ${!this.hasPyproject ? 'opacity: 0.5; cursor: not-allowed;' : ''}"
                            ?disabled=${!this.hasPyproject}
                            @click=${() => {
                                const initVer = prompt("Enter initial semantic version (e.g., 0.1.0):", "0.1.0");
                                if (initVer) {
                                    UpdateStore.getState().scaffoldRepo(this.targetRepo, initVer.trim());
                                }
                            }}>
                            ✨ Initialize Semantic Versioning
                        </button>
                    ` : ''}
                </div>
                ${this.repoConfigured ? html`
                    <div style="padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">Build Command</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" 
                                style="flex: 1; padding: 8px; border-radius: 4px; background: var(--bg); color: var(--text); border: 1px solid var(--border); font-family: var(--font-mono); font-size: 0.85rem;"
                                .value=${this.repoBuildCommand === 'false' ? '' : this.repoBuildCommand}
                                placeholder="e.g., python -m build (leave blank to skip)"
                                @keydown=${(e) => {
                                    if (e.key === 'Enter') {
                                        const newVal = e.target.value.trim() || 'false';
                                        if (newVal !== this.repoBuildCommand) {
                                            UpdateStore.getState().updateTomlConfig(this.targetRepo, newVal);
                                        }
                                    }
                                }}>
                            <sutram-async-btn 
                                label="💾 Save" 
                                intent="success" 
                                style="margin: 0; --btn-padding: 8px 12px; --btn-font-size: 0.85rem;"
                                .onClick=${async (e) => {
                                    const inputEl = e.target.previousElementSibling;
                                    const newVal = inputEl ? (inputEl.value.trim() || 'false') : 'false';
                                    if (newVal !== this.repoBuildCommand) {
                                        await UpdateStore.getState().updateTomlConfig(this.targetRepo, newVal);
                                    }
                                }}>
                            </sutram-async-btn>
                        </div>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Executed by Semantic Release before tagging. Changes are committed to <code>pyproject.toml</code> natively.</span>
                    </div>
                ` : ''}

                <div style="padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 15px;">
                    <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 5px;">
                        <sutram-async-btn 
                            style="width: 100%;" 
                            label="📦 Bump & Tag" 
                            intent="primary" 
                            ?disabled=${!this.repoConfigured || !this.isClean || !this.hasRelease}
                            .onClick=${async () => await UpdateStore.getState().previewBump(this.targetRepo)}>
                        </sutram-async-btn>
                        <span style="font-size: 0.75rem; color: var(--text-muted); text-align: center; line-height: 1.2;">Calculates the next version and commits the changelog.</span>
                    </div>
                    <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 5px;">
                        <sutram-async-btn 
                            style="width: 100%;" 
                            label="🚀 Release" 
                            intent="highlight" 
                            ?disabled=${!this.repoConfigured || !this.isClean || !this.hasRelease}
                            .onClick=${async () => await UpdateStore.getState().previewPublish(this.targetRepo)}>
                        </sutram-async-btn>
                        <span style="font-size: 0.75rem; color: var(--text-muted); text-align: center; line-height: 1.2;">Distributes the package to the configured registry.</span>
                    </div>
                </div>
            </div>
            <sutram-modal ?open=${this.previewModalOpen} ?fullscreen=${true} titleText="Release Preview" @sutram-modal-closed=${() => UpdateStore.setState({ previewModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">This is a dry run of the next release. If you proceed, the changelog will be committed and a new version tag will be pushed to the repository.</p>
                    <div style="display: flex; gap: 8px; margin-bottom: 12px; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
                        <button class="btn-sm" style="background: ${this.previewTab === 'changelog' ? 'var(--intent-primary)' : 'var(--input-bg)'}; color: ${this.previewTab === 'changelog' ? '#fff' : 'var(--text)'}; border: 1px solid var(--border); border-radius: 4px; padding: 6px 12px; font-weight: bold; cursor: pointer;"
                            @click=${() => UpdateStore.setState({ previewTab: 'changelog' })}>
                            📝 Change Log
                        </button>
                        <button class="btn-sm" style="background: ${this.previewTab === 'full' ? 'var(--intent-primary)' : 'var(--input-bg)'}; color: ${this.previewTab === 'full' ? '#fff' : 'var(--text)'}; border: 1px solid var(--border); border-radius: 4px; padding: 6px 12px; font-weight: bold; cursor: pointer;"
                            @click=${() => UpdateStore.setState({ previewTab: 'full' })}>
                            📋 Complete Report
                        </button>
                    </div>
                    ${this.previewTab === 'changelog' ? html`
                        <div class="output-box" style="margin-top: 0;">${this.previewChangelog}</div>
                    ` : html`
                        <div class="output-box" style="margin-top: 0;">${this.previewOutput}</div>
                    `}
                </div>
                <button slot="footer" class="btn-sm" style="background: var(--intent-neutral); color: white; border: none; padding: 10px 15px; font-weight: bold; border-radius: 4px; cursor: pointer;" @click=${() => UpdateStore.setState({ previewModalOpen: false })}>❌ Cancel</button>
                <sutram-async-btn slot="footer" label="${this.previewActionType === 'publish' ? '⚡ Confirm & Execute Publish' : '⚡ Confirm & Execute Bump'}" intent="success" .onClick=${async () => {
                    UpdateStore.setState({ previewModalOpen: false });
                    const action = this.previewActionType === 'publish' ? this._getPublishAction() : this._getBumpAction();
                    await action();
                }}></sutram-async-btn>
            </sutram-modal>
        `;
    }
}
customElements.define('insetu-ext-update', InSetuExtUpdate);
window.ExtensionRegistry.registerExtension('update', {
    name: "Semantic Update",
    version: "1.0.0",
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "ctrl",
            id: "update",
            label: "Update",
            order: 4,
            component: "insetu-ext-update"
        }
    ],
    uiHooks: {
        'zone:vfs-mutated': (payload) => {
            if (!payload || !payload.mutations) return false;
            const repo = UpdateStore.getState().targetRepo;
            if (repo) {
                // Check if any mutation happened inside the active target repository
                const affected = payload.mutations.some(m => m.filepath && (m.filepath.startsWith(repo + '/') || m.filepath === repo));
                if (affected) {
                    // Debounce the status check so we don't spam Git on bulk saves
                    if (window._updateExtDebounce) clearTimeout(window._updateExtDebounce);
                    window._updateExtDebounce = setTimeout(() => {
                        UpdateStore.getState().fetchRepoStatus(repo);
                    }, 500);
                }
            }
            return false;
        }
    }
});