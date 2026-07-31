import { html, css } from 'lit';
import { InSetuElement, createExtensionStore } from '../core/sdk.js';
import { sharedStyles } from '../core/shared_styles.js';

const AppStore = window.inSetu.stores.App;

// 1. Strict Unidirectional Data Flow (UDF) Store
export const FreshdeskStore = createExtensionStore('Freshdesk', {
    tickets: [],
    loadingMsg: null,
    activeJobId: null,
    selectedTicket: null,
    isModalOpen: false,
    conversations: [],
    conversationsLoading: false,
    myAgentId: null,
    filterAssignee: 'Self + Unassigned',
    filterStatus: 'Open',
    replyContent: '',
    editorFocused: false,
    ignoredTickets: [],
    syncLedger: [],
    contiguousCount: 0,
    lastFetchedPage: 0
});

window.inSetu.stores.Freshdesk = FreshdeskStore;
// 2. The Declarative Lit Component
export class InSetuExtFreshdesk extends InSetuElement {
    static properties = {
        tickets: { type: Array },
        loadingMsg: { type: String },
        activeJobId: { type: String },
        selectedTicket: { type: Object },
        isModalOpen: { type: Boolean },
        conversations: { type: Array },
        conversationsLoading: { type: Boolean },
        myAgentId: { type: Number },
        filterAssignee: { type: String },
        filterStatus: { type: String },
        replyContent: { type: String },
        editorFocused: { type: Boolean },
        ignoredTickets: { type: Array },
        syncLedger: { type: Array },
        contiguousCount: { type: Number },
        lastFetchedPage: { type: Number }
    };

    static styles = [sharedStyles];
    constructor() {
        super();
        this.tickets = [];
        this.loadingMsg = null;
        this.activeJobId = null;
        this.selectedTicket = null;
        this.isModalOpen = false;
        this.conversations = [];
        this.conversationsLoading = false;
        this.myAgentId = null;
        this.filterAssignee = 'Self + Unassigned';
        this.filterStatus = 'Open';
        this.replyContent = '';
        this.editorFocused = false;
        this.ignoredTickets = [];
        this.syncLedger = [];
        this.contiguousCount = 0;
        this.lastFetchedPage = 0;
    }
    connectedCallback() {
        super.connectedCallback();

        // Decouple from static UI hooks
        this.registerGlobalListener('insetu:freshdesk:take', window, (e) => this.takeTicket(e.detail.id));
        this.registerGlobalListener('insetu:freshdesk:resolve', window, (e) => this.resolveTicket(e.detail.id));
        this.registerGlobalListener('insetu:freshdesk:ignore', window, (e) => this.ignoreTicket(e.detail.id));
        this.registerGlobalListener('insetu:freshdesk:fetch', window, () => this.fetchTickets());

        // The SDK automatically cleans up this subscription on unmount
        this.subscribe(FreshdeskStore, state => {
            this.tickets = state.tickets;
            this.loadingMsg = state.loadingMsg;
            this.activeJobId = state.activeJobId;
            this.selectedTicket = state.selectedTicket;
            this.isModalOpen = state.isModalOpen;
            this.conversations = state.conversations;
            this.conversationsLoading = state.conversationsLoading;
            this.myAgentId = state.myAgentId;
            this.filterAssignee = state.filterAssignee;
            this.filterStatus = state.filterStatus;
            this.replyContent = state.replyContent;
            this.editorFocused = state.editorFocused;
            this.ignoredTickets = state.ignoredTickets || [];
            this.syncLedger = state.syncLedger || [];
            this.contiguousCount = state.contiguousCount || 0;
            this.lastFetchedPage = state.lastFetchedPage || 0;
        });
        this.loadIgnored().then(() => this.fetchTickets());
    }

