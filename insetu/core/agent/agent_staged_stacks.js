/**
 * Collapsible DAG Execution Trace ("Thinking") and Staged Patch Stacks components for the Agent Chat view.
 */
import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { AgentStore } from '/static/extensions/agent/agent_store.js';
import {
    InSetuAgentContextHud,
    InSetuAgentHandoffPanel,
    InSetuAgentPlanStepper,
    buildAgentTelemetryMenuItems,
    estimateWorkingSetTokensFromComponent,
} from '/static/extensions/agent/agent_handoff_and_plan.js';

export { InSetuAgentContextHud, InSetuAgentHandoffPanel, InSetuAgentPlanStepper, buildAgentTelemetryMenuItems, estimateWorkingSetTokensFromComponent };

export function hasYomamaPatchBlocks(text) {
    if (!text || typeof text !== 'string') return false;
    return /^[ \t]*(?:<[ \t]*){3,}(?:FILE:|SEARCH|TEXTEDIT|JSON_PATCH|RELOCATE|RENAME|MOVE_FILE|ARCHIVE_FILE|DELETE_FILE|TASK_?MANAGE|QUERY_CONTEXT)\b/m.test(text);
}

export class InSetuCoreAgentSessions extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        sessions: { type: Array },
        activeSessionId: { type: String },
        _showArchived: { type: Boolean, state: true },
        _searchQuery: { type: String, state: true },
        _renamingSessionId: { type: String, state: true },
        _renameDraft: { type: String, state: true }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.sessions = [];
        this.activeSessionId = null;
        this._showArchived = false;
        this._searchQuery = '';
        this._renamingSessionId = null;
        this._renameDraft = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            AgentStore,
            state => ({ sessions: state.sessions || [], activeSessionId: state.activeSessionId }),
            { autoFetch: 'fetchSessions' }
        );
        if (window.inSetu?.stores?.Bridge) {
            this.subscribe(
                window.inSetu.stores.Bridge,
                state => Boolean(state.drawerOpen || !state.drawerCollapsedDesktop),
                (isOpen) => {
                    if (isOpen && (!this.sessions || this.sessions.length === 0)) {
                        AgentStore.getState().fetchSessions();
                    }
                }
            );
        }
        this.registerGlobalListener('insetu:yomama:toggle-drawer', window, () => {
            if (!this.sessions || this.sessions.length === 0) {
                AgentStore.getState().fetchSessions();
            }
        });
        this.registerGlobalListener('insetu:agent:start-rename-session', window, (e) => {
            const ses = e.detail?.session;
            if (ses?.session_id) {
                this._renamingSessionId = ses.session_id;
                this._renameDraft = ses.title || '';
            }
        });
    }

    async _commitRename() {
        const sid = this._renamingSessionId;
        const draft = (this._renameDraft || '').trim();
        this._renamingSessionId = null;
        this._renameDraft = '';
        if (sid && draft) {
            await AgentStore.getState().renameSession(sid, draft);
            this.setStatus('✏️ Conversation renamed.', 2000);
        }
    }

    render() {
        const allSessions = Array.isArray(this.sessions) ? this.sessions : [];
        const archivedCount = allSessions.filter(s => Boolean(s.archived)).length;
        const scopedSessions = allSessions.filter(s => Boolean(s.archived) === Boolean(this._showArchived));
        const visibleSessions = this._searchQuery.trim()
            ? this.utils.fuzzyFilterObjects(scopedSessions, this._searchQuery, s => `${s.title || ''} ${s.session_id || ''}`)
            : scopedSessions;

        return html`
            <sutram-stack direction="col" gap="xs" ?flex=${true}>
                <sutram-stack direction="row" align="center" gap="xs">
                    <sutram-async-btn
                        label="New Chat"
                        icon="plus"
                        intent="primary"
                        ?compact=${true}
                        ?grow=${true}
                        .onClick=${async () => {
                            const ts = this.utils.formatDate ? this.utils.formatDate(new Date()) : new Date().toLocaleString();
                            const res = await this.api.post('agent/sessions', { title: `New Conversation (${ts})` });
                            if (res.ok) {
                                const data = await res.json();
                                const newSes = { session_id: data.session_id, title: data.title, updated_at: Date.now() / 1000, archived: 0 };
                                this._showArchived = false;
                                AgentStore.getState().resetSessionView(newSes);
                                this.dispatch('insetu:yomama:navigate', { surface: 'chat', sessionId: data.session_id });
                            }
                        }}>
                    </sutram-async-btn>
                    ${archivedCount > 0 || this._showArchived ? html`
                        <sutram-pill
                            ?compact=${true}
                            labelText=${this._showArchived ? `Archived (${archivedCount})` : `📦 ${archivedCount}`}
                            title="Toggle Archived Conversations"
                            ?active=${this._showArchived}
                            @sutram-pill-toggled=${() => { this._showArchived = !this._showArchived; }}>
                        </sutram-pill>
                    ` : ''}
                </sutram-stack>

                ${allSessions.length > 4 ? html`
                    <sutram-input
                        ?flush=${true}
                        placeholder="Filter conversations..."
                        .value=${this._searchQuery}
                        @sutram-input-changed=${e => { this._searchQuery = e.detail.value; }}>
                    </sutram-input>
                ` : ''}

                ${this._renamingSessionId ? html`
                    <sutram-surface variant="tinted" intent="primary" padding="xs" gap="xs">
                        <sutram-label text="Rename Conversation:"></sutram-label>
                        <sutram-input
                            ?flush=${true}
                            .value=${this._renameDraft}
                            placeholder="Conversation title..."
                            @sutram-input-changed=${e => { this._renameDraft = e.detail.value; }}>
                        </sutram-input>
                        <sutram-stack direction="row" justify="end" gap="xs">
                            <sutram-btn ?compact=${true} intent="neutral" icon="x" label="Cancel" @click=${() => { this._renamingSessionId = null; }}></sutram-btn>
                            <sutram-btn ?compact=${true} intent="success" icon="check" label="Save" @click=${() => this._commitRename()}></sutram-btn>
                        </sutram-stack>
                    </sutram-surface>
                ` : ''}

                <sutram-stack direction="row" justify="between" align="center" gap="xs">
                    <sutram-label .text=${this._showArchived ? 'ARCHIVED CHATS' : 'CONVERSATIONS'}></sutram-label>
                    <sutram-tag .text=${`${visibleSessions.length}`} intent="neutral"></sutram-tag>
                </sutram-stack>

                <sutram-stack direction="col" gap="xs" ?flex=${true} ?scrollable=${true}>
                    ${visibleSessions.length === 0 ? html`
                        <sutram-empty-state .text=${this._showArchived ? "No archived conversations." : "No conversations yet."}></sutram-empty-state>
                    ` : visibleSessions.map(s => {
                        const isActive = this.activeSessionId === s.session_id;
                        const relTime = (s.updated_at && this.utils.timeAgo) ? this.utils.timeAgo(s.updated_at * 1000) : '';
                        return html`
                            <sutram-card
                                ?disableSelection=${true}
                                selectionStoreKey="none"
                                ?selected=${isActive}
                                .titleText=${s.title || s.session_id}
                                .detailText=${relTime}
                                icon=${s.archived ? 'archive' : 'message-square'}
                                intent=${isActive ? 'primary' : (s.archived ? 'neutral' : 'highlight')}
                                entityType="agent_session"
                                .entityData=${{ ...s, id: s.session_id, titleText: s.title }}
                                @card-clicked=${async () => {
                                    await AgentStore.getState().selectSession(s.session_id);
                                    this.dispatch('insetu:yomama:navigate', { surface: 'chat', sessionId: s.session_id });
                                }}>
                            </sutram-card>
                        `;
                    })}
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
        activePlan: { type: Object },
        activePlanPath: { type: String },
        sessionId: { type: String },
        activeJobMessage: { type: String },
        loading: { type: Boolean }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.trace = [];
        this.activePlan = null;
        this.activePlanPath = '';
        this.sessionId = '';
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

        const activeRunningStep = steps.find(s => s.status === 'running');
        const pausedStep = steps.find(s => s.status === 'paused');
        const focusStep = activeRunningStep || pausedStep;
        const completedCount = steps.filter(s => s.status === 'completed').length;
        const totalMs = steps.reduce((acc, s) => acc + Number(s.elapsed_ms || 0), 0);
        const timeStr = totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)}s` : `${totalMs}ms`;
        const headerTitle = this.activeJobMessage
            ? `Thinking • ${this.activeJobMessage}`
            : (focusStep
                ? `Thinking • ${focusStep.id} (${focusStep.status}) • ${completedCount}/${steps.length} done`
                : `Thinking Trace • ${completedCount}/${steps.length} step(s) (${timeStr})`);

        return html`
            <sutram-collapsible
                ?compact=${true}
                .titleText=${headerTitle}
                intent=${pausedStep ? 'warning' : (this.activeJobMessage || activeRunningStep ? 'primary' : 'neutral')}
                ?open=${Boolean(this.activeJobMessage || activeRunningStep)}>
                <sutram-stack direction="col" gap="xs" padding="xs">
                    ${steps.map(step => {
                        const meta = this._statusMeta(step.status);
                        const roleBadge = step.type === 'exec'
                            ? (step.capability || step.id)
                            : (step.tier || 'standard');
                        const stepTime = step.elapsed_ms
                            ? (Number(step.elapsed_ms) >= 1000 ? `${(Number(step.elapsed_ms) / 1000).toFixed(1)}s` : `${step.elapsed_ms}ms`)
                            : '';
                        const children = Array.isArray(step.children) ? step.children : [];
                        return html`
                            <sutram-surface variant="inset" padding="xs" gap="none">
                                <sutram-stack direction="row" justify="between" align="center" gap="xs">
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        <sutram-icon name=${meta.icon} size="xs" intent=${meta.intent}></sutram-icon>
                                        <strong>${step.id}</strong>
                                        <sutram-tag .text=${roleBadge} intent=${step.type === 'exec' ? 'highlight' : 'primary'}></sutram-tag>
                                    </sutram-stack>
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        ${stepTime ? html`<sutram-label ?monospace=${true} .text=${stepTime}></sutram-label>` : ''}
                                        <sutram-tag .text=${meta.badge} intent=${meta.intent}></sutram-tag>
                                    </sutram-stack>
                                </sutram-stack>
                                ${step.summary ? html`
                                    <sutram-label intent="neutral" ?truncate=${true} title=${step.summary} .text=${step.summary}></sutram-label>
                                ` : ''}
                                ${children.length > 0 ? html`
                                    <sutram-collapsible ?compact=${true} ?open=${false} intent="neutral" .titleText=${`${children.length} sub-step(s)`}>
                                        <sutram-stack direction="col" gap="xs" padding="xs">
                                            ${children.map(ch => {
                                                const chMeta = this._statusMeta(ch.status);
                                                return html`
                                                    <sutram-stack direction="row" justify="between" align="center" gap="xs">
                                                        <sutram-stack direction="row" align="center" gap="xs">
                                                            <sutram-icon name=${chMeta.icon} size="xs" intent=${chMeta.intent}></sutram-icon>
                                                            <strong>${ch.id}</strong>
                                                            ${ch.summary ? html`<sutram-label ?truncate=${true} title=${ch.summary} .text=${ch.summary}></sutram-label>` : ''}
                                                        </sutram-stack>
                                                        ${ch.elapsed_ms ? html`<sutram-label ?monospace=${true} .text=${`${ch.elapsed_ms}ms`}></sutram-label>` : ''}
                                                    </sutram-stack>
                                                `;
                                            })}
                                        </sutram-stack>
                                    </sutram-collapsible>
                                ` : ''}
                            </sutram-surface>
                        `;
                    })}
                    ${this.activeJobMessage ? html`
                        <sutram-surface variant="ghost" padding="xs">
                            <sutram-spinner .text=${this.activeJobMessage}></sutram-spinner>
                        </sutram-surface>
                    ` : ''}
                    ${(this.activePlan || this.activePlanPath) ? html`
                        <insetu-agent-plan-stepper
                            .activePlan=${this.activePlan}
                            .activePlanPath=${this.activePlanPath}
                            .sessionId=${this.sessionId}>
                        </insetu-agent-plan-stepper>
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

        const fileEntries = Object.entries(grouped);
        return html`
            ${qpCard}
            <sutram-surface variant="panel" intent="highlight" padding="sm" gap="sm">
                <sutram-stack direction="row" justify="between" align="center" gap="xs" ?wrap=${true}>
                    <sutram-stack direction="row" align="center" gap="xs">
                        <sutram-icon name="layers" size="sm" intent="highlight"></sutram-icon>
                        <strong>Staged Patches (${activeCount}/${list.length})</strong>
                    </sutram-stack>
                    <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                        <sutram-btn
                            ?compact=${true}
                            intent="neutral"
                            icon="bridge"
                            label="Bridge"
                            title="Inspect in Yomama Bridge"
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
                            ?grow=${true}
                            intent="success"
                            icon="zap"
                            label="Apply (${activeCount})"
                            ?disabled=${activeCount === 0}
                            .onClick=${async () => {
                                const bStore = window.inSetu?.stores?.Bridge?.getState();
                                if (!bStore) return;
                                const textVal = bStore.getCompiledPayload();
                                const activeFiles = bStore.getActiveFiles();
                                const isAiAssisted = (AgentStore.getState()?.agentSettings?.helper_mode || 'ai_assisted') === 'ai_assisted';
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
                                            const activeSesId = AgentStore.getState()?.activeSessionId;
                                            let recData = null;
                                            if (activeSesId && tel.transaction_id) {
                                                recData = await this.api.postJson('agent/record_transaction', {
                                                    session_id: activeSesId,
                                                    transaction_id: tel.transaction_id,
                                                    committed_files: activeFiles
                                                }).catch(() => null);
                                            }
                                            bStore.clearPayload();
                                            bStore.fetchHistory();
                                            AgentStore.setState(s => ({
                                                lastTurnCommittedFiles: activeFiles,
                                                activePlan: recData?.active_plan !== undefined ? recData.active_plan : s.activePlan
                                            }));
                                            if (recData?.auto_advanced && recData?.next_task) {
                                                const nt = recData.next_task;
                                                this.setStatus(`✅ Applied & advancing to [${nt.id}]: ${nt.description}`, 3500);
                                                AgentStore.setState(s => ({
                                                    agentMode: 'code',
                                                    agentRoutineId: 'code',
                                                    pinnedFiles: Array.isArray(nt.targets) && nt.targets.length > 0 ? nt.targets : s.pinnedFiles,
                                                    promptInput: `Execute [${nt.id}]: ${nt.description}`
                                                }));
                                                this.dispatchEvent(new CustomEvent('insetu-start-next-plan-step', { bubbles: true, composed: true }));
                                            } else {
                                                this.setStatus(`✅ Applied ${activeFiles.length} file(s)!`, 2500);
                                            }
                                        } else if (isAiAssisted && bStore.repairMode !== 'off') {
                                            this.setStatus('✨ Running dry-run AI repair on failed patch(es) for review...', null);
                                            const healJob = this.api.bindJobAction('bridge/sync', {
                                                text: textVal,
                                                active_files: activeFiles,
                                                dry_run: true,
                                                repair_mode: 'ai_assisted',
                                                auto_heal: true,
                                                profile_id: this.activeProfileId
                                            }, {
                                                onComplete: (hData) => {
                                                    const hTel = hData?.artifact;
                                                    if (hTel?.healed_cells && Object.keys(hTel.healed_cells).length > 0 && bStore.applyHealedCells) {
                                                        bStore.applyHealedCells(hTel.healed_cells);
                                                    } else if (hTel?.healed_payload && hTel?.can_commit) {
                                                        bStore.clearPayload();
                                                        bStore.parseAndAppendCells(hTel.healed_payload, { stayOnCurrentSurface: true });
                                                    }
                                                    if (hTel?.can_commit) {
                                                        this.setStatus('✨ AI-repaired staged patch(es) in dry-run — review and click Apply!', 4500);
                                                    } else {
                                                        bStore.setTelemetry(hTel || tel);
                                                        bStore.setViewMode('console');
                                                        bStore.setActiveSurface('bridge');
                                                    }
                                                }
                                            });
                                            await healJob();
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
                <sutram-collapsible
                    ?compact=${true}
                    intent="highlight"
                    ?open=${fileEntries.length <= 3}
                    .titleText=${`${fileEntries.length} file(s) staged • tap to inspect chunks`}>
                    <sutram-stack direction="col" gap="xs">
                        ${fileEntries.map(([file, groupCells]) => {
                            const selInFile = groupCells.filter(c => c.active).length;
                            return html`
                                <sutram-card-group ?stacked=${true} ?accordion=${true}>
                                    <sutram-card
                                        ?compact=${true}
                                        .titleText=${new this.utils.InSetuURI(file).basename}
                                        .descriptionText=${`${selInFile}/${groupCells.length} patch(es)`}
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
                                                ?compact=${true}
                                                .titleText=${`Patch ${idx + 1}/${groupCells.length}`}
                                                .descriptionText=${commentStr}
                                                icon="file-diff"
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
                </sutram-collapsible>
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
