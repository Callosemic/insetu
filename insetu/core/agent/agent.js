import { html, css } from 'lit';
import { createExtensionStore, InSetuElement } from '/static/extensions/system/insetu_sdk.js';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';

export const AgentStore = createExtensionStore('Agent', {
    sessions: [],
    activeSessionId: null,
    messages: [],
    loading: false,
    fetchSessions: async () => {
        AgentStore.setState({ loading: true });
        try {
            const res = await window.inSetu.api.workspace.get('agent/sessions');
            if (res.ok) {
                const data = await res.json();
                AgentStore.setState({ sessions: data.sessions || [] });
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

export class InSetuCoreAgent extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        sessions: { type: Array },
        activeSessionId: { type: String },
        messages: { type: Array },
        loading: { type: Boolean },
        attachedFiles: { type: Array },
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
        .agent-layout {
            display: flex;
            flex: 1;
            min-height: 0;
            width: 100%;
        }
        .session-sidebar {
            width: 240px;
            border-right: 1px solid var(--border);
            background: var(--input-bg);
            display: flex;
            flex-direction: column;
            padding: 10px;
            gap: 8px;
            flex-shrink: 0;
        }
        .chat-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            background: var(--bg);
        }
        .messages-scroll {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .msg-bubble {
            display: flex;
            flex-direction: column;
            max-width: 85%;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 0.95rem;
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
            padding: 15px 20px;
            border-top: 1px solid var(--border);
            background: var(--input-bg);
            display: flex;
            flex-direction: column;
            gap: 10px;
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
        this.activeSessionId = null;
        this.messages = [];
        this.loading = false;
        this.attachedFiles = [];
        this.promptInput = '';
        this.activeJobMessage = '';
    }
    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            AgentStore,
            state => ({ sessions: state.sessions || [], loading: !!state.loading }),
            { autoFetch: 'fetchSessions' }
        );

        // Listen for live job progress emitted by worker chain
        this.registerGlobalListener('sutram-compile-progress', window, (e) => {
            if (e.detail && e.detail.ext_name === 'agent') {
                this.activeJobMessage = e.detail.message || '';
                this.requestUpdate();
            }
        });
    }

    async _selectSession(id) {
        this.activeSessionId = id;
        AgentStore.setState({ activeSessionId: id });
        try {
            const res = await this.api.workspace.get(`agent/messages/${id}`);
            if (res.ok) {
                const data = await res.json();
                this.messages = data.messages || [];
                this.requestUpdate();
            }
        } catch (e) {
            console.error("Failed to fetch messages:", e);
        }
    }

    async _sendPrompt() {
        if (!this.promptInput.trim() || !this.activeSessionId) return;

        const userText = this.promptInput;
        this.promptInput = '';
        this.messages = [...this.messages, { role: 'user', content: userText, timestamp: Date.now() / 1000 }];
        this.activeJobMessage = "Submitting prompt...";
        this.requestUpdate();

        try {
            const res = await this.api.workspace.post('agent/prompt', {
                session_id: this.activeSessionId,
                prompt: userText,
                attached_files: this.attachedFiles
            });

            if (res.ok) {
                const data = await res.json();
                this.api.pollJob(data.job_id, {
                    onProgress: (msg, jobObj) => {
                        this.activeJobMessage = msg;
                        this.requestUpdate();
                    },
                    onComplete: async () => {
                        this.activeJobMessage = '';
                        await this._selectSession(this.activeSessionId);
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

    render() {
        return html`
            <div class="agent-layout">
                <!-- Sidebar -->
                <div class="session-sidebar">
                    <sutram-async-btn 
                        label="New Chat" 
                        icon="plus" 
                        intent="primary" 
                        style="width: 100%;"
                        .onClick=${async () => {
                            const res = await this.api.workspace.post('agent/sessions', { title: "New Conversation" });
                            if (res.ok) {
                                const data = await res.json();
                                await AgentStore.getState().fetchSessions();
                                this._selectSession(data.session_id);
                            }
                        }}>
                    </sutram-async-btn>
                    
                    <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; margin-top: 10px;">
                        ${this.sessions.map(s => html`
                            <div 
                                class="yv-interactive-row" 
                                style="padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: bold; display: flex; align-items: center; gap: 8px; background: ${this.activeSessionId === s.session_id ? 'var(--bg-hover)' : 'transparent'};"
                                @click=${() => this._selectSession(s.session_id)}>
                                <yv-icon name="message-square" style="width: 14px; height: 14px; color: var(--intent-primary); flex-shrink: 0;"></yv-icon>
                                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${s.title}</span>
                            </div>
                        `)}
                    </div>
                </div>

                <!-- Main Chat -->
                <div class="chat-main">
                    ${!this.activeSessionId ? html`
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted);">
                            <yv-icon name="bot" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></yv-icon>
                            <h3>Select or create a conversation to begin.</h3>
                        </div>
                    ` : html`
                        <div class="messages-scroll">
                            ${this.messages.map(m => html`
                                <div class="msg-bubble ${m.role}">
                                    <div style="font-weight: bold; font-size: 0.75rem; margin-bottom: 4px; opacity: 0.8;">
                                        ${m.role === 'user' ? 'You' : 'inSetu Agent'}
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

                        <!-- Input -->
                        <div class="input-panel">
                            ${this.attachedFiles.length > 0 ? html`
                                <div class="attachment-pills">
                                    ${this.attachedFiles.map(f => html`
                                        <sutram-pill 
                                            labelText=${f.split('/').pop()} 
                                            pillId=${f} 
                                            ?active=${true}
                                            @sutram-pill-toggled=${() => {
                                                this.attachedFiles = this.attachedFiles.filter(x => x !== f);
                                                this.requestUpdate();
                                            }}>
                                        </sutram-pill>
                                    `)}
                                </div>
                            ` : ''}
                            <div style="display: flex; gap: 10px; align-items: flex-end;">
                                <sutram-btn 
                                    icon="paperclip" 
                                    intent="neutral" 
                                    title="Attach File Context"
                                    style="margin: 0; width: 42px; height: 42px;"
                                    @click=${() => {
                                        if (window.inSetu.ui.openWorkspaceBrowser) {
                                            window.inSetu.ui.openWorkspaceBrowser({
                                                mode: 'file',
                                                title: 'Attach File Context',
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
                                <sutram-textarea 
                                    placeholder="Type your prompt... (Press Shift+Enter for newline)" 
                                    .value=${this.promptInput} 
                                    ?flush=${true}
                                    style="flex: 1; margin: 0;"
                                    @sutram-input-changed=${e => this.promptInput = e.detail.value}>
                                </sutram-textarea>
                                <sutram-async-btn 
                                    label="Send" 
                                    icon="send" 
                                    intent="primary" 
                                    style="margin: 0;"
                                    .onClick=${() => this._sendPrompt()}>
                                </sutram-async-btn>
                            </div>
                        </div>
                    `}
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
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "agent",
            label: "Agent",
            icon: "bot",
            intent: "highlight",
            order: 15,
            component: "insetu-core-agent"
        }
    ]
});