    onWorkspaceChanged(newWorkspaceId) {
        this.loadIgnored().then(() => this.fetchTickets());
    }
    _ticketMatchesFilters(t, filterStatus, filterAssignee, myAgentId) {
        let sMatch = true;
        if (filterStatus === 'Open') sMatch = (t.status === 2);
        else if (filterStatus === 'Pending') sMatch = (t.status === 3);
        else if (filterStatus === 'Open + Pending') sMatch = (t.status === 2 || t.status === 3);

        let aMatch = true;
        const isMe = t.responder_id === myAgentId;
        const isUnassigned = !t.responder_id;
        if (filterAssignee === 'Self') aMatch = isMe;
        else if (filterAssignee === 'Unassigned') aMatch = isUnassigned;
        else if (filterAssignee === 'Self + Unassigned') aMatch = (isMe || isUnassigned);

        return sMatch && aMatch;
    }

    async loadIgnored() {
        try {
            const res = await this.api.get('tickets/ignored');
            if (res.ok) {
                const ids = await res.json();
                FreshdeskStore.setState({ ignoredTickets: Array.isArray(ids) ? ids : [] });
            }
        } catch (e) {
            FreshdeskStore.setState({ ignoredTickets: [] });
        }
    }
    async ignoreTicket(ticketId) {
        if (!ticketId) return;
        const state = FreshdeskStore.getState();
        const newIgnored = [...(state.ignoredTickets || []), ticketId];
        FreshdeskStore.setState({ ignoredTickets: newIgnored });

        try {
            await this.api.post(`tickets/${ticketId}/ignore`, {});
            if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("🚫 Ticket Ignored!", 2000);
        } catch (err) {
            console.error("Failed to save ignored tickets schema", err);
        }
    }
    async resolveTicket(ticketId) {
        FreshdeskStore.setState({ loadingMsg: "Resolving ticket...", activeJobId: 'starting' });
        try {
            const res = await this.api.post(`tickets/${ticketId}/resolve`, {});
            if (res.ok) {
                const data = await res.json();
                FreshdeskStore.setState({ activeJobId: data.job_id });
                this.api.pollJob(data.job_id, {
                    onProgress: (msg) => FreshdeskStore.setState({ loadingMsg: msg }),
                    onComplete: (statusData) => {
                        const updatedTicket = statusData.artifact.ticket;
                        const state = FreshdeskStore.getState();

                        // Merge the new state while preserving our local agent name mappings
                        const newTickets = state.tickets.map(t => t.id === ticketId ? { ...t, ...updatedTicket, responder_name: t.responder_name } : t);
                        const newSelected = state.selectedTicket?.id === ticketId ? { ...state.selectedTicket, ...updatedTicket, responder_name: state.selectedTicket.responder_name } : state.selectedTicket;
                        FreshdeskStore.setState({ tickets: newTickets, selectedTicket: newSelected, activeJobId: null, loadingMsg: null });
                        if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("✅ Ticket Resolved!", 2000);
                    },
                    onError: (err) => {
                        FreshdeskStore.setState({ activeJobId: null, loadingMsg: null });
                        if (window.alert) window.alert(`Resolve Error: ${err.message}`);
                    }
                });
            } else {
                FreshdeskStore.setState({ activeJobId: null, loadingMsg: null });
            }
        } catch(e) {
            console.error(e);
            FreshdeskStore.setState({ activeJobId: null, loadingMsg: null });
        }
    }

