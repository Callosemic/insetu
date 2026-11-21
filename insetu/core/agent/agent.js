import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import { AgentStore, ONE_SHOT_ROUTINES, classifyRoutineTargetUri, getAllAgentCommandOptions, preWarmHandoffContext } from '/static/extensions/agent/agent_store.js';
import { InSetuAgentRoutineProjection, InSetuCoreAgentRoutines } from '/static/extensions/agent/agent_routine_studio.js';
import {
    InSetuAgentContextHud, InSetuAgentExecutionTrace, InSetuAgentHandoffPanel, InSetuAgentPlanStepper,
    InSetuAgentStagedStacks, InSetuCoreAgentSessions, buildAgentTelemetryMenuItems,
    estimateWorkingSetTokensFromComponent, hasYomamaPatchBlocks,
} from '/static/extensions/agent/agent_staged_stacks.js';

export {
    AgentStore, classifyRoutineTargetUri, InSetuAgentRoutineProjection, InSetuCoreAgentRoutines,
    InSetuCoreAgentSessions, InSetuAgentContextHud, InSetuAgentExecutionTrace, InSetuAgentHandoffPanel, InSetuAgentPlanStepper, InSetuAgentStagedStacks,
};

export class InSetuCoreAgent extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        sessions: { type: Array }, routines: { type: Array }, llmProfiles: { type: Array },
        activeProfileId: { type: String }, activeSessionId: { type: String }, messages: { type: Array },
        loading: { type: Boolean }, constitutionFiles: { type: Array }, referenceFiles: { type: Array },
        pinnedFiles: { type: Array }, fileTokenMap: { type: Object }, executionTrace: { type: Array },
        tokenLedger: { type: Object }, activePlanPath: { type: String }, activePlan: { type: Object }, stagedTaskActions: { type: Array }, pendingCheckpoint: { type: Object },
        agentRoutineId: { type: String }, agentMode: { type: String }, agentScope: { type: String },
        agentSettings: { type: Object }, promptInput: { type: String }, webChatWindowMode: { type: String },
        activeJobMessage: { type: String }, pendingHandoff: { type: Object }, _lastQueryQuickpack: { type: Object, state: true }
    };
    static styles = [sharedStyles];
    constructor() {
        super();
        Object.assign(this, {
            sessions: [], routines: [], llmProfiles: [], activeProfileId: 'default', activeSessionId: null,
            messages: [], loading: false, constitutionFiles: [], referenceFiles: [], pinnedFiles: [],
            fileTokenMap: {}, executionTrace: [], activePlanPath: '', activePlan: null, stagedTaskActions: [], pendingCheckpoint: null,
            tokenLedger: { prompt_tokens: 0, completion_tokens: 0, saved_by_slicing: 0, by_tier: {}, total_cost_usd: 0 },
            agentRoutineId: 'workspace_turn', agentMode: 'auto', agentScope: '', promptInput: '',
            agentSettings: { helper_mode: 'ai_assisted', run_tests_on_code: false, strict_test_enforcement: false, auto_complete_plan_tasks: false },
            webChatWindowMode: 'same_window', activeJobMessage: '', pendingHandoff: null, _handoffBranchIdx: 0,
            _handoffBranchResponses: {}, _lastTurnCommittedFiles: [], _lastQueryQuickpack: null, _stagedBridgeCells: []
        });
    }

    connectedCallback() {
        super.connectedCallback();
        this.bindStore(AgentStore, state => ({
            sessions: state.sessions || [], routines: state.routines || [], llmProfiles: state.llmProfiles || [],
            activeProfileId: state.activeProfileId || 'default', activeSessionId: state.activeSessionId,
            messages: state.messages || [], loading: !!state.loading, constitutionFiles: state.constitutionFiles || [],
            referenceFiles: state.referenceFiles || [], pinnedFiles: state.pinnedFiles || [],
            fileTokenMap: state.fileTokenMap || {}, executionTrace: state.executionTrace || [],
            tokenLedger: state.tokenLedger || { prompt_tokens: 0, completion_tokens: 0, saved_by_slicing: 0, by_tier: {}, total_cost_usd: 0 },
            activePlanPath: state.activePlanPath || '', activePlan: state.activePlan || null, stagedTaskActions: state.stagedTaskActions || [], pendingCheckpoint: state.pendingCheckpoint || null,
            agentRoutineId: state.agentRoutineId || 'workspace_turn', agentMode: state.agentMode || 'auto',
            agentScope: state.agentScope || '', promptInput: state.promptInput || '',
            agentSettings: state.agentSettings || { helper_mode: 'ai_assisted', run_tests_on_code: false, strict_test_enforcement: false, auto_complete_plan_tasks: false },
            webChatWindowMode: state.webChatWindowMode || 'same_window', pendingHandoff: state.pendingHandoff || null,
            _handoffBranchIdx: state.handoffBranchIdx || 0, _handoffBranchResponses: state.handoffBranchResponses || {},
            _lastTurnCommittedFiles: state.lastTurnCommittedFiles || []
        }), { autoFetch: 'fetchSessions' });

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
        this.registerGlobalListener('paste', window, (e) => {
            if (!this.offsetParent) return;
            const activeSurf = window.inSetu?.stores?.Bridge?.getState()?.activeSurface || 'bridge';
            if (activeSurf !== 'chat') return;
            if (this.pendingHandoff && this.pendingHandoff.pending_handoff) return;
            const path = this.getEventPath(e);
            const isEditingExternalInput = path.some(el =>
                el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) && !this.shadowRoot?.contains(el)
            );
            if (isEditingExternalInput) return;
            const text = e.clipboardData?.getData('text') || '';
            if (text && !text.trim().startsWith('/yomama') && hasYomamaPatchBlocks(text)) {
                e.preventDefault();
                e.stopPropagation();
                this._ingestPastedPatchesAndProse(text);
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

    _getActiveCommandPillText() {
        if (this.agentMode === 'user' && this.agentRoutineId && this.agentRoutineId !== 'workspace_turn') {
            return `/${this.agentRoutineId}${this.agentScope ? ':' + this.agentScope : ''}`;
        }
        return `/${this.agentMode || 'auto'}`;
    }

    _getAllCommandOptions() {
        return getAllAgentCommandOptions(this.routines);
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

    async _handleCompletedTurnArtifact(art, sesId) {
        await AgentStore.getState().fetchSessions();
        await AgentStore.getState().selectSession(sesId);
        const stagedCount = AgentStore.getState().applyTurnSettlement(art, { clearBridgeFirst: true });
        if (stagedCount > 0) {
            this.setStatus(`📦 Staged ${stagedCount} patch block(s) in Chat for review.`, 3000);
        }
    }

    async _sendPrompt(options = {}) {
        const forceResumeCheckpoint = Boolean(options?.resumeCheckpoint);
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

            const origPrompt = this.pendingHandoff.user_prompt || 'Resume Routine Handoff';
            const targetRoutineId = this.pendingHandoff.routine_id || this.agentRoutineId;
            const sesId = await this._ensureActiveSession();
            if (!sesId) return;

            AgentStore.setState({
                promptInput: '',
                pendingHandoff: null,
                handoffBranchIdx: 0,
                handoffBranchResponses: {}
            });
            this.activeJobMessage = "Processing response...";
            const resumeJob = this.api.bindJobAction(
                'agent/prompt',
                {
                    session_id: sesId,
                    prompt: origPrompt,
                    mode: targetRoutineId === 'code' ? 'code' : this.agentMode,
                    profile_id: this.activeProfileId,
                    routine_id: targetRoutineId,
                    attached_files: this.pinnedFiles,
                    read_only_files: this.referenceFiles,
                    pinned_repos: Array.from(this.ecosystem?.pinnedRepos || ['ALL']),
                    web_chat_window_mode: this.webChatWindowMode,
                    handoff_responses: nextMap
                },
                {
                    onProgress: (msg) => {
                        this.activeJobMessage = msg;
                    },
                    onComplete: async (sData) => {
                        this.activeJobMessage = '';
                        const art = sData?.artifact || sData;
                        if (art?.status === 'paused_for_user' && art.pending_handoff) {
                            AgentStore.setState(s => ({
                                pendingHandoff: art,
                                activePlan: art.active_plan || s.activePlan,
                                pinnedFiles: Array.isArray(art.attached_files) ? art.attached_files : this.pinnedFiles,
                                referenceFiles: Array.isArray(art.read_only_files) ? art.read_only_files : this.referenceFiles,
                                fileTokenMap: { ...(s.fileTokenMap || {}), ...(art.file_token_map || {}) },
                                executionTrace: art.execution_trace || s.executionTrace || [],
                                handoffBranchIdx: 0,
                                handoffBranchResponses: {}
                            }));
                            preWarmHandoffContext(art);
                        } else {
                            await this._handleCompletedTurnArtifact(art, sesId);
                        }
                    },
                    onError: (err) => {
                        this.activeJobMessage = '';
                        this.setStatus(`⚠️ Routine Error: ${err.message}`, 4000, true);
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

        const liveState = AgentStore.getState();
        let effectiveMode = liveState.agentMode || this.agentMode || 'auto';
        let effectiveRoutineId = liveState.agentRoutineId || this.agentRoutineId || 'workspace_turn';
        let effectiveScope = liveState.agentScope || this.agentScope || '';
        let cleanedInput = rawInput;

        const leadingSlash = rawInput.match(/^(\/(?:user:[a-zA-Z0-9_:-]+|[a-zA-Z0-9_:-]+))(?:\s+([\s\S]*))?$/);
        if (leadingSlash) {
            const typedSlash = leadingSlash[1].toLowerCase();
            const matchedOpt = this._getAllCommandOptions().find(
                o => (o.slash || '').toLowerCase() === typedSlash || (o.altSlash || '').toLowerCase() === typedSlash
            );
            if (matchedOpt) {
                effectiveMode = matchedOpt.mode;
                effectiveRoutineId = matchedOpt.routineId || 'workspace_turn';
                effectiveScope = matchedOpt.scope || '';
                cleanedInput = (leadingSlash[2] || '').trim();
            }
        }

        if (effectiveMode === 'undo') {
            AgentStore.getState().setModePrefix('auto');
            await this._undoLastTurn();
            return;
        }
        // If a budget checkpoint is pending and user confirms resume:
        let resumeCheckpoint = forceResumeCheckpoint;
        if (!resumeCheckpoint && this.pendingCheckpoint && (rawInput.toLowerCase().includes('resume') || rawInput.toLowerCase().includes('continue'))) {
            resumeCheckpoint = true;
        }
        if (resumeCheckpoint) {
            AgentStore.setState({ pendingCheckpoint: null });
        }

        const isCustomRoutine = effectiveRoutineId && effectiveRoutineId !== 'workspace_turn';
        if (!cleanedInput && !isCustomRoutine && !resumeCheckpoint) return;
        const activePill = (effectiveMode === 'user' && effectiveRoutineId && effectiveRoutineId !== 'workspace_turn')
            ? `/${effectiveRoutineId}${effectiveScope ? ':' + effectiveScope : ''}`
            : `/${effectiveMode || 'auto'}`;
        const userText = resumeCheckpoint
            ? (this.pendingCheckpoint?.user_prompt || 'Resume from budget checkpoint')
            : (cleanedInput || activePill);

        if (
            !userText.trim().startsWith('/yomama') &&
            hasYomamaPatchBlocks(userText) &&
            window.inSetu?.stores?.Bridge?.getState()?.parseAndAppendCells
        ) {
            await this._ingestPastedPatchesAndProse(userText);
            return;
        }

        const sesId = await this._ensureActiveSession();
        if (!sesId) return;

        const isOneShot = ONE_SHOT_ROUTINES.has(effectiveRoutineId) || ONE_SHOT_ROUTINES.has(effectiveMode);
        AgentStore.setState(s => ({
            promptInput: '',
            agentMode: isOneShot ? 'auto' : effectiveMode,
            agentRoutineId: isOneShot ? 'workspace_turn' : effectiveRoutineId,
            agentScope: isOneShot ? '' : effectiveScope,
            messages: resumeCheckpoint
                ? (s.messages || [])
                : [...(s.messages || []), {
                    role: 'user',
                    content: cleanedInput || activePill,
                    mode: effectiveMode,
                    routine_id: effectiveRoutineId,
                    scope: effectiveScope,
                    command_pill: activePill,
                    timestamp: Date.now() / 1000
                }]
        }));
        this.activeJobMessage = "Submitting prompt...";
        const runTurn = this.api.bindJobAction(
            'agent/prompt',
            {
                session_id: sesId,
                prompt: userText,
                mode: effectiveMode,
                scope: effectiveScope || undefined,
                profile_id: this.activeProfileId,
                routine_id: effectiveRoutineId,
                attached_files: this.pinnedFiles,
                read_only_files: this.referenceFiles,
                pinned_repos: Array.from(this.ecosystem?.pinnedRepos || ['ALL']),
                web_chat_window_mode: this.webChatWindowMode,
                resume_checkpoint: resumeCheckpoint || undefined
            },
            {
                onProgress: (msg) => {
                    this.activeJobMessage = msg;
                },
                onComplete: async (statusData) => {
                    this.activeJobMessage = '';
                    const art = statusData?.artifact || statusData;
                    if (art?.status === 'paused_for_user' && art.pending_handoff) {
                        const nextPinned = Array.isArray(art.attached_files) ? art.attached_files : this.pinnedFiles;
                        const nextRef = Array.isArray(art.read_only_files) ? art.read_only_files : this.referenceFiles;
                        const nextConst = Array.isArray(art.constitution_files) ? art.constitution_files : this.constitutionFiles;
                        AgentStore.setState(s => ({
                            pendingHandoff: art,
                            activePlan: art.active_plan || s.activePlan,
                            constitutionFiles: nextConst,
                            pinnedFiles: nextPinned,
                            referenceFiles: nextRef,
                            fileTokenMap: { ...(s.fileTokenMap || {}), ...(art.file_token_map || {}) },
                            executionTrace: art.execution_trace || [],
                            handoffBranchIdx: 0,
                            handoffBranchResponses: {}
                        }));
                        preWarmHandoffContext(art);
                        return;
                    }
                    if (art?.status === 'paused_for_budget') {
                        AgentStore.setState({
                            pendingCheckpoint: art.checkpoint || art,
                        });
                        return;
                    }
                    await this._handleCompletedTurnArtifact(art, sesId);
                },
                onError: (err) => {
                    this.activeJobMessage = '';
                    this.setStatus(`⚠️ Agent Turn Error: ${err.message}`, 4000, true);
                }
            }
        );
        try {
            await runTurn();
        } catch (e) {
            this.activeJobMessage = '';
        }
    }

    async _ingestPastedPatchesAndProse(rawText) {
        AgentStore.setState({ promptInput: '' });
        this._clearComposerDomValue(null, '');
        const sesId = await this._ensureActiveSession();
        const res = await this.api.postJson('agent/ingest_reply', {
            session_id: sesId || '',
            role: 'assistant',
            raw_text: rawText
        }).catch(() => null);
        const stagedCount = AgentStore.getState().applyTurnSettlement(res || { unapplied_patches: rawText }, { clearBridgeFirst: false });
        if (res?.quickpack?.base_filename) {
            this._lastQueryQuickpack = res.quickpack;
            this.requestUpdate();
        }
        if (res?.quickpack?.base_filename && stagedCount > 0) {
            this.setStatus(`📦 Staged ${stagedCount} patch(es) & compiled Query Quickpack (${res.quickpack.file_count} file(s)).`, 3000);
        } else if (res?.quickpack?.base_filename) {
            this.setStatus(`📦 Compiled Query Quickpack (${res.quickpack.file_count} file(s)).`, 3000);
        } else {
            this.setStatus(`📦 Staged ${stagedCount || ''} patch block(s) in Chat.`, 2500);
        }
    }

    async _removeMessageBubble(msg, idx) {
        const msgId = msg?.message_id;
        const isLast = idx >= (this.messages?.length || 1) - 1;
        AgentStore.setState(s => {
            const nextMsgs = (s.messages || []).filter((m, i) => (msgId ? m.message_id !== msgId : i !== idx));
            const total = nextMsgs.length;
            return {
                messages: nextMsgs.map((m, i) => ({
                    ...m,
                    compaction_tier: i >= Math.max(0, total - 4) ? 'hot' : (i >= Math.max(0, total - 12) ? 'warm' : 'cold')
                }))
            };
        });
        if (msgId) {
            await this.api.delete(`agent/messages/${encodeURIComponent(msgId)}`).catch(() => {});
            if (isLast && this.activeSessionId) {
                await AgentStore.getState().selectSession(this.activeSessionId);
            }
        } else if (isLast && this.activeSessionId) {
            await this.api.postJson('agent/rewind', { session_id: this.activeSessionId }).catch(() => null);
            await AgentStore.getState().selectSession(this.activeSessionId);
        }
    }

    async _rewindToMessageBubble(msg, idx) {
        const msgId = msg?.message_id;
        if (this.activeJobMessage) {
            await this._cancelTurn().catch(() => {});
        }
        let restoredPrompt = String(msg?.content || '').trim();
        let nextMode = msg?.mode || this.agentMode || 'auto';
        let nextRoutineId = msg?.routine_id || this.agentRoutineId || 'workspace_turn';
        let nextScope = msg?.scope || this.agentScope || '';

        if (msgId || this.activeSessionId) {
            const res = await this.api.postJson('agent/rewind', {
                message_id: msgId || undefined,
                session_id: this.activeSessionId || undefined
            }).catch(() => null);
            if (res?.prompt_text !== undefined) {
                restoredPrompt = String(res.prompt_text).trim();
            }
            if (res?.mode) nextMode = res.mode;
            if (res?.routine_id) nextRoutineId = res.routine_id;
            if (res?.scope !== undefined) nextScope = res.scope || '';
        } else {
            AgentStore.setState(s => ({
                messages: (s.messages || []).slice(0, idx),
                pendingHandoff: null,
                pendingCheckpoint: null,
                handoffBranchIdx: 0,
                handoffBranchResponses: {}
            }));
        }

        window.inSetu?.stores?.Bridge?.getState()?.clearPayload?.();
        const slashMatch = restoredPrompt.match(/^(\/(?:user:[a-zA-Z0-9_:-]+|[a-zA-Z0-9_:-]+))(?:\s+([\s\S]*))?$/);
        if (slashMatch) {
            const typedSlash = slashMatch[1].toLowerCase();
            const matchedOpt = this._getAllCommandOptions().find(
                o => (o.slash || '').toLowerCase() === typedSlash || (o.altSlash || '').toLowerCase() === typedSlash
            );
            if (matchedOpt) {
                nextMode = matchedOpt.mode;
                nextRoutineId = matchedOpt.routineId || 'workspace_turn';
                nextScope = matchedOpt.scope || '';
                restoredPrompt = (slashMatch[2] || '').trim();
            }
        }
        if (this.activeSessionId) {
            await AgentStore.getState().selectSession(this.activeSessionId);
        }
        AgentStore.setState({
            agentMode: nextMode,
            agentRoutineId: nextRoutineId,
            agentScope: nextScope,
            promptInput: restoredPrompt,
            executionTrace: [],
            pendingHandoff: null,
            pendingCheckpoint: null,
            handoffBranchIdx: 0,
            handoffBranchResponses: {}
        });
        this._clearComposerDomValue(null, restoredPrompt);
        this.setStatus("⏪ Rewound conversation to prompt.", 2500);
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
            this.setStatus(`⚠️ ${err.error || "Nothing to undo for this session."}`, 4000, true);
        }
    }

    render() {
        const tokenEst = estimateWorkingSetTokensFromComponent(this);
        const activeNodeName = this.pendingHandoff?.pending_handoff?.node_id
            || (this.executionTrace || []).find(s => s.status === 'running')?.id
            || 'next turn';
        const budgetLimitUsd = Number(this.tokenLedger?.budget_limit_usd || 1.0);
        const budgetStepUsd = Number(this.tokenLedger?.budget_step_usd || 1.0);

        return html`
            <sutram-view>
                <insetu-agent-context-hud
                    slot="overlay"
                    .constitutionFiles=${this.constitutionFiles}
                    .referenceFiles=${this.referenceFiles}
                    .pinnedFiles=${this.pinnedFiles}
                    .fileTokenMap=${this.fileTokenMap}
                    .tokenLedger=${this.tokenLedger}
                    .activeNodeName=${activeNodeName}
                    .tokenEst=${tokenEst}>
                </insetu-agent-context-hud>

                <sutram-stack direction="col" gap="sm" padding="sm" ?flex=${true} @insetu-start-next-plan-step=${() => this._sendPrompt()}>
                    ${this.messages.length === 0 && !this.activeJobMessage ? html`
                        <sutram-surface variant="tinted" intent="primary" padding="lg">
                            <sutram-stack direction="col" align="center" justify="center" gap="sm">
                                <sutram-icon name="message-square" size="xl" intent="primary"></sutram-icon>
                                <h3>Yomama Agent Stream</h3>
                                <sutram-label text="Ask a question, run a declarative routine (/code, /plan, /ask, /yomama), or paste a patch sandwich at the bottom."></sutram-label>
                            </sutram-stack>
                        </sutram-surface>
                    ` : this.messages.map((m, mIdx) => html`
                        <sutram-surface
                            variant="bubble"
                            intent=${m.role === 'user' ? 'primary' : 'neutral'}>
                            <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                <sutram-stack direction="row" align="center" gap="xs">
                                    <sutram-label .text=${m.role === 'user' ? 'You' : 'Yomama Agent'}></sutram-label>
                                    ${m.seq ? html`<sutram-tag .text=${`#${m.seq}`} intent="neutral" title=${m.message_id || ''}></sutram-tag>` : ''}
                                    ${m.role === 'user' && (m.command_pill || (m.mode && m.mode !== 'auto')) ? html`
                                        <sutram-tag
                                            .text=${m.command_pill || `/${m.mode}`}
                                            intent="warning"
                                            title=${`Routine: ${m.routine_id || m.mode}`}>
                                        </sutram-tag>
                                    ` : ''}
                                    ${m.compaction_tier ? html`
                                        <sutram-tag
                                            .text=${m.compaction_tier === 'hot' ? 'Hot' : (m.compaction_tier === 'warm' ? 'Warm' : 'Cold')}
                                            intent=${m.compaction_tier === 'hot' ? 'success' : (m.compaction_tier === 'warm' ? 'highlight' : 'neutral')}
                                            title=${m.receipt ? `Receipt: ${m.receipt}` : ''}>
                                        </sutram-tag>
                                    ` : ''}
                                </sutram-stack>
                                <sutram-stack direction="row" align="center" gap="xs">
                                    <sutram-btn
                                        ?compact=${true}
                                        intent="neutral"
                                        icon="clipboard"
                                        title="Copy message text"
                                        @click=${() => {
                                            const rawTxt = String(m.content || '').trim();
                                            const pillPrefix = (m.role === 'user' && !rawTxt.startsWith('/'))
                                                ? (m.command_pill || (m.mode && m.mode !== 'auto' ? `/${m.mode}` : ''))
                                                : '';
                                            const fullCopy = pillPrefix ? `${pillPrefix} ${rawTxt}`.trim() : rawTxt;
                                            this.utils.copyRawText(fullCopy, "📋 Message copied!");
                                        }}>
                                    </sutram-btn>
                                    ${m.role === 'user' ? html`
                                        <sutram-btn
                                            ?compact=${true}
                                            intent="warning"
                                            icon="rewind"
                                            title="Rewind conversation to this prompt (restores pre-turn working set & mode)"
                                            @click=${() => this._rewindToMessageBubble(m, mIdx)}>
                                        </sutram-btn>
                                    ` : ''}
                                    <sutram-btn
                                        ?compact=${true}
                                        intent="neutral"
                                        icon="x"
                                        title="Remove message from transcript & compaction view"
                                        @click=${() => this._removeMessageBubble(m, mIdx)}>
                                    </sutram-btn>
                                </sutram-stack>
                            </sutram-stack>
                            <sutram-label intent="neutral" ?multiline=${true} .text=${m.content}></sutram-label>
                        </sutram-surface>
                    `)}
                    ${this.pendingCheckpoint && this.pendingCheckpoint.status ? html`
                        <sutram-surface variant="tinted" intent="warning" padding="md" gap="sm">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                <sutram-stack direction="row" align="center" gap="xs">
                                    <sutram-icon name="alert-circle" size="md" intent="warning"></sutram-icon>
                                    <strong>Session Budget Checkpoint Reached</strong>
                                </sutram-stack>
                                <sutram-tag text="Wavefront ${this.pendingCheckpoint.wavefront_index ?? 0}" intent="warning"></sutram-tag>
                            </sutram-stack>
                            <sutram-label .text=${this.pendingCheckpoint.reason || `Session spend reached $${budgetLimitUsd.toFixed(2)}. Resume to increase session budget by +$${budgetStepUsd.toFixed(2)} (to $${(budgetLimitUsd + budgetStepUsd).toFixed(2)}):`}></sutram-label>
                            <sutram-stack direction="row" align="center" gap="sm">
                                <sutram-btn
                                    ?compact=${true}
                                    intent="warning"
                                    icon="play"
                                    label="Resume Turn (+$${budgetStepUsd.toFixed(2)})"
                                    @click=${() => {
                                        this._sendPrompt({ resumeCheckpoint: true });
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
                    <insetu-agent-execution-trace
                        .trace=${this.executionTrace}
                        .activePlan=${this.activePlan}
                        .activePlanPath=${this.activePlanPath}
                        .sessionId=${this.activeSessionId}
                        .activeJobMessage=${this.activeJobMessage}
                        .loading=${this.loading}>
                    </insetu-agent-execution-trace>
                    ${(() => {
                        const traceVisible = Boolean((this.executionTrace && this.executionTrace.length > 0) || this.activeJobMessage);
                        const activeTaskObj = (this.activePlan?.tasks || []).find(t => t.id === this.activePlan?.active_task_id);
                        const needsStandaloneStepper = Boolean(
                            this.activePlan?.pending_commit_tx
                            || (this.stagedTaskActions && this.stagedTaskActions.length > 0)
                            || (!traceVisible && (this.activePlanPath || this.activePlan?.recommend_file_upgrade || ['explore', 'verify'].includes(activeTaskObj?.kind)))
                        );
                        return needsStandaloneStepper ? html`
                            <insetu-agent-plan-stepper
                                .activePlan=${this.activePlan}
                                .activePlanPath=${this.activePlanPath}
                                .sessionId=${this.activeSessionId}
                                .stagedTaskActions=${this.stagedTaskActions || []}
                                @insetu-clear-task-actions=${() => AgentStore.setState({ stagedTaskActions: [] })}>
                            </insetu-agent-plan-stepper>
                        ` : '';
                    })()}
                    <insetu-agent-staged-stacks
                        .cells=${this._stagedBridgeCells}
                        .activeProfileId=${this.activeProfileId}
                        .quickpack=${this._lastQueryQuickpack}
                        @insetu-dismiss-quickpack=${() => { this._lastQueryQuickpack = null; this.requestUpdate(); }}>
                    </insetu-agent-staged-stacks>
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
                </sutram-stack>

                ${this.pendingHandoff && this.pendingHandoff.pending_handoff ? html`
                    <insetu-agent-handoff-panel
                        slot="footer"
                        .pendingHandoff=${this.pendingHandoff}
                        .routines=${this.routines}
                        .agentRoutineId=${this.agentRoutineId}
                        .webChatWindowMode=${this.webChatWindowMode}
                        .handoffBranchIdx=${this._handoffBranchIdx}
                        .handoffBranchResponses=${this._handoffBranchResponses}
                        .promptInput=${this.promptInput}
                        .totalTokensEst=${tokenEst.total}
                        .onSendPrompt=${() => this._sendPrompt()}>
                    </insetu-agent-handoff-panel>
                ` : html`
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
                            if (e.target !== e.currentTarget) return;
                            const rawVal = e.detail?.value;
                            if (typeof rawVal !== 'string') return;
                            const slashMatch = rawVal.match(/^(\/(?:user:[a-zA-Z0-9_:-]+|[a-zA-Z0-9_:-]+))\s+([\s\S]*)$/);
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
                            AgentStore.setState({ promptInput: rawVal });
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
                                    title="Show or hide surfaces"
                                    data-testid="surface-toggle"
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
                                            @sutram-input-changed=${e => { e.stopPropagation(); AgentStore.getState().selectProfile(e.detail.value); }}>
                                        </sutram-select>
                                        <sutram-select
                                            label="Substrate Helper Mode (RAG, Compaction & Healer)"
                                            ?flush=${true}
                                            .value=${this.agentSettings?.helper_mode || 'ai_assisted'}
                                            .options=${[
                                                { value: 'deterministic', label: 'Deterministic Only (0 tok AST & Sandwich Healer)' },
                                                { value: 'ai_assisted', label: 'AI-Assisted (Fast-Tier Scout, Compactor & Healer)' }
                                            ]}
                                            @sutram-input-changed=${e => { e.stopPropagation(); AgentStore.getState().updateAgentSetting('helper_mode', e.detail.value); }}>
                                        </sutram-select>
                                        <sutram-toggle
                                            label="Run Test Gate After /code"
                                            ?flush=${true}
                                            .checked=${Boolean(this.agentSettings?.run_tests_on_code)}
                                            @sutram-input-changed=${e => { e.stopPropagation(); AgentStore.getState().updateAgentSetting('run_tests_on_code', e.detail.value); }}>
                                        </sutram-toggle>
                                        <sutram-toggle
                                            label="Auto-Complete Plan Step & Advance on Apply"
                                            ?flush=${true}
                                            .checked=${Boolean(this.agentSettings?.auto_complete_plan_tasks)}
                                            @sutram-input-changed=${e => { e.stopPropagation(); AgentStore.getState().updateAgentSetting('auto_complete_plan_tasks', e.detail.value); }}>
                                        </sutram-toggle>
                                        <sutram-stack direction="row" justify="between" align="center" gap="xs" ?wrap=${true}>
                                            <sutram-dropdown
                                                align="left"
                                                direction="up"
                                                .items=${buildAgentTelemetryMenuItems(this)}>
                                                <sutram-pill
                                                    slot="trigger"
                                                    ?compact=${true}
                                                    ?active=${true}
                                                    labelText="📊 Telemetry ▾"
                                                    title="Copy, Share, or Download AI Telemetry">
                                                </sutram-pill>
                                            </sutram-dropdown>
                                            <sutram-pill
                                                ?compact=${true}
                                                labelText="⚙️ All Settings..."
                                                title="Open Full Agent & Compute Pool Settings"
                                                @sutram-pill-toggled=${() => window.inSetu?.events?.emit('insetu:system:open-settings-view', { view: 'ext:agent' })}>
                                            </sutram-pill>
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

                                        const pinFile = (fp) => {
                                            if (fp && !this.pinnedFiles.includes(fp)) {
                                                AgentStore.setState({ pinnedFiles: [...this.pinnedFiles, fp] });
                                            }
                                        };
                                        return [
                                            {
                                                label: "📄 Choose Files... (Workspace Explorer)",
                                                icon: "folder",
                                                onClick: () => window.inSetu.ui.openWorkspaceBrowser?.({ mode: 'file', title: 'Add Context File', callback: pinFile })
                                            },
                                            {
                                                label: `🧺 Add from Selection Basket (${basketCount})`,
                                                icon: "package",
                                                disabled: basketCount === 0,
                                                onClick: () => {
                                                    const uris = basketItems.map(i => i.data?.filepath || i.filepath).filter(Boolean);
                                                    AgentStore.setState({ pinnedFiles: Array.from(new Set([...this.pinnedFiles, ...uris])) });
                                                }
                                            },
                                            {
                                                label: `✏️ Add Active Editor File (${activeEditorName})`,
                                                icon: "edit-3",
                                                disabled: !activeEditorFile,
                                                onClick: () => pinFile(activeEditorFile)
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
            targetEntity: 'agent_session',
            id: 'session-rename',
            label: 'Rename',
            icon: 'edit-3',
            intent: 'primary',
            group: 'edit',
            vfsBound: false,
            order: 10,
            emitEvent: (data) => ({ name: 'insetu:agent:start-rename-session', detail: { session: data } })
        },
        {
            targetEntity: 'agent_session',
            id: 'session-archive',
            label: (data) => data?.archived ? 'Unarchive' : 'Archive',
            icon: 'archive',
            intent: 'warning',
            group: 'edit',
            vfsBound: false,
            order: 20,
            asyncAction: async (data) => {
                if (!data?.session_id) return;
                const nextArch = !Boolean(data.archived);
                await AgentStore.getState().archiveSession(data.session_id, nextArch);
                if (window.inSetu?.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus(nextArch ? '📦 Conversation archived.' : '📂 Conversation restored.', 2000);
                }
            }
        },
        {
            targetEntity: 'agent_session',
            id: 'session-delete',
            label: 'Delete',
            icon: 'trash-2',
            intent: 'danger',
            group: 'file',
            vfsBound: false,
            order: 30,
            asyncAction: async (data) => {
                if (!data?.session_id) return;
                const ok = window.inSetu?.ui?.confirmModal
                    ? await window.inSetu.ui.confirmModal({
                        title: 'Delete Conversation',
                        message: `Delete conversation "${data.title || data.session_id}" and all its messages?`,
                        confirmLabel: 'Delete',
                        intent: 'danger'
                    })
                    : confirm(`Delete conversation "${data.title || data.session_id}" and all its messages?`);
                if (!ok) return;
                await AgentStore.getState().deleteSession(data.session_id);
                if (window.inSetu?.ui?.setGlobalStatus) {
                    window.inSetu.ui.setGlobalStatus('🗑️ Conversation deleted.', 2000);
                }
            }
        },
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
        { slot: "slots:yomama-surface", id: "chat", label: "Chat", icon: "message-square", intent: "primary", order: 20, component: "insetu-core-agent" },
        { slot: "slots:yomama-surface", id: "routines", label: "Routines", icon: "workflow", intent: "warning", order: 30, component: "insetu-core-agent-routines" },
        { slot: "slots:yomama-drawer", id: "agent-sessions", label: "Conversations", order: 10, component: "insetu-core-agent-sessions" }
    ]
});
