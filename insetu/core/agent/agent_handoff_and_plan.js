/**
 * Context Budget Floating HUD, External Web-Chat Handoff Panel, and Multi-Step Plan Stepper components for Agent Chat.
 */
import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { AgentStore } from '/static/extensions/agent/agent_store.js';

export function estimateFileTokensFromState(filepath, tier, fileTokenMap) {
    if (!filepath) return 0;
    const mapVal = fileTokenMap?.[filepath];
    if (Number(mapVal) > 0) return Number(mapVal);
    const activeBuffers = window.inSetu?.stores?.Fs?.getState?.()?.activeBuffers || {};
    const buf = activeBuffers[filepath];
    if (buf && typeof buf.content === 'string' && buf.content !== 'Loading...') {
        const fullTok = Math.max(1, Math.round(buf.content.length / 4));
        return tier === 'reference' ? Math.max(40, Math.round(fullTok * 0.2)) : fullTok;
    }
    const wsRaw = AgentStore.getState()?.workingSetRaw || [];
    const entry = wsRaw.find(x => x && x.filepath === filepath);
    if (entry && Number(entry.tokens) > 0) return Number(entry.tokens);
    return tier === 'constitution' ? 450 : (tier === 'reference' ? 200 : 800);
}

export function estimateWorkingSetTokensFromComponent(comp) {
    const rawConst = Array.from(new Set(comp.constitutionFiles || []));
    const explicitFiles = [...(comp.pinnedFiles || []), ...(comp.referenceFiles || [])];
    if (comp.activePlanPath) explicitFiles.push(comp.activePlanPath);
    const activeRepos = new Set(explicitFiles.map(fp => new comp.utils.InSetuURI(fp).repo).filter(Boolean));
    const globalPins = comp.ecosystem?.pinnedRepos;
    if (globalPins && !globalPins.has('ALL')) globalPins.forEach(r => activeRepos.add(r));
    const filtered = activeRepos.size === 0 ? rawConst : rawConst.filter(fp => activeRepos.has(new comp.utils.InSetuURI(fp).repo));
    const scopedConstitution = filtered.length > 0 ? filtered : rawConst;
    const cTokens = scopedConstitution.reduce((acc, fp) => acc + estimateFileTokensFromState(fp, 'constitution', comp.fileTokenMap), 0);
    const rTokens = (comp.referenceFiles || []).reduce((acc, fp) => acc + estimateFileTokensFromState(fp, 'reference', comp.fileTokenMap), 0);
    const pTokens = (comp.pinnedFiles || []).reduce((acc, fp) => acc + estimateFileTokensFromState(fp, 'pinned', comp.fileTokenMap), 0);
    const promptTokens = Math.round((comp.promptInput || '').length / 4);
    return {
        scopedConstitution,
        constitution: cTokens,
        references: rTokens,
        pinned: pTokens,
        prompt: promptTokens,
        total: cTokens + rTokens + pTokens + promptTokens
    };
}

