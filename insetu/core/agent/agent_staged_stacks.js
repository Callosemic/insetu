/**
 * Collapsible DAG Execution Trace ("Thinking") and Staged Patch Stacks components for the Agent Chat view.
 */
import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { AgentStore } from '/static/extensions/agent/agent_store.js';

export function hasYomamaPatchBlocks(text) {
    if (!text || typeof text !== 'string') return false;
    return /^[ \t]*(?:<[ \t]*){3,}(?:FILE:|SEARCH|TEXTEDIT|JSON_PATCH|RELOCATE|RENAME|MOVE_FILE|ARCHIVE_FILE|DELETE_FILE|QUERY_CONTEXT)\b/m.test(text);
}

export class InSetuCoreAgentSessions extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = { sessions: { type: Array }, activeSessionId: { type: String } };
    static styles = [sharedStyles];
    constructor() { super(); this.sessions = []; this.activeSessionId = null; }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(AgentStore, state => ({ sessions: state.sessions || [], activeSessionId: state.activeSessionId }), { autoFetch: 'fetchSessions' });
    }
    render() {
        return html`
            <sutram-stack direction="col" gap="sm" ?flex=${true}>
                <sutram-async-btn label="New Chat" icon="plus" intent="primary" ?fullWidth=${true} .onClick=${async () => {
                    const ts = this.utils.formatDate ? this.utils.formatDate(new Date()) : new Date().toLocaleString();
                    const res = await this.api.post('agent/sessions', { title: `New Conversation (${ts})` });
                    if (res.ok) {
                        const data = await res.json();
                        const newSes = { session_id: data.session_id, title: data.title, updated_at: Date.now() / 1000 };
                        AgentStore.setState(s => ({
                            sessions: [newSes, ...(s.sessions || []).filter(x => x.session_id !== data.session_id)],
                            activeSessionId: data.session_id,
                            messages: [],
                            workingSetRaw: [],
                            pinnedFiles: [],
                            referenceFiles: [],
                            activePlanPath: '',
                            pendingHandoff: null,
                            pendingCheckpoint: null,
                            executionTrace: [],
                            handoffBranchIdx: 0,
                            handoffBranchResponses: {},
                            lastTurnCommittedFiles: [],
                            sessionSummary: ''
                        }));
                        this.dispatch('insetu:yomama:navigate', { surface: 'chat', sessionId: data.session_id });
                    }
                }}></sutram-async-btn>
                <sutram-label text="CONVERSATIONS"></sutram-label>
                <sutram-stack direction="col" gap="xs" ?flex=${true} ?scrollable=${true}>
                    ${this.sessions.length === 0 ? html`<sutram-empty-state text="No conversations yet."></sutram-empty-state>` : this.sessions.map(s => html`
                        <sutram-surface variant=${this.activeSessionId === s.session_id ? 'tinted' : 'ghost'} intent="primary" padding="xs" ?interactive=${true}
                            @click=${async () => { await AgentStore.getState().selectSession(s.session_id); this.dispatch('insetu:yomama:navigate', { surface: 'chat', sessionId: s.session_id }); }}>
                            <sutram-stack direction="row" align="center" gap="sm">
                                <sutram-icon name="message-square" size="sm" intent="primary"></sutram-icon>
                                <sutram-label intent="neutral" ?truncate=${true} .text=${s.title}></sutram-label>
                            </sutram-stack>
                        </sutram-surface>
                    `)}
                </sutram-stack>
            </sutram-stack>
        `;
    }
}
if (!customElements.get('insetu-core-agent-sessions')) {
    customElements.define('insetu-core-agent-sessions', InSetuCoreAgentSessions);
}

