import { html } from 'lit';
import { createExtensionStore, InSetuElement, sharedStyles, debounce } from '/static/extensions/system/insetu_sdk.js';

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
        const res = await window.inSetu.api.post(endpoint, { repo, ...extraPayload });
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
                                const postRes = await window.inSetu.api.post(`update/${ep}`, { repo, ...extra });
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
            const res = await window.inSetu.api.get('update/eligible_repos');
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
            const res = await window.inSetu.api.get('system/config');
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
            const res = await window.inSetu.api.post('update/status', { repo });
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
    static styles = [sharedStyles];
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
            <sutram-view>
                <sutram-stack direction="col" gap="md">
                ${this.missingDependencies.length > 0 ? html`
                    <sutram-surface variant="tinted" intent="warning" padding="md">
                        <sutram-stack direction="row" justify="between" align="center" gap="md" ?wrap=${true}>
                            <sutram-stack direction="row" align="start" gap="sm">
                                <sutram-icon name="alert-triangle" size="md" intent="warning"></sutram-icon>
                                <sutram-stack direction="col" gap="xs">
                                    <strong>Missing Dependencies</strong>
                                    <sutram-label text="Install required Python packages into the active daemon environment:"></sutram-label>
                                    <code>pip install ${this.missingDependencies.join(' ')}</code>
                                </sutram-stack>
                            </sutram-stack>
                            <sutram-async-btn
                                ?compact=${true}
                                intent="primary"
                                icon="download"
                                label="Install Missing Packages"
                                .onClick=${this.installExtensionDependencies('update', async () => {
                                    await UpdateStore.getState().checkDependencies();
                                    if (this.targetRepo) UpdateStore.getState().fetchRepoStatus(this.targetRepo);
                                })}>
                            </sutram-async-btn>
                        </sutram-stack>
                    </sutram-surface>
                ` : ''}
                ${this.missingBinaries.length > 0 ? html`
                    <sutram-surface variant="tinted" intent="danger" padding="md">
                        <sutram-stack direction="row" align="start" gap="sm">
                            <sutram-icon name="alert-octagon" size="md" intent="danger"></sutram-icon>
                            <sutram-stack direction="col" gap="xs">
                                <strong>Missing System Binaries</strong>
                                <sutram-label text="The following required system binaries are missing from your host environment:"></sutram-label>
                                <code>${this.missingBinaries.join(', ')}</code>
                            </sutram-stack>
                        </sutram-stack>
                    </sutram-surface>
                ` : ''}
                <sutram-surface variant="ghost" border="bottom" padding="sm">
                    <h3>Semantic Update</h3>
                    <sutram-label text="Automated semantic versioning and package distribution pipeline."></sutram-label>
                </sutram-surface>
                <sutram-stack direction="grid" gap="md">
                    ${(() => {
                        const withToml = this.allRepos.filter(r => this.eligibleRepos[r]);
                        const withoutToml = this.allRepos.filter(r => !this.eligibleRepos[r]);
                        const options = [
                            ...withToml.map(r => ({ value: r, label: r })),
                            ...(withToml.length > 0 && withoutToml.length > 0 ? [{ value: '---', label: '──────────' }] : []),
                            ...withoutToml.map(r => ({ value: r, label: r }))
                        ];
                        return html`
                            <sutram-select 
                                label="Target Repository"
                                ?flush=${true}
                                .value=${this.targetRepo}
                                .options=${options}
                                @sutram-input-changed=${e => {
                                    if (e.detail.value !== '---') UpdateStore.setState({ targetRepo: e.detail.value });
                                }}>
                            </sutram-select>
                        `;
                    })()}
                    <sutram-select 
                        label="Distribution Target"
                        ?flush=${true}
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
                </sutram-stack>

                <sutram-surface variant="panel" padding="md" gap="md">
                    <sutram-stack direction="row" justify="between" align="center">
                        <sutram-stack direction="col" gap="xs">
                            <sutram-label text="Current Version"></sutram-label>
                            <sutram-stack direction="row" align="center" gap="sm">
                                <code>${this.repoLoading ? 'refreshing repo state...' : (this.repoVersion ? `v${this.repoVersion}` : 'Unversioned')}</code>
                                ${!this.repoLoading && this.repoConfigured ? html`
                                    <sutram-btn ?compact=${true} variant="tinted" intent="warning" label="Force Override" title="Force version override"
                                        @click=${() => {
                                            const newVer = prompt("Force version override to (e.g., 0.5.0):", this.repoVersion || "0.1.0");
                                            if (newVer) {
                                                UpdateStore.getState().forceVersion(this.targetRepo, newVer.trim());
                                            }
                                        }}>
                                    </sutram-btn>
                                ` : ''}
                            </sutram-stack>
                            ${!this.repoLoading && this.repoConfigured && !this.hasRelease ? html`
                                <sutram-stack direction="col" align="start" gap="xs">
                                    <sutram-label text="Local version configured, but no Git release tag has been established."></sutram-label>
                                    <sutram-btn ?compact=${true} intent="primary" icon="tag" label="Tag and Sync Initial Version"
                                        @click=${() => {
                                            const ver = this.repoVersion || "0.1.0";
                                            if (confirm(`Establish and tag initial baseline release v${ver}?`)) {
                                                UpdateStore.getState().forceVersion(this.targetRepo, ver);
                                            }
                                        }}>
                                    </sutram-btn>
                                </sutram-stack>
                            ` : ''}
                            ${!this.repoLoading && this.repoConfigured && this.hasPendingBump ? html`
                                <sutram-surface variant="tinted" intent="success" padding="sm">
                                    <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                        <sutram-stack direction="row" align="center" gap="xs">
                                            <sutram-icon name="rocket" size="sm" intent="success"></sutram-icon>
                                            <strong>Ready to Version & Update: Next Version is <code>v${this.nextVersion}</code></strong>
                                        </sutram-stack>
                                        <sutram-async-btn 
                                            ?compact=${true}
                                            icon="zap"
                                            label="Bump to v${this.nextVersion}" 
                                            intent="success" 
                                            .onClick=${async () => await UpdateStore.getState().previewBump(this.targetRepo)}>
                                        </sutram-async-btn>
                                    </sutram-stack>
                                </sutram-surface>
                            ` : ''}
                        </sutram-stack>
                        ${!this.repoLoading && this.repoConfigured ? html`
                            <sutram-tag text="✓ Configured" intent="success"></sutram-tag>
                        ` : ''}
                    </sutram-stack>
                    ${!this.repoLoading && !this.isClean && this.repoConfigured ? html`
                        <sutram-surface variant="tinted" intent="warning" padding="xs">
                            <sutram-stack direction="row" align="center" justify="center" gap="xs">
                                <sutram-icon name="alert-triangle" size="sm" intent="warning"></sutram-icon>
                                <strong>Working tree is not clean. Commit changes before releasing.</strong>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}
                    ${!this.repoLoading && !this.hasPyproject ? html`
                        <sutram-surface variant="tinted" intent="warning" padding="sm" gap="xs">
                            <sutram-stack direction="col" align="center" gap="xs">
                                <strong>Missing pyproject.toml in this repository.</strong>
                                <sutram-btn ?compact=${true} intent="warning" icon="file-plus" label="Create Basic TOML and Tag"
                                    @click=${() => {
                                        const initVer = prompt("Enter initial semantic version (e.g., 0.1.0):", "0.1.0");
                                        if (initVer) {
                                            UpdateStore.getState().createDummyToml(this.targetRepo, initVer.trim());
                                        }
                                    }}>
                                </sutram-btn>
                                <sutram-label text="The TOML file will be initialized with Python build disabled to accommodate versioning for all project types. This action will also instantly create a Git tag to establish your baseline version."></sutram-label>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}
                    ${!this.repoLoading && !this.repoConfigured ? html`
                        <sutram-btn ?compact=${true} intent="success" icon="sparkles" label="Initialize Semantic Versioning" ?fullWidth=${true}
                            ?disabled=${!this.hasPyproject}
                            @click=${() => {
                                const initVer = prompt("Enter initial semantic version (e.g., 0.1.0):", "0.1.0");
                                if (initVer) {
                                    UpdateStore.getState().scaffoldRepo(this.targetRepo, initVer.trim());
                                }
                            }}>
                        </sutram-btn>
                    ` : ''}
                </sutram-surface>

                ${!this.repoLoading && this.repoConfigured ? html`
                    <sutram-surface variant="panel" padding="md" gap="md">
                        <sutram-stack direction="col" gap="xs">
                            <sutram-toggle
                                label="Release via GitHub API (vcs_release)"
                                .checked=${this.repoVcsRelease}
                                ?disabled=${!this.isClean}
                                ?flush=${true}
                                @sutram-input-changed=${(e) => {
                                    UpdateStore.getState().updateTomlConfig(this.targetRepo, this.repoBuildCommand, e.detail.value, this.repoPrereleaseToken);
                                }}>
                            </sutram-toggle>
                            ${this.repoVcsRelease && !this.hasToken ? html`
                                <sutram-stack direction="row" align="center" gap="xs">
                                    <sutram-icon name="alert-triangle" size="sm" intent="warning"></sutram-icon>
                                    <sutram-label text="No GitHub API token detected in secrets or environment. Local tag/push will succeed, but API release card creation will fail."></sutram-label>
                                </sutram-stack>
                            ` : ''}
                        </sutram-stack>

                        <sutram-stack direction="col" gap="xs">
                            <sutram-toggle
                                label="Trigger Build Command on Bump"
                                .checked=${!!this.repoBuildCommand}
                                ?disabled=${!this.isClean}
                                ?flush=${true}
                                @sutram-input-changed=${(e) => {
                                    const enabled = e.detail.value;
                                    const cmd = enabled ? (this.repoBuildCommand || 'python -m build') : '';
                                    UpdateStore.getState().updateTomlConfig(this.targetRepo, cmd, this.repoVcsRelease, this.repoPrereleaseToken);
                                }}>
                            </sutram-toggle>
                            ${this.repoBuildCommand ? html`
                                <sutram-stack direction="row" align="center" gap="sm" ?wrap=${true}>
                                    <sutram-input 
                                        ?flush=${true}
                                        ?grow=${true}
                                        .value=${this.repoBuildCommand}
                                        ?disabled=${!this.isClean}
                                        placeholder="e.g., python -m build"
                                        @sutram-input-changed=${(e) => {
                                            UpdateStore.setState({ repoBuildCommand: e.detail.value });
                                        }}>
                                    </sutram-input>
                                    <sutram-async-btn 
                                        ?compact=${true}
                                        icon="save"
                                        label="Save" 
                                        intent="success" 
                                        ?disabled=${!this.isClean}
                                        .onClick=${async () => {
                                            await UpdateStore.getState().updateTomlConfig(this.targetRepo, this.repoBuildCommand, this.repoVcsRelease, this.repoPrereleaseToken);
                                        }}>
                                    </sutram-async-btn>
                                    <sutram-async-btn 
                                        ?compact=${true}
                                        icon="play"
                                        label="Run Manually" 
                                        intent="neutral" 
                                        .onClick=${async () => {
                                            await UpdateStore.getState().runManualBuild(this.targetRepo, this.repoBuildCommand);
                                        }}>
                                    </sutram-async-btn>
                                </sutram-stack>
                            ` : ''}
                            <sutram-label text="Executed by Semantic Release before tagging. Changes are committed to pyproject.toml natively."></sutram-label>
                        </sutram-stack>

                        <sutram-surface variant="ghost" border="top" padding="xs">
                            <sutram-stack direction="grid" gap="md">
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
                                <sutram-toggle
                                    label="Auto-Publish after Bump"
                                    ?flush=${true}
                                    .checked=${this.autoPublish}
                                    @sutram-input-changed=${(e) => {
                                        UpdateStore.getState().toggleAutoPublish(this.targetRepo, e.detail.value);
                                    }}>
                                </sutram-toggle>
                            </sutram-stack>
                        </sutram-surface>

                        <sutram-surface variant="ghost" border="top" padding="xs" gap="xs">
                            <strong>Default Pre-release Token (<code>prerelease_token</code>)</strong>
                            <sutram-stack direction="row" align="center" gap="sm">
                                <sutram-input 
                                    ?flush=${true}
                                    .value=${this.repoPrereleaseToken || 'rc'}
                                    ?disabled=${!this.isClean}
                                    placeholder="e.g., rc, beta, alpha"
                                    @sutram-input-changed=${(e) => {
                                        UpdateStore.setState({ repoPrereleaseToken: e.detail.value });
                                    }}>
                                </sutram-input>
                                <sutram-async-btn 
                                    ?compact=${true}
                                    icon="save"
                                    label="Save Token" 
                                    intent="success" 
                                    ?disabled=${!this.isClean}
                                    .onClick=${async () => {
                                        await UpdateStore.getState().updateTomlConfig(this.targetRepo, this.repoBuildCommand, this.repoVcsRelease, this.repoPrereleaseToken);
                                    }}>
                                </sutram-async-btn>
                            </sutram-stack>
                            <sutram-label text="Token identifier used when Pre-release Mode is toggled ON (e.g., beta produces v1.0.0-beta.1)."></sutram-label>
                        </sutram-surface>
                    </sutram-surface>

                    <sutram-surface variant="panel" padding="md">
                        <sutram-stack direction="grid" gap="md">
                        <!-- Step 1 Column -->
                        <sutram-stack direction="col" gap="xs">
                            <sutram-async-btn 
                                ?fullWidth=${true} 
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
                                label="Pre-release Mode (e.g., -${this.repoPrereleaseToken || 'rc'}.1)">
                            </sutram-toggle>
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-align: left; line-height: 1.3; margin-top: 4px;">
                                <strong>Phase 1 (Code & Git Preparation):</strong>
                                <ol style="margin: 4px 0 0 0; padding-left: 18px;">
                                    <li>Analyzes commit logs (<code>feat:</code>, <code>fix:</code>) to pick next version.</li>
                                    <li>Updates version in <code>pyproject.toml</code> & generates <code>CHANGELOG.md</code>.</li>
                                    <li>Triggers build command (e.g. <code>python -m build</code>) to make wheels.</li>
                                    <li>Commits, tags (<code>vX.Y.Z</code>), and pushes directly to GitHub via SSH.</li>
                                </ol>
                            </div>
                        </sutram-stack>
                        <!-- Step 2 Column -->
                        <sutram-stack direction="col" gap="xs">
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
                                const buildLabel = this.latestBuildArtifact ? html`<sutram-stack direction="row" align="center" justify="center" gap="xs"><sutram-icon name="package" size="sm" intent="success"></sutram-icon><code>Active Artifact: ${this.latestBuildArtifact}</code></sutram-stack>` : '';
                                const mismatchLabel = buildMismatch ? html`<sutram-label text="Build artifact missing or version mismatch. Ensure Step 1 succeeded."></sutram-label>` : '';
                                if (isFirstReleasePhase) {
                                    return html`
                                        <sutram-async-btn 
                                            ?fullWidth=${true} 
                                            icon="${this.distributionTarget === 'python_pypi' ? 'send' : 'tag'}"
                                            label="${this.distributionTarget === 'python_pypi' ? 'Publish v' + (this.repoVersion || '0.1.0') + ' to PyPI' : 'Release v' + (this.repoVersion || '0.1.0') + ' to VCS'}" 
                                            intent="highlight" 
                                            ?disabled=${step2Disabled}
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
                                            ?fullWidth=${true} 
                                            icon="${this.distributionTarget === 'disabled' ? 'ban' : 'send'}"
                                            label="${this.distributionTarget === 'python_pypi' ? 'Step 2: Publish Release' : (this.distributionTarget === 'disabled' ? 'Publishing Disabled' : 'Step 2: Push VCS Release')}" 
                                            intent="highlight" 
                                            ?disabled=${step2Disabled}
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
                                <sutram-stack direction="row" align="center" justify="center" gap="xs">
                                    <sutram-icon name="alert-triangle" size="sm" intent="warning"></sutram-icon>
                                    <sutram-label text="API token is missing. Please configure 'PyPI Distribution Token' in Workspace Settings."></sutram-label>
                                </sutram-stack>
                            ` : ''}
                            ${this.lastPublishTime > 0 && this.distributionTarget === 'python_pypi' && !this.pypiPublished && ((Date.now() / 1000) - this.lastPublishTime < 3600) ? html`
                                <sutram-surface variant="tinted" intent="highlight" padding="xs">
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        <sutram-icon name="clock" size="sm" intent="highlight"></sutram-icon>
                                        <span>Publish dispatched <strong>${this.utils.timeAgo(this.lastPublishTime * 1000)}</strong>. PyPI indexing may take several minutes before it reflects here.</span>
                                    </sutram-stack>
                                </sutram-surface>
                            ` : ''}
                            <div style="font-size: 0.75rem; color: var(--text-muted); text-align: left; line-height: 1.3; margin-top: 4px;">
                                ${(this.distributionTarget === 'python_pypi' ? !this.pypiPackageExists : !this.hasRelease) 
                                    ? (this.distributionTarget === 'python_pypi' 
                                        ? `Initial release pipeline: validates package assets, builds wheels, uploads to PyPI, and establishes v${this.repoVersion || '0.1.0'} baseline.` 
                                        : `Initial release pipeline: establishes v${this.repoVersion || '0.1.0'} Git baseline tags.`)
                                    : html`<strong>Phase 2 (External Distribution):</strong>
                                        <ol style="margin: 4px 0 0 0; padding-left: 18px;">
                                            ${this.distributionTarget === 'python_pypi' ? html`<li>Uploads compiled package files to PyPI.</li>` : ''}
                                            ${this.distributionTarget !== 'disabled' ? html`<li>Mints the official GitHub Release card UI with notes.</li>` : html`<li>External distribution is disabled in settings.</li>`}
                                        </ol>`}
                            </div>
                        </sutram-stack>
                        </sutram-stack>
                    </sutram-surface>
                ` : ''}
                ${this.lastReleaseLog ? html`
                    <sutram-stack direction="row" justify="end">
                        <sutram-btn ?compact=${true} intent="neutral" icon="eye" label="View Last Release Log"
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
                    </sutram-stack>
                ` : ''}
                </sutram-stack>
            </sutram-view>
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