export class InSetuAgentContextHud extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        constitutionFiles: { type: Array },
        referenceFiles: { type: Array },
        pinnedFiles: { type: Array },
        fileTokenMap: { type: Object },
        tokenLedger: { type: Object },
        activeNodeName: { type: String },
        tokenEst: { type: Object },
        _hudExpanded: { type: Boolean, state: true }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.constitutionFiles = [];
        this.referenceFiles = [];
        this.pinnedFiles = [];
        this.fileTokenMap = {};
        this.tokenLedger = {};
        this.activeNodeName = 'next turn';
        this.tokenEst = { scopedConstitution: [], constitution: 0, references: 0, pinned: 0, prompt: 0, total: 0 };
        this._hudExpanded = false;
    }

    _estimateFileTokens(filepath, tier = 'pinned') {
        return estimateFileTokensFromState(filepath, tier, this.fileTokenMap);
    }

    _formatContextPillLabel(filepath, tier, tokCount) {
        const uri = new this.utils.InSetuURI(filepath);
        const icon = tier === 'constitution' ? '📜' : (tier === 'reference' ? '🔒' : '✏️');
        const numTok = Number(tokCount || 0);
        const tokStr = numTok >= 1000 ? `${(numTok / 1000).toFixed(1)}k` : `${numTok}`;
        return `${icon} ${uri.basename} · ${tokStr}`;
    }

    render() {
        const tEst = this.tokenEst || { scopedConstitution: [], constitution: 0, references: 0, pinned: 0, total: 0 };
        const scopedConstitution = tEst.scopedConstitution || [];
        const modelMaxContext = Number(this.tokenLedger?.model_context_length || 200000);
        const softCeiling = Number(this.tokenLedger?.context_soft_ceiling || Math.round(modelMaxContext * 0.75));
        const contextFillRatio = tEst.total / modelMaxContext;
        const tokenIntent = contextFillRatio > 0.90 ? 'danger' : (contextFillRatio > 0.75 ? 'warning' : 'success');
        const totalContextFiles = scopedConstitution.length + (this.referenceFiles?.length || 0) + (this.pinnedFiles?.length || 0);
        const compactTokStr = tEst.total >= 1000 ? `${(tEst.total / 1000).toFixed(1)}k` : `${tEst.total}`;
        const byTier = this.tokenLedger?.by_tier || {};
        const totalCostUsd = Number(this.tokenLedger?.total_cost_usd || 0);
        const budgetLimitUsd = Number(this.tokenLedger?.budget_limit_usd || 1.0);
        const budgetStepUsd = Number(this.tokenLedger?.budget_step_usd || 1.0);
        const pinnedFiltered = (this.pinnedFiles || []).filter(f => !scopedConstitution.includes(f));
        const refFiltered = (this.referenceFiles || []).filter(f => !scopedConstitution.includes(f));
        const activeTiers = Object.entries(byTier).filter(([, info]) => info && info.calls > 0);
        const fmtK = (n) => Number(n || 0) >= 1000 ? `${(Number(n) / 1000).toFixed(1)}k` : `${Number(n || 0)}`;

        return html`
            <sutram-floating-hud
                position="top-right"
                icon="database"
                .badgeText=${`~${compactTokStr}${totalContextFiles > 0 ? ` (${totalContextFiles})` : ''}`}
                .titleText=${`Context: ~${compactTokStr} / ${(softCeiling / 1000).toFixed(0)}k tok (${Math.round(contextFillRatio * 100)}%)`}
                .intent=${tokenIntent}
                .open=${this._hudExpanded}
                @sutram-hud-toggled=${(e) => { this._hudExpanded = e.detail.open; }}>
                <sutram-tag slot="header" .text=${tokenIntent === 'danger' ? '>90%' : (tokenIntent === 'warning' ? '>75%' : 'OK')} .intent=${tokenIntent}></sutram-tag>
                <sutram-stack direction="col" gap="xs">
                    <sutram-surface variant="inset" padding="xs" gap="xs">
                        <sutram-stack direction="row" justify="between" align="center" gap="xs">
                            <sutram-label ?truncate=${true} .text=${`Working Set (→ ${this.activeNodeName || 'next turn'})`}></sutram-label>
                            <sutram-tag .text=${`~${compactTokStr} tok`} .intent=${tokenIntent}></sutram-tag>
                        </sutram-stack>
                        <sutram-label .text=${`Full ${fmtK(tEst.pinned)} · Slices ${fmtK(tEst.references)} · Const ${fmtK(tEst.constitution)}`}></sutram-label>
                        ${totalContextFiles > 0 ? html`
                            <sutram-stack direction="col" gap="xs">
                                ${pinnedFiltered.length > 0 ? html`
                                    <sutram-collapsible
                                        ?compact=${true}
                                        intent="primary"
                                        ?open=${pinnedFiltered.length <= 5}
                                        .titleText=${`✏️ Pinned Full (${pinnedFiltered.length} · ~${fmtK(tEst.pinned)} tok)`}>
                                        <sutram-stack direction="row" gap="xs" ?wrap=${true} padding="xs">
                                            ${pinnedFiltered.map(f => html`
                                                <sutram-pill
                                                    ?compact=${true}
                                                    labelText=${this._formatContextPillLabel(f, 'pinned', this._estimateFileTokens(f, 'pinned'))}
                                                    pillId=${f}
                                                    title="${f} — Tier 2 Pinned Edit Target (Tap to demote to Slice, Shift+Tap to remove)"
                                                    ?active=${true}
                                                    @sutram-pill-toggled=${(e) => {
                                                        if (e.detail?.originalEvent?.shiftKey) {
                                                            AgentStore.setState({ pinnedFiles: this.pinnedFiles.filter(x => x !== f) });
                                                        } else {
                                                            AgentStore.setState({
                                                                pinnedFiles: this.pinnedFiles.filter(x => x !== f),
                                                                referenceFiles: [...this.referenceFiles, f]
                                                            });
                                                        }
                                                    }}>
                                                </sutram-pill>
                                            `)}
                                        </sutram-stack>
                                    </sutram-collapsible>
                                ` : ''}
                                ${refFiltered.length > 0 ? html`
                                    <sutram-collapsible
                                        ?compact=${true}
                                        intent="highlight"
                                        ?open=${false}
                                        .titleText=${`🔒 Reference Slices (${refFiltered.length} · ~${fmtK(tEst.references)} tok)`}>
                                        <sutram-stack direction="row" gap="xs" ?wrap=${true} padding="xs">
                                            ${refFiltered.map(f => html`
                                                <sutram-pill
                                                    ?compact=${true}
                                                    labelText=${this._formatContextPillLabel(f, 'reference', this._estimateFileTokens(f, 'reference'))}
                                                    pillId=${f}
                                                    title="${f} — Tier 1 Reference Slice (Tap to promote to Full, Shift+Tap to remove)"
                                                    ?active=${false}
                                                    @sutram-pill-toggled=${(e) => {
                                                        if (e.detail?.originalEvent?.shiftKey) {
                                                            AgentStore.setState({ referenceFiles: this.referenceFiles.filter(x => x !== f) });
                                                        } else {
                                                            AgentStore.setState({
                                                                referenceFiles: this.referenceFiles.filter(x => x !== f),
                                                                pinnedFiles: [...this.pinnedFiles, f]
                                                            });
                                                        }
                                                    }}>
                                                </sutram-pill>
                                            `)}
                                        </sutram-stack>
                                    </sutram-collapsible>
                                ` : ''}
                                ${scopedConstitution.length > 0 ? html`
                                    <sutram-collapsible
                                        ?compact=${true}
                                        intent="neutral"
                                        ?open=${false}
                                        .titleText=${`📜 Auto Constitution (${scopedConstitution.length} · ~${fmtK(tEst.constitution)} tok)`}>
                                        <sutram-stack direction="row" gap="xs" ?wrap=${true} padding="xs">
                                            ${scopedConstitution.map(f => html`
                                                <sutram-pill
                                                    ?compact=${true}
                                                    labelText=${this._formatContextPillLabel(f, 'constitution', this._estimateFileTokens(f, 'constitution'))}
                                                    pillId=${f}
                                                    title=${`${f} — Tier 0 Auto-Pinned Constitution`}
                                                    ?active=${true}>
                                                </sutram-pill>
                                            `)}
                                        </sutram-stack>
                                    </sutram-collapsible>
                                ` : ''}
                            </sutram-stack>
                        ` : html`<sutram-label text="Working set empty. Use [+] below to attach files."></sutram-label>`}
                    </sutram-surface>

                    <sutram-surface variant="inset" padding="xs" gap="xs">
                        <sutram-stack direction="row" justify="between" align="center" gap="xs">
                            <strong>Session Spend</strong>
                            <sutram-tag .text=${`~$${totalCostUsd.toFixed(3)} / $${budgetLimitUsd.toFixed(2)} (+$${budgetStepUsd.toFixed(2)})`} intent=${totalCostUsd >= budgetLimitUsd ? 'warning' : 'highlight'}></sutram-tag>
                        </sutram-stack>
                        <sutram-label .text=${`${fmtK(this.tokenLedger?.prompt_tokens || 0)} in / ${fmtK(this.tokenLedger?.completion_tokens || 0)} out · ~${fmtK(this.tokenLedger?.saved_by_slicing ?? this.tokenLedger?.saved_by_slicing_tokens ?? 0)} saved`}></sutram-label>
                        ${activeTiers.length > 0 ? html`
                            <sutram-collapsible ?compact=${true} ?open=${false} intent="neutral" .titleText=${`Spend by Tier (${activeTiers.length})`}>
                                <sutram-stack direction="col" gap="xs" padding="xs">
                                    ${activeTiers.map(([tierKey, info]) => html`
                                        <sutram-stack direction="row" justify="between" align="center" gap="xs">
                                            <sutram-tag .text=${tierKey} intent="neutral"></sutram-tag>
                                            <sutram-label ?monospace=${true} .text=${`${info.calls}x · ${fmtK(info.prompt_tokens)}/${fmtK(info.completion_tokens)} · ~$${Number(info.cost_usd || 0).toFixed(4)}`}></sutram-label>
                                        </sutram-stack>
                                    `)}
                                </sutram-stack>
                            </sutram-collapsible>
                        ` : ''}
                    </sutram-surface>
                </sutram-stack>
            </sutram-floating-hud>
        `;
    }
}
if (!customElements.get('insetu-agent-context-hud')) {
    customElements.define('insetu-agent-context-hud', InSetuAgentContextHud);
}

