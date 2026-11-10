import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { AgentStore, classifyRoutineTargetUri } from '/static/extensions/agent/agent_store.js';
import {
    InSetuAgentRoutineProjection,
    InSetuCoreAgentRoutines,
} from '/static/extensions/agent/agent_routine_studio.js';

export {
    AgentStore,
    classifyRoutineTargetUri,
    InSetuAgentRoutineProjection,
    InSetuCoreAgentRoutines,
};

export class InSetuCoreAgentSessions extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        sessions: { type: Array },
        activeSessionId: { type: String }
    };
    static styles = [sharedStyles];

    constructor() {
        super();
        this.sessions = [];
        this.activeSessionId = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            AgentStore,
            state => ({
                sessions: state.sessions || [],
                activeSessionId: state.activeSessionId
            }),
            { autoFetch: 'fetchSessions' }
        );
    }
    render() {
        return html`
            <sutram-stack direction="col" gap="sm" ?flex=${true}>
                <sutram-async-btn 
                    label="New Chat" 
                    icon="plus" 
                    intent="primary" 
                    ?fullWidth=${true}
                    .onClick=${async () => {
                        const ts = this.utils.formatDate ? this.utils.formatDate(new Date()) : new Date().toLocaleString();
                        const res = await this.api.post('agent/sessions', { title: `New Conversation (${ts})` });
                        if (res.ok) {
                            const data = await res.json();
                            await AgentStore.getState().fetchSessions();
                            await AgentStore.getState().selectSession(data.session_id);
                            this.dispatch('insetu:yomama:navigate', { surface: 'chat', sessionId: data.session_id });
                        }
                    }}>
                </sutram-async-btn>
                <sutram-label text="CONVERSATIONS"></sutram-label>
                <sutram-stack direction="col" gap="xs" ?flex=${true} ?scrollable=${true}>
                    ${this.sessions.length === 0 ? html`
                        <sutram-empty-state text="No conversations yet."></sutram-empty-state>
                    ` : this.sessions.map(s => html`
                        <sutram-surface
                            variant=${this.activeSessionId === s.session_id ? 'tinted' : 'ghost'}
                            intent="primary"
                            padding="xs"
                            ?interactive=${true}
                            @click=${async () => {
                                await AgentStore.getState().selectSession(s.session_id);
                                this.dispatch('insetu:yomama:navigate', { surface: 'chat', sessionId: s.session_id });
                            }}>
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
customElements.define('insetu-core-agent-sessions', InSetuCoreAgentSessions);

export class InSetuCoreAgent extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        sessions: { type: Array },
        routines: { type: Array },
        llmProfiles: { type: Array },
        activeProfileId: { type: String },
        activeSessionId: { type: String },
        messages: { type: Array },
        loading: { type: Boolean },
        constitutionFiles: { type: Array },
        referenceFiles: { type: Array },
        pinnedFiles: { type: Array },
        tokenLedger: { type: Object },
        activePlanPath: { type: String },
        pendingCheckpoint: { type: Object },
        agentRoutineId: { type: String },
        agentMode: { type: String },
        agentScope: { type: String },
        agentSettings: { type: Object },
        promptInput: { type: String },
        activeJobMessage: { type: String },
        pendingHandoff: { type: Object },
        _hudExpanded: { type: Boolean, state: true }
    };

    static styles = [sharedStyles];
    constructor() {
        super();
        this.sessions = [];
        this.routines = [];
        this.llmProfiles = [];
        this.activeProfileId = 'default';
        this.activeSessionId = null;
        this.messages = [];
        this.loading = false;
        this.constitutionFiles = [];
        this.referenceFiles = [];
        this.pinnedFiles = [];
        this.tokenLedger = { prompt_tokens: 0, completion_tokens: 0, saved_by_slicing: 0 };
        this.activePlanPath = '';
        this.pendingCheckpoint = null;
        this.agentRoutineId = 'workspace_turn';
        this.agentMode = 'auto';
        this.agentScope = '';
        this.agentSettings = {
            rag_strategy: 'blast_radius',
            compaction_strategy: 'deterministic',
            run_tests_on_code: false,
            strict_test_enforcement: false
        };
        this.promptInput = '';
        this.activeJobMessage = '';
        this.pendingHandoff = null;
        this._handoffBranchIdx = 0;
        this._handoffBranchResponses = {};
        this._lastTurnCommittedFiles = [];
        this._stagedBridgeCells = [];
        this._hudExpanded = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            AgentStore,
            state => ({
                sessions: state.sessions || [],
                routines: state.routines || [],
                llmProfiles: state.llmProfiles || [],
                activeProfileId: state.activeProfileId || 'default',
                activeSessionId: state.activeSessionId,
                messages: state.messages || [],
                loading: !!state.loading,
                constitutionFiles: state.constitutionFiles || [],
                referenceFiles: state.referenceFiles || [],
                pinnedFiles: state.pinnedFiles || [],
                tokenLedger: state.tokenLedger || { prompt_tokens: 0, completion_tokens: 0, saved_by_slicing: 0 },
                activePlanPath: state.activePlanPath || '',
                pendingCheckpoint: state.pendingCheckpoint || null,
                agentRoutineId: state.agentRoutineId || 'workspace_turn',
                agentMode: state.agentMode || 'auto',
                agentScope: state.agentScope || '',
                agentSettings: state.agentSettings || { rag_strategy: 'blast_radius', compaction_strategy: 'deterministic', run_tests_on_code: false, strict_test_enforcement: false },
                promptInput: state.promptInput || '',
                pendingHandoff: state.pendingHandoff || null,
                _handoffBranchIdx: state.handoffBranchIdx || 0,
                _handoffBranchResponses: state.handoffBranchResponses || {},
                _lastTurnCommittedFiles: state.lastTurnCommittedFiles || []
            }),
            { autoFetch: 'fetchSessions' }
        );

        this.registerGlobalListener('sutram-compile-progress', window, (e) => {
            if (e.detail && e.detail.ext_name === 'agent') {
                this.activeJobMessage = e.detail.message || '';
            }
        });
        this.registerGlobalListener('insetu:yomama:select-routine', window, (e) => {
            if (e.detail?.routineId) {
                AgentStore.getState().selectRoutine(e.detail);
            }
        });
        if (window.inSetu?.stores?.Bridge) {
            this.subscribe(
                window.inSetu.stores.Bridge,
                state => state.cells || [],
                (cells) => {
                    this._stagedBridgeCells = cells;
                    this.requestUpdate();
                }
            );
            this._stagedBridgeCells = window.inSetu.stores.Bridge.getState()?.cells || [];
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
    }

    _getActiveCommandPillText() {
        if (this.agentMode === 'user' && this.agentRoutineId && this.agentRoutineId !== 'workspace_turn') {
            return `/${this.agentRoutineId}${this.agentScope ? ':' + this.agentScope : ''}`;
        }
        return `/${this.agentMode || 'auto'}`;
    }

    _getAllCommandOptions() {
        const baseCommands = [
            { id: 'auto', slash: '/auto', mode: 'auto', routineId: 'workspace_turn', scope: '', label: 'Smart Router', icon: 'sparkles', intent: 'primary' },
            { id: 'code', slash: '/code', mode: 'code', routineId: 'code', scope: '', label: 'Edit Code (Yomama Bridge)', icon: 'code', intent: 'highlight' },
            { id: 'plan', slash: '/plan', mode: 'plan', routineId: 'plan', scope: '', label: 'Draft Architectural Plan', icon: 'file-text', intent: 'highlight' },
            { id: 'ask', slash: '/ask', mode: 'ask', routineId: 'ask', scope: '', label: 'Read-Only Codebase Q&A', icon: 'help-circle', intent: 'neutral' },
            { id: 'yomama', slash: '/yomama', mode: 'yomama', routineId: 'yomama', scope: '', label: 'Apply & Heal Patch Blocks', icon: 'zap', intent: 'warning' },
            { id: 'undo', slash: '/undo', mode: 'undo', routineId: 'workspace_turn', scope: '', label: 'Revert Last Patch Transaction', icon: 'rotate-ccw', intent: 'danger' }
        ];
        const baseIds = new Set(['workspace_turn', 'code', 'plan', 'ask', 'yomama']);
        const customCommands = [];
        (this.routines || []).forEach(r => {
            if (!r || !r.id || baseIds.has(r.id)) return;
            customCommands.push({
                id: `user:${r.id}`,
                slash: `/${r.id}`,
                altSlash: `/user:${r.id}`,
                mode: 'user',
                routineId: r.id,
                scope: '',
                label: r.title || r.name || r.id,
                icon: 'workflow',
                intent: 'warning',
                ctxCount: Array.isArray(r.includes) ? r.includes.length : 0
            });
            (r.scopes || []).forEach(sc => {
                customCommands.push({
                    id: `user:${r.id}:${sc}`,
                    slash: `/${r.id}:${sc}`,
                    altSlash: `/user:${r.id}:${sc}`,
                    mode: 'user',
                    routineId: r.id,
                    scope: sc,
                    label: `${r.title || r.id} (${sc})`,
                    icon: 'workflow',
                    intent: 'warning',
                    ctxCount: Array.isArray(r.includes) ? r.includes.length : 0
                });
            });
        });
        return [...baseCommands, ...customCommands];
    }

    _clearComposerDomValue(compEl, nextVal = '') {
        const applyClear = () => {
            const target = compEl || this.shadowRoot?.querySelector('sutram-composer');
            if (!target) return;
            target.value = nextVal;
            const inner = target.shadowRoot?.querySelector('textarea, input, sutram-textarea, sutram-input');
            if (inner) {
                inner.value = nextVal;
                const deepInner = inner.shadowRoot?.querySelector('textarea, input');
                if (deepInner) deepInner.value = nextVal;
            }
        };
        applyClear();
        requestAnimationFrame(applyClear);
    }

    _selectCommandOption(opt, remainingPrompt = null, compEl = null) {
        if (!opt) return;
        if (opt.mode === 'undo' && remainingPrompt === null) {
            this._undoLastTurn();
            return;
        }
        const currentRaw = (remainingPrompt !== null
            ? remainingPrompt
            : (this.promptInput || '')).replace(/^\/(?:user:[a-zA-Z0-9_:-]*|[a-zA-Z0-9_:-]*)\s*/, '');
        AgentStore.setState({
            agentMode: opt.mode,
            agentRoutineId: opt.routineId || 'workspace_turn',
            agentScope: opt.scope || '',
            promptInput: currentRaw
        });
        this._clearComposerDomValue(compEl, currentRaw);
    }

    async _ensureActiveSession() {
        if (this.activeSessionId) return this.activeSessionId;
        const ts = this.utils.formatDate ? this.utils.formatDate(new Date()) : new Date().toLocaleString();
        const res = await this.api.post('agent/sessions', { title: `New Conversation (${ts})` });
        if (res.ok) {
            const data = await res.json();
            await AgentStore.getState().fetchSessions();
            await AgentStore.getState().selectSession(data.session_id);
            return data.session_id;
        }
        return null;
    }
    async _sendPrompt() {
        const rawInput = (this.promptInput || '').trim();

        // If a routine handoff card is awaiting the external LLM response, route the bottom input box directly to resume it!
        if (this.pendingHandoff && this.pendingHandoff.pending_handoff && rawInput && !rawInput.startsWith('/')) {
            const ph = this.pendingHandoff.pending_handoff;
            const branches = Array.isArray(ph.branches) && ph.branches.length > 0 ? ph.branches : [ph];
            const safeIdx = Math.min(this._handoffBranchIdx || 0, branches.length - 1);
            const activeBranch = branches[safeIdx] || ph;
            const nextMap = { ...(this._handoffBranchResponses || {}), [activeBranch.node_id]: rawInput };

            if (branches.length > 1 && !branches.every(b => (nextMap[b.node_id] || '').trim())) {
                const nextUnfilled = branches.findIndex(b => !(nextMap[b.node_id] || '').trim());
                AgentStore.setState({
                    promptInput: '',
                    handoffBranchResponses: nextMap,
                    handoffBranchIdx: nextUnfilled !== -1 ? nextUnfilled : safeIdx
                });
                return;
            }

            const priorCtx = this.pendingHandoff.chain_context || {};
            const targetRoutineId = this.pendingHandoff.routine_id || this.agentRoutineId;
            const sesId = await this._ensureActiveSession();
            if (!sesId) return;

            AgentStore.setState({
                promptInput: '',
                pendingHandoff: null,
                handoffBranchIdx: 0,
                handoffBranchResponses: {},
                handoffPasteText: ''
            });
            this.activeJobMessage = "Processing response...";
            const resumeJob = this.api.bindJobAction(
                'agent/prompt',
                {
                    session_id: sesId,
                    prompt: 'Resume Routine Handoff',
                    mode: this.agentMode,
                    routine_id: targetRoutineId,
                    transport: 'manual',
                    handoff_responses: nextMap,
                    prior_chain_context: priorCtx
                },
                {
                    onProgress: (msg) => {
                        this.activeJobMessage = msg;
                    },
                    onComplete: async (sData) => {
                        this.activeJobMessage = '';
                        const art = sData?.artifact || sData;
                        if (art?.status === 'paused_for_user' && art.pending_handoff) {
                            AgentStore.setState({ pendingHandoff: art, handoffBranchIdx: 0, handoffBranchResponses: {}, handoffPasteText: '' });
                        } else {
                            if (art?.unapplied_patches && window.inSetu?.stores?.Bridge?.getState()?.parseAndAppendCells) {
                                window.inSetu.stores.Bridge.getState().clearPayload();
                                window.inSetu.stores.Bridge.getState().parseAndAppendCells(art.unapplied_patches);
                                window.inSetu.stores.Bridge.setState({ activeSurface: 'chat' });
                            }
                            AgentStore.setState({ lastTurnCommittedFiles: art?.committed_files || [] });
                            await AgentStore.getState().fetchSessions();
                            await AgentStore.getState().selectSession(sesId);
                        }
                    },
                    onError: (err) => {
                        this.activeJobMessage = '';
                        alert("Routine Error: " + err.message);
                    }
                }
            );
            try {
                await resumeJob();
            } catch (_) {
                this.activeJobMessage = '';
            }
            return;
        }

        if (this.agentMode === 'undo') {
            AgentStore.getState().setModePrefix('auto');
            await this._undoLastTurn();
            return;
        }
        const isCustomRoutine = this.agentRoutineId && this.agentRoutineId !== 'workspace_turn';
        if (!rawInput && !isCustomRoutine) return;
        const activePill = this._getActiveCommandPillText();
        const displayUserBubble = rawInput
            ? (this.agentMode !== 'auto' ? `${activePill} ${rawInput}` : rawInput)
            : activePill;
        const userText = rawInput || activePill;

        // If a budget checkpoint is pending and user confirms resume:
        let priorContext = null;
        if (this.pendingCheckpoint && (rawInput.toLowerCase().includes('resume') || rawInput.toLowerCase().includes('continue'))) {
            priorContext = this.pendingCheckpoint.chain_context || null;
            AgentStore.setState({ pendingCheckpoint: null });
        }

        // If user pasted raw Yomama patch blocks without an explicit /yomama prefix, hand off to the Bridge staging surface immediately
        if (
            !userText.trim().startsWith('/yomama') &&
            (userText.includes('<<<<<<< FILE:') || userText.includes('<<<<<<< RELOCATE') || userText.includes('<<<<<<< RENAME')) &&
            window.inSetu?.stores?.Bridge?.getState()?.parseAndAppendCells
        ) {
            AgentStore.setState({ promptInput: '' });
            window.inSetu.stores.Bridge.getState().parseAndAppendCells(userText);
            return;
        }

        const sesId = await this._ensureActiveSession();
        if (!sesId) return;

        AgentStore.setState(s => ({
            promptInput: '',
            agentMode: 'auto',
            agentRoutineId: 'workspace_turn',
            agentScope: '',
            messages: [...(s.messages || []), { role: 'user', content: displayUserBubble, timestamp: Date.now() / 1000 }]
        }));
        this.activeJobMessage = "Submitting prompt...";
        const runTurn = this.api.bindJobAction(
            'agent/prompt',
            {
                session_id: sesId,
                prompt: userText,
                mode: this.agentMode,
                scope: this.agentScope || undefined,
                profile_id: this.activeProfileId,
                routine_id: this.agentRoutineId,
                attached_files: this.pinnedFiles,
                read_only_files: this.referenceFiles,
                prior_chain_context: priorContext
            },
            {
                onProgress: (msg) => {
                    this.activeJobMessage = msg;
                },
                onComplete: async (statusData) => {
                    this.activeJobMessage = '';
                    const art = statusData?.artifact || statusData;
                    if (art?.status === 'paused_for_user' && art.pending_handoff) {
                        const globalCtx = art.chain_context?.global || {};
                        const nextPinned = Array.isArray(globalCtx.attached_files) ? globalCtx.attached_files : this.pinnedFiles;
                        const nextRef = Array.isArray(globalCtx.read_only_files) ? globalCtx.read_only_files : this.referenceFiles;
                        AgentStore.setState({
                            pendingHandoff: art,
                            pinnedFiles: nextPinned,
                            referenceFiles: nextRef,
                            handoffBranchIdx: 0,
                            handoffBranchResponses: {},
                            handoffPasteText: ''
                        });
                        return;
                    }
                    if (art?.status === 'paused_for_budget') {
                        AgentStore.setState({
                            pendingCheckpoint: art.checkpoint || art,
                        });
                        return;
                    }
                    if (art?.unapplied_patches && window.inSetu?.stores?.Bridge?.getState()?.parseAndAppendCells) {
                        window.inSetu.stores.Bridge.getState().clearPayload();
                        window.inSetu.stores.Bridge.getState().parseAndAppendCells(art.unapplied_patches);
                        window.inSetu.stores.Bridge.setState({ activeSurface: 'chat' });
                    }
                    AgentStore.setState({
                        pendingHandoff: null,
                        lastTurnCommittedFiles: art?.committed_files || []
                    });
                    await AgentStore.getState().fetchSessions();
                    await AgentStore.getState().selectSession(sesId);
                },
                onError: (err) => {
                    this.activeJobMessage = '';
                    alert("Agent Turn Error: " + err.message);
                }
            }
        );
        try {
            await runTurn();
        } catch (e) {
            this.activeJobMessage = '';
        }
    }

    async _cancelTurn() {
        if (!this.activeSessionId) return;
        await this.api.post('agent/cancel', { session_id: this.activeSessionId });
        this.activeJobMessage = '';
    }

    async _undoLastTurn() {
        if (!this.activeSessionId) return;
        const res = await this.api.post('agent/undo', { session_id: this.activeSessionId });
        if (res.ok) {
            await AgentStore.getState().fetchSessions();
            await AgentStore.getState().selectSession(this.activeSessionId);
            this.setStatus("⏪ Reverted last agent patch transaction.", 2500);
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || "Nothing to undo for this session.");
        }
    }

    _estimateFileTokens(filepath, tier = 'pinned') {
        if (!filepath) return 0;
        const activeBuffers = window.inSetu?.stores?.Fs?.getState?.()?.activeBuffers || {};
        const buf = activeBuffers[filepath];
        if (buf && typeof buf.content === 'string' && buf.content !== 'Loading...') {
            const fullTok = Math.max(1, Math.round(buf.content.length / 4));
            return tier === 'reference' ? Math.max(40, Math.round(fullTok * 0.2)) : fullTok;
        }
        const wsRaw = AgentStore.getState()?.workingSetRaw || [];
        const entry = wsRaw.find(x => x && x.filepath === filepath);
        if (entry && Number(entry.tokens) > 0) {
            return Number(entry.tokens);
        }
        if (tier === 'constitution') return 450;
        if (tier === 'reference') return 200;
        return 1500;
    }

    _getScopedConstitutionFiles() {
        const rawConst = Array.from(new Set(this.constitutionFiles || []));
        const explicitFiles = [...(this.pinnedFiles || []), ...(this.referenceFiles || [])];
        if (this.activePlanPath) explicitFiles.push(this.activePlanPath);
        const activeRepos = new Set(
            explicitFiles
                .map(fp => new this.utils.InSetuURI(fp).repo)
                .filter(Boolean)
        );
        const globalPins = this.ecosystem?.pinnedRepos;
        if (globalPins && !globalPins.has('ALL')) {
            globalPins.forEach(r => activeRepos.add(r));
        }
        if (activeRepos.size === 0) return rawConst;
        const filtered = rawConst.filter(fp => activeRepos.has(new this.utils.InSetuURI(fp).repo));
        return filtered.length > 0 ? filtered : rawConst;
    }

    _formatContextPillLabel(filepath, tier, tokCount) {
        const uri = new this.utils.InSetuURI(filepath);
        const repoPrefix = uri.repo ? `[${uri.repo}] ` : '';
        const icon = tier === 'constitution' ? '📜' : (tier === 'reference' ? '🔒' : '✏️');
        const badge = tier === 'constitution' ? '[Auto]' : (tier === 'reference' ? '[Slice]' : '[Full]');
        return `${icon} ${repoPrefix}${uri.basename} · ${tokCount} tok ${badge}`;
    }

    _estimateWorkingSetTokens() {
        const charPerTok = 4;
        const scopedConstitution = this._getScopedConstitutionFiles();
        const cTokens = scopedConstitution.reduce((acc, fp) => acc + this._estimateFileTokens(fp, 'constitution'), 0);
        const rTokens = (this.referenceFiles || []).reduce((acc, fp) => acc + this._estimateFileTokens(fp, 'reference'), 0);
        const pTokens = (this.pinnedFiles || []).reduce((acc, fp) => acc + this._estimateFileTokens(fp, 'pinned'), 0);
        const promptTokens = Math.round((this.promptInput || '').length / charPerTok);
        return {
            scopedConstitution,
            constitution: cTokens,
            references: rTokens,
            pinned: pTokens,
            prompt: promptTokens,
            total: cTokens + rTokens + pTokens + promptTokens
        };
    }

    render() {
        const tokenEst = this._estimateWorkingSetTokens();
        const scopedConstitution = tokenEst.scopedConstitution || [];
        const softCeiling = 12000;
        const ceilingRatio = tokenEst.total / softCeiling;
        const tokenIntent = ceilingRatio > 1.0 ? 'danger' : (ceilingRatio > 0.75 ? 'warning' : 'success');

        const totalContextFiles = scopedConstitution.length + (this.referenceFiles?.length || 0) + (this.pinnedFiles?.length || 0);
        const compactTokStr = tokenEst.total >= 1000 ? `${(tokenEst.total / 1000).toFixed(1)}k` : `${tokenEst.total}`;

        return html`
            <sutram-view>
                <sutram-floating-hud
                    slot="overlay"
                    position="top-right"
                    icon="database"
                    .badgeText=${`~${compactTokStr}${totalContextFiles > 0 ? ` (${totalContextFiles})` : ''}`}
                    .titleText=${`Context Budget: ~${tokenEst.total.toLocaleString()} / ${softCeiling.toLocaleString()} tok`}
                    .intent=${tokenIntent}
                    .open=${this._hudExpanded}
                    @sutram-hud-toggled=${(e) => { this._hudExpanded = e.detail.open; }}>
                    <sutram-tag slot="header" .text=${tokenIntent === 'danger' ? 'Over Soft Budget' : (tokenIntent === 'warning' ? 'Near Ceiling' : 'Optimal')} .intent=${tokenIntent}></sutram-tag>
                    <sutram-stack direction="col" gap="xs">
                        <sutram-label .text=${`Session: ${(this.tokenLedger?.prompt_tokens || 0).toLocaleString()} in / ${(this.tokenLedger?.completion_tokens || 0).toLocaleString()} out / ~${(this.tokenLedger?.saved_by_slicing ?? this.tokenLedger?.saved_by_slicing_tokens ?? 0).toLocaleString()} saved`}></sutram-label>
                        <sutram-label .text=${`Breakdown: Constitution ${tokenEst.constitution} tok · Reference Slices ${tokenEst.references} tok · Pinned Targets ${tokenEst.pinned} tok · Prompt ${tokenEst.prompt} tok`}></sutram-label>
                        ${totalContextFiles > 0 ? html`
                            <sutram-stack direction="row" gap="xs" ?wrap=${true}>
                                ${scopedConstitution.map(f => html`
                                    <sutram-pill
                                        labelText=${this._formatContextPillLabel(f, 'constitution', this._estimateFileTokens(f, 'constitution'))}
                                        pillId=${f}
                                        title=${`${f} — Tier 0 Constitution File (Auto-Pinned Architectural Standards)`}
                                        ?active=${true}>
                                    </sutram-pill>
                                `)}
                                ${(this.referenceFiles || []).filter(f => !scopedConstitution.includes(f)).map(f => html`
                                    <sutram-pill
                                        labelText=${this._formatContextPillLabel(f, 'reference', this._estimateFileTokens(f, 'reference'))}
                                        pillId=${f}
                                        title="${f} — Tier 1 Reference Interface (Click to promote to Full Source, Shift+Click to dismiss)"
                                        ?active=${false}
                                        @sutram-pill-toggled=${(e) => {
                                            if (e.detail?.originalEvent?.shiftKey) {
                                                AgentStore.setState({
                                                    referenceFiles: this.referenceFiles.filter(x => x !== f)
                                                });
                                            } else {
                                                AgentStore.setState({
                                                    referenceFiles: this.referenceFiles.filter(x => x !== f),
                                                    pinnedFiles: [...this.pinnedFiles, f]
                                                });
                                            }
                                        }}>
                                    </sutram-pill>
                                `)}
                                ${(this.pinnedFiles || []).filter(f => !scopedConstitution.includes(f)).map(f => html`
                                    <sutram-pill
                                        labelText=${this._formatContextPillLabel(f, 'pinned', this._estimateFileTokens(f, 'pinned'))}
                                        pillId=${f}
                                        title="${f} — Tier 2 Pinned Edit Target (Click to demote to AST Slice, Shift+Click to dismiss)"
                                        ?active=${true}
                                        @sutram-pill-toggled=${(e) => {
                                            if (e.detail?.originalEvent?.shiftKey) {
                                                AgentStore.setState({
                                                    pinnedFiles: this.pinnedFiles.filter(x => x !== f)
                                                });
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
                        ` : html`<sutram-label text="Working set empty. Use [+] below to attach files or run a turn to auto-populate."></sutram-label>`}
                    </sutram-stack>
                </sutram-floating-hud>

                <sutram-stack direction="col" gap="md" ?flex=${true}>
                    ${this.activePlanPath ? html`
                        <sutram-surface variant="tinted" intent="highlight" padding="sm">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                <sutram-stack direction="row" align="center" gap="xs">
                                    <sutram-icon name="list-checks" size="sm" intent="highlight"></sutram-icon>
                                    <strong>Active Plan: ${new this.utils.InSetuURI(this.activePlanPath).basename}</strong>
                                </sutram-stack>
                                <sutram-btn
                                    ?compact=${true}
                                    intent="highlight"
                                    icon="external-link"
                                    label="Open Plan"
                                    @click=${() => {
                                        if (this.vfs?.viewSourceFile) this.vfs.viewSourceFile(this.activePlanPath, true);
                                    }}>
                                </sutram-btn>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}
                    ${this.messages.length === 0 && !this.activeJobMessage ? html`
                        <sutram-surface variant="tinted" intent="primary" padding="lg">
                            <sutram-stack direction="col" align="center" justify="center" gap="sm">
                                <sutram-icon name="message-square" size="xl" intent="primary"></sutram-icon>
                                <h3>Yomama Agent Stream</h3>
                                <sutram-label text="Ask a question, run a declarative routine (/code, /plan, /ask, /yomama), or paste a patch sandwich at the bottom."></sutram-label>
                            </sutram-stack>
                        </sutram-surface>
                    ` : this.messages.map(m => html`
                        <sutram-surface
                            variant="bubble"
                            intent=${m.role === 'user' ? 'primary' : 'neutral'}>
                            <sutram-label .text=${m.role === 'user' ? 'You' : 'Yomama Agent'}></sutram-label>
                            <sutram-label intent="neutral" ?multiline=${true} .text=${m.content}></sutram-label>
                        </sutram-surface>
                    `)}
                    ${this.pendingCheckpoint && this.pendingCheckpoint.chain_context ? html`
                        <sutram-surface variant="tinted" intent="warning" padding="md" gap="sm">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                <sutram-stack direction="row" align="center" gap="xs">
                                    <sutram-icon name="alert-circle" size="md" intent="warning"></sutram-icon>
                                    <strong>P1 Execution Budget Checkpoint Reached</strong>
                                </sutram-stack>
                                <sutram-tag text="Wavefront ${this.pendingCheckpoint.wavefront_index ?? 0}" intent="warning"></sutram-tag>
                            </sutram-stack>
                            <sutram-label text="Turn paused at step budget limit to prevent unbounded execution. Resume to continue the next wavefront:"></sutram-label>
                            <sutram-stack direction="row" align="center" gap="sm">
                                <sutram-btn
                                    ?compact=${true}
                                    intent="warning"
                                    icon="play"
                                    label="Resume Turn"
                                    @click=${() => {
                                        AgentStore.setState({ promptInput: 'Resume from budget checkpoint' });
                                        this._sendPrompt();
                                    }}>
                                </sutram-btn>
                                <sutram-btn
                                    ?compact=${true}
                                    intent="neutral"
                                    icon="x"
                                    label="Dismiss"
                                    @click=${() => AgentStore.setState({ pendingCheckpoint: null })}>
                                </sutram-btn>
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}
                    ${this._stagedBridgeCells && this._stagedBridgeCells.length > 0 ? (() => {
                        const grouped = this._stagedBridgeCells.reduce((acc, cell) => {
                            if (!acc[cell.file]) acc[cell.file] = [];
                            acc[cell.file].push(cell);
                            return acc;
                        }, {});
                        const activeCount = this._stagedBridgeCells.filter(c => c.active).length;
                        return html`
                            <sutram-surface variant="panel" intent="highlight" padding="md" gap="md">
                                <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                    <sutram-stack direction="row" align="center" gap="xs">
                                        <sutram-icon name="layers" size="md" intent="highlight"></sutram-icon>
                                        <strong>Staged Patch Stacks (${activeCount} of ${this._stagedBridgeCells.length} selected)</strong>
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
                                                            window.inSetu.stores.Bridge.setState({ telemetry: tel, viewMode: 'console' });
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
                    })() : ''}
                    ${this._lastTurnCommittedFiles && this._lastTurnCommittedFiles.length > 0 ? html`
                        <sutram-stack direction="col" gap="xs">
                            ${this._lastTurnCommittedFiles.map(fp => html`
                                <sutram-card
                                    ?compact=${true}
                                    .filename=${fp}
                                    .titleText=${new this.utils.InSetuURI(fp).basename}
                                    .detailText=${fp}
                                    icon="file-check-2"
                                    intent="success"
                                    entityType="file"
                                    .entityData=${{ filepath: fp, isFS: true }}
                                    ?disableSelection=${true}
                                    @card-clicked=${() => { if (this.vfs?.viewSourceFile) this.vfs.viewSourceFile(fp, true); }}>
                                </sutram-card>
                            `)}
                        </sutram-stack>
                    ` : ''}
                    ${this.activeJobMessage ? html`
                        <sutram-surface variant="panel" intent="primary" padding="sm">
                            <sutram-spinner .text=${this.activeJobMessage}></sutram-spinner>
                        </sutram-surface>
                    ` : ''}
                </sutram-stack>

                ${this.pendingHandoff && this.pendingHandoff.pending_handoff ? (() => {
                    const ph = this.pendingHandoff.pending_handoff;
                    const branches = Array.isArray(ph.branches) && ph.branches.length > 0 ? ph.branches : [ph];
                    const safeIdx = Math.min(this._handoffBranchIdx || 0, branches.length - 1);
                    const activeBranch = branches[safeIdx] || ph;
                    const routineObj = (this.routines || []).find(r => r.id === (this.pendingHandoff.routine_id || this.agentRoutineId));
                    const displayTitle = this.pendingHandoff.routine_title || activeBranch.routine_title || routineObj?.title || routineObj?.name || this.pendingHandoff.routine_id || 'Routine';
                    const wfCtxUri = activeBranch.workflow_context_uri || '';
                    const promptToCopy = activeBranch.prompt_text || activeBranch.compiled_prompt || '';
                    return html`
                        <sutram-surface slot="footer" variant="tinted" intent="warning" border="top" padding="md" gap="sm">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                                    <sutram-icon name="zap" size="sm" intent="warning"></sutram-icon>
                                    <strong>External LLM Handoff • ${displayTitle} (${activeBranch.node_id})</strong>
                                    ${activeBranch.tier ? html`<sutram-tag text=${activeBranch.tier} intent="warning"></sutram-tag>` : ''}
                                </sutram-stack>
                                <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                                    ${wfCtxUri ? (() => {
                                        const chunks = this.vfs?.getChunks ? this.vfs.getChunks(wfCtxUri) : [wfCtxUri];
                                        const ctxEntityData = {
                                            filepath: wfCtxUri,
                                            isFS: false,
                                            chunks,
                                            suppress: ['file-edit', 'file-browse', 'file-view', 'file-window']
                                        };
                                        const rawActions = window.ExtensionRegistry?.getEntityActions
                                            ? window.ExtensionRegistry.getEntityActions('file:context', ctxEntityData)
                                            : [];
                                        const shareActions = rawActions.filter(a =>
                                            !a.bulkOnly && ['file-copy', 'file-download', 'file-share'].includes(a.id)
                                        );
                                        const menuItems = shareActions.map(act => ({
                                            label: typeof act.label === 'function' ? act.label(ctxEntityData) : act.label,
                                            icon: act.icon,
                                            intent: act.intent,
                                            onClick: (e) => {
                                                if (window.ExtensionRegistry?.executeEntityAction) {
                                                    return window.ExtensionRegistry.executeEntityAction(act, ctxEntityData, e);
                                                }
                                                if (act.onClick) return act.onClick(ctxEntityData, e);
                                                if (act.asyncAction) return act.asyncAction(ctxEntityData, e);
                                            }
                                        }));
                                        return html`
                                            <sutram-dropdown align="left" direction="up" .items=${menuItems}>
                                                <sutram-btn
                                                    slot="trigger"
                                                    ?compact=${true}
                                                    intent="highlight"
                                                    icon="package"
                                                    label="Context">
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
                                        const isDone = Boolean((this._handoffBranchResponses[b.node_id] || '').trim());
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
                                        AgentStore.setState({
                                            promptInput: '',
                                            pendingHandoff: null,
                                            handoffBranchIdx: 0,
                                            handoffBranchResponses: {},
                                            handoffPasteText: ''
                                        });
                                    }}>
                                </sutram-btn>
                                <sutram-async-btn
                                    label="Ingest Reply & Continue"
                                    icon="corner-down-left"
                                    intent="warning"
                                    ?grow=${true}
                                    .onClick=${() => this._sendPrompt()}>
                                </sutram-async-btn>
                            </sutram-action-bar>
                        </sutram-surface>
                    `;
                })() : html`
                <sutram-surface slot="footer" variant="tinted" intent="primary" border="top" padding="sm" gap="sm">
                    <sutram-composer
                        placeholder="Ask Yomama."
                        .value=${this.promptInput || ''}
                        .triggers=${this._getAllCommandOptions().map(o => ({
                            ...o,
                            token: (o.slash || '').replace(/^\//, ''),
                            altToken: (o.altSlash || '').replace(/^\//, ''),
                            pillLabel: `${o.slash} ▾`,
                            badge: o.ctxCount ? `${o.ctxCount} ctx` : o.slash
                        }))}
                        .activeTrigger=${this.agentMode && this.agentMode !== 'auto'
                            ? {
                                id: this.agentMode === 'user' ? `user:${this.agentRoutineId}` : this.agentMode,
                                token: this._getActiveCommandPillText().replace(/^\//, ''),
                                pillLabel: `${this._getActiveCommandPillText()} ▾`
                            }
                            : { id: 'auto', token: 'auto', pillLabel: '/auto ▾' }}
                        @sutram-input-changed=${e => {
                            const val = e.detail?.value ?? '';
                            const slashMatch = val.match(/^(\/(?:user:[a-zA-Z0-9_:-]+|[a-zA-Z0-9_:-]+))\s+([\s\S]*)$/);
                            if (slashMatch) {
                                const typedSlash = slashMatch[1].toLowerCase();
                                const restText = slashMatch[2] || '';
                                const matchedOpt = this._getAllCommandOptions().find(
                                    o => (o.slash || '').toLowerCase() === typedSlash || (o.altSlash || '').toLowerCase() === typedSlash
                                );
                                if (matchedOpt) {
                                    this._selectCommandOption(matchedOpt, restText, e.currentTarget);
                                    return;
                                }
                            }
                            AgentStore.setState({ promptInput: val });
                        }}
                        @sutram-trigger-changed=${e => {
                            const trig = e.detail.trigger;
                            const rem = (e.detail?.remainingText ?? '').replace(/^\/(?:user:[a-zA-Z0-9_:-]*|[a-zA-Z0-9_:-]*)\s*/, '');
                            if (!trig || trig.id === 'auto') {
                                AgentStore.getState().setModePrefix('auto');
                                this._clearComposerDomValue(e.currentTarget, rem);
                            } else {
                                this._selectCommandOption(trig, rem, e.currentTarget);
                            }
                        }}
                        @sutram-composer-submit=${() => this._sendPrompt()}>
                        <sutram-action-bar slot="footer" collapse="md" align="between">
                            <sutram-stack direction="row" align="center" gap="sm">
                                <sutram-btn
                                    intent="primary"
                                    icon="message-square"
                                    label="Conversations"
                                    title="Toggle Yomama Conversations Drawer"
                                    @click=${() => this.dispatch('insetu:yomama:toggle-drawer')}>
                                </sutram-btn>
                                <sutram-dropdown direction="up" align="left">
                                    <sutram-btn
                                        slot="trigger"
                                        intent="neutral"
                                        icon="settings"
                                        label="Settings"
                                        title="Agent & Compute Profile Settings">
                                    </sutram-btn>
                                    <sutram-stack slot="content" direction="col" gap="sm" padding="xs">
                                        <strong>Agent Quick Settings</strong>
                                        <sutram-select
                                            label="Compute Profile"
                                            ?flush=${true}
                                            .value=${this.activeProfileId || 'default'}
                                            .options=${((this.llmProfiles && this.llmProfiles.length > 0) ? this.llmProfiles : [{ id: 'default', title: 'Default Configuration' }]).map(p => ({ value: p.id, label: p.title || p.id }))}
                                            @sutram-input-changed=${e => AgentStore.getState().selectProfile(e.detail.value)}>
                                        </sutram-select>
                                        <sutram-select
                                            label="Substrate Helper Mode (RAG, Compaction & Healer)"
                                            ?flush=${true}
                                            .value=${this.agentSettings?.helper_mode || 'ai_assisted'}
                                            .options=${[
                                                { value: 'deterministic', label: 'Deterministic Only (0 tok AST & Sandwich Healer)' },
                                                { value: 'ai_assisted', label: 'AI-Assisted (Fast-Tier Scout, Compactor & Healer)' }
                                            ]}
                                            @sutram-input-changed=${e => AgentStore.getState().updateAgentSetting('helper_mode', e.detail.value)}>
                                        </sutram-select>
                                        <sutram-toggle
                                            label="Run Test Gate After /code"
                                            ?flush=${true}
                                            .checked=${Boolean(this.agentSettings?.run_tests_on_code)}
                                            @sutram-input-changed=${e => AgentStore.getState().updateAgentSetting('run_tests_on_code', e.detail.value)}>
                                        </sutram-toggle>
                                        <sutram-stack direction="row" gap="xs">
                                            <sutram-btn
                                                ?compact=${true}
                                                intent="neutral"
                                                icon="cpu"
                                                label="Compute Pool..."
                                                ?grow=${true}
                                                @click=${() => window.inSetu?.events?.emit('insetu:system:open-settings-view', { view: 'ext:llm' })}>
                                            </sutram-btn>
                                            <sutram-btn
                                                ?compact=${true}
                                                intent="neutral"
                                                icon="sliders"
                                                label="All Settings..."
                                                ?grow=${true}
                                                @click=${() => window.inSetu?.events?.emit('insetu:system:open-settings-view', { view: 'ext:agent' })}>
                                            </sutram-btn>
                                        </sutram-stack>
                                    </sutram-stack>
                                </sutram-dropdown>
                                <sutram-dropdown
                                    align="left"
                                    direction="up"
                                    .items=${(() => {
                                        const basketItems = Array.from(window.inSetu?.stores?.Selection?.getState?.()?.selectedItems?.values?.() || []);
                                        const basketCount = basketItems.length;
                                        const activeEditorFile = window.inSetu?.editor?.getActiveEditorPath ? window.inSetu.editor.getActiveEditorPath() : null;
                                        const activeEditorName = activeEditorFile ? new this.utils.InSetuURI(activeEditorFile).basename : 'None';

                                        return [
                                            {
                                                label: "📄 Choose Files... (Workspace Explorer)",
                                                icon: "folder",
                                                onClick: () => {
                                                    if (window.inSetu.ui.openWorkspaceBrowser) {
                                                        window.inSetu.ui.openWorkspaceBrowser({
                                                            mode: 'file',
                                                            title: 'Add Context File',
                                                            callback: (filepath) => {
                                                                if (!this.pinnedFiles.includes(filepath)) {
                                                                    AgentStore.setState({
                                                                        pinnedFiles: [...this.pinnedFiles, filepath]
                                                                    });
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                            },
                                            {
                                                label: `🧺 Add from Selection Basket (${basketCount})`,
                                                icon: "package",
                                                disabled: basketCount === 0,
                                                onClick: () => {
                                                    const uris = basketItems.map(i => i.data?.filepath || i.filepath).filter(Boolean);
                                                    const combined = Array.from(new Set([...this.pinnedFiles, ...uris]));
                                                    AgentStore.setState({ pinnedFiles: combined });
                                                }
                                            },
                                            {
                                                label: `✏️ Add Active Editor File (${activeEditorName})`,
                                                icon: "edit-3",
                                                disabled: !activeEditorFile,
                                                onClick: () => {
                                                    if (activeEditorFile && !this.pinnedFiles.includes(activeEditorFile)) {
                                                        AgentStore.setState({
                                                            pinnedFiles: [...this.pinnedFiles, activeEditorFile]
                                                        });
                                                    }
                                                }
                                            }
                                        ];
                                    })()}>
                                    <sutram-btn
                                        slot="trigger"
                                        icon="plus"
                                        label="Add Context"
                                        intent="neutral"
                                        title="Add Working Set Context (+)">
                                    </sutram-btn>
                                </sutram-dropdown>
                            </sutram-stack>

                            <sutram-stack direction="row" align="center" gap="sm">
                                ${this.activeJobMessage ? html`
                                    <sutram-async-btn
                                        icon="square"
                                        label="Stop"
                                        intent="danger"
                                        title="Stop Active Turn"
                                        .onClick=${() => this._cancelTurn()}>
                                    </sutram-async-btn>
                                ` : ''}
                                <sutram-async-btn
                                    label="Send"
                                    icon="send"
                                    intent="primary"
                                    title="Send Prompt"
                                    .onClick=${() => this._sendPrompt()}>
                                </sutram-async-btn>
                            </sutram-stack>
                        </sutram-action-bar>
                    </sutram-composer>
                </sutram-surface>
                `}
            </sutram-view>
        `;
    }
}
customElements.define('insetu-core-agent', InSetuCoreAgent);
window.ExtensionRegistry.registerExtension('agent', {
    name: "Agent Harness",
    version: "2.0.0",
    offline_mode: "read_only",
    entityActions: [
        {
            targetEntity: 'agent_routine',
            id: 'routine-run-chat',
            label: 'Select in Chat',
            icon: 'play',
            intent: 'primary',
            group: 'tools',
            vfsBound: false,
            order: 5,
            onClick: (data) => {
                AgentStore.getState().selectRoutine({
                    routineId: data.id,
                    mode: data.default_mode || data.id,
                    slashCommand: data.slash_command || `/${data.id}`
                });
                window.inSetu.events.emit('insetu:yomama:navigate', { surface: 'chat' });
            }
        },
        {
            targetEntity: 'agent_routine',
            id: 'routine-studio-edit',
            label: (data) => (data?.source === 'builtin' || data?.is_shared) ? 'Fork & Customize' : 'Edit in Studio',
            icon: 'sliders',
            intent: 'warning',
            group: 'edit',
            vfsBound: false,
            order: 10,
            emitEvent: (data) => ({ name: 'insetu:agent:edit-routine', detail: { routine: data, fork: false } })
        },
        {
            targetEntity: 'agent_routine',
            id: 'routine-duplicate',
            label: 'Duplicate Routine',
            icon: 'copy',
            intent: 'neutral',
            group: 'edit',
            vfsBound: false,
            order: 15,
            emitEvent: (data) => ({ name: 'insetu:agent:edit-routine', detail: { routine: data, fork: true } })
        },
        {
            targetEntity: 'agent_routine',
            id: 'routine-raw-edit',
            label: 'View / Raw Edit (.md)',
            icon: 'code',
            intent: 'highlight',
            group: 'edit',
            vfsBound: false,
            order: 20,
            onClick: (data) => {
                if (data?.filepath && window.inSetu?.vfs?.viewSourceFile) {
                    const editable = data.source === 'workspace' || data.source === 'user_template';
                    window.inSetu.vfs.viewSourceFile(data.filepath, editable, true);
                }
            }
        },
        {
            targetEntity: 'agent_routine',
            id: 'routine-delete-override',
            label: (data) => data?.has_override ? 'Reset to Built-In' : 'Delete Routine',
            icon: 'trash-2',
            intent: 'danger',
            group: 'file',
            vfsBound: false,
            order: 30,
            match: (data) => data?.source === 'workspace' || data?.source === 'user_template',
            emitEvent: (data) => ({ name: 'insetu:agent:delete-routine', detail: { routine: data } })
        }
    ],
    customEditors: [
        {
            component: 'insetu-agent-routine-projection',
            match: (filepath) => filepath && filepath.startsWith('ctx://routines/'),
            onOpen: (filepath) => {
                const routines = AgentStore.getState().routines || [];
                const base = new window.inSetu.utils.InSetuURI(filepath).basename.replace(/\.(md|yaml|yml)$/, '');
                const found = routines.find(r => r.filepath === filepath || r.id === base);
                AgentStore.getState().openRoutineStudio(found || { id: base, title: base, filepath }, false);
            }
        }
    ],
    layoutSlots: [
        {
            slot: "slots:yomama-surface",
            id: "chat",
            label: "Chat",
            icon: "message-square",
            intent: "primary",
            order: 20,
            component: "insetu-core-agent"
        },
        {
            slot: "slots:yomama-surface",
            id: "routines",
            label: "Routines",
            icon: "workflow",
            intent: "warning",
            order: 30,
            component: "insetu-core-agent-routines"
        },
        {
            slot: "slots:yomama-drawer",
            id: "agent-sessions",
            label: "Conversations",
            order: 10,
            component: "insetu-core-agent-sessions"
        }
    ]
});
