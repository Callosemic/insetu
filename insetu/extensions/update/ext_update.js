import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '../core/sdk.js';
import { sharedStyles } from '../../vendor/sutram/js/shared_styles.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
export const UpdateStore = createExtensionStore('Update', {
    targetRepo: '',
    repoVersion: null,
    repoLoading: false,
    repoConfigured: false,
    hasPyproject: true,
    isClean: true,
    hasRelease: false,
    pypiPublished: false,
    packageName: '',
    repoBuildCommand: 'python -m build',
    repoVcsRelease: true,
    hasToken: true,
    hasPypiToken: false,
    lastReleaseLog: '',
    missingDependencies: [],
    missingBinaries: [],
    eligibleRepos: {},
    previewModalOpen: false,
    previewOutput: '',
    previewChangelog: '',
    previewTab: 'changelog',
    previewActionType: 'bump',
    previewCaption: '',
    distributionTarget: 'python_pypi',
    lastPublishTime: 0,

    _runPreviewJob: async (repo, endpoint, actionType, defaultOutput, defaultChangelog, tab, defaultCaption) => {
        if (!repo) return;
        const res = await window.inSetu.api.post(endpoint, { repo });
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
                            previewOutput: statusData.artifact.output || defaultOutput,
                            previewChangelog: statusData.artifact.changelog || defaultChangelog,
                            previewActionType: actionType,
                            previewModalOpen: true,
                            previewTab: tab,
                            previewCaption: defaultCaption || ''
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
            throw new Error(`Failed to start preview for ${actionType}`);
        }
    },
    previewFirstRelease: async (repo) => {
        return UpdateStore.getState()._runPreviewJob(repo, 'update/preview_first_release', 'first_release', 'No changes to release.', 'N/A (Initial Release Phase)', 'full', 'This is a dry run of the initial release. If you proceed, the package will be built and distributed.');
    },
    previewBump: async (repo) => {
        return UpdateStore.getState()._runPreviewJob(repo, 'update/preview_bump', 'bump', 'No changes to release.', 'No changelog notes generated.', 'changelog', 'This is a dry run of the next release. If you proceed, the changelog will be committed and a new version tag will be pushed.');
    },
    previewPublish: async (repo) => {
        return UpdateStore.getState()._runPreviewJob(repo, 'update/preview_publish', 'publish', 'No publish operations required.', 'N/A (Publish Phase)', 'full', 'This is a dry run of the publish phase. If you proceed, the package will be uploaded to the target distribution registry.');
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

                // Auto-select the first versioned repository to keep the visually reordered dropdown in sync.
                // If the current repo is unversioned, snap to the versioned one. The user can still manually re-select the unversioned repo later.
                if (!currentRepo || !allRepos.includes(currentRepo) || (!eligibility[currentRepo] && withToml.length > 0)) {
                    nextRepo = withToml.length > 0 ? withToml[0] : (allRepos.length > 0 ? allRepos[0] : '');
                }

                const updates = { eligibleRepos: eligibility };
                if (nextRepo !== currentRepo) {
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
        UpdateStore.setState({ repoVersion: null, repoLoading: true }); // Clear and mark loading
        try {
            const res = await window.inSetu.api.post('update/status', { repo });
            if (res.status === 202) {
                const data = await res.json();
                window.inSetu.utils.pollJob(data.job_id, {
                    onComplete: (statusData) => {
                        UpdateStore.setState({ 
                            repoVersion: statusData.artifact.version, 
                            repoConfigured: statusData.artifact.configured,
                            hasPyproject: statusData.artifact.has_pyproject !== false,
                            isClean: statusData.artifact.is_clean !== false,
                            hasRelease: statusData.artifact.has_release === true,
                            pypiPublished: statusData.artifact.pypi_published === true,
                            packageName: statusData.artifact.package_name || '',
                            repoBuildCommand: statusData.artifact.build_command ?? 'python -m build',
                            repoVcsRelease: statusData.artifact.vcs_release !== false,
                            hasToken: statusData.artifact.has_token !== false,
                            hasPypiToken: statusData.artifact.has_pypi_token === true,
                            distributionTarget: statusData.artifact.distribution_target || 'python_pypi',
                            lastPublishTime: statusData.artifact.last_publish_time || 0,
                            repoLoading: false
                        });
                    },
                    onError: (err) => {
                        console.error("Status check failed:", err.message);
                        UpdateStore.setState({ repoLoading: false });
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus(`❌ Status Error: ${err.message}`, 5000, true);
                        }
                    }
                });
            } else {
                UpdateStore.setState({ repoLoading: false });
            }
        } catch (e) {
            console.error("Failed to queue status job:", e);
            UpdateStore.setState({ repoLoading: false });
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
    updateTomlConfig: async (repo, buildCommand, vcsRelease) => {
        if (!repo) return;
        try {
            const res = await window.inSetu.api.post('update/update_toml_config', { repo, build_command: buildCommand, vcs_release: vcsRelease });
            if (res.status === 202) {
                const data = await res.json();
                return new Promise((resolve, reject) => {
                    window.inSetu.utils.pollJob(data.job_id, {
                        onComplete: () => {
                            if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`✅ Release config updated.`, 2000);
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
                throw new Error("Failed to update config.");
            }
        } catch (e) {
            alert(`Network error: ${e.message}`);
            throw e;
        }
    },
    changeDistributionTarget: async (repo, target) => {
        if (!repo) return;
        try {
            const res = await window.inSetu.api.post(`update/settings?repo=${encodeURIComponent(repo)}`, {
                distribution_target: target
            });
            if (res.ok) {
                UpdateStore.setState({ distributionTarget: target });
                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus(`✅ Distribution target updated.`, 2000);
                }
            } else {
                throw new Error("Failed to save setting.");
            }
        } catch(e) {
            alert(`Error saving setting: ${e.message}`);
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
        repoLoading: { type: Boolean },
        repoConfigured: { type: Boolean },
        hasPyproject: { type: Boolean },
        isClean: { type: Boolean },
        hasRelease: { type: Boolean },
        pypiPublished: { type: Boolean },
        packageName: { type: String },
        repoBuildCommand: { type: String },
        repoVcsRelease: { type: Boolean },
        hasToken: { type: Boolean },
        hasPypiToken: { type: Boolean },
        distributionTarget: { type: String },
        lastReleaseLog: { type: String },
        allRepos: { type: Array },
        missingDependencies: { type: Array },
        missingBinaries: { type: Array },
        eligibleRepos: { type: Object },
        previewModalOpen: { type: Boolean },
        previewOutput: { type: String },
        previewChangelog: { type: String },
        previewTab: { type: String },
        previewActionType: { type: String },
        previewCaption: { type: String },
        lastPublishTime: { type: Number }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow-y: auto; background: var(--bg); box-sizing: border-box; padding: 20px; }
        .output-box { font-family: var(--font-mono); background: var(--input-bg); border: 1px solid var(--border); padding: 12px; border-radius: 4px; font-size: 0.85rem; color: var(--text); white-space: pre-wrap; overflow-y: auto; flex: 1; min-height: 150px; margin-top: 15px; }
    `];
    constructor() {
        super();
        this.targetRepo = '';
        this.repoVersion = null;
        this.repoLoading = false;
        this.repoConfigured = false;
        this.hasPyproject = true;
        this.isClean = true;
        this.hasRelease = false;
        this.repoBuildCommand = 'python -m build';
        this.repoVcsRelease = true;
        this.hasToken = true;
        this.hasPypiToken = false;
        this.distributionTarget = 'python_pypi';
        this.allRepos = [];
        this.missingDependencies = [];
        this.missingBinaries = [];
        this.eligibleRepos = {};
        this.previewModalOpen = false;
        this.previewOutput = '';
        this.previewChangelog = '';
        this.previewTab = 'changelog';
        this.previewActionType = 'bump';
        this.previewCaption = '';
        this.lastPublishTime = 0;
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(UpdateStore, state => {
            const previousRepo = this.targetRepo;
            this.targetRepo = state.targetRepo;
            this.repoVersion = state.repoVersion;
            this.repoLoading = !!state.repoLoading;
            this.repoConfigured = state.repoConfigured;
            this.hasPyproject = state.hasPyproject !== false;
            this.isClean = state.isClean !== false;
            this.hasRelease = state.hasRelease === true;
            this.pypiPublished = state.pypiPublished === true;
            this.packageName = state.packageName || '';
            this.repoBuildCommand = state.repoBuildCommand ?? 'python -m build';
            this.repoVcsRelease = state.repoVcsRelease !== false;
            this.hasToken = state.hasToken !== false;
            this.hasPypiToken = state.hasPypiToken === true;
            this.distributionTarget = state.distributionTarget || 'python_pypi';
            this.lastReleaseLog = state.lastReleaseLog || '';
            this.missingDependencies = state.missingDependencies || [];
            this.missingBinaries = state.missingBinaries || [];
            this.eligibleRepos = state.eligibleRepos || {};
            this.previewModalOpen = state.previewModalOpen;
            this.previewOutput = state.previewOutput;
            this.previewChangelog = state.previewChangelog || '';
            this.previewTab = state.previewTab || 'changelog';
            this.previewActionType = state.previewActionType || 'bump';
            this.previewCaption = state.previewCaption || '';
            this.lastPublishTime = state.lastPublishTime || 0;
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
    _getReleaseAction(endpoint, successMessage, isFirstRelease = false) {
        return this.api.bindJobAction(endpoint, { repo: this.targetRepo }, {
            onProgress: (msg) => {
                this.setStatus(`⏳ ${msg}`, null);
            },
            onComplete: (statusData) => {
                const output = statusData.artifact?.output || statusData.message;
                if (isFirstRelease) {
                    UpdateStore.setState({ lastReleaseLog: output });
                    this.setStatus(`🎉 Initial release v${statusData.artifact?.version || ''} published!`, 5000);
                    UpdateStore.getState().fetchRepoStatus(this.targetRepo);
                    UpdateStore.getState().fetchEligibleRepos();
                } else {
                    this.setStatus(`✅ ${successMessage} complete.`, 2000);
                }
                console.log(`${successMessage} Output:\n`, output);
            },
            onError: (err) => {
                if (isFirstRelease) {
                    const logText = `❌ First Release Error:\n\n${err.message}`;
                    UpdateStore.setState({ lastReleaseLog: logText });
                    this.setStatus(`❌ First release failed. See log below.`, 5000, true);
                } else {
                    this.setStatus(`❌ ${successMessage} failed: ${err.message}`, 5000, true);
                }
                console.error(`${successMessage} Error:\n`, err);
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
                    ${(() => {
                        const withToml = this.allRepos.filter(r => this.eligibleRepos[r]);
                        const withoutToml = this.allRepos.filter(r => !this.eligibleRepos[r]);
                        const options = [
                            ...withToml.map(r => ({ value: r, label: r })),
                            ...(withToml.length > 0 && withoutToml.length > 0 ? [{ value: '---', label: '──────────' }] : []),
                            ...withoutToml.map(r => ({ value: r, label: r }))
                        ];

                        // Force a complete component remount when the eligibility matrix hydrates
                        // by serving physically distinct template references to the Lit engine.
                        if (Object.keys(this.eligibleRepos).length === 0) {
                            return html`
                                <sutram-select 
                                    style="flex: 1; margin-bottom: 0;"
                                    .value=${this.targetRepo}
                                    .options=${options}
                                    @sutram-input-changed=${e => {
                                        if (e.detail.value !== '---') UpdateStore.setState({ targetRepo: e.detail.value });
                                    }}>
                                </sutram-select>
                            `;
                        } else {
                            return html`
                                <sutram-select 
                                    style="flex: 1; margin-bottom: 0;"
                                    .value=${this.targetRepo}
                                    .options=${options}
                                    @sutram-input-changed=${e => {
                                        if (e.detail.value !== '---') UpdateStore.setState({ targetRepo: e.detail.value });
                                    }}>
                                </sutram-select>
                            `;
                        }
                    })()}
                </div>
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                    <label style="font-weight: bold; font-size: 0.9rem; color: var(--text-muted);">Distribution Target:</label>
                    <sutram-select 
                        style="flex: 1; margin-bottom: 0;"
                        .value=${this.distributionTarget}
                        .options=${[
                            { value: 'python_pypi', label: 'Python (PyPI + VCS)' },
                            { value: 'vcs_only', label: 'VCS Only (Git Tag & GitHub Release)' },
                            { value: 'disabled', label: 'Disabled (Version Bump Only)' }
                        ]}
                        @sutram-input-changed=${e => {
                            if (this.targetRepo) {
                                UpdateStore.getState().changeDistributionTarget(this.targetRepo, e.detail.value);
                            }
                        }}>
                    </sutram-select>
                </div>
                <div style="padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.85rem; color: var(--text-muted); font-weight: bold;">Current Version</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-family: var(--font-mono); font-size: 1.1rem; color: ${this.repoLoading ? 'var(--text-muted)' : (this.repoVersion ? 'var(--intent-primary)' : 'var(--text-muted)')}; font-weight: bold;">
                                    ${this.repoLoading ? 'refreshing repo state...' : (this.repoVersion ? `v${this.repoVersion}` : 'Unversioned')}
                                </span>
                                ${!this.repoLoading && this.repoConfigured ? html`
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
                            ${!this.repoLoading && this.repoConfigured && !this.hasRelease ? html`
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
                        ${!this.repoLoading && this.repoConfigured ? html`
                            <span style="font-size: 0.75rem; color: var(--intent-success); border: 1px solid var(--intent-success); padding: 2px 6px; border-radius: 10px; font-weight: bold;">
                                ✅ Configured
                            </span>
                        ` : ''}
                    </div>

                    ${!this.repoLoading && !this.isClean && this.repoConfigured ? html`
                        <div style="background: var(--bg); border: 1px dashed var(--intent-warning); border-radius: 4px; padding: 8px 12px; margin-top: 10px; color: var(--intent-warning); font-size: 0.85rem; font-weight: bold; text-align: center;">
                            ⚠️ Working tree is not clean. Commit changes before releasing.
                        </div>
                    ` : ''}
                    ${!this.repoLoading && !this.hasPyproject ? html`
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
                    ${!this.repoLoading && !this.repoConfigured ? html`
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
                ${!this.repoLoading && this.repoConfigured && this.isClean ? html`
                    <div style="padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                <input type="checkbox" .checked=${this.repoVcsRelease}
                                    @change=${(e) => {
                                        UpdateStore.getState().updateTomlConfig(this.targetRepo, this.repoBuildCommand, e.target.checked);
                                    }}>
                                <span style="font-weight: bold; color: var(--text);">Release via GitHub API (<code>vcs_release</code>)</span>
                            </label>
                            ${this.repoVcsRelease && !this.hasToken ? html`
                                <div style="color: var(--intent-warning); font-size: 0.75rem; margin-left: 24px;">
                                    ⚠️ No GitHub API token detected in secrets or environment. Local tag/push will succeed, but API release card creation will fail.
                                </div>
                            ` : ''}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer;">
                                <input type="checkbox" .checked=${!!this.repoBuildCommand}
                                    @change=${(e) => {
                                        const enabled = e.target.checked;
                                        const cmd = enabled ? (this.repoBuildCommand || 'python -m build') : '';
                                        UpdateStore.getState().updateTomlConfig(this.targetRepo, cmd, this.repoVcsRelease);
                                    }}>
                                <span style="font-weight: bold; color: var(--text);">Trigger Build Command on Bump</span>
                            </label>
                            ${this.repoBuildCommand ? html`
                                <div style="display: flex; gap: 8px; margin-left: 24px; margin-top: 4px;">
                                    <sutram-input 
                                        style="flex: 1; margin-bottom: 0; --bg-input: var(--bg);"
                                        .value=${this.repoBuildCommand}
                                        placeholder="e.g., python -m build"
                                        @sutram-input-changed=${(e) => {
                                            UpdateStore.setState({ repoBuildCommand: e.detail.value });
                                        }}>
                                    </sutram-input>
                                    <sutram-async-btn 
                                        label="💾 Save" 
                                        intent="success" 
                                        style="margin: 0; --btn-padding: 8px 12px; --btn-font-size: 0.85rem;"
                                        .onClick=${async () => {
                                            await UpdateStore.getState().updateTomlConfig(this.targetRepo, this.repoBuildCommand, this.repoVcsRelease);
                                        }}>
                                    </sutram-async-btn>
                                </div>
                            ` : ''}
                            <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 24px;">Executed by Semantic Release before tagging. Changes are committed to <code>pyproject.toml</code> natively.</span>
                        </div>
                    </div>

                    <div style="padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 15px;">
                        <!-- Step 1 Column -->
                        <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 6px;">
                            <sutram-async-btn 
                                style="width: 100%;" 
                                label="📦 Step 1: Bump & Tag" 
                                intent="primary" 
                                ?disabled=${!this.repoConfigured || !this.isClean}
                                .onClick=${async () => await UpdateStore.getState().previewBump(this.targetRepo)}>
                            </sutram-async-btn>
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-align: left; line-height: 1.3;">
                                <strong>Phase 1 (Code & Git Preparation):</strong>
                                <ol style="margin: 4px 0 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px;">
                                    <li>Analyzes commit logs (<code>feat:</code>, <code>fix:</code>) to pick next version.</li>
                                    <li>Updates version in <code>pyproject.toml</code> & generates <code>CHANGELOG.md</code>.</li>
                                    <li>Triggers build command (e.g. <code>python -m build</code>) to make wheels.</li>
                                    <li>Commits, tags (<code>vX.Y.Z</code>), and pushes directly to GitHub via SSH.</li>
                                </ol>
                            </div>
                        </div>
                        <!-- Step 2 Column -->
                        <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 6px;">
                            ${!this.hasRelease || (!this.pypiPublished && this.distributionTarget === 'python_pypi') ? html`
                                <sutram-async-btn 
                                    style="width: 100%;" 
                                    label="${this.distributionTarget === 'python_pypi' ? `🚀 Publish v${this.repoVersion || '0.1.0'} to PyPI` : `🏷️ Release v${this.repoVersion || '0.1.0'} to VCS`}" 
                                    intent="highlight" 
                                    ?disabled=${!this.isClean || (this.distributionTarget === 'python_pypi' && !this.hasPypiToken)}
                                    .disabled=${!this.isClean || (this.distributionTarget === 'python_pypi' && !this.hasPypiToken)}
                                    .onClick=${async () => {
                                        if (!this.isClean || (this.distributionTarget === 'python_pypi' && !this.hasPypiToken)) return;
                                        await UpdateStore.getState().previewFirstRelease(this.targetRepo);
                                    }}>
                                </sutram-async-btn>
                                ${this.distributionTarget === 'python_pypi' && !this.hasPypiToken ? html`
                                    <span style="font-size: 0.75rem; color: var(--intent-warning); font-style: italic; text-align: center; display: block; margin-top: 4px;">
                                        ⚠️ API token is missing. Please configure 'PyPI Distribution Token' in Workspace Settings.
                                    </span>
                                ` : ''}
                                ${this.lastPublishTime > 0 && this.distributionTarget === 'python_pypi' && !this.pypiPublished ? html`
                                    <div style="font-size: 0.75rem; color: var(--intent-highlight); font-weight: bold; text-align: left; line-height: 1.3; background: var(--bg); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--intent-highlight); margin-top: 2px;">
                                        🕒 Publish dispatched <strong>${this.utils.timeAgo(this.lastPublishTime * 1000)}</strong>. PyPI indexing may take several minutes before it reflects here.
                                    </div>
                                ` : ''}
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-align: left; line-height: 1.3; margin-top: 4px;">
                                    ${this.distributionTarget === 'python_pypi' 
                                        ? `Initial release pipeline: validates package assets, builds wheels, uploads to PyPI, and establishes v${this.repoVersion || '0.1.0'} baseline.` 
                                        : `Initial release pipeline: establishes v${this.repoVersion || '0.1.0'} Git baseline tags.`}
                                </div>
                            ` : html`
                                <sutram-async-btn 
                                    style="width: 100%;" 
                                    label="${this.distributionTarget === 'python_pypi' ? '🚀 Step 2: Publish Release' : (this.distributionTarget === 'disabled' ? '🚫 Publishing Disabled' : '🚀 Step 2: Push VCS Release')}" 
                                    intent="highlight" 
                                    ?disabled=${!this.repoConfigured || !this.isClean || (this.distributionTarget === 'python_pypi' && !this.hasPypiToken) || this.distributionTarget === 'disabled'}
                                    .disabled=${!this.repoConfigured || !this.isClean || (this.distributionTarget === 'python_pypi' && !this.hasPypiToken) || this.distributionTarget === 'disabled'}
                                    .onClick=${async () => {
                                        if (!this.repoConfigured || !this.isClean || (this.distributionTarget === 'python_pypi' && !this.hasPypiToken) || this.distributionTarget === 'disabled') return;
                                        await UpdateStore.getState().previewPublish(this.targetRepo);
                                    }}>
                                </sutram-async-btn>
                                ${this.distributionTarget === 'python_pypi' && !this.hasPypiToken ? html`
                                    <span style="font-size: 0.75rem; color: var(--intent-warning); font-style: italic; text-align: center; display: block; margin-top: 4px;">
                                        ⚠️ API token is missing. Please configure 'PyPI Distribution Token' in Workspace Settings.
                                    </span>
                                ` : ''}
                                ${this.lastPublishTime > 0 && this.distributionTarget === 'python_pypi' && !this.pypiPublished ? html`
                                    <div style="font-size: 0.75rem; color: var(--intent-highlight); font-weight: bold; text-align: left; line-height: 1.3; background: var(--bg); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--intent-highlight); margin-top: 2px;">
                                        🕒 Publish dispatched <strong>${this.utils.timeAgo(this.lastPublishTime * 1000)}</strong>. PyPI indexing may take several minutes before it reflects here.
                                    </div>
                                ` : ''}
                                <div style="font-size: 0.75rem; color: var(--text-muted); text-align: left; line-height: 1.3; margin-top: 4px;">
                                    <strong>Phase 2 (External Distribution):</strong>
                                    <ol style="margin: 4px 0 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px;">
                                        ${this.distributionTarget === 'python_pypi' ? html`<li>Uploads compiled package files to PyPI.</li>` : ''}
                                        ${this.distributionTarget !== 'disabled' ? html`<li>Mints the official GitHub Release card UI with notes.</li>` : html`<li>External distribution is disabled in settings.</li>`}
                                    </ol>
                                </div>
                            `}
                        </div>
                    </div>
                ` : ''}
                ${this.lastReleaseLog ? html`
                    <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                        <button class="btn-sm" style="background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 8px 14px; font-weight: bold; cursor: pointer;"
                            @click=${() => {
                                UpdateStore.setState({
                                    previewOutput: this.lastReleaseLog,
                                    previewChangelog: 'Release Execution Log',
                                    previewActionType: 'log_view',
                                    previewModalOpen: true,
                                    previewTab: 'full',
                                    previewCaption: 'Execution log output for the previous release action.'
                                });
                            }}>
                            👁️ View Last Release Log
                        </button>
                    </div>
                ` : ''}
            </div>
            <sutram-modal ?open=${this.previewModalOpen} ?fullscreen=${true} titleText=${this.previewActionType === 'log_view' ? 'Release Execution Log' : 'Release Preview'} @sutram-modal-closed=${() => UpdateStore.setState({ previewModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0; margin-bottom: 10px;">
                        ${this.previewCaption}
                    </p>
                    <div style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
                        ${this.previewActionType !== 'log_view' ? html`
                            <button class="btn-sm" style="background: ${this.previewTab === 'changelog' ? 'var(--intent-primary)' : 'var(--input-bg)'}; color: ${this.previewTab === 'changelog' ? '#fff' : 'var(--text)'}; border: 1px solid var(--border); border-radius: 4px; padding: 6px 12px; font-weight: bold; cursor: pointer;"
                                @click=${() => UpdateStore.setState({ previewTab: 'changelog' })}>
                                📝 Change Log
                            </button>
                        ` : ''}
                        <button class="btn-sm" style="background: ${this.previewTab === 'full' ? 'var(--intent-primary)' : 'var(--input-bg)'}; color: ${this.previewTab === 'full' ? '#fff' : 'var(--text)'}; border: 1px solid var(--border); border-radius: 4px; padding: 6px 12px; font-weight: bold; cursor: pointer;"
                            @click=${() => UpdateStore.setState({ previewTab: 'full' })}>
                            📋 Complete Report
                        </button>
                    </div>
                    ${this.previewTab === 'changelog' && this.previewActionType !== 'log_view' ? html`
                        <div class="output-box" style="margin-top: 0; margin-bottom: 8px;">${this.previewChangelog}</div>
                    ` : html`
                        <div class="output-box" style="margin-top: 0; margin-bottom: 8px;">${this.previewOutput}</div>
                    `}
                    <div style="padding: 6px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px; flex-shrink: 0; display: flex; align-items: center; justify-content: flex-end;">
                        <sutram-entity-actions 
                            ?scrollable=${true}
                            style="justify-content: flex-end;"
                            .entityType=${'text_blob'} 
                            .entityData=${{ 
                                textContent: this.previewTab === 'changelog' && this.previewActionType !== 'log_view' ? this.previewChangelog : this.previewOutput,
                                suggestedFilename: `release_log_${Date.now()}.txt`
                            }}>
                        </sutram-entity-actions>
                    </div>
                </div>
                <div slot="footer" style="display: flex; width: 100%; gap: 10px;">
                    <button class="btn-sm" style="flex: 1; background: var(--intent-neutral); color: white; border: none; padding: 10px 15px; font-weight: bold; border-radius: 4px; cursor: pointer;" @click=${() => UpdateStore.setState({ previewModalOpen: false })}>
                        ${this.previewActionType === 'log_view' ? '❌ Close' : '❌ Cancel'}
                    </button>
                    ${this.previewActionType !== 'log_view' ? html`
                        <sutram-async-btn label="${this.previewActionType === 'publish' ? '⚡ Confirm & Execute Publish' : (this.previewActionType === 'first_release' ? '⚡ Confirm & Initial Release' : '⚡ Confirm & Execute Bump')}" intent="success" style="flex: 1; margin: 0; --btn-padding: 10px 15px;" .onClick=${async () => {
                            UpdateStore.setState({ previewModalOpen: false });
                            let endpoint = 'bump';
                            let msg = 'Bump';
                            if (this.previewActionType === 'publish') { endpoint = 'publish'; msg = 'Publish'; }
                            else if (this.previewActionType === 'first_release') { endpoint = 'first_release'; msg = 'First Release'; }

                            const action = this._getReleaseAction(endpoint, msg, this.previewActionType === 'first_release');
                            await action();
                        }}></sutram-async-btn>
                    ` : ''}
                </div>
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
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'ctrl' && data.subId === 'update') {
                const repo = UpdateStore.getState().targetRepo;
                if (repo) UpdateStore.getState().fetchRepoStatus(repo);
                UpdateStore.getState().fetchEligibleRepos();
            }
        },
        'zone:vfs-mutated': (payload) => {
            if (!payload || !payload.mutations) return false;
            const repo = UpdateStore.getState().targetRepo;
            if (repo) {
                // Check if any mutation happened inside the active target repository
                const affected = payload.mutations.some(m => m.filepath && (m.filepath.startsWith(repo + '/') || m.filepath === repo));
                if (affected) {
                    // Debounce the status check heavily to avoid index.lock collisions during automated git workflows
                    if (!window._debouncedRepoStatusUpdate) {
                        window._debouncedRepoStatusUpdate = window.ExtensionRegistry.utils.debounce((r) => {
                            UpdateStore.getState().fetchRepoStatus(r);
                        }, 3500);
                    }
                    window._debouncedRepoStatusUpdate(repo);
                }
            }
            return false;
        }
    }
});