export async function ensureAgentSessionTelemetryCompiled(comp, { latestTurnOnly = false } = {}) {
    const activeSesId = AgentStore.getState()?.activeSessionId || comp?.pendingHandoff?.session_id || undefined;
    comp.setStatus(latestTurnOnly ? '⏳ Compiling Latest Turn Telemetry...' : '⏳ Compiling AI Telemetry context...', null);
    const res = await comp.api.postJson('bridge/compile_telemetry', {
        limit: 40,
        session_id: activeSesId,
        latest_turn_only: latestTurnOnly
    });
    if (window.inSetu?.sys?.refreshManifest) await window.inSetu.sys.refreshManifest();
    const defaultUri = latestTurnOnly ? 'ctx://contexts/ai_latest_turn_telemetry.txt' : 'ctx://contexts/ai_telemetry_context.txt';
    const uri = res?.context_uri || defaultUri;
    const chunks = Array.isArray(res?.chunks) && res.chunks.length > 0 ? res.chunks : [uri];
    if (latestTurnOnly) {
        comp._warmLatestTurnTelemetryUri = uri;
        comp._warmLatestTurnTelemetryChunks = chunks;
    } else {
        comp._warmTelemetryUri = uri;
        comp._warmTelemetryChunks = chunks;
    }
    if (comp.vfs?.preWarmShareArtifact) {
        await comp.vfs.preWarmShareArtifact(uri, chunks, false).catch(() => {});
    }
    return { res, uri, chunks };
}