export class InSetuAgentExecutionTrace extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        trace: { type: Array },
        activeJobMessage: { type: String },
        loading: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.trace = [];
        this.activeJobMessage = '';
        this.loading = false;
    }

    _statusMeta(status) {
        if (status === 'completed') return { icon: 'check-circle-2', intent: 'success', badge: 'Done' };
        if (status === 'running') return { icon: 'loader', intent: 'primary', badge: 'Running' };
        if (status === 'paused') return { icon: 'pause-circle', intent: 'warning', badge: 'Paused' };
        if (status === 'skipped') return { icon: 'skip-forward', intent: 'neutral', badge: 'Skipped' };
        if (status === 'failed') return { icon: 'alert-triangle', intent: 'danger', badge: 'Failed' };
        return { icon: 'circle', intent: 'neutral', badge: status || 'Pending' };
    }

    render() {
        const steps = Array.isArray(this.trace) ? this.trace : [];
        if (steps.length === 0 && !this.activeJobMessage) return html``;

        const runningStep = steps.find(s => s.status === 'running' || s.status === 'paused');
        const completedCount = steps.filter(s => s.status === 'completed').length;
        const totalMs = steps.reduce((acc, s) => acc + Number(s.elapsed_ms || 0), 0);
        const timeStr = totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)}s` : `${totalMs}ms`;
        const headerTitle = this.activeJobMessage
            ? `Thinking • ${this.activeJobMessage}`
            : (runningStep
                ? `Thinking • Step [${runningStep.id}] (${runningStep.status})`
                : `Execution Trace • ${completedCount}/${steps.length} step(s) (${timeStr})`);

        return html`
            <sutram-collapsible
                .titleText=${headerTitle}
                intent=${runningStep?.status === 'paused' ? 'warning' : (this.activeJobMessage ? 'primary' : 'neutral')}
                ?open=${Boolean(this.activeJobMessage || runningStep)}>
                <sutram-stack direction="col" gap="xs">
                    ${steps.map(step => {
                        const meta = this._statusMeta(step.status);
                        const roleBadge = step.type === 'exec'
                            ? `exec: ${step.capability || step.id}`
                            : `llm: ${step.tier || 'standard'}`;
                        const stepTime = step.elapsed_ms ? `${step.elapsed_ms}ms` : '';
                        const children = Array.isArray(step.children) ? step.children : [];
                        return html`
                            <sutram-surface variant="inset" padding="xs" gap="xs">
                                <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                    <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                                        <sutram-icon name=${meta.icon} size="sm" intent=${meta.intent}></sutram-icon>
                                        <strong>${step.id}</strong>
                                        <sutram-tag .text=${roleBadge} intent=${step.type === 'exec' ? 'highlight' : 'primary'}></sutram-tag>
                                        ${step.summary ? html`<sutram-label intent="neutral" .text=${step.summary}></sutram-label>` : ''}
                                    </sutram-stack>
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        ${stepTime ? html`<sutram-label ?monospace=${true} .text=${stepTime}></sutram-label>` : ''}
                                        <sutram-tag .text=${meta.badge} intent=${meta.intent}></sutram-tag>
                                    </sutram-stack>
                                </sutram-stack>
                                ${children.length > 0 ? html`
                                    <sutram-stack direction="col" gap="xs" padding="xs">
                                        ${children.map(ch => {
                                            const chMeta = this._statusMeta(ch.status);
                                            return html`
                                                <sutram-stack direction="row" justify="between" align="center" gap="xs" ?wrap=${true}>
                                                    <sutram-stack direction="row" align="center" gap="xs">
                                                        <sutram-label ?monospace=${true} text="├─"></sutram-label>
                                                        <sutram-icon name=${chMeta.icon} size="xs" intent=${chMeta.intent}></sutram-icon>
                                                        <strong>${ch.id}</strong>
                                                        ${ch.summary ? html`<sutram-label .text=${ch.summary}></sutram-label>` : ''}
                                                    </sutram-stack>
                                                    ${ch.elapsed_ms ? html`<sutram-label ?monospace=${true} .text=${`${ch.elapsed_ms}ms`}></sutram-label>` : ''}
                                                </sutram-stack>
                                            `;
                                        })}
                                    </sutram-stack>
                                ` : ''}
                            </sutram-surface>
                        `;
                    })}
                    ${this.activeJobMessage ? html`
                        <sutram-surface variant="ghost" padding="xs">
                            <sutram-spinner .text=${this.activeJobMessage}></sutram-spinner>
                        </sutram-surface>
                    ` : ''}
                </sutram-stack>
            </sutram-collapsible>
        `;
    }
}

export class InSetuAgentStagedStacks extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        cells: { type: Array },
        activeProfileId: { type: String },
        quickpack: { type: Object }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.cells = [];
        this.activeProfileId = 'default';
        this.quickpack = null;
    }

    render() {
        const list = Array.isArray(this.cells) ? this.cells : [];
        const qp = this.quickpack?.base_filename ? this.quickpack : null;
        if (list.length === 0 && !qp) return html``;
        const qpCard = qp ? html`
            <sutram-card
                .filename=${qp.base_filename}
                .titleText=${`Query Quickpack (${qp.file_count || 1} item(s))`}
                .descriptionText=${(qp.files || []).map(f => new this.utils.InSetuURI(f).basename).join(', ')}
                .detailText=${(qp.files || []).join(', ')}
                icon="package"
                intent="highlight"
                entityType="file:context"
                .entityData=${{ filepath: qp.base_filename, isFS: false, chunks: qp.chunks || [qp.base_filename], suppress: ['file-edit', 'file-browse'] }}
                ?disableSelection=${true}>
                <sutram-btn slot="header-actions" ?compact=${true} intent="neutral" icon="x" title="Dismiss Quickpack card"
                    @click=${() => this.dispatchEvent(new CustomEvent('insetu-dismiss-quickpack', { bubbles: true, composed: true }))}>
                </sutram-btn>
            </sutram-card>
        ` : '';
        if (list.length === 0) return qpCard;

        const grouped = list.reduce((acc, cell) => {
            if (!acc[cell.file]) acc[cell.file] = [];
            acc[cell.file].push(cell);
            return acc;
        }, {});
        const activeCount = list.filter(c => c.active).length;

        return html`
            ${qpCard}
            <sutram-surface variant="panel" intent="highlight" padding="md" gap="md">
                <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                    <sutram-stack direction="row" align="center" gap="xs">
                        <sutram-icon name="layers" size="md" intent="highlight"></sutram-icon>
                        <strong>Staged Patch Stacks (${activeCount} of ${list.length} selected)</strong>
                    </sutram-stack>
                    <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                        <sutram-btn
                            ?compact=${true}
                            intent="neutral"
                            icon="bridge"
                            label="Open in Bridge"
                            @click=${() => window.inSetu?.stores?.Bridge?.getState()?.setActiveSurface('bridge')}>
                        </sutram-btn>
                        <sutram-btn
                            ?compact=${true}
                            intent="danger"
                            icon="trash-2"
                            label="Discard"
                            @click=${() => window.inSetu?.stores?.Bridge?.getState()?.clearPayload()}>
                        </sutram-btn>
                        <sutram-async-btn
                            ?compact=${true}
                            intent="success"
                            icon="zap"
                            label="Confirm & Commit (${activeCount})"
                            ?disabled=${activeCount === 0}
                            .onClick=${async () => {
                                const bStore = window.inSetu?.stores?.Bridge?.getState();
                                if (!bStore) return;
                                const textVal = bStore.getCompiledPayload();
                                const activeFiles = bStore.getActiveFiles();
                                const commitJob = this.api.bindJobAction('bridge/sync', {
                                    text: textVal,
                                    active_files: activeFiles,
                                    dry_run: false,
                                    repair_mode: bStore.repairMode === 'off' ? 'off' : 'algorithmic',
                                    auto_heal: false,
                                    profile_id: this.activeProfileId
                                }, {
                                    onComplete: async (sData) => {
                                        const tel = sData?.artifact;
                                        if (tel?.can_commit && tel?.mode === 'live') {
                                            bStore.clearPayload();
                                            bStore.fetchHistory();
                                            AgentStore.setState({ lastTurnCommittedFiles: activeFiles });
                                            this.setStatus(`✅ Committed ${activeFiles.length} file(s)!`, 2500);
                                        } else {
                                            bStore.setTelemetry(tel);
                                            bStore.setViewMode('console');
                                            bStore.setActiveSurface('bridge');
                                        }
                                    }
                                });
                                await commitJob();
                            }}>
                        </sutram-async-btn>
                    </sutram-stack>
                </sutram-stack>
                <sutram-stack direction="col" gap="sm">
                    ${Object.entries(grouped).map(([file, groupCells]) => {
                        const selInFile = groupCells.filter(c => c.active).length;
                        return html`
                            <sutram-card-group ?stacked=${true} ?accordion=${true}>
                                <sutram-card
                                    .titleText=${new this.utils.InSetuURI(file).basename}
                                    .descriptionText=${`${selInFile} of ${groupCells.length} patch(es) selected`}
                                    .detailText=${file}
                                    icon="file-code-2"
                                    intent=${selInFile > 0 ? 'highlight' : 'neutral'}
                                    selectionStoreKey="none"
                                    ?selected=${selInFile > 0}
                                    @sutram-card-select-toggled=${(e) => {
                                        e.stopPropagation();
                                        window.inSetu?.stores?.Bridge?.getState()?.toggleGroupActive(file, selInFile === 0);
                                    }}>
                                </sutram-card>
                                ${groupCells.map((c, idx) => {
                                    const commentMatch = c.content.match(/<<<<<<< COMMENT\r?\n([\s\S]*?)\r?\n<<<<<<< /);
                                    const commentStr = commentMatch && commentMatch[1] ? commentMatch[1].trim() : `Patch #${idx + 1}`;
                                    return html`
                                        <sutram-card
                                            .titleText=${`Patch ${idx + 1} of ${groupCells.length}`}
                                            .descriptionText=${commentStr}
                                            icon="git-commit"
                                            intent=${c.active ? 'success' : 'neutral'}
                                            selectionStoreKey="none"
                                            ?selected=${c.active}
                                            @sutram-card-select-toggled=${(e) => {
                                                e.stopPropagation();
                                                window.inSetu?.stores?.Bridge?.getState()?.toggleCellActive(c.id);
                                            }}
                                            @card-clicked=${() => {
                                                window.inSetu?.stores?.Bridge?.getState()?.setActiveSurface('bridge');
                                            }}>
                                        </sutram-card>
                                    `;
                                })}
                            </sutram-card-group>
                        `;
                    })}
                </sutram-stack>
            </sutram-surface>
        `;
    }
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
        const ctxBtnLabel = (isSameWindow && hasPriorWindowState)
            ? (Number(deltaMeta.changed_count || 0) === 0
                ? 'Context (0 Δ — Unchanged)'
                : `Delta Context (+${deltaMeta.changed_count} · ~${deltaMeta.delta_tokens || 0} tok)`)
            : `Full Context (~${deltaMeta.full_tokens || this.totalTokensEst || 0} tok)`;
        const promptToCopy = activeBranch.prompt_text || activeBranch.compiled_prompt || '';

        return html`
            <sutram-surface variant="tinted" intent="warning" border="top" padding="md" gap="sm">
                <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                    <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                        <sutram-icon name="zap" size="sm" intent="warning"></sutram-icon>
                        <strong>External LLM Handoff • ${displayTitle} (${activeBranch.node_id})</strong>
                        ${activeBranch.tier ? html`<sutram-tag text=${activeBranch.tier} intent="warning"></sutram-tag>` : ''}
                    </sutram-stack>
                    <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                        <sutram-pill
                            ?compact=${true}
                            labelText=${isSameWindow ? '🪟 Same Window (Delta)' : '🆕 New Window (Full)'}
                            title="Click to toggle between Same Chat Window (packs only new/changed context) and New Chat Window (packs all context)"
                            ?active=${isSameWindow}
                            @sutram-pill-toggled=${() => {
                                AgentStore.setState({ webChatWindowMode: isSameWindow ? 'new_window' : 'same_window' });
                            }}>
                        </sutram-pill>
                        ${wfCtxUri ? (() => {
                            const chunks = this.vfs?.getChunks ? this.vfs.getChunks(wfCtxUri) : [wfCtxUri];
                            const ctxEntityData = {
                                filepath: wfCtxUri, isFS: false, chunks,
                                suppress: ['file-edit', 'file-browse', 'file-view', 'file-window']
                            };
                            const rawActions = window.ExtensionRegistry?.getEntityActions
                                ? window.ExtensionRegistry.getEntityActions('file:context', ctxEntityData)
                                : [];
                            const shareActions = rawActions.filter(a => !a.bulkOnly && ['file-copy', 'file-download', 'file-share'].includes(a.id));
                            const menuItems = shareActions.map(act => ({
                                label: typeof act.label === 'function' ? act.label(ctxEntityData) : act.label,
                                icon: act.icon,
                                intent: act.intent,
                                onClick: (e) => {
                                    if (window.ExtensionRegistry?.executeEntityAction) return window.ExtensionRegistry.executeEntityAction(act, ctxEntityData, e);
                                    if (act.onClick) return act.onClick(ctxEntityData, e);
                                    if (act.asyncAction) return act.asyncAction(ctxEntityData, e);
                                }
                            }));
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
                        <sutram-btn
                            ?compact=${true}
                            intent="primary"
                            icon="clipboard"
                            label="Copy Prompt + Directives"
                            @click=${() => this.utils.copyRawText(promptToCopy, "📋 Prompt & directives copied!").catch(() => {})}>
                        </sutram-btn>
                    </sutram-stack>
                </sutram-stack>
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
                    placeholder=${`Paste the external LLM's response for "${activeBranch.node_id}" here (prose & Yomama patches will split automatically)...`}
                    .value=${this.promptInput}
                    ?flush=${true}
                    @sutram-input-changed=${e => AgentStore.setState({ promptInput: e.detail.value })}>
                </sutram-textarea>
                <sutram-action-bar collapse="sm" align="between">
                    <sutram-btn
                        intent="neutral"
                        icon="x"
                        label="Cancel Handoff"
                        @click=${() => {
                            AgentStore.setState({ promptInput: '', pendingHandoff: null, handoffBranchIdx: 0, handoffBranchResponses: {} });
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

if (!customElements.get('insetu-agent-execution-trace')) {
    customElements.define('insetu-agent-execution-trace', InSetuAgentExecutionTrace);
}
if (!customElements.get('insetu-agent-staged-stacks')) {
    customElements.define('insetu-agent-staged-stacks', InSetuAgentStagedStacks);
}
if (!customElements.get('insetu-agent-handoff-panel')) {
    customElements.define('insetu-agent-handoff-panel', InSetuAgentHandoffPanel);
}
