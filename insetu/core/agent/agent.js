import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';
export const AgentStore = createExtensionStore('Agent', {
    sessions: [],
    routines: [],
    activeSessionId: null,
    messages: [],
    loading: false,
    selectSession: async (id) => {
        if (!id) return;
        AgentStore.setState({ activeSessionId: id });
        try {
            const res = await window.inSetu.api.get(`agent/messages/${id}`);
            if (res.ok) {
                const data = await res.json();
                AgentStore.setState({ messages: data.messages || [] });
            }
        } catch (e) {
            console.error("Failed to fetch messages:", e);
        }
    },
    fetchSessions: async () => {
        AgentStore.setState({ loading: true });
        try {
            const [sesRes, routRes] = await Promise.all([
                window.inSetu.api.get('agent/sessions'),
                window.inSetu.api.get('agent/routines')
            ]);
            const patch = {};
            if (sesRes.ok) {
                const data = await sesRes.json();
                patch.sessions = data.sessions || [];
            }
            if (routRes.ok) {
                const rData = await routRes.json();
                patch.routines = rData.routines || [];
            }
            AgentStore.setState(patch);
            const curActive = AgentStore.getState().activeSessionId;
            if (!curActive && patch.sessions && patch.sessions.length > 0) {
                await AgentStore.getState().selectSession(patch.sessions[0].session_id);
            }
        } catch (e) {
            console.error("Failed to fetch chat sessions:", e);
        } finally {
            AgentStore.setState({ loading: false });
        }
    }
});
window.inSetu = window.inSetu || { stores: {} };
window.inSetu.stores.Agent = AgentStore;

export class InSetuCoreAgentSessions extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        sessions: { type: Array },
        activeSessionId: { type: String }
    };
    static styles = [sharedStyles, css`
        :host {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            gap: 8px;
        }
    `];

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
            <sutram-async-btn 
                label="New Chat" 
                icon="plus" 
                intent="primary" 
                style="width: 100%; margin: 0; flex-shrink: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                .onClick=${async () => {
                    const res = await this.api.post('agent/sessions', { title: "New Conversation" });
                    if (res.ok) {
                        const data = await res.json();
                        await AgentStore.getState().fetchSessions();
                        await AgentStore.getState().selectSession(data.session_id);
                        this.dispatch('insetu:yomama:navigate', { surface: 'chat', sessionId: data.session_id });
                    }
                }}>
            </sutram-async-btn>
            <div style="font-size: 0.7rem; font-weight: 800; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); padding: 4px 8px 0 8px; flex-shrink: 0;">
                Conversations
            </div>
            <div style="flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
                ${this.sessions.length === 0 ? html`
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; padding: 6px 8px;">No conversations yet.</span>
                ` : this.sessions.map(s => html`
                    <div 
                        class="yv-interactive-row" 
                        style="padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: bold; display: flex; align-items: center; gap: 8px; background: ${this.activeSessionId === s.session_id ? 'var(--bg-hover)' : 'transparent'}; color: ${this.activeSessionId === s.session_id ? 'var(--text)' : 'var(--text-muted)'};"
                        @click=${async () => {
                            await AgentStore.getState().selectSession(s.session_id);
                            this.dispatch('insetu:yomama:navigate', { surface: 'chat', sessionId: s.session_id });
                        }}>
                        <yv-icon name="message-square" style="width: 14px; height: 14px; color: var(--intent-primary); flex-shrink: 0;"></yv-icon>
                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s.title}</span>
                    </div>
                `)}
            </div>
        `;
    }
}
customElements.define('insetu-core-agent-sessions', InSetuCoreAgentSessions);

export class InSetuCoreAgentRoutines extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        routines: { type: Array }
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
    `];

    constructor() {
        super();
        this.routines = [];
    }

    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            AgentStore,
            state => ({ routines: state.routines || [] }),
            { autoFetch: 'fetchSessions' }
        );
    }
    render() {
        return html`
            <sutram-scroll-view padding="16px" style="gap: 12px;">
                <div style="background: color-mix(in srgb, var(--intent-warning) 10%, var(--input-bg)); border: 1px solid color-mix(in srgb, var(--intent-warning) 35%, var(--border)); border-left: 4px solid var(--intent-warning); border-radius: 6px; padding: 12px 14px; margin-bottom: 4px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <yv-icon name="workflow" style="width: 16px; height: 16px; color: var(--intent-warning);"></yv-icon>
                        <h3 style="margin: 0; color: var(--text); font-size: 0.95rem;">Declarative YAML Routines (${this.routines.length})</h3>
                    </div>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Select a DAG workflow to prime Chat, or author custom routines in <code>.insetu/routines/*.yaml</code>.</span>
                </div>
                <sutram-card-group>
                    ${this.routines.map(r => html`
                        <sutram-card
                            .titleText=${r.name}
                            .descriptionText=${r.description}
                            .detailText=${r.slash_command || `/${r.id}`}
                            .detailSuffix=${`${r.node_count || 0} DAG node(s)`}
                            icon="workflow"
                            intent="warning"
                            ?disableSelection=${true}
                            @card-clicked=${() => {
                                this.dispatch('insetu:yomama:select-routine', { routineId: r.id, mode: r.default_mode || 'auto' });
                                this.dispatch('insetu:yomama:navigate', { surface: 'chat' });
                            }}>
                        </sutram-card>
                    `)}
                </sutram-card-group>
            </sutram-scroll-view>
            <div style="padding: 12px 16px; gap: 10px; border-top: 2px solid color-mix(in srgb, var(--intent-warning) 55%, var(--border)); background: color-mix(in srgb, var(--intent-warning) 6%, var(--input-bg)); display: flex; align-items: stretch; justify-content: space-between; flex-shrink: 0; width: 100%; box-sizing: border-box;">
                <sutram-btn
                    intent="warning"
                    icon="workflow"
                    title="Toggle Yomama Menu (Active: Routines)"
                    style="margin: 0; flex-shrink: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                    @click=${() => this.dispatch('insetu:yomama:toggle-drawer')}>
                </sutram-btn>
                <sutram-btn
                    intent="primary"
                    icon="message-square"
                    label="Open Chat"
                    style="flex: 1; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                    @click=${() => this.dispatch('insetu:yomama:navigate', { surface: 'chat' })}>
                </sutram-btn>
                <sutram-btn
                    intent="warning"
                    icon="refresh-cw"
                    label="Refresh"
                    style="margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                    @click=${() => AgentStore.getState().fetchSessions()}>
                </sutram-btn>
            </div>
        `;
    }
}
customElements.define('insetu-core-agent-routines', InSetuCoreAgentRoutines);