export function buildAgentTelemetryMenuItems(comp) {
    return [
        {
            label: '📋 Copy Latest Turn Telemetry (.txt)',
            icon: 'clipboard',
            onClick: async () => {
                try {
                    const { uri } = await ensureAgentSessionTelemetryCompiled(comp, { latestTurnOnly: true });
                    if (comp.vfs?.fetchAndCopy) await comp.vfs.fetchAndCopy(uri);
                    comp.setStatus('📊 Copied Latest Turn Telemetry!', 3000);
                } catch (err) {
                    comp.setStatus(`⚠️ Latest turn telemetry failed: ${err.message}`, 4000, true);
                }
            }
        },
        {
            label: '📤 Share Latest Turn Telemetry (.txt)',
            icon: 'share',
            onClick: async () => {
                try {
                    const { uri, chunks } = await ensureAgentSessionTelemetryCompiled(comp, { latestTurnOnly: true });
                    if (comp.vfs?.shareFiles) {
                        await comp.vfs.shareFiles(uri, chunks, false);
                    }
                } catch (err) {
                    comp.setStatus(`⚠️ Latest turn telemetry share failed: ${err.message}`, 4000, true);
                }
            }
        },
        {
            label: '⬇️ Download Latest Turn Telemetry (.txt)',
            icon: 'download',
            onClick: async () => {
                try {
                    const { uri } = await ensureAgentSessionTelemetryCompiled(comp, { latestTurnOnly: true });
                    if (comp.vfs?.fetchAndDownloadState) {
                        await comp.vfs.fetchAndDownloadState(uri);
                    }
                } catch (err) {
                    comp.setStatus(`⚠️ Latest turn telemetry download failed: ${err.message}`, 4000, true);
                }
            }
        },
        {
            label: '📋 Copy Full AI Telemetry (.txt)',
            icon: 'clipboard',
            onClick: async () => {
                try {
                    const { res, uri } = await ensureAgentSessionTelemetryCompiled(comp, { latestTurnOnly: false });
                    if (comp.vfs?.fetchAndCopy) await comp.vfs.fetchAndCopy(uri);
                    comp.setStatus(`📊 Copied Full AI Telemetry (${res?.turn_dossiers || 0} turn(s), ${res?.llm_calls || 0} LLM calls)!`, 3500);
                } catch (err) {
                    comp.setStatus(`⚠️ Telemetry compile failed: ${err.message}`, 4000, true);
                }
            }
        },
        {
            label: '📤 Share Full AI Telemetry (.txt)',
            icon: 'share',
            onClick: async () => {
                try {
                    if (comp._warmTelemetryUri && comp.vfs?.shareFiles) {
                        await comp.vfs.shareFiles(comp._warmTelemetryUri, comp._warmTelemetryChunks, false);
                        return;
                    }
                    const { uri, chunks } = await ensureAgentSessionTelemetryCompiled(comp, { latestTurnOnly: false });
                    if (comp.vfs?.shareFiles) {
                        await comp.vfs.shareFiles(uri, chunks, false);
                    }
                } catch (err) {
                    comp.setStatus(`⚠️ Telemetry share failed: ${err.message}`, 4000, true);
                }
            }
        },
        {
            label: '⬇️ Download Full AI Telemetry (.txt)',
            icon: 'download',
            onClick: async () => {
                try {
                    const { uri } = await ensureAgentSessionTelemetryCompiled(comp, { latestTurnOnly: false });
                    if (comp.vfs?.fetchAndDownloadState) {
                        await comp.vfs.fetchAndDownloadState(uri);
                    }
                } catch (err) {
                    comp.setStatus(`⚠️ Telemetry download failed: ${err.message}`, 4000, true);
                }
            }
        },
        {
            label: '📤 Share Session Dossiers (.zip)',
            icon: 'share',
            onClick: async () => {
                const activeSesId = AgentStore.getState()?.activeSessionId || comp?.pendingHandoff?.session_id || undefined;
                comp.setStatus('⏳ Building Session Telemetry .zip...', null);
                try {
                    const res = await comp.api.postJson('bridge/telemetry_zip', {
                        limit: 40,
                        session_id: activeSesId
                    });
                    if (res?.zip_base64) {
                        const bytes = Uint8Array.from(atob(res.zip_base64), c => c.charCodeAt(0));
                        const fname = res.filename || 'session_telemetry.zip';
                        const fileObj = new File([bytes], fname, { type: 'application/zip' });
                        const shared = comp.utils.nativeShareFiles ? await comp.utils.nativeShareFiles([fileObj]) : false;
                        if (!shared) {
                            comp.utils.downloadBlob(new Blob([bytes], { type: 'application/zip' }), fname);
                            comp.setStatus(`📦 Downloaded ${fname}!`, 3000);
                        } else {
                            comp.setStatus(`📤 Shared ${fname}!`, 3000);
                        }
                    }
                } catch (err) {
                    comp.setStatus(`⚠️ Telemetry ZIP share failed: ${err.message}`, 4000, true);
                }
            }
        },
        {
            label: '📦 Download Session Dossiers (.zip)',
            icon: 'package',
            onClick: async () => {
                const activeSesId = AgentStore.getState()?.activeSessionId || comp?.pendingHandoff?.session_id || undefined;
                comp.setStatus('⏳ Building Session Telemetry .zip...', null);
                try {
                    const res = await comp.api.postJson('bridge/telemetry_zip', {
                        limit: 40,
                        session_id: activeSesId
                    });
                    if (res?.zip_base64) {
                        const bytes = Uint8Array.from(atob(res.zip_base64), c => c.charCodeAt(0));
                        const blob = new Blob([bytes], { type: 'application/zip' });
                        comp.utils.downloadBlob(blob, res.filename || 'session_telemetry.zip');
                        comp.setStatus(`📦 Downloaded ${res.filename || 'session_telemetry.zip'}!`, 3000);
                    }
                } catch (err) {
                    comp.setStatus(`⚠️ Telemetry ZIP failed: ${err.message}`, 4000, true);
                }
            }
        }
    ];
}