    async takeTicket(ticketId) {
        FreshdeskStore.setState({ loadingMsg: "Assigning ticket to you...", activeJobId: 'starting' });
        try {
            const res = await this.api.post(`tickets/${ticketId}/take`, {});
            if (res.ok) {
                const data = await res.json();
                FreshdeskStore.setState({ activeJobId: data.job_id });
                this.api.pollJob(data.job_id, {
                    onProgress: (msg) => FreshdeskStore.setState({ loadingMsg: msg }),
                    onComplete: (statusData) => {
                        const updatedTicket = statusData.artifact.ticket;
                        const state = FreshdeskStore.getState();
                        // Reactively update the ticket in the background and the modal
                        const newTickets = state.tickets.map(t => t.id === ticketId ? { ...t, ...updatedTicket } : t);
                        const newSelected = state.selectedTicket?.id === ticketId ? { ...state.selectedTicket, ...updatedTicket } : state.selectedTicket;
                        FreshdeskStore.setState({ tickets: newTickets, selectedTicket: newSelected, activeJobId: null, loadingMsg: null });
                        if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("✅ Ticket Assigned!", 2000);
                    },
                    onError: (err) => {
                        FreshdeskStore.setState({ activeJobId: null, loadingMsg: null });
                        if (window.alert) window.alert(`Assignment Error: ${err.message}`);
                    }
                });
            } else {
                FreshdeskStore.setState({ activeJobId: null, loadingMsg: null });
            }
        } catch(e) {
            console.error(e);
            FreshdeskStore.setState({ activeJobId: null, loadingMsg: null });
        }
    }
    sendReply() {
        const ticketId = this.selectedTicket?.id;
        const content = FreshdeskStore.getState().replyContent;
        if (!ticketId || !content.trim()) return Promise.resolve();

        return new Promise(async (resolve, reject) => {
            try {
                const res = await this.api.post(`tickets/${ticketId}/reply`, { body: content });
                if (res.ok) {
                    const data = await res.json();
                    this.api.pollJob(data.job_id, {
                        onComplete: async () => {
                            FreshdeskStore.setState({ replyContent: '' });
                            this.fetchConversations(ticketId);
                            if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("✅ Reply Sent & Saved Locally!", 2000);
                            resolve();
                        },
                        onError: (err) => {
                            if (window.alert) window.alert(`Reply Error: ${err.message}`);
                            reject(err);
                        }
                    });
                } else {
                    reject(new Error("Failed to queue reply."));
                }
            } catch (e) {
                console.error(e);
                reject(e);
            }
        });
    }
    async copyThread() {
        const ticketId = this.selectedTicket?.id;
        if (!ticketId) return;
        try {
            const res = await window.inSetu.api.workspace(`fs/fetch?file=.insetu/freshdesk/${ticketId}.md`);
            if (res.ok) {
                const txt = await res.text();
                // Enforce DRY Utility Centralization Mandate
                this.utils.copyRawText(txt);
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("✅ Thread copied successfully!", 2000);
            } else {
                if (window.alert) window.alert("Local thread index cache processing... retry shortly.");
            }
        } catch (e) {
            if (window.alert) window.alert("Error copying thread: " + e);
        }
    }

    async fetchConversations(ticketId) {
        FreshdeskStore.setState({ conversationsLoading: true, conversations: [] });
        try {
            const res = await this.api.post(`tickets/${ticketId}/conversations`, {});
            if (res.ok) {
                const data = await res.json();
                this.api.pollJob(data.job_id, {
                    onComplete: (statusData) => {
                        FreshdeskStore.setState({ conversations: statusData.artifact.conversations || [], conversationsLoading: false });
                    },
                    onError: (err) => {
                        FreshdeskStore.setState({ conversationsLoading: false });
                        if (window.alert) window.alert(`Conversations Error: ${err.message}`);
                    }
                });
            } else {
                FreshdeskStore.setState({ conversationsLoading: false });
            }
        } catch(e) {
            console.error(e);
            FreshdeskStore.setState({ conversationsLoading: false });
        }
    }
    async fetchTickets(loadMore = false) {
        // Guardrail: Don't fetch if the extension isn't active in this workspace
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('freshdesk')) return;

        const state = FreshdeskStore.getState();

        // Heuristic calculation based on cached items
        const heuristicPage = Math.floor(state.contiguousCount / 100) + 1;
        // Never fetch a page we've already fetched in this session
        const nextPage = loadMore ? Math.max((state.lastFetchedPage || 0) + 1, heuristicPage) : 1;

