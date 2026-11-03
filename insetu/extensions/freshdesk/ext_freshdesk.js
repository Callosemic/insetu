import { html } from 'lit';
import { InSetuElement, createExtensionStore, sharedStyles } from '/static/extensions/system/insetu_sdk.js';

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
    static get extensionName() { return 'freshdesk'; }
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
        this.bindStore(
            FreshdeskStore,
            state => ({
                tickets: state.tickets,
                loadingMsg: state.loadingMsg,
                activeJobId: state.activeJobId,
                selectedTicket: state.selectedTicket,
                isModalOpen: state.isModalOpen,
                conversations: state.conversations,
                conversationsLoading: state.conversationsLoading,
                myAgentId: state.myAgentId,
                filterAssignee: state.filterAssignee,
                filterStatus: state.filterStatus,
                replyContent: state.replyContent,
                editorFocused: state.editorFocused,
                ignoredTickets: state.ignoredTickets || [],
                syncLedger: state.syncLedger || [],
                contiguousCount: state.contiguousCount || 0,
                lastFetchedPage: state.lastFetchedPage || 0
            }),
            { autoFetch: () => this.loadIgnored() }
        );
    }
    onForceRefresh() {
        super.onForceRefresh();
        this.fetchTickets();
    }
    _ticketMatchesFilters(t, filterStatus, filterAssignee, myAgentId) {
        const sMatch = filterStatus === 'All' || 
            (filterStatus === 'Open' && t.status === 2) || 
            (filterStatus === 'Pending' && t.status === 3) || 
            (filterStatus === 'Open + Pending' && (t.status === 2 || t.status === 3));

        const isMe = t.responder_id === myAgentId;
        const isUnassigned = !t.responder_id;
        const aMatch = filterAssignee === 'All' || 
            (filterAssignee === 'Self' && isMe) || 
            (filterAssignee === 'Unassigned' && isUnassigned) || 
            (filterAssignee === 'Self + Unassigned' && (isMe || isUnassigned));

        return sMatch && aMatch;
    }
    async loadIgnored() {
        try {
            const res = await this.api.get('freshdesk/tickets/ignored');
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
            await this.api.post(`freshdesk/tickets/${ticketId}/ignore`, {});
            if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("🚫 Ticket Ignored!", 2000);
        } catch (err) {
            console.error("Failed to save ignored tickets schema", err);
        }
    }
    _getResolveTicketAction(ticketId) {
        return this.api.bindJobAction(`freshdesk/tickets/${ticketId}/resolve`, {}, {
            onProgress: (msg) => FreshdeskStore.setState({ loadingMsg: msg }),
            onComplete: (statusData) => {
                const updatedTicket = statusData.artifact.ticket;
                const state = FreshdeskStore.getState();
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
    }
    async resolveTicket(ticketId) {
        FreshdeskStore.setState({ loadingMsg: "Resolving ticket...", activeJobId: 'starting' });
        try { await this._getResolveTicketAction(ticketId)(); } catch(e) {}
    }
    _getTakeTicketAction(ticketId) {
        return this.api.bindJobAction(`freshdesk/tickets/${ticketId}/take`, {}, {
            onProgress: (msg) => FreshdeskStore.setState({ loadingMsg: msg }),
            onComplete: (statusData) => {
                const updatedTicket = statusData.artifact.ticket;
                const state = FreshdeskStore.getState();
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
    }
    async takeTicket(ticketId) {
        FreshdeskStore.setState({ loadingMsg: "Assigning ticket to you...", activeJobId: 'starting' });
        try { await this._getTakeTicketAction(ticketId)(); } catch(e) {}
    }
    _getSendReplyAction() {
        return this.api.bindJobAction(`freshdesk/tickets/${this.selectedTicket?.id}/reply`, () => {
            const content = FreshdeskStore.getState().replyContent;
            if (!content.trim()) throw new Error("Reply content missing.");
            return { body: content };
        }, {
            onComplete: async () => {
                FreshdeskStore.setState({ replyContent: '' });
                this.fetchConversations(this.selectedTicket?.id);
                if (this.ui && this.ui.setGlobalStatus) this.ui.setGlobalStatus("✅ Reply Sent & Saved Locally!", 2000);
            },
            onError: (err) => {
                if (window.alert) window.alert(`Reply Error: ${err.message}`);
            }
        });
    }
    async sendReply() {
        try { await this._getSendReplyAction()(); } catch(e) {}
    }
    async copyThread() {
        const ticketId = this.selectedTicket?.id;
        if (!ticketId) return;
        try {
            const res = await this.api.get(`freshdesk/tickets/${ticketId}/thread`);
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
    _getFetchConversationsAction(ticketId) {
        return this.api.bindJobAction(`freshdesk/tickets/${ticketId}/conversations`, {}, {
            onComplete: (statusData) => {
                FreshdeskStore.setState({ conversations: statusData.artifact.conversations || [], conversationsLoading: false });
            },
            onError: (err) => {
                FreshdeskStore.setState({ conversationsLoading: false });
                if (window.alert) window.alert(`Conversations Error: ${err.message}`);
            }
        });
    }
    async fetchConversations(ticketId) {
        FreshdeskStore.setState({ conversationsLoading: true, conversations: [] });
        try { await this._getFetchConversationsAction(ticketId)(); } catch(e) { FreshdeskStore.setState({ conversationsLoading: false }); }
    }
    async fetchTickets(loadMore = false) {
        // Guardrail: Don't fetch if the extension isn't active in this workspace
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('freshdesk')) return;

        const state = FreshdeskStore.getState();

        // Heuristic calculation based on cached items
        const heuristicPage = Math.floor(state.contiguousCount / 100) + 1;
        // Never fetch a page we've already fetched in this session
        const nextPage = loadMore ? Math.max((state.lastFetchedPage || 0) + 1, heuristicPage) : 1;

        if (!loadMore) FreshdeskStore.setState({ lastFetchedPage: 0 });

        // We will fetch a 2-page spread
        FreshdeskStore.setState({ 
            loadingMsg: `Fetching pages ${nextPage} & ${nextPage + 1}...`, 
            activeJobId: 'starting',
            lastFetchedPage: nextPage + 1
        });
        try {
            // ADR 0017: Utilize the native component this.api wrapper
            const res = await this.api.post('freshdesk/tickets/fetch', {
                filterAssignee: state.filterAssignee,
                filterStatus: state.filterStatus,
                page: nextPage,
                twoPageSpread: true
            });
            if (res.ok) {
                const data = await res.json();
                FreshdeskStore.setState({ activeJobId: data.job_id });
                // Utilize the OS job metronome to poll the background task statelessly
                window.inSetu.utils.pollJob(data.job_id, {
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
            ${this.isModalOpen ? html`
            <sutram-modal ?open=${true} titleText="Ticket #${this.selectedTicket?.id || ''}" ?fullscreen=${true} @sutram-modal-closed=${() => FreshdeskStore.setState({ isModalOpen: false })}>
                <sutram-stack slot="body" direction="col" gap="md">
                    <sutram-collapsible titleText="Subject: ${this.selectedTicket?.subject || ''}" intent="primary" ?open=${true}>
                        <sutram-stack direction="row" justify="between" align="center" gap="md" ?wrap=${true}>
                            <sutram-stack direction="row" gap="md" ?wrap=${true}>
                                <span><b>Sender:</b> ${this.selectedTicket?.requester?.name || 'Customer'} (${this.selectedTicket?.requester?.email || 'No email'})</span>
                                <span><b>Assigned Agent:</b> ${this.selectedTicket?.responder_id === this.myAgentId ? 'You' : (this.selectedTicket?.responder_name || 'Unassigned')}</span>
                            </sutram-stack>
                            <sutram-stack direction="row" gap="xs" ?wrap=${true}>
                                <sutram-btn ?compact=${true} intent="primary" label="📋 Copy Thread" @click=${() => this.copyThread()}></sutram-btn>
                                ${(!this.myAgentId || this.selectedTicket?.responder_id !== this.myAgentId) ? html`<sutram-btn ?compact=${true} intent="success" label="🙋 Take" @click=${() => this.takeTicket(this.selectedTicket?.id)}></sutram-btn>` : ''}
                                ${(this.selectedTicket?.status !== 4 && this.selectedTicket?.status !== 5) ? html`<sutram-btn ?compact=${true} intent="neutral" label="✅ Resolve" @click=${() => this.resolveTicket(this.selectedTicket?.id)}></sutram-btn>` : ''}
                                <sutram-btn ?compact=${true} intent="danger" label="🚫 Ignore" @click=${() => { this.ignoreTicket(this.selectedTicket?.id); FreshdeskStore.setState({ isModalOpen: false }); }}></sutram-btn>
                            </sutram-stack>
                        </sutram-stack>
                    </sutram-collapsible>

                    <sutram-stack direction="col" gap="sm" @click=${() => FreshdeskStore.setState({ editorFocused: false })}>
                        <sutram-collapsible titleText="Initial Description (${this.selectedTicket?.created_at ? this.utils.formatDate(this.selectedTicket.created_at) : ''})" intent="primary" ?open=${true}>
                            <div style="white-space: pre-wrap; word-break: break-word;">${this.selectedTicket?.description_text || this.selectedTicket?.description || 'No description provided.'}</div>
                        </sutram-collapsible>

                        ${this.conversationsLoading ? html`<sutram-spinner text="Loading thread..."></sutram-spinner>` : ''}
                        ${this.conversations?.map(conv => html`
                            <sutram-collapsible
                                titleText="${conv.private ? '📝 Private Note' : (conv.incoming ? '📨 Reply from Customer' : '📤 Agent Response')} ${conv.from_email ? `<${conv.from_email}>` : ''} (${this.utils.formatDate(conv.created_at)})"
                                intent=${conv.private ? 'neutral' : (conv.incoming ? 'warning' : 'success')}
                                ?open=${!conv.private}>
                                <div style="white-space: pre-wrap; word-break: break-word;">${conv.body_text || conv.body || 'No text content.'}</div>
                            </sutram-collapsible>
                        `)}
                    </sutram-stack>

                    <sutram-surface variant="panel" border="top" padding="sm" gap="sm" @click=${() => FreshdeskStore.setState({ editorFocused: true })} @focusin=${() => FreshdeskStore.setState({ editorFocused: true })}>
                        <div style="min-height: 180px;">
                            <insetu-markdown-editor  
                                .value=${this.replyContent} 
                                @content-changed=${e => FreshdeskStore.setState({ replyContent: e.detail.value })}>
                            </insetu-markdown-editor>
                        </div>
                        <sutram-stack direction="row" justify="end">
                            <sutram-async-btn label="📤 Send Reply" intent="primary" .onClick=${this._getSendReplyAction()}></sutram-async-btn>
                        </sutram-stack>
                    </sutram-surface>
                </sutram-stack>
            </sutram-modal>
            ` : ''}
            <sutram-view>
                <sutram-stack direction="col" gap="md">
                    <sutram-surface variant="panel" padding="sm">
                        <sutram-stack direction="grid" ?compact=${true}>
                            <sutram-select 
                                label="Assignee" 
                                ?flush=${true}
                                .value=${this.filterAssignee} 
                                .options=${[
                                    { value: 'Self', label: 'Self' },
                                    { value: 'Unassigned', label: 'Unassigned' },
                                    { value: 'Self + Unassigned', label: 'Self + Unassigned' },
                                    { value: 'All', label: 'All' }
                                ]} 
                                @sutram-input-changed=${e => { FreshdeskStore.setState({ filterAssignee: e.detail.value }); this.fetchTickets(); }}>
                            </sutram-select>
                            <sutram-select 
                                label="Status" 
                                ?flush=${true}
                                .value=${this.filterStatus} 
                                .options=${[
                                    { value: 'Open', label: 'Open' },
                                    { value: 'Pending', label: 'Pending' },
                                    { value: 'Open + Pending', label: 'Open + Pending' },
                                    { value: 'All', label: 'All' }
                                ]} 
                                @sutram-input-changed=${e => { FreshdeskStore.setState({ filterStatus: e.detail.value }); this.fetchTickets(); }}>
                            </sutram-select>
                        </sutram-stack>
                    </sutram-surface>

                    ${this.syncLedger.length > 0 ? html`
                        <sutram-surface variant="panel" padding="sm" gap="xs">
                            <strong>Cache Coverage:</strong>
                            <sutram-stack direction="col" gap="xs">
                                ${this.syncLedger.map(l => html`
                                    <sutram-label .text=${`✔️ ${this.utils.formatDate(l.start_time)} to ${this.utils.formatDate(l.end_time)}`}></sutram-label>
                                `)}
                            </sutram-stack>
                        </sutram-surface>
                    ` : ''}

                    <sutram-stack direction="col" gap="sm">
                        ${this.activeJobId ? html`<sutram-spinner text=${this.loadingMsg || 'Fetching Freshdesk tickets...'}></sutram-spinner>` : ''}
                        ${(this.tickets.length === 0 && !this.activeJobId) ? html`<sutram-empty-state text="No active tickets found."></sutram-empty-state>` : ''}
                        <sutram-stack direction="col" gap="sm">
                            ${this.tickets.filter(t => {
                                if (this.ignoredTickets?.includes(t.id)) return false;
                                return this._ticketMatchesFilters(t, this.filterStatus, this.filterAssignee, this.myAgentId);
                            }).map(t => {
                                const statusMap = { 2: 'Open', 3: 'Pending', 4: 'Resolved', 5: 'Closed' };
                                const prioMap = { 1: 'Low', 2: 'Medium', 3: 'High', 4: 'Urgent' };
                                const assigneeText = t.responder_id ? ((t.responder_id === this.myAgentId) ? 'Me' : (t.responder_name || 'Someone Else')) : 'None';
                                return html`
                                <sutram-card
                                    .filename=${`Ticket #${t.id}`}
                                    .titleText=${t.subject}
                                    .descriptionText=${`Assignee: ${assigneeText} | Status: ${statusMap[t.status] || t.status} | Priority:${prioMap[t.priority] || t.priority}`}
                                    .detailText=${this.utils.formatDate(t.created_at)}
                                    icon="ticket"
                                    intent="highlight"
                                    entityType="freshdesk_ticket"
                                    .entityData=${t}
                                    @card-clicked=${() => {
                                        FreshdeskStore.setState({ selectedTicket: t, isModalOpen: true });
                                        this.fetchConversations(t.id);
                                    }}>
                                </sutram-card>
                            `})}
                        </sutram-stack>
                        ${(!this.activeJobId && this.tickets.length > 0) ? html`
                            <sutram-btn intent="primary" ?fullWidth=${true} label=${'⬇️ Load Older Tickets (Pages ' + Math.max((this.lastFetchedPage || 0) + 1, Math.floor(this.contiguousCount / 100) + 1) + ' & ' + (Math.max((this.lastFetchedPage || 0) + 1, Math.floor(this.contiguousCount / 100) + 1) + 1) + ')'} @click=${() => this.fetchTickets(true)}></sutram-btn>
                        ` : ''}
                    </sutram-stack>
                </sutram-stack>
            </sutram-view>
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
            icon: "headphones",
            intent: "highlight",
            order: 5,
            component: "insetu-ext-freshdesk"
        }
    ]
});