export class InSetuAgentHandoffPanel extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        pendingHandoff: { type: Object },
        routines: { type: Array },
        agentRoutineId: { type: String },
        webChatWindowMode: { type: String },
        handoffBranchIdx: { type: Number },
        handoffBranchResponses: { type: Object },
        promptInput: { type: String },
        totalTokensEst: { type: Number },
        onSendPrompt: { attribute: false }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.pendingHandoff = null;
        this.routines = [];
        this.agentRoutineId = 'workspace_turn';
        this.webChatWindowMode = 'same_window';
        this.handoffBranchIdx = 0;
        this.handoffBranchResponses = {};
        this.promptInput = '';
        this.totalTokensEst = 0;
        this.onSendPrompt = null;
        this._warmTelemetryUri = '';
        this._warmTelemetryChunks = null;
    }

    render() {
        const ph = this.pendingHandoff?.pending_handoff;
        if (!ph) return html``;
        const branches = Array.isArray(ph.branches) && ph.branches.length > 0 ? ph.branches : [ph];
        const safeIdx = Math.min(this.handoffBranchIdx || 0, branches.length - 1);
        const activeBranch = branches[safeIdx] || ph;
        const routineObj = (this.routines || []).find(r => r.id === (this.pendingHandoff.routine_id || this.agentRoutineId));
        const displayTitle = this.pendingHandoff.routine_title || activeBranch.routine_title || routineObj?.title || routineObj?.name || this.pendingHandoff.routine_id || 'Routine';
        const deltaMeta = activeBranch.delta_meta || {};
        const hasPriorWindowState = Number(deltaMeta.unchanged_count || 0) > 0;
        const isSameWindow = this.webChatWindowMode === 'same_window';
        const wfCtxUri = (isSameWindow && hasPriorWindowState && activeBranch.delta_context_uri)
            ? activeBranch.delta_context_uri
            : (activeBranch.full_context_uri || activeBranch.workflow_context_uri || '');
        const fmtTok = (n) => {
            const num = Number(n || 0);
            return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : `${num}`;
        };
        const ctxBtnLabel = (isSameWindow && hasPriorWindowState)
            ? (Number(deltaMeta.changed_count || 0) === 0
                ? 'Context (0 Δ)'
                : `Delta (+${deltaMeta.changed_count} · ~${fmtTok(deltaMeta.delta_tokens)})`)
            : `Full Context (~${fmtTok(deltaMeta.full_tokens || this.totalTokensEst || 0)})`;
        const promptToCopy = activeBranch.prompt_text || activeBranch.compiled_prompt || '';

        return html`
            <sutram-surface variant="tinted" intent="warning" border="top" padding="sm" gap="xs">
                <sutram-stack direction="row" justify="between" align="center" gap="xs">
                    <sutram-stack direction="row" align="center" gap="xs">
                        <sutram-icon name="zap" size="sm" intent="warning"></sutram-icon>
                        <sutram-label
                            ?truncate=${true}
                            title=${`External LLM Handoff • ${displayTitle} (${activeBranch.node_id})`}
                            .text=${`Handoff • ${activeBranch.node_id}`}>
                        </sutram-label>
                        ${activeBranch.tier ? html`<sutram-tag text=${activeBranch.tier} intent="warning"></sutram-tag>` : ''}
                    </sutram-stack>
                    <sutram-pill
                        ?compact=${true}
                        labelText=${isSameWindow ? '🪟 Same Window (Δ)' : '🆕 New Window (Full)'}
                        title="Click to toggle between Same Chat Window (packs only new/changed context) and New Chat Window (packs all context)"
                        ?active=${isSameWindow}
                        @sutram-pill-toggled=${() => {
                            AgentStore.setState({ webChatWindowMode: isSameWindow ? 'new_window' : 'same_window' });
                        }}>
                    </sutram-pill>
                </sutram-stack>
                <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                    ${wfCtxUri ? (() => {
                        const manifestChunks = this.vfs?.getChunks ? this.vfs.getChunks(wfCtxUri) : [];
                        const fallbackChunks = (isSameWindow && hasPriorWindowState && activeBranch.delta_context_chunks)
                            ? activeBranch.delta_context_chunks
                            : (activeBranch.full_context_chunks || [wfCtxUri]);
                        const chunks = (manifestChunks && manifestChunks.length > 0 && !(manifestChunks.length === 1 && manifestChunks[0] === wfCtxUri && fallbackChunks.length > 1))
                            ? manifestChunks
                            : fallbackChunks;
                        const ctxEntityData = {
                            filepath: wfCtxUri, isFS: false, chunks,
                            suppress: ['file-edit', 'file-browse', 'file-view', 'file-window']
                        };
                        const menuItems = this.utils.getDropdownEntityActions(
                            'file:context',
                            ctxEntityData,
                            a => !a.bulkOnly && ['file-copy', 'file-download', 'file-share', 'file-view-parts'].includes(a.id)
                        );
                        return html`
                            <sutram-dropdown align="left" direction="up" .items=${menuItems}>
                                <sutram-btn
                                    slot="trigger"
                                    ?compact=${true}
                                    intent=${isSameWindow && hasPriorWindowState && Number(deltaMeta.changed_count || 0) === 0 ? 'success' : 'highlight'}
                                    icon="package"
                                    label=${ctxBtnLabel}>
                                </sutram-btn>
                            </sutram-dropdown>
                        `;
                    })() : ''}
                    ${(() => {
                        const promptItems = this.utils.getDropdownEntityActions('text_blob', {
                            textContent: promptToCopy || '',
                            suggestedFilename: `prompt_${activeBranch.node_id || 'handoff'}.md`,
                            suppress: ['blob-save-vfs']
                        });
                        return html`
                            <sutram-dropdown align="left" direction="up" .items=${promptItems}>
                                <sutram-btn
                                    slot="trigger"
                                    ?compact=${true}
                                    intent="primary"
                                    icon="file-text"
                                    label="Prompt + Directives">
                                </sutram-btn>
                            </sutram-dropdown>
                        `;
                    })()}
                    <sutram-dropdown
                        align="left"
                        direction="up"
                        .items=${buildAgentTelemetryMenuItems(this)}>
                        <sutram-btn
                            slot="trigger"
                            ?compact=${true}
                            intent="neutral"
                            icon="activity"
                            label="Telemetry">
                        </sutram-btn>
                    </sutram-dropdown>
                </sutram-stack>
                ${activeBranch.budget_warning ? html`
                    <sutram-collapsible
                        ?compact=${true}
                        ?open=${false}
                        intent="warning"
                        .titleText=${"Budget & Context Window Notice (tap for details)"}>
                        <sutram-surface variant="inset" intent="warning" padding="xs">
                            <sutram-label intent="warning" ?multiline=${true} .text=${activeBranch.budget_warning}></sutram-label>
                        </sutram-surface>
                    </sutram-collapsible>
                ` : ''}
                ${branches.length > 1 ? html`
                    <sutram-stack direction="row" gap="xs" ?wrap=${true}>
                        ${branches.map((b, bIdx) => {
                            const isDone = Boolean((this.handoffBranchResponses?.[b.node_id] || '').trim());
                            return html`
                                <sutram-btn
                                    ?compact=${true}
                                    intent=${bIdx === safeIdx ? 'warning' : (isDone ? 'success' : 'neutral')}
                                    ?active=${bIdx === safeIdx}
                                    label="${isDone ? '●' : '○'} Step ${bIdx + 1}: ${b.node_id}"
                                    @click=${() => { AgentStore.setState({ handoffBranchIdx: bIdx }); }}>
                                </sutram-btn>
                            `;
                        })}
                    </sutram-stack>
                ` : ''}
                <sutram-textarea
                    ?compact=${true}
                    placeholder=${`Paste LLM reply for "${activeBranch.node_id}" (prose & patches split automatically)...`}
                    .value=${this.promptInput}
                    ?flush=${true}
                    @sutram-input-changed=${e => AgentStore.setState({ promptInput: e.detail.value })}>
                </sutram-textarea>
                <sutram-action-bar collapse="sm" align="between">
                    <sutram-btn
                        intent="warning"
                        icon="message-square"
                        label="Menu"
                        title="Toggle Conversations & Yomama Surfaces (Bridge, Chat, Routines, Receipts)"
                        @click=${() => this.dispatch('insetu:yomama:toggle-drawer')}>
                    </sutram-btn>
                    <sutram-btn
                        intent="neutral"
                        icon="x"
                        label="Cancel"
                        title="Cancel Handoff"
                        @click=${() => {
                            const activeSesId = AgentStore.getState()?.activeSessionId || this.pendingHandoff?.session_id;
                            AgentStore.setState({ promptInput: '', pendingHandoff: null, handoffBranchIdx: 0, handoffBranchResponses: {} });
                            if (activeSesId) {
                                this.api.post('agent/cancel', { session_id: activeSesId }).catch(() => {});
                            }
                        }}>
                    </sutram-btn>
                    <sutram-async-btn
                        label="Ingest Reply & Continue"
                        icon="corner-down-left"
                        intent="warning"
                        ?grow=${true}
                        .onClick=${() => this.onSendPrompt && this.onSendPrompt()}>
                    </sutram-async-btn>
                </sutram-action-bar>
            </sutram-surface>
        `;
    }
}
if (!customElements.get('insetu-agent-handoff-panel')) {
    customElements.define('insetu-agent-handoff-panel', InSetuAgentHandoffPanel);
}