        if (!loadMore) FreshdeskStore.setState({ tickets: [], lastFetchedPage: 0 });

        // We will fetch a 2-page spread
        FreshdeskStore.setState({ 
            loadingMsg: `Fetching pages ${nextPage} & ${nextPage + 1}...`, 
            activeJobId: 'starting',
            lastFetchedPage: nextPage + 1
        });

        try {
            // ADR 0017: Utilize the native component this.api wrapper
            const res = await this.api.post('tickets/fetch', {
                filterAssignee: state.filterAssignee,
                filterStatus: state.filterStatus,
                page: nextPage,
                twoPageSpread: true
            });
            if (res.ok) {
                const data = await res.json();
                FreshdeskStore.setState({ activeJobId: data.job_id });
                // Utilize the OS job metronome to poll the background task statelessly
                this.api.pollJob(data.job_id, {
                    onProgress: (msg, statusData) => {
                        const updates = { loadingMsg: msg };
                        if (statusData && statusData.artifact && statusData.artifact.tickets) {
                            updates.tickets = statusData.artifact.tickets;
                            if (statusData.artifact.my_agent_id) updates.myAgentId = statusData.artifact.my_agent_id;
                            if (statusData.artifact.ledger) updates.syncLedger = statusData.artifact.ledger;
                            if (statusData.artifact.contiguous_count !== undefined) updates.contiguousCount = statusData.artifact.contiguous_count;
                        }
                        FreshdeskStore.setState(updates);
                    },
                    onComplete: (statusData) => {
                        const newTickets = statusData.artifact.tickets || [];
                        const myAgentId = statusData.artifact.my_agent_id || state.myAgentId;
                        const ledger = statusData.artifact.ledger || state.syncLedger;
                        const contiguousCount = statusData.artifact.contiguous_count !== undefined ? statusData.artifact.contiguous_count : state.contiguousCount;

                        FreshdeskStore.setState({ 
                            tickets: newTickets, 
                            myAgentId: myAgentId,
                            syncLedger: ledger,
                            contiguousCount: contiguousCount,
                            activeJobId: null, 
                            loadingMsg: null 
                        });
                    },
                    onError: (err) => {
                        console.error("Freshdesk job failed:", err);
                        FreshdeskStore.setState({ activeJobId: null, loadingMsg: null });
                        if (window.alert) window.alert(`Freshdesk Error: ${err.message}`);
                    }
                });
            } else {
                throw new Error("Failed to queue Freshdesk job.");
            }
        } catch (e) {
            console.error(e);
            FreshdeskStore.setState({ activeJobId: null, loadingMsg: null });
        }
    }
    render() {
        return html`
            <sutram-modal ?open=${this.isModalOpen} titleText="Ticket #${this.selectedTicket?.id || ''}" ?fullscreen=${true} @sutram-modal-closed=${() => FreshdeskStore.setState({ isModalOpen: false })}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 15px; height: 100%;">
                    <!-- Metadata Header -->
                    <details style="background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; font-size: 0.95rem; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                        <summary style="padding: 15px; cursor: pointer; outline: none; user-select: none; font-weight: bold;">
                            Subject: <span style="color: var(--intent-primary); font-size: 1.1rem;">${this.selectedTicket?.subject}</span>
                        </summary>
                        <div style="padding: 0 15px 15px 15px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 15px; border-top: 1px dashed var(--border); margin-top: 5px; padding-top: 15px;">
                            <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                                <div><b>Sender:</b> <span style="color: var(--intent-success);">${this.selectedTicket?.requester?.name || 'Customer'} <span style="color: var(--text-muted);">(${this.selectedTicket?.requester?.email || 'No email'})</span></span></div>
                                <div><b>Assigned Agent:</b> <span style="color: ${this.selectedTicket?.responder_id === this.myAgentId ? 'var(--intent-success)' : 'var(--intent-highlight)'}; font-weight: ${this.selectedTicket?.responder_id === this.myAgentId ? 'bold' : 'normal'};">${this.selectedTicket?.responder_id === this.myAgentId ? 'You' : (this.selectedTicket?.responder_name || 'Unassigned')}</span></div>
                            </div>
                            <div style="display: flex; gap: 8px;">
                                <button class="btn-sm" style="background: var(--intent-primary); color: white; margin: 0;" @click=${() => this.copyThread()}>📋 Copy Thread</button>
                                ${(!this.myAgentId || this.selectedTicket?.responder_id !== this.myAgentId) ? html`<button class="btn-sm" style="background: var(--intent-success); color: white; margin: 0;" @click=${() => this.takeTicket(this.selectedTicket?.id)}>🙋 Take</button>` : ''}
                                ${(this.selectedTicket?.status !== 4 && this.selectedTicket?.status !== 5) ? html`<button class="btn-sm" style="background: var(--intent-neutral); color: white; margin: 0;" @click=${() => this.resolveTicket(this.selectedTicket?.id)}>✅ Resolve</button>` : ''}
                                <button class="btn-sm" style="background: var(--intent-danger); color: white; margin: 0;" @click=${() => { this.ignoreTicket(this.selectedTicket?.id); FreshdeskStore.setState({ isModalOpen: false }); }}>🚫 Ignore</button>
                            </div>
                        </div>
                    </details>

                    <!-- Message Timeline Thread -->
                    <div @click=${() => FreshdeskStore.setState({ editorFocused: false })} style="flex: ${this.editorFocused ? '1' : '2'}; min-height: 150px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 5px; transition: flex 0.3s ease;">
                        <details open style="background: var(--bg); border: 1px solid var(--border); border-left: 4px solid var(--intent-primary); border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <summary style="padding: 15px; cursor: pointer; display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted); font-weight: bold; outline: none; user-select: none;">
                                <span>Initial Description</span>
                                <span>${this.selectedTicket?.created_at ? new Date(this.selectedTicket.created_at).toLocaleString() : ''}</span>
                            </summary>
                            <div style="padding: 0 15px 15px 15px; font-size: 0.95rem; word-break: break-word; border-top: 1px dashed var(--border); margin-top: 5px; padding-top: 15px;" .innerHTML=${this.selectedTicket?.description || this.selectedTicket?.description_text || 'No description provided.'}></div>
                        </details>

                        ${this.conversationsLoading ? html`<div class="spinner" style="display:block; text-align:center; padding: 20px;">Loading thread...</div>` : ''}
                        ${this.conversations?.map(conv => html`
                            <details ?open=${!conv.private} style="background: var(--bg); border: 1px solid var(--border); border-left: 4px solid ${conv.private ? 'var(--intent-neutral)' : (conv.incoming ? 'var(--intent-warning)' : 'var(--intent-success)')}; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <summary style="padding: 15px; cursor: pointer; display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted); font-weight: bold; outline: none; user-select: none;">
                                    <span style="display: flex; align-items: center; gap: 8px;">
                                        <span>${conv.private ? '📝 Private Note' : (conv.incoming ? '📨 Reply from Customer' : '📤 Agent Response')}</span>
                                        <span style="color: var(--text); opacity: 0.6;">${conv.from_email ? `<${conv.from_email}>` : ''}</span>
                                    </span>
                                    <span>${new Date(conv.created_at).toLocaleString()}</span>
                                </summary>
                                <div style="padding: 0 15px 15px 15px; font-size: 0.95rem; word-break: break-word; color: var(--text); border-top: 1px dashed var(--border); margin-top: 5px; padding-top: 15px;" .innerHTML=${conv.body || conv.body_text || 'No text content.'}></div>
                            </details>
                        `)}
                    </div>

                    <!-- Reply Editor -->
                    <div @click=${() => FreshdeskStore.setState({ editorFocused: true })} @focusin=${() => FreshdeskStore.setState({ editorFocused: true })} style="border-top: 1px solid var(--border); padding-top: 15px; display: flex; flex-direction: column; gap: 10px; flex: ${this.editorFocused ? '2' : '1'}; min-height: 200px; transition: flex 0.3s ease;">
                        <div style="flex: 1; border: 1px solid var(--border); border-radius: 4px; overflow: hidden; background: var(--bg); display: flex; flex-direction: column;">
                            <insetu-markdown-editor  
                                .value=${this.replyContent} 
                                @content-changed=${e => FreshdeskStore.setState({ replyContent: e.detail.value })}>
                            </insetu-markdown-editor>
                        </div>
                        <div style="display: flex; justify-content: flex-end; gap: 10px;">
                            <sutram-async-btn label="📤 Send Reply" intent="primary" .onClick=${() => this.sendReply()}></sutram-async-btn>
                        </div>
                    </div>
                </div>
            </sutram-modal>
            <div style="display: flex; gap: 15px; margin-top: 15px; align-items: center; background: var(--input-bg); padding: 10px; border-radius: 6px; border: 1px solid var(--border); flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted);">Assignee:</label>
                    <select style="padding: 4px 8px; width: auto;" .value=${this.filterAssignee} @change=${e => { FreshdeskStore.setState({ filterAssignee: e.target.value }); this.fetchTickets(); }}>
                        <option value="Self">Self</option>
                        <option value="Unassigned">Unassigned</option>
                        <option value="Self + Unassigned">Self + Unassigned</option>
                        <option value="All">All</option>
                    </select>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <label style="font-size: 0.85rem; font-weight: bold; color: var(--text-muted);">Status:</label>
                    <select style="padding: 4px 8px; width: auto;" .value=${this.filterStatus} @change=${e => { FreshdeskStore.setState({ filterStatus: e.target.value }); this.fetchTickets(); }}>
                        <option value="Open">Open</option>
                        <option value="Pending">Pending</option>
                        <option value="Open + Pending">Open + Pending</option>
                        <option value="All">All</option>
                    </select>
                </div>
            </div>
            ${this.syncLedger.length > 0 ? html`
                <div style="background: var(--input-bg); padding: 10px 15px; border-radius: 6px; border: 1px solid var(--border); font-size: 0.85rem; color: var(--text-muted); margin-top: 15px;">
                    <strong style="color: var(--text);">Cache Coverage:</strong>
                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 5px;">
                        ${this.syncLedger.map(l => html`
                            <div>✔️ ${new Date(l.start_time).toLocaleDateString()} to ${new Date(l.end_time).toLocaleDateString()}</div>
                        `)}
                    </div>
                </div>
            ` : ''}

            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
                ${(this.tickets.length === 0 && this.activeJobId) ? html`<div class="spinner" style="display:block; padding: 20px;">${this.loadingMsg || 'Fetching Freshdesk tickets...'}</div>` : ''}
                ${(this.tickets.length === 0 && !this.activeJobId) ? html`<p style="color: var(--text-muted); font-style: italic; padding: 20px;">No active tickets found.</p>` : ''}
                ${this.tickets.filter(t => {
                    if (this.ignoredTickets?.includes(t.id)) return false;
                    return this._ticketMatchesFilters(t, this.filterStatus, this.filterAssignee, this.myAgentId);
                }).map(t => {
                    const statusMap = { 2: 'Open', 3: 'Pending', 4: 'Resolved', 5: 'Closed' };
                    const prioMap = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent' };

                    let assigneeText = 'None';
                    if (t.responder_id) {
                        assigneeText = (t.responder_id === this.myAgentId) ? 'Me' : (t.responder_name || 'Someone Else');
                    }

                    return html`
                    <insetu-card
                        .filename=${`Ticket #${t.id}`}
                        .titleText=${t.subject}
                        .descriptionText=${`Assignee: ${assigneeText} | Status: ${statusMap[t.status] || t.status} | Priority: ${prioMap[t.priority] || t.priority}`}
                        .detailText=${new Date(t.created_at).toLocaleString()}
                        icon="🎫"
                        intentColor="var(--intent-highlight)"
                        entityType="freshdesk_ticket"
                        .entityData=${t}
                        @card-clicked=${() => {
                            FreshdeskStore.setState({ selectedTicket: t, isModalOpen: true });
                            this.fetchConversations(t.id);
                        }}>
                    </insetu-card>
                `})}
                ${(this.tickets.length > 0 && this.activeJobId) ? html`
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; padding: 15px; color: var(--text-muted); font-size: 0.9rem; font-style: italic; opacity: 0.8;">
                        <span class="spinner" style="display: inline-block; width: 14px; height: 14px; margin: 0; border-width: 2px;"></span>
                        Hydrating stream: ${this.loadingMsg}
                    </div>
                ` : ''}
                ${(!this.activeJobId && this.tickets.length > 0) ? html`
                    <button class="btn-sm" style="background: var(--intent-primary); width: 100%; margin-top: 10px; padding: 12px; font-weight: bold;" @click=${() => this.fetchTickets(true)}>
                        ⬇️ Load Older Tickets (Pages ${Math.max((this.lastFetchedPage || 0) + 1, Math.floor(this.contiguousCount / 100) + 1)} & ${Math.max((this.lastFetchedPage || 0) + 1, Math.floor(this.contiguousCount / 100) + 1) + 1})
                    </button>
                ` : ''}
            </div>
        `;
    }
}
customElements.define('insetu-ext-freshdesk', InSetuExtFreshdesk);
// 3. Declarative OS Extension Mapping
window.ExtensionRegistry.registerExtension('freshdesk', {
    name: "Freshdesk Support",
    version: "2.0.0",
    // Polymorphic Entity Actions (buttons appear on the cards automatically)
    entityActions: [
        {
            targetEntity: 'freshdesk_ticket',
            id: 'fd-take',
            label: 'Take',
            icon: '🙋',
            intent: 'success',
            order: 20,
            match: (data) => {
                const myId = FreshdeskStore.getState().myAgentId;
                return !myId || data.responder_id !== myId;
            },
            emitEvent: (data) => ({ name: 'insetu:freshdesk:take', detail: { id: data.id } })
        },
        {
            targetEntity: 'freshdesk_ticket',
            id: 'fd-resolve',
            label: 'Resolve',
            icon: '✅',
            intent: 'neutral',
            order: 30,
            match: (data) => {
                return data.status !== 4 && data.status !== 5;
            },
            emitEvent: (data) => ({ name: 'insetu:freshdesk:resolve', detail: { id: data.id } })
        },
        {
            targetEntity: 'freshdesk_ticket',
            id: 'fd-ignore',
            label: 'Ignore',
            icon: '🚫',
            intent: 'danger',
            order: 40,
            match: (data) => true,
            emitEvent: (data) => ({ name: 'insetu:freshdesk:ignore', detail: { id: data.id } })
        }
    ],

    // Inject into the primary Layout Slots
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "freshdesk",
            label: "Freshdesk",
            order: 5,
            component: "insetu-ext-freshdesk"
        }
    ],
    // React to global OS events without direct DOM coupling
    uiHooks: {
        'zone:subtab-changed': (data) => {
            if (data.parentId === 'edit' && data.subId === 'freshdesk') {
                if (data.forceRefresh) {
                    FreshdeskStore.setState({ tickets: [] });
                    window.inSetu.events.emit('insetu:freshdesk:fetch');
                }
            }
        },
        'zone:soft-refresh': (ws) => {
            FreshdeskStore.setState({ tickets: [] });
            window.inSetu.events.emit('insetu:freshdesk:fetch');
            return false;
        }
    }
});