export class InSetuCoreAgent extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        sessions: { type: Array },
        routines: { type: Array },
        activeSessionId: { type: String },
        messages: { type: Array },
        loading: { type: Boolean },
        attachedFiles: { type: Array },
        readOnlyFiles: { type: Array },
        agentRoutineId: { type: String },
        agentMode: { type: String },
        promptInput: { type: String },
        activeJobMessage: { type: String }
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
        .chat-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            width: 100%;
            background: var(--bg);
        }
        .messages-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 16px 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;
        }
        .msg-bubble {
            display: flex;
            flex-direction: column;
            max-width: 88%;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 0.92rem;
            line-height: 1.5;
            word-break: break-word;
        }
        .msg-bubble.user {
            align-self: flex-end;
            background: var(--intent-primary);
            color: #ffffff;
        }
        .msg-bubble.assistant {
            align-self: flex-start;
            background: var(--input-bg);
            color: var(--text);
            border: 1px solid var(--border);
        }
        .input-panel {
            padding: 10px 14px 12px 14px;
            border-top: 2px solid color-mix(in srgb, var(--intent-primary) 55%, var(--border));
            background: color-mix(in srgb, var(--intent-primary) 6%, var(--input-bg));
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex-shrink: 0;
        }
        .attachment-pills {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
        }
    `];

    constructor() {
        super();
        this.sessions = [];
        this.routines = [];
        this.activeSessionId = null;
        this.messages = [];
        this.loading = false;
        this.attachedFiles = [];
        this.readOnlyFiles = [];
        this.agentRoutineId = 'workspace_turn';
        this.agentMode = 'auto';
        this.promptInput = '';
        this.activeJobMessage = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            AgentStore,
            state => ({
                sessions: state.sessions || [],
                routines: state.routines || [],
                activeSessionId: state.activeSessionId,
                messages: state.messages || [],
                loading: !!state.loading
            }),
            { autoFetch: 'fetchSessions' }
        );

        this.registerGlobalListener('sutram-compile-progress', window, (e) => {
            if (e.detail && e.detail.ext_name === 'agent') {
                this.activeJobMessage = e.detail.message || '';
                this.requestUpdate();
            }
        });
        this.registerGlobalListener('insetu:yomama:select-routine', window, (e) => {
            if (e.detail?.routineId) {
                this.agentRoutineId = e.detail.routineId;
                this.agentMode = e.detail.mode || 'auto';
                this.requestUpdate();
            }
        });
    }

    async _ensureActiveSession() {
        if (this.activeSessionId) return this.activeSessionId;
        const res = await this.api.post('agent/sessions', { title: "New Conversation" });
        if (res.ok) {
            const data = await res.json();
            await AgentStore.getState().fetchSessions();
            await AgentStore.getState().selectSession(data.session_id);
            return data.session_id;
        }
        return null;
    }

    async _sendPrompt() {
        if (!this.promptInput.trim()) return;
        const userText = this.promptInput;

        // If user pasted raw Yomama patch blocks without an explicit /yomama prefix, hand off to the Bridge staging surface immediately
        if (
            !userText.trim().startsWith('/yomama') &&
            (userText.includes('<<<<<<< FILE:') || userText.includes('<<<<<<< RELOCATE') || userText.includes('<<<<<<< RENAME')) &&
            window.inSetu?.stores?.Bridge?.getState()?.parseAndAppendCells
        ) {
            this.promptInput = '';
            window.inSetu.stores.Bridge.getState().parseAndAppendCells(userText);
            return;
        }

        const sesId = await this._ensureActiveSession();
        if (!sesId) return;

        this.promptInput = '';
        AgentStore.setState(s => ({
            messages: [...(s.messages || []), { role: 'user', content: userText, timestamp: Date.now() / 1000 }]
        }));
        this.activeJobMessage = "Submitting prompt...";
        this.requestUpdate();
        try {
            const res = await this.api.post('agent/prompt', {
                session_id: sesId,
                prompt: userText,
                mode: this.agentMode,
                routine_id: this.agentRoutineId,
                attached_files: this.attachedFiles,
                read_only_files: this.readOnlyFiles
            });

            if (res.ok) {
                const data = await res.json();
                if (!data.job_id) {
                    this.activeJobMessage = '';
                    await AgentStore.getState().fetchSessions();
                    await AgentStore.getState().selectSession(sesId);
                    return;
                }
                this.api.pollJob(data.job_id, {
                    onProgress: (msg) => {
                        this.activeJobMessage = msg;
                        this.requestUpdate();
                    },
                    onComplete: async () => {
                        this.activeJobMessage = '';
                        await AgentStore.getState().fetchSessions();
                        await AgentStore.getState().selectSession(sesId);
                    },
                    onError: (err) => {
                        this.activeJobMessage = '';
                        alert("Agent Turn Error: " + err.message);
                    }
                });
            }
        } catch (e) {
            this.activeJobMessage = '';
            alert("Network Error: " + e.message);
        }
    }

    async _cancelTurn() {
        if (!this.activeSessionId) return;
        await this.api.post('agent/cancel', { session_id: this.activeSessionId });
        this.activeJobMessage = '';
        this.requestUpdate();
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

    render() {
        return html`
            <div class="chat-main">
                <div class="messages-scroll">
                    ${this.messages.length === 0 && !this.activeJobMessage ? html`
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed color-mix(in srgb, var(--intent-primary) 40%, var(--border)); border-radius: 8px; background: color-mix(in srgb, var(--intent-primary) 4%, var(--input-bg)); color: var(--text-muted); text-align: center; padding: 20px; margin: 4px;">
                            <yv-icon name="message-square" style="width: 42px; height: 42px; margin-bottom: 10px; color: var(--intent-primary);"></yv-icon>
                            <h3 style="margin: 0 0 6px 0; color: var(--text);">Yomama Agent Stream</h3>
                            <p style="margin: 0; font-size: 0.85rem; max-width: 420px;">Ask a question, run a declarative routine (<code>/code</code>, <code>/plan</code>, <code>/ask</code>, <code>/yomama</code>), or paste a patch sandwich at the bottom.</p>
                        </div>
                    ` : this.messages.map(m => html`
                        <div class="msg-bubble ${m.role}">
                            <div style="font-weight: bold; font-size: 0.72rem; margin-bottom: 4px; opacity: 0.8;">
                                ${m.role === 'user' ? 'You' : 'Yomama Agent'}
                            </div>
                            <div style="white-space: pre-wrap;">${m.content}</div>
                        </div>
                    `)}
                    ${this.activeJobMessage ? html`
                        <div class="msg-bubble assistant" style="border: 1px dashed var(--intent-primary);">
                            <sutram-spinner .text=${this.activeJobMessage}></sutram-spinner>
                        </div>
                    ` : ''}
                </div>
                <!-- Gemini-Style Two-Tier Bottom Composer -->
                <div class="input-panel" style="padding: 12px 16px; gap: 10px;">
                    ${(this.attachedFiles.length > 0 || this.readOnlyFiles.length > 0) ? html`
                        <div class="attachment-pills">
                            ${this.attachedFiles.map(f => html`
                                <sutram-pill 
                                    labelText=${`✏️ ${new this.utils.InSetuURI(f).basename}`} 
                                    pillId=${f} 
                                    title="Editable Target (Click to switch to Read-Only, Shift+Click to remove)"
                                    ?active=${true}
                                    @sutram-pill-toggled=${(e) => {
                                        if (e.detail?.originalEvent?.shiftKey) {
                                            this.attachedFiles = this.attachedFiles.filter(x => x !== f);
                                        } else {
                                            this.attachedFiles = this.attachedFiles.filter(x => x !== f);
                                            if (!this.readOnlyFiles.includes(f)) {
                                                this.readOnlyFiles = [...this.readOnlyFiles, f];
                                            }
                                        }
                                        this.requestUpdate();
                                    }}>
                                </sutram-pill>
                            `)}
                            ${this.readOnlyFiles.map(f => html`
                                <sutram-pill 
                                    labelText=${`🔒 ${new this.utils.InSetuURI(f).basename}`} 
                                    pillId=${f} 
                                    title="Read-Only Reference (Click to remove)"
                                    ?active=${false}
                                    @sutram-pill-toggled=${() => {
                                        this.readOnlyFiles = this.readOnlyFiles.filter(x => x !== f);
                                        this.requestUpdate();
                                    }}>
                                </sutram-pill>
                            `)}
                        </div>
                    ` : ''}

                    <!-- Row 1: Full-Width Input Box -->
                    <sutram-textarea 
                        placeholder="Ask Yomama or paste patches (/code, /plan, /ask, /yomama, /undo)..." 
                        .value=${this.promptInput} 
                        ?flush=${true}
                        style="width: 100%; margin: 0;"
                        @sutram-input-changed=${e => this.promptInput = e.detail.value}>
                    </sutram-textarea>
                    <!-- Row 2: Bottom Action Bar ([💬] | [/mode ▾] | [+] ... [Send]) -->
                    <div style="display: flex; align-items: stretch; justify-content: space-between; gap: 8px; width: 100%;">
                        <div style="display: flex; align-items: stretch; gap: 8px; min-width: 0;">
                            <sutram-btn
                                intent="primary"
                                icon="message-square"
                                title="Toggle Yomama Menu (Active: Chat)"
                                style="margin: 0; flex-shrink: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                                @click=${() => this.dispatch('insetu:yomama:toggle-drawer')}>
                            </sutram-btn>
                            <sutram-dropdown
                                align="left"
                                direction="up"
                                .items=${(() => {
                                    const activeRoutine = (this.routines || []).find(r => r.id === this.agentRoutineId);
                                    const modeList = (activeRoutine && Array.isArray(activeRoutine.modes) && activeRoutine.modes.length > 0)
                                        ? activeRoutine.modes
                                        : [
                                            { id: 'auto', label: '/auto (Smart Router)' },
                                            { id: 'code', label: '/code (Edit Code)' },
                                            { id: 'plan', label: '/plan (Draft Plan)' },
                                            { id: 'ask', label: '/ask (Read-Only Q&A)' },
                                            { id: 'yomama', label: '/yomama (Heal Patches)' }
                                        ];
                                    return modeList.map(m => ({
                                        label: m.label,
                                        icon: this.agentMode === m.id ? 'check' : 'terminal',
                                        onClick: () => {
                                            this.agentMode = m.id;
                                            this.requestUpdate();
                                        }
                                    }));
                                })()}>
                                <sutram-btn
                                    slot="trigger"
                                    intent="neutral"
                                    icon="chevron-up"
                                    label=${`/${this.agentMode || 'auto'}`}
                                    title="Select Slash Mode"
                                    style="margin: 0; flex-shrink: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem; font-family: var(--font-mono);">
                                </sutram-btn>
                            </sutram-dropdown>

                            <sutram-btn 
                                icon="plus" 
                                intent="neutral" 
                                title="Add Context File"
                                style="margin: 0; flex-shrink: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                                @click=${() => {
                                    if (window.inSetu.ui.openWorkspaceBrowser) {
                                        window.inSetu.ui.openWorkspaceBrowser({
                                            mode: 'file',
                                            title: 'Add Context File',
                                            callback: (filepath) => {
                                                if (!this.attachedFiles.includes(filepath)) {
                                                    this.attachedFiles = [...this.attachedFiles, filepath];
                                                    this.requestUpdate();
                                                }
                                            }
                                        });
                                    }
                                }}>
                            </sutram-btn>
                        </div>

                        <div style="display: flex; align-items: stretch; gap: 8px; flex-shrink: 0;">
                            ${this.activeJobMessage ? html`
                                <sutram-async-btn
                                    icon="square"
                                    label="Stop"
                                    intent="danger"
                                    style="margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                                    .onClick=${() => this._cancelTurn()}>
                                </sutram-async-btn>
                            ` : ''}
                            <sutram-async-btn 
                                label="Send" 
                                icon="send" 
                                intent="primary" 
                                style="margin: 0; flex-shrink: 0; --btn-padding: 10px 16px; --btn-font-size: 0.9rem;"
                                .onClick=${() => this._sendPrompt()}>
                            </sutram-async-btn>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-core-agent', InSetuCoreAgent);

window.ExtensionRegistry.registerExtension('agent', {
    name: "Agent Harness",
    version: "1.0.0",
    offline_mode: "read_only",
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