export class InSetuAgentPlanStepper extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        activePlan: { type: Object },
        activePlanPath: { type: String },
        sessionId: { type: String },
        stagedTaskActions: { type: Array }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.activePlan = null;
        this.activePlanPath = '';
        this.sessionId = '';
        this.stagedTaskActions = [];
    }

    async _applyStagedTaskActions(actionsToApply, startNext = true) {
        if (!this.sessionId || !Array.isArray(actionsToApply) || actionsToApply.length === 0) return;
        const res = await this.api.postJson('agent/plan_task', {
            session_id: this.sessionId,
            action: 'apply_task_actions',
            task_actions: actionsToApply
        }).catch(() => null);
        if (!res?.active_plan) return;
        const nextTask = res.next_task;
        AgentStore.setState(s => ({
            activePlan: res.active_plan,
            pinnedFiles: Array.isArray(nextTask?.targets) && nextTask.targets.length > 0 ? nextTask.targets : s.pinnedFiles
        }));
        this.dispatchEvent(new CustomEvent('insetu-clear-task-actions', { bubbles: true, composed: true }));
        if (startNext && nextTask) {
            AgentStore.setState(s => ({
                agentMode: 'code',
                agentRoutineId: 'code',
                pinnedFiles: Array.isArray(nextTask.targets) && nextTask.targets.length > 0 ? nextTask.targets : s.pinnedFiles,
                promptInput: `Execute [${nextTask.id}]: ${nextTask.description}`
            }));
            this.dispatchEvent(new CustomEvent('insetu-start-next-plan-step', { bubbles: true, composed: true }));
        }
    }

    async _completeTask(startNextTurn = true, taskId = null) {
        if (!this.sessionId) return;
        const res = await this.api.postJson('agent/plan_task', {
            session_id: this.sessionId,
            action: 'complete_and_advance',
            task_id: taskId || undefined
        }).catch(() => null);
        if (!res || !res.active_plan) return;
        const nextTask = res.next_task;
        AgentStore.setState({
            activePlan: res.active_plan,
            pinnedFiles: Array.isArray(nextTask?.targets) && nextTask.targets.length > 0 ? nextTask.targets : AgentStore.getState().pinnedFiles
        });
        if (startNextTurn && nextTask) {
            AgentStore.setState(s => ({
                agentMode: 'code',
                agentRoutineId: 'code',
                pinnedFiles: Array.isArray(nextTask.targets) && nextTask.targets.length > 0 ? nextTask.targets : s.pinnedFiles,
                promptInput: `Execute [${nextTask.id}]: ${nextTask.description}`
            }));
            this.dispatchEvent(new CustomEvent('insetu-start-next-plan-step', { bubbles: true, composed: true }));
        } else if (!nextTask) {
            this.setStatus('🎉 All steps in the execution plan are complete!', 3500);
        }
    }

    async _promoteToPlanFile() {
        if (!this.sessionId) return;
        const res = await this.api.postJson('agent/plan_task', {
            session_id: this.sessionId,
            action: 'promote_to_file'
        }).catch(() => null);
        if (res?.status === 'success') {
            AgentStore.setState({
                activePlanPath: res.plan_filepath || '',
                activePlan: res.active_plan || this.activePlan
            });
            this.setStatus(`📄 Promoted plan to ${res.plan_filepath}`, 3500);
        }
    }

    render() {
        const plan = this.activePlan;
        const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
        if (tasks.length === 0 && !this.activePlanPath) return html``;
        const doneCount = tasks.filter(t => t.completed).length;
        const activeId = plan?.active_task_id;
        const activeTask = tasks.find(t => t.id === activeId) || tasks.find(t => !t.completed) || null;
        const nextAfterActive = activeTask
            ? tasks.find(t => !t.completed && t.id !== activeTask.id)
            : null;
        const filePath = plan?.plan_filepath || this.activePlanPath || '';
        const pendingCommitTx = plan?.pending_commit_tx || '';
        const stagedActs = Array.isArray(this.stagedTaskActions) ? this.stagedTaskActions : [];
        const canCompleteNow = Boolean(pendingCommitTx || activeTask?.kind === 'explore' || activeTask?.kind === 'verify');

        return html`
            <sutram-surface variant="inset" intent="highlight" padding="xs" gap="xs">
                <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                    <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                        <sutram-icon name="list-checks" size="xs" intent="highlight"></sutram-icon>
                        <strong>Plan (${doneCount}/${tasks.length})</strong>
                        ${activeTask ? html`<sutram-tag .text=${`Active: ${activeTask.id}`} intent="warning"></sutram-tag>` : ''}
                        ${activeTask ? html`<sutram-label .text=${activeTask.description}></sutram-label>` : ''}
                    </sutram-stack>
                    <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                        ${stagedActs.map(act => html`
                            <sutram-async-btn
                                ?compact=${true}
                                intent=${act.op === 'complete' ? 'success' : 'highlight'}
                                icon=${act.op === 'complete' ? 'check-circle-2' : 'plus-circle'}
                                label=${act.op === 'complete' ? `✓ Mark [${act.task_id}] Complete` : (act.op === 'add' ? `+ Add Task [${act.task_id}]` : `${act.op}: ${act.task_id}`)}
                                .onClick=${() => this._applyStagedTaskActions([act], act.op === 'complete')}>
                            </sutram-async-btn>
                        `)}
                        ${canCompleteNow && activeTask && nextAfterActive ? html`
                            <sutram-async-btn
                                ?compact=${true}
                                intent="success"
                                icon="check-circle-2"
                                label=${`${pendingCommitTx ? `✓ Mark [${activeTask.id}] Done (${pendingCommitTx}) & Start [${nextAfterActive.id}]` : `✓ Mark [${activeTask.id}] Done & Start [${nextAfterActive.id}]`}`}
                                .onClick=${() => this._completeTask(true, activeTask.id)}>
                            </sutram-async-btn>
                        ` : ''}
                        ${canCompleteNow && activeTask ? html`
                            <sutram-async-btn
                                ?compact=${true}
                                intent=${nextAfterActive ? 'neutral' : 'success'}
                                icon="check"
                                label=${`Mark [${activeTask.id}] Complete`}
                                .onClick=${() => this._completeTask(false, activeTask.id)}>
                            </sutram-async-btn>
                        ` : ''}
                        ${plan?.recommend_file_upgrade && !filePath ? html`
                            <sutram-async-btn
                                ?compact=${true}
                                intent="warning"
                                icon="file-plus"
                                label="Upgrade to Plan File"
                                title="Save this multi-step plan as a canonical Markdown file in docs/plans/"
                                .onClick=${() => this._promoteToPlanFile()}>
                            </sutram-async-btn>
                        ` : ''}
                        ${filePath ? html`
                            <sutram-btn
                                ?compact=${true}
                                intent="highlight"
                                icon="external-link"
                                label="Open Plan"
                                @click=${() => { if (this.vfs?.viewSourceFile) this.vfs.viewSourceFile(filePath, true); }}>
                            </sutram-btn>
                        ` : ''}
                    </sutram-stack>
                </sutram-stack>
            </sutram-surface>
        `;
    }
}
if (!customElements.get('insetu-agent-plan-stepper')) {
    customElements.define('insetu-agent-plan-stepper', InSetuAgentPlanStepper);
}
