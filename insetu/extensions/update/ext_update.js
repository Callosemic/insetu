import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
import { debounce } from '/static/vendor/sutram/js/utils.js';

window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };
const AppStore = window.inSetu.stores.App;
export const UpdateStore = createExtensionStore('Update', {
    targetRepo: '',
    repoVersion: null,
    nextVersion: null,
    hasPendingBump: false,
    bumpReason: '',
    repoLoading: false,
    repoConfigured: false,
    hasPyproject: true,
    isClean: true,
    hasRelease: false,
    pypiPublished: false,
    packageName: '',
    repoBuildCommand: 'python -m build',
    repoPrereleaseToken: 'rc',
    repoCommitParser: 'conventional',
    autoPublish: false,
    repoVcsRelease: true,
    hasToken: true,
    hasPypiToken: false,
    lastReleaseLog: '',
    missingDependencies: [],
    missingBinaries: [],
    eligibleRepos: {},
    isBackendMissing: false,
    distributionTarget: 'python_pypi',
    lastPublishTime: 0,
    latestBuildArtifact: null,
    isPrerelease: false,

    _runPreviewJob: async (repo, endpoint, actionType, defaultOutput, defaultChangelog, tab, defaultCaption, extraPayload = {}) => {
        if (!repo) return;
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('update')) return;
        const res = await window.inSetu.api.workspace.post(endpoint, { repo, ...extraPayload });
        if (res.status === 202) {
            const data = await res.json();
            return new Promise((resolve, reject) => {
                window.inSetu.utils.pollJob(data.job_id, {
                    onProgress: (msg) => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`${msg}`, null);
                    },
                    onComplete: (statusData) => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`Preview ready.`, 2000);
                        const output = statusData.artifact.output || defaultOutput;
                        const changelog = statusData.artifact.changelog || defaultChangelog;
                        if (window.Sutram?.stores?.Layout) {
                            const layout = window.Sutram.stores.Layout.getState();
                            const closeWin = () => layout.closeWindow('update:preview');
                            const confirmLabel = actionType === 'publish' 
                                ? 'Confirm & Execute Publish' 
                                : (actionType === 'first_release' ? 'Confirm & Initial Release' : 'Confirm & Execute Bump');

                            const executeAction = async () => {
                                closeWin();
                                const ep = actionType === 'publish' ? 'publish' : (actionType === 'first_release' ? 'first_release' : 'bump');
                                const msg = actionType === 'publish' ? 'Publish' : (actionType === 'first_release' ? 'First Release' : 'Bump');
                                const extra = actionType === 'bump' ? { prerelease: UpdateStore.getState().isPrerelease } : {};
                                const postRes = await window.inSetu.api.workspace.post(`update/${ep}`, { repo, ...extra });
                                if (postRes.status === 202) {
                                    const pData = await postRes.json();
                                    window.inSetu.utils.pollJob(pData.job_id, {
                                        onProgress: (pMsg) => {
                                            if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`${pMsg}`, null);
                                        },
                                        onComplete: (sData) => {
                                            const out = sData.artifact?.output || sData.message;
                                            UpdateStore.setState({ lastReleaseLog: out });
                                            if (actionType === 'first_release') {
                                                if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`Initial release v${sData.artifact?.version || ''} published!`, 5000);
                                                UpdateStore.getState().fetchRepoStatus(repo);
                                                UpdateStore.getState().fetchEligibleRepos();
                                            } else {
                                                if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`${msg} complete.`, 2000);
                                                UpdateStore.getState().fetchRepoStatus(repo);
                                            }
                                        },
                                        onError: (err) => {
                                            const logText = `${msg} Error:\n\n${err.message}`;
                                            UpdateStore.setState({ lastReleaseLog: logText });
                                            if (window.inSetu.ui?.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`${msg} failed:${err.message}`, 5000, true);
                                        }
                                    });
                                }
                            };

                            const tabs = actionType !== 'log_view' ? [
                                { id: 'changelog', label: 'Change Log', icon: 'file-text', content: changelog },
                                { id: 'full', label: 'Complete Report', icon: 'terminal', content: output }
                            ] : [
                                { id: 'full', label: 'Complete Report', icon: 'terminal', content: output }
                            ];

                            const actions = actionType !== 'log_view' ? [
                                { label: 'Cancel', icon: 'x', intent: 'neutral', onClick: closeWin },
                                { label: confirmLabel, icon: 'zap', intent: 'success', primary: true, asyncAction: executeAction }
                            ] : [
                                { label: 'Close', icon: 'x', intent: 'neutral', onClick: closeWin }
                            ];

                            layout.openWindow({
                                id: 'update:preview',
                                component: 'sutram-report-projection',
                                label: actionType === 'log_view' ? 'Release Execution Log' : 'Release Preview',
                                icon: 'package',
                                intent: 'success',
                                extName: 'update',
                                windowOnly: true,
                                props: {
                                    caption: defaultCaption || '',
                                    tabs,
                                    activeTab: tab,
                                    actions,
                                    suggestedFilename: `release_log_${Date.now()}.txt`
                                }
                            }, layout.focusedColumn || 'center', 1);
                        }
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
        const isPrerelease = UpdateStore.getState().isPrerelease;
        return UpdateStore.getState()._runPreviewJob(repo, 'update/preview_bump', 'bump', 'No changes to release.', 'No changelog notes generated.', 'changelog', 'This is a dry run of the next release. If you proceed, the changelog will be committed and a new version tag will be pushed.', { prerelease: isPrerelease });
    },
    previewPublish: async (repo) => {
        return UpdateStore.getState()._runPreviewJob(repo, 'update/preview_publish', 'publish', 'No publish operations required.', 'N/A (Publish Phase)', 'full', 'This is a dry run of the publish phase. If you proceed, the package will be uploaded to the target distribution registry.');
    },
    fetchEligibleRepos: async () => {
        const state = UpdateStore.getState();
        if (state.isBackendMissing) return;
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('update')) return;
        try {
            const res = await window.inSetu.api.workspace.get('update/eligible_repos');
            if (res.status === 404) {
                UpdateStore.setState({ isBackendMissing: true });
                return;
            }
            if (res.ok) {
                const data = await res.json();
                const eligibility = data.eligibility || {};
                const currentRepo = UpdateStore.getState().targetRepo;
                const allRepos = window.inSetu.stores.App.getState().allRepos || [];
                const withToml = allRepos.filter(r => eligibility[r]);

                // Auto-select the first versioned repository to keep the visually reordered dropdown in sync.
                // If the current repo is unversioned, snap to the versioned one. The user can still manually re-select the unversioned repo later.
                const nextRepo = (!currentRepo || !allRepos.includes(currentRepo) || (!eligibility[currentRepo] && withToml.length > 0)) 
                    ? (withToml.length > 0 ? withToml[0] : (allRepos.length > 0 ? allRepos[0] : '')) 
                    : currentRepo;

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
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('update')) return;
        try {
            const res = await window.inSetu.api.workspace.get('system/config');
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
    _debouncedStatusFn: null,
    _statusEpoch: 0,
    clearPayload: () => {
        UpdateStore.setState(s => ({ _debouncedStatusFn: null, _statusEpoch: (s._statusEpoch || 0) + 1 }));
    },
    fetchRepoStatus: (repo, silent = false) => {
        if (!repo) return;
        const expectedWs = window.inSetu.utils.getActiveWorkspace();
        const expectedEpoch = UpdateStore.getState()._statusEpoch || 0;
        let debounced = UpdateStore.getState()._debouncedStatusFn;
        if (!debounced) {
            debounced = debounce(async (targetRepo, isSilent, originWs, originEpoch) => {
                if (window.inSetu.utils.getActiveWorkspace() !== originWs) return;
                if ((UpdateStore.getState()._statusEpoch || 0) !== originEpoch) return;
                UpdateStore.getState()._executeFetchRepoStatus(targetRepo, isSilent);
            }, 500);
            UpdateStore.setState({ _debouncedStatusFn: debounced });
        }
        debounced(repo, silent, expectedWs, expectedEpoch);
    },
    _executeFetchRepoStatus: async (repo, silent = false) => {
        if (!repo) return;
        const state = UpdateStore.getState();
        if (state.isBackendMissing) return;
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('update')) return;
        if (!silent) UpdateStore.setState({ repoLoading: true });
        try {
            const res = await window.inSetu.api.workspace.post('update/status', { repo });
            if (res.status === 404) {
                UpdateStore.setState({ isBackendMissing: true, repoLoading: false });
                return;
            }
            if (res.status === 202) {
                const data = await res.json();
                window.inSetu.utils.pollJob(data.job_id, {
                    onComplete: (statusData) => {
                        const versionStr = statusData.artifact.version || '';
                        const isExistingPrerelease = Boolean(versionStr && (versionStr.includes('-') || /[a-zA-Z]/.test(versionStr)));
                        UpdateStore.setState({ 
                            repoVersion: statusData.artifact.version, 
                            nextVersion: statusData.artifact.next_version || null,
                            hasPendingBump: statusData.artifact.has_pending_bump === true,
                            bumpReason: statusData.artifact.bump_reason || '',
                            repoConfigured: statusData.artifact.configured,
                            hasPyproject: statusData.artifact.has_pyproject !== false,
                            isClean: statusData.artifact.is_clean !== false,
                            hasRelease: statusData.artifact.has_release === true,
                            pypiPublished: statusData.artifact.pypi_published === true,
                            pypiPackageExists: statusData.artifact.pypi_package_exists === true,
                            packageName: statusData.artifact.package_name || '',
                            repoBuildCommand: statusData.artifact.build_command ?? 'python -m build',
                            repoPrereleaseToken: statusData.artifact.prerelease_token || 'rc',
                            repoCommitParser: statusData.artifact.commit_parser || 'conventional',
                            autoPublish: statusData.artifact.auto_publish === true,
                            repoVcsRelease: statusData.artifact.vcs_release !== false,
                            hasToken: statusData.artifact.has_token !== false,
                            hasPypiToken: statusData.artifact.has_pypi_token === true,
                            distributionTarget: statusData.artifact.distribution_target || 'python_pypi',
                            latestBuildArtifact: statusData.artifact.latest_build_artifact || null,
                            lastPublishTime: statusData.artifact.last_publish_time || 0,
                            isPrerelease: isExistingPrerelease,
                            repoLoading: false
                        });
                    },
                    onError: (err) => {
                        console.error("Status check failed:", err.message);
                        UpdateStore.setState({ repoLoading: false });
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                            window.inSetu.ui.setGlobalStatus(`Status Error: ${err.message}`, 5000, true);
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
                            window.inSetu.ui.setGlobalStatus(`Created basic TOML for ${repo}.`, 3000);
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
    updateTomlConfig: async (repo, buildCommand, vcsRelease, prereleaseToken, commitParser = null) => {
        if (!repo) return;
        try {
            const payload = { repo, build_command: buildCommand, vcs_release: vcsRelease, prerelease_token: prereleaseToken };
            if (commitParser !== null) payload.commit_parser = commitParser;
            const res = await window.inSetu.api.post('update/update_toml_config', payload);
            if (res.status === 202) {
                const data = await res.json();
                return new Promise((resolve, reject) => {
                    window.inSetu.utils.pollJob(data.job_id, {
                        onComplete: () => {
                            if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`Release config updated.`, 2000);
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
                    window.inSetu.ui.setGlobalStatus(`Distribution target updated.`, 2000);
                }
            } else {
                throw new Error("Failed to save setting.");
            }
        } catch(e) {
            alert(`Error saving setting: ${e.message}`);
        }
    },
    toggleAutoPublish: async (repo, enabled) => {
        if (!repo) return;
        try {
            const res = await window.inSetu.api.post(`update/settings?repo=${encodeURIComponent(repo)}`, {
                auto_publish: enabled
            });
            if (res.ok) {
                UpdateStore.setState({ autoPublish: enabled });
                if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus(`Auto-publish preference saved.`, 2000);
                }
            } else {
                throw new Error("Failed to save auto-publish setting.");
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
                            window.inSetu.ui.setGlobalStatus(`Version forced to v${version}.`, 3000);
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
    runManualBuild: async (repo, buildCommand) => {
        if (!repo) return;
        try {
            const res = await window.inSetu.api.post('update/manual_build', { repo, build_command: buildCommand });
            if (res.status === 202) {
                const data = await res.json();
                window.inSetu.utils.pollJob(data.job_id, {
                    onProgress: (msg) => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`${msg}`, null);
                    },
                    onComplete: (statusData) => {
                        if (window.inSetu.ui && window.inSetu.ui.setGlobalStatus) window.inSetu.ui.setGlobalStatus(`Manual build complete.`, 2000);
                        if (window.Sutram?.stores?.Layout) {
                            const layout = window.Sutram.stores.Layout.getState();
                            layout.openWindow({
                                id: 'update:preview',
                                component: 'sutram-report-projection',
                                label: 'Manual Build Log',
                                icon: 'terminal',
                                intent: 'neutral',
                                extName: 'update',
                                windowOnly: true,
                                props: {
                                    caption: 'Execution log output for the manual build action.',
                                    content: statusData.artifact.output || 'No output.',
                                    suggestedFilename: `build_log_${Date.now()}.txt`,
                                    actions: [
                                        { label: 'Close', icon: 'x', intent: 'neutral', onClick: () => layout.closeWindow('update:preview') }
                                    ]
                                }
                            }, layout.focusedColumn || 'center', 1);
                        }
                        UpdateStore.getState().fetchRepoStatus(repo);
                    },
                    onError: (err) => {
                        alert(`Build Error: ${err.message}`);
                        if (window.Sutram?.stores?.Layout) {
                            const layout = window.Sutram.stores.Layout.getState();
                            layout.openWindow({
                                id: 'update:preview',
                                component: 'sutram-report-projection',
                                label: 'Manual Build Log (Failed)',
                                icon: 'alert-triangle',
                                intent: 'danger',
                                extName: 'update',
                                windowOnly: true,
                                props: {
                                    caption: 'Execution log output for the failed manual build action.',
                                    content: err.message || 'No output.',
                                    suggestedFilename: `build_error_${Date.now()}.txt`,
                                    actions: [
                                        { label: 'Close', icon: 'x', intent: 'neutral', onClick: () => layout.closeWindow('update:preview') }
                                    ]
                                }
                            }, layout.focusedColumn || 'center', 1);
                        }
                        UpdateStore.getState().fetchRepoStatus(repo);
                    }
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
                            window.inSetu.ui.setGlobalStatus(`Successfully scaffolded versioning for ${repo}.`, 3000);
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
        nextVersion: { type: String },
        hasPendingBump: { type: Boolean },
        bumpReason: { type: String },
        repoLoading: { type: Boolean },
        repoConfigured: { type: Boolean },
        hasPyproject: { type: Boolean },
        isClean: { type: Boolean },
        hasRelease: { type: Boolean },
        pypiPublished: { type: Boolean },
        pypiPackageExists: { type: Boolean },
        packageName: { type: String },
        repoBuildCommand: { type: String },
        repoPrereleaseToken: { type: String },
        repoCommitParser: { type: String },
        autoPublish: { type: Boolean },
        repoVcsRelease: { type: Boolean },
        hasToken: { type: Boolean },
        hasPypiToken: { type: Boolean },
        distributionTarget: { type: String },
        lastReleaseLog: { type: String },
        allRepos: { type: Array },
        missingDependencies: { type: Array },
        missingBinaries: { type: Array },
        eligibleRepos: { type: Object },
        lastPublishTime: { type: Number },
        latestBuildArtifact: { type: String },
        isPrerelease: { type: Boolean }
    };
    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; width: 100%; overflow-y: auto; background: var(--bg); box-sizing: border-box; padding: 20px; }
    `];
    constructor() {
        super();
        this.targetRepo = '';
        this.repoVersion = null;
        this.nextVersion = null;
        this.hasPendingBump = false;
        this.bumpReason = '';
        this.repoLoading = false;
        this.repoConfigured = false;
        this.hasPyproject = true;
        this.isClean = true;
        this.hasRelease = false;
        this.pypiPackageExists = false;
        this.repoBuildCommand = 'python -m build';
        this.repoPrereleaseToken = 'rc';
        this.repoCommitParser = 'conventional';
        this.autoPublish = false;
        this.repoVcsRelease = true;
        this.hasToken = true;
        this.hasPypiToken = false;
        this.distributionTarget = 'python_pypi';
        this.allRepos = [];
        this.missingDependencies = [];
        this.missingBinaries = [];
        this.eligibleRepos = {};
        this.lastPublishTime = 0;
        this.latestBuildArtifact = null;
        this.isPrerelease = false;
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            UpdateStore,
            state => ({
                targetRepo: state.targetRepo || '',
                repoVersion: state.repoVersion,
                nextVersion: state.nextVersion,
                hasPendingBump: !!state.hasPendingBump,
                bumpReason: state.bumpReason || '',
                repoLoading: !!state.repoLoading,
                repoConfigured: state.repoConfigured,
                hasPyproject: state.hasPyproject !== false,
                isClean: state.isClean !== false,
                hasRelease: state.hasRelease === true,
                pypiPublished: state.pypiPublished === true,
                pypiPackageExists: state.pypiPackageExists === true,
                packageName: state.packageName || '',
                repoBuildCommand: state.repoBuildCommand ?? 'python -m build',
                repoPrereleaseToken: state.repoPrereleaseToken || 'rc',
                repoCommitParser: state.repoCommitParser || 'conventional',
                autoPublish: !!state.autoPublish,
                repoVcsRelease: state.repoVcsRelease !== false,
                hasToken: state.hasToken !== false,
                hasPypiToken: state.hasPypiToken === true,
                distributionTarget: state.distributionTarget || 'python_pypi',
                lastReleaseLog: state.lastReleaseLog || '',
                missingDependencies: state.missingDependencies || [],
                missingBinaries: state.missingBinaries || [],
                eligibleRepos: state.eligibleRepos || {},
                lastPublishTime: state.lastPublishTime || 0,
                latestBuildArtifact: state.latestBuildArtifact || null,
                isPrerelease: state.isPrerelease || false
            }),
            {
                autoFetch: () => {
                    if (this.targetRepo) UpdateStore.getState().fetchRepoStatus(this.targetRepo);
                    UpdateStore.getState().fetchEligibleRepos();
                    UpdateStore.getState().checkDependencies();
                },
                equalityFn: (a, b) => {
                    const previousRepo = this.targetRepo;
                    Object.assign(this, b);
                    if (this.targetRepo && this.targetRepo !== previousRepo) {
                        UpdateStore.getState().fetchRepoStatus(this.targetRepo);
                    }
                    return this.utils.shallowEqual(a, b);
                }
            }
        );
const initRepos = AppStore.getState()?.allRepos || this.ecosystem?.allRepos || [];
this.allRepos = initRepos;
if (!UpdateStore.getState().targetRepo && initRepos.length > 0) {
    this.targetRepo = initRepos[0];
    UpdateStore.setState({ targetRepo: initRepos[0] });
    UpdateStore.getState().fetchRepoStatus(initRepos[0]);
}

this.subscribe(
    AppStore,
    state => state.allRepos || [],
    (allRepos) => {
        this.allRepos = allRepos;
        if (!this.targetRepo && allRepos.length > 0) {
            UpdateStore.setState({ targetRepo: allRepos[0] });
        }
        this.requestUpdate();
    }
);

        this.registerGlobalListener('insetu:git:diffs-refreshed', window, () => {
            if (this.targetRepo) {
                UpdateStore.getState().fetchRepoStatus(this.targetRepo, true);
            }
        });
        this.registerGlobalListener('insetu:vfs-mutated', window, (e) => {
            if (this.targetRepo) {
                const mutations = e.detail?.mutations || [];
                const isRelevant = mutations.some(m => m.filepath && m.filepath.includes('pyproject.toml'));
                if (isRelevant) {
                    UpdateStore.getState().fetchRepoStatus(this.targetRepo, true);
                }
            }
        });
        this.registerGlobalListener('sutram-sync-complete', window, () => {
            if (this.targetRepo) {
                UpdateStore.getState().fetchRepoStatus(this.targetRepo, true);
            }
        });
        this.registerGlobalListener('insetu-update-settings-changed', window, () => {
            if (this.targetRepo) {
                UpdateStore.getState().fetchRepoStatus(this.targetRepo, true);
            }
        });
    }
    onWorkspaceLoad(workspaceId) {
        const repos = AppStore.getState()?.allRepos || this.ecosystem?.allRepos || [];
        this.allRepos = repos;
        const firstRepo = repos[0] || '';
        UpdateStore.setState({ targetRepo: firstRepo });
        super.onWorkspaceLoad(workspaceId);
    }

    onViewActivated() {
        const repos = AppStore.getState()?.allRepos || this.ecosystem?.allRepos || [];
        if (repos.length > 0 && this.allRepos.length === 0) {
            this.allRepos = repos;
        }
        if (!this.targetRepo && this.allRepos.length > 0) {
            UpdateStore.setState({ targetRepo: this.allRepos[0] });
        }
        if (this.targetRepo) {
            UpdateStore.getState().fetchRepoStatus(this.targetRepo);
        }
        UpdateStore.getState().fetchEligibleRepos();
        UpdateStore.getState().checkDependencies();
    }

    render() {
        return html`
            <div style="display: flex; flex-direction: column; height: 100%;">
                ${this.missingDependencies.length > 0 ? html`
                    <div style="background: var(--input-bg); border: 1px solid var(--intent-warning); border-radius: 4px; padding: 12px 15px; margin-bottom: 15px; display: flex; align-items: flex-start; gap: 10px;">
                        <yv-icon name="alert-triangle" style="width: 18px; height: 18px; color: var(--intent-warning); flex-shrink: 0; margin-top: 2px;"></yv-icon>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span style="font-weight: bold; color: var(--intent-warning); font-size: 0.95rem;">Missing Dependencies</span>
                            <span style="font-size: 0.85rem; color: var(--text);">Run the following command to install required Python packages:</span>
                            <code style="background: var(--bg); padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); font-family: var(--font-mono); font-size: 0.8rem; color: var(--text); user-select: all; margin-top: 4px;">pip install ${this.missingDependencies.join(' ')}</code>
                        </div>
                    </div>
                ` : ''}
                ${this.missingBinaries.length > 0 ? html`
                    <div style="background: var(--input-bg); border: 1px solid var(--intent-danger); border-radius: 4px; padding: 12px 15px; margin-bottom: 15px; display: flex; align-items: flex-start; gap: 10px;">
                        <yv-icon name="alert-octagon" style="width: 18px; height: 18px; color: var(--intent-danger); flex-shrink: 0; margin-top: 2px;"></yv-icon>
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
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-bottom: 20px;">
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
                                    label="Target Repository"
                                    style="margin-bottom: 0;"
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
                                    label="Target Repository"
                                    style="margin-bottom: 0;"
                                    .value=${this.targetRepo}
                                    .options=${options}
                                    @sutram-input-changed=${e => {
                                        if (e.detail.value !== '---') UpdateStore.setState({ targetRepo: e.detail.value });
                                    }}>
                                </sutram-select>
                            `;
                        }
                    })()}
                    <sutram-select 
                        label="Distribution Target"
                        style="margin-bottom: 0;"
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
                                    <span style="font-size: 0.75rem; color: var(--intent-warning); font-style: italic;">Local version configured, but no Git release tag has been established.</span>
                                    <sutram-btn size="sm" intent="primary" icon="tag" label="Tag and Sync Initial Version" style="align-self: flex-start;"
                                        @click=${() => {
                                            const ver = this.repoVersion || "0.1.0";
                                            if (confirm(`Establish and tag initial baseline release v${ver}?`)) {
                                                UpdateStore.getState().forceVersion(this.targetRepo, ver);
                                            }
                                        }}>
                                    </sutram-btn>
                                </div>
                            ` : ''}
                            ${!this.repoLoading && this.repoConfigured && this.hasPendingBump ? html`
                                <div style="margin-top: 10px; background: var(--bg); border: 1px solid var(--intent-success); border-radius: 4px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                                    <span style="font-size: 0.85rem; color: var(--intent-success); font-weight: bold; display: flex; align-items: center; gap: 6px;">
                                        <yv-icon name="rocket" style="width: 14px; height: 14px;"></yv-icon> <strong>Ready to Version & Update:</strong> Next Version is <code style="font-family: var(--font-mono); color: var(--text);">v${this.nextVersion}</code>
                                    </span>
                                    <sutram-async-btn 
                                        icon="zap"
                                        label="Bump to v${this.nextVersion}" 
                                        intent="success" 
                                        style="margin: 0; --btn-padding: 4px 10px; --btn-font-size: 0.8rem;"
                                        .onClick=${async () => await UpdateStore.getState().previewBump(this.targetRepo)}>
                                    </sutram-async-btn>
                                </div>
                            ` : ''}
                        </div>
                        ${!this.repoLoading && this.repoConfigured ? html`
                            <span style="font-size: 0.75rem; color: var(--intent-success); border: 1px solid var(--intent-success); padding: 2px 6px; border-radius: 10px; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;">
                                <yv-icon name="check-circle-2" style="width: 12px; height: 12px;"></yv-icon> Configured
                            </span>
                        ` : ''}
                    </div>
                    ${!this.repoLoading && !this.isClean && this.repoConfigured ? html`
                        <div style="background: var(--bg); border: 1px dashed var(--intent-warning); border-radius: 4px; padding: 8px 12px; margin-top: 10px; color: var(--intent-warning); font-size: 0.85rem; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px;">
                            <yv-icon name="alert-triangle" style="width: 14px; height: 14px; flex-shrink: 0;"></yv-icon>
                            <span>Working tree is not clean. Commit changes before releasing.</span>
                        </div>
                    ` : ''}
                    ${!this.repoLoading && !this.hasPyproject ? html`
                        <div style="background: var(--bg); border: 1px dashed var(--intent-warning); border-radius: 4px; padding: 8px 12px; margin-bottom: 10px; color: var(--intent-warning); font-size: 0.85rem; font-weight: bold; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                            <span>Missing pyproject.toml in this repository.</span>
                            <sutram-btn size="sm" intent="warning" icon="file-plus" label="Create Basic TOML and Tag"
                                @click=${() => {
                                    const initVer = prompt("Enter initial semantic version (e.g., 0.1.0):", "0.1.0");
                                    if (initVer) {
                                        UpdateStore.getState().createDummyToml(this.targetRepo, initVer.trim());
                                    }
                                }}>
                            </sutram-btn>
                            <span style="font-size: 0.7rem; font-weight: normal; font-style: italic; opacity: 0.9;">The TOML file will be initialized with Python build disabled to accommodate versioning for all project types. This action will also instantly create a Git tag to establish your baseline version. Update manually as needed.</span>
                        </div>
                    ` : ''}
                    ${!this.repoLoading && !this.repoConfigured ? html`
                        <sutram-btn size="sm" intent="success" icon="sparkles" label="Initialize Semantic Versioning" style="width: 100%; margin: 0;"
                            ?disabled=${!this.hasPyproject}
                            @click=${() => {
                                const initVer = prompt("Enter initial semantic version (e.g., 0.1.0):", "0.1.0");
                                if (initVer) {
                                    UpdateStore.getState().scaffoldRepo(this.targetRepo, initVer.trim());
                                }
                            }}>
                        </sutram-btn>
                    ` : ''}
                </div>
                ${!this.repoLoading && this.repoConfigured ? html`
                    <div style="padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <div style="display: flex; align-items: center; gap: 8px; opacity: ${!this.isClean ? '0.6' : '1'};">
                                <sutram-toggle .checked=${this.repoVcsRelease} ?disabled=${!this.isClean} ?flush=${true}
                                    @sutram-input-changed=${(e) => {
                                        UpdateStore.getState().updateTomlConfig(this.targetRepo, this.repoBuildCommand, e.detail.value, this.repoPrereleaseToken);
                                    }}></sutram-toggle>
                                <span style="font-size: 0.85rem; font-weight: bold; color: var(--text);">Release via GitHub API (<code>vcs_release</code>)</span>
                            </div>
                            ${this.repoVcsRelease && !this.hasToken ? html`
                                <div style="color: var(--intent-warning); font-size: 0.75rem; margin-left: 24px; display: flex; align-items: center; gap: 6px;">
                                    <yv-icon name="alert-triangle" style="width: 12px; height: 12px; flex-shrink: 0;"></yv-icon>
                                    <span>No GitHub API token detected in secrets or environment. Local tag/push will succeed, but API release card creation will fail.</span>
                                </div>
                            ` : ''}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            <div style="display: flex; align-items: center; gap: 8px; opacity: ${!this.isClean ? '0.6' : '1'};">
                                <sutram-toggle .checked=${!!this.repoBuildCommand} ?disabled=${!this.isClean} ?flush=${true}
                                    @sutram-input-changed=${(e) => {
                                        const enabled = e.detail.value;
                                        const cmd = enabled ? (this.repoBuildCommand || 'python -m build') : '';
                                        UpdateStore.getState().updateTomlConfig(this.targetRepo, cmd, this.repoVcsRelease, this.repoPrereleaseToken);
                                    }}></sutram-toggle>
                                <span style="font-size: 0.85rem; font-weight: bold; color: var(--text);">Trigger Build Command on Bump</span>
                            </div>
                            ${this.repoBuildCommand ? html`
                                <div style="display: flex; gap: 8px; margin-left: 24px; margin-top: 4px; opacity: ${!this.isClean ? '0.6' : '1'};">
                                    <sutram-input 
                                        style="flex: 1; margin-bottom: 0; --bg-input: var(--bg);"
                                        .value=${this.repoBuildCommand}
                                        ?disabled=${!this.isClean}
                                        placeholder="e.g., python -m build"
                                        @sutram-input-changed=${(e) => {
                                            UpdateStore.setState({ repoBuildCommand: e.detail.value });
                                        }}>
                                    </sutram-input>
                                    <sutram-async-btn 
                                        icon="save"
                                        label="Save" 
                                        intent="success" 
                                        ?disabled=${!this.isClean}
                                        style="margin: 0; --btn-padding: 8px 12px; --btn-font-size: 0.85rem;"
                                        .onClick=${async () => {
                                            await UpdateStore.getState().updateTomlConfig(this.targetRepo, this.repoBuildCommand, this.repoVcsRelease, this.repoPrereleaseToken);
                                        }}>
                                    </sutram-async-btn>
                                    <sutram-async-btn 
                                        icon="play"
                                        label="Run Manually" 
                                        intent="neutral" 
                                        style="margin: 0; --btn-padding: 8px 12px; --btn-font-size: 0.85rem;"
                                        .onClick=${async () => {
                                            await UpdateStore.getState().runManualBuild(this.targetRepo, this.repoBuildCommand);
                                        }}>
                                    </sutram-async-btn>
                                </div>
                            ` : ''}
                            <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 24px;">Executed by Semantic Release before tagging. Changes are committed to <code>pyproject.toml</code> natively.</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; border-top: 1px dashed var(--border); padding-top: 10px; margin-top: 4px;">
                            <sutram-select
                                label="Commit Parser Convention"
                                ?flush=${true}
                                ?disabled=${!this.isClean}
                                .value=${this.repoCommitParser || 'conventional'}
                                .options=${[
                                    { value: 'conventional', label: 'Conventional Commits (Angular)' },
                                    { value: 'emoji', label: 'Emoji (Gitmoji)' },
                                    { value: 'scipy', label: 'SciPy' }
                                ]}
                                @sutram-input-changed=${(e) => {
                                    UpdateStore.setState({ repoCommitParser: e.detail.value });
                                    UpdateStore.getState().updateTomlConfig(this.targetRepo, this.repoBuildCommand, this.repoVcsRelease, this.repoPrereleaseToken, e.detail.value);
                                }}>
                            </sutram-select>
                            <div style="display: flex; align-items: center; padding-top: 18px;">
                                <sutram-toggle
                                    label="Auto-Publish after Bump"
                                    ?flush=${true}
                                    .checked=${this.autoPublish}
                                    @sutram-input-changed=${(e) => {
                                        UpdateStore.getState().toggleAutoPublish(this.targetRepo, e.detail.value);
                                    }}>
                                </sutram-toggle>
                            </div>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed var(--border); padding-top: 10px; margin-top: 4px;">
                            <span style="font-size: 0.85rem; font-weight: bold; color: var(--text);">Default Pre-release Token (<code>prerelease_token</code>)</span>
                            <div style="display: flex; gap: 8px; opacity: ${!this.isClean ? '0.6' : '1'}; align-items: center;">
                                <sutram-input 
                                    style="width: 180px; margin-bottom: 0; --bg-input: var(--bg);"
                                    .value=${this.repoPrereleaseToken || 'rc'}
                                    ?disabled=${!this.isClean}
                                    placeholder="e.g., rc, beta, alpha"
                                    @sutram-input-changed=${(e) => {
                                        UpdateStore.setState({ repoPrereleaseToken: e.detail.value });
                                    }}>
                                </sutram-input>
                                <sutram-async-btn 
                                    icon="save"
                                    label="Save Token" 
                                    intent="success" 
                                    ?disabled=${!this.isClean}
                                    style="margin: 0; --btn-padding: 8px 12px; --btn-font-size: 0.85rem;"
                                    .onClick=${async () => {
                                        await UpdateStore.getState().updateTomlConfig(this.targetRepo, this.repoBuildCommand, this.repoVcsRelease, this.repoPrereleaseToken);
                                    }}>
                                </sutram-async-btn>
                            </div>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Token identifier used when Pre-release Mode is toggled ON (e.g., <code>beta</code> produces <code>v1.0.0-beta.1</code>).</span>
                        </div>
                    </div>

                    <div style="padding: 15px; background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 15px;">
                        <!-- Step 1 Column -->
                        <div style="flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 6px;">
                            <sutram-async-btn 
                                style="width: 100%;" 
                                icon="package"
                                label="${this.hasPendingBump ? 'Step 1: Bump to v' + this.nextVersion : 'Step 1: Bump & Tag'}" 
                                intent="${this.hasPendingBump ? 'success' : 'primary'}" 
                                ?disabled=${!this.repoConfigured || !this.isClean}
                                .onClick=${async () => await UpdateStore.getState().previewBump(this.targetRepo)}>
                            </sutram-async-btn>
                            <sutram-toggle 
                                .checked=${this.isPrerelease} 
                                ?disabled=${!this.repoConfigured || !this.isClean}
                                ?flush=${true}
                                @sutram-input-changed=${e => UpdateStore.setState({ isPrerelease: e.detail.value })} 
                                label="Pre-release Mode (e.g., -${this.repoPrereleaseToken || 'rc'}.1)"
                                style="margin-top: 4px;">
                            </sutram-toggle>
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-align: left; line-height: 1.3; margin-top: 4px;">
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
                            ${(() => {
                                let buildMismatch = false;
                                if (this.distributionTarget === 'python_pypi' && this.repoBuildCommand && this.repoVersion) {
                                    const normalizeVer = (v) => (v || '').toLowerCase()
                                        .replace(/-?beta\.?/g, 'b')
                                        .replace(/-?alpha\.?/g, 'a')
                                        .replace(/-?rc\.?/g, 'rc')
                                        .replace(/[^a-z0-9]/g, '');

                                    const normArtifact = normalizeVer(this.latestBuildArtifact);
                                    const normVersion = normalizeVer(this.repoVersion);

                                    if (!this.latestBuildArtifact || !normArtifact.includes(normVersion)) {
                                        buildMismatch = true;
                                    }
                                }
                                const isFirstReleasePhase = this.distributionTarget === 'python_pypi' ? !this.pypiPackageExists : !this.hasRelease;
                                const step2Disabled = !this.repoConfigured || (isFirstReleasePhase && !this.isClean) || (this.distributionTarget === 'python_pypi' && !this.hasPypiToken) || this.distributionTarget === 'disabled' || buildMismatch;
                                const buildLabel = this.latestBuildArtifact ? html`<span style="font-size: 0.75rem; color: var(--intent-success); font-family: var(--font-mono); justify-content: center; display: flex; align-items: center; gap: 6px; margin-top: 4px;"><yv-icon name="package" style="width: 12px; height: 12px;"></yv-icon> Active Artifact: ${this.latestBuildArtifact}</span>` : '';
                                const mismatchLabel = buildMismatch ? html`<span style="font-size: 0.75rem; color: var(--intent-warning); font-style: italic; text-align: center; display: block; margin-top: 4px;">Build artifact missing or version mismatch. Ensure Step 1 succeeded.</span>` : '';
                                if (isFirstReleasePhase) {
                                    return html`
                                        <sutram-async-btn 
                                            style="width: 100%;" 
                                            icon="${this.distributionTarget === 'python_pypi' ? 'send' : 'tag'}"
                                            label="${this.distributionTarget === 'python_pypi' ? 'Publish v' + (this.repoVersion || '0.1.0') + ' to PyPI' : 'Release v' + (this.repoVersion || '0.1.0') + ' to VCS'}" 
                                            intent="highlight" 
                                            ?disabled=${step2Disabled}
                                            .disabled=${step2Disabled}
                                            .onClick=${async () => {
                                                if (step2Disabled) return;
                                                await UpdateStore.getState().previewFirstRelease(this.targetRepo);
                                            }}>
                                        </sutram-async-btn>
                                        ${buildLabel}
                                        ${mismatchLabel}
                                    `;
                                } else {
                                    return html`
                                        <sutram-async-btn 
                                            style="width: 100%;" 
                                            icon="${this.distributionTarget === 'disabled' ? 'ban' : 'send'}"
                                            label="${this.distributionTarget === 'python_pypi' ? 'Step 2: Publish Release' : (this.distributionTarget === 'disabled' ? 'Publishing Disabled' : 'Step 2: Push VCS Release')}" 
                                            intent="highlight" 
                                            ?disabled=${step2Disabled}
                                            .disabled=${step2Disabled}
                                            .onClick=${async () => {
                                                if (step2Disabled) return;
                                                await UpdateStore.getState().previewPublish(this.targetRepo);
                                            }}>
                                        </sutram-async-btn>
                                        ${buildLabel}
                                        ${mismatchLabel}
                                    `;
                                }
                            })()}
                            ${this.distributionTarget === 'python_pypi' && !this.hasPypiToken ? html`
                                <span style="font-size: 0.75rem; color: var(--intent-warning); font-style: italic; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 4px;">
                                    <yv-icon name="alert-triangle" style="width: 12px; height: 12px; flex-shrink: 0;"></yv-icon>
                                    <span>API token is missing. Please configure 'PyPI Distribution Token' in Workspace Settings.</span>
                                </span>
                            ` : ''}
                            ${this.lastPublishTime > 0 && this.distributionTarget === 'python_pypi' && !this.pypiPublished && ((Date.now() / 1000) - this.lastPublishTime < 3600) ? html`
                                <div style="font-size: 0.75rem; color: var(--intent-highlight); font-weight: bold; text-align: left; line-height: 1.3; background: var(--bg); padding: 8px 10px; border-radius: 4px; border: 1px solid var(--intent-highlight); margin-top: 2px; display: flex; align-items: center; gap: 6px;">
                                    <yv-icon name="clock" style="width: 14px; height: 14px; flex-shrink: 0;"></yv-icon>
                                    <span>Publish dispatched <strong>${this.utils.timeAgo(this.lastPublishTime * 1000)}</strong>. PyPI indexing may take several minutes before it reflects here.</span>
                                </div>
                            ` : ''}
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-align: left; line-height: 1.3; margin-top: 4px;">
                                ${(this.distributionTarget === 'python_pypi' ? !this.pypiPackageExists : !this.hasRelease) 
                                    ? (this.distributionTarget === 'python_pypi' 
                                        ? `Initial release pipeline: validates package assets, builds wheels, uploads to PyPI, and establishes v${this.repoVersion || '0.1.0'} baseline.` 
                                        : `Initial release pipeline: establishes v${this.repoVersion || '0.1.0'} Git baseline tags.`)
                                    : html`<strong>Phase 2 (External Distribution):</strong>
                                        <ol style="margin: 4px 0 0 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px;">
                                            ${this.distributionTarget === 'python_pypi' ? html`<li>Uploads compiled package files to PyPI.</li>` : ''}
                                            ${this.distributionTarget !== 'disabled' ? html`<li>Mints the official GitHub Release card UI with notes.</li>` : html`<li>External distribution is disabled in settings.</li>`}
                                        </ol>`}
                            </div>
                        </div>
                    </div>
                ` : ''}
                ${this.lastReleaseLog ? html`
                    <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                        <sutram-btn size="sm" intent="neutral" icon="eye" label="View Last Release Log"
                            @click=${() => {
                                if (window.Sutram?.stores?.Layout) {
                                    const layout = window.Sutram.stores.Layout.getState();
                                    layout.openWindow({
                                        id: 'update:preview',
                                        component: 'sutram-report-projection',
                                        label: 'Release Execution Log',
                                        icon: 'file-text',
                                        intent: 'neutral',
                                        extName: 'update',
                                        windowOnly: true,
                                        props: {
                                            caption: 'Execution log output for the previous release action.',
                                            content: this.lastReleaseLog,
                                            suggestedFilename: `release_log_${Date.now()}.txt`,
                                            actions: [
                                                { label: 'Close', icon: 'x', intent: 'neutral', onClick: () => layout.closeWindow('update:preview') }
                                            ]
                                        }
                                    }, layout.focusedColumn || 'center', 1);
                                }
                            }}>
                        </sutram-btn>
                    </div>
                ` : ''}
            </div>
        `;
    }
}
customElements.define('insetu-ext-update', InSetuExtUpdate);
window.ExtensionRegistry.registerExtension('update', {
    name: "Semantic Update",
    version: "1.0.0",
    offline_mode: "none",
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "ctrl",
            id: "update",
            label: "Update",
            icon: "arrow-up-circle",
            intent: "success",
            order: 4,
            component: "insetu-ext-update"
        }
    ]
});