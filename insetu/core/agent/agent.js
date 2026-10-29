import { html, css } from 'lit';
import { createExtensionStore, InSetuElement, sharedStyles } from '/static/extensions/system/insetu_sdk.js';
export const AgentStore = createExtensionStore('Agent', {
    sessions: [],
    routines: [],
    llmProfiles: [],
    llmEndpoints: [],
    activeProfileId: 'default',
    availableOptions: { contexts: [], diffs: [], prompts: [] },
    activeSessionId: null,
    messages: [],
    loading: false,
    editingRoutine: null,
    routineForm: {},
    attachedFiles: [],
    readOnlyFiles: [],
    agentRoutineId: 'workspace_turn',
    agentMode: 'auto',
    promptInput: '',
    pendingHandoff: null,
    handoffBranchIdx: 0,
    handoffBranchResponses: {},
    handoffPasteText: '',
    lastTurnCommittedFiles: [],
    setModePrefix: (modeId, explicitRoutineId = null, explicitScope = null) => {
        const st = AgentStore.getState();
        const raw = st.promptInput || '';
        const stripped = raw.replace(/^\/(?:user:[a-zA-Z0-9_:-]*|[a-zA-Z0-9_:-]+)\s*/, '');
        const CORE_MODE_ROUTINES = {
            auto: 'workspace_turn',
            code: 'code',
            plan: 'plan',
            ask: 'ask',
            yomama: 'yomama'
        };
        if (modeId === 'auto') {
            AgentStore.setState({
                agentRoutineId: 'workspace_turn',
                agentMode: 'auto',
                promptInput: stripped
            });
            return;
        }
        if (CORE_MODE_ROUTINES[modeId]) {
            AgentStore.setState({
                agentRoutineId: CORE_MODE_ROUTINES[modeId],
                agentMode: modeId,
                promptInput: `/${modeId} ${stripped}`
            });
            return;
        }
        if (modeId === 'user') {
            if (explicitRoutineId) {
                const scopeSuffix = explicitScope ? `:${explicitScope}` : '';
                AgentStore.setState({
                    agentRoutineId: explicitRoutineId,
                    agentMode: 'user',
                    promptInput: `/user:${explicitRoutineId}${scopeSuffix} ${stripped}`
                });
            } else {
                AgentStore.setState({
                    agentRoutineId: 'workspace_turn',
                    agentMode: 'user',
                    promptInput: `/user:${stripped ? ' ' + stripped : ''}`
                });
            }
        }
    },
    selectRoutine: ({ routineId, mode } = {}) => {
        if (!routineId) return;
        const CORE_MODES = new Set(['auto', 'code', 'plan', 'ask', 'yomama']);
        if (routineId === 'workspace_turn' && (!mode || CORE_MODES.has(mode))) {
            AgentStore.getState().setModePrefix(mode || 'auto');
            return;
        }
        if (CORE_MODES.has(routineId)) {
            AgentStore.getState().setModePrefix(routineId);
            return;
        }
        AgentStore.getState().setModePrefix('user', routineId);
    },
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
    selectProfile: async (profileId) => {
        if (!profileId) return;
        AgentStore.setState({ activeProfileId: profileId });
        try {
            await window.inSetu.api.workspace.post('llm/profiles', { active_profile_id: profileId });
        } catch (e) {
            console.warn("Failed to persist active LLM profile:", e);
        }
    },
    fetchSessions: async () => {
        AgentStore.setState({ loading: true });
        try {
            const [sesRes, routRes, profRes] = await Promise.all([
                window.inSetu.api.get('agent/sessions'),
                window.inSetu.api.get('agent/routines'),
                window.inSetu.api.workspace.get('llm/profiles')
            ]);
            const patch = {};
            if (sesRes.ok) {
                const data = await sesRes.json();
                patch.sessions = data.sessions || [];
            }
            if (routRes.ok) {
                const rData = await routRes.json();
                patch.routines = rData.routines || [];
                patch.availableOptions = {
                    contexts: rData.available_contexts || [],
                    diffs: rData.available_diffs || [],
                    prompts: rData.available_prompts || []
                };
            }
            if (profRes && profRes.ok) {
                const pData = await profRes.json();
                patch.llmProfiles = pData.profiles || [];
                patch.llmEndpoints = pData.endpoints || [];
                patch.activeProfileId = pData.active_profile_id || 'default';
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
    },
    openRoutineStudio: (routine = null, forkMode = false) => {
        const isNew = !routine;
        const baseNodes = (routine && Array.isArray(routine.nodes) && routine.nodes.length > 0)
            ? routine.nodes.map(n => ({
                id: n.id || 'step_1',
                type: n.type || 'llm',
                tier: n.tier || 'standard',
                parents: Array.isArray(n.parents) ? [...n.parents] : [],
                capability: n.capability || n.action || '',
                condition: n.condition || n.when || '',
                map_over: n.map_over || '',
                repeat: n.repeat || 1,
                output_schema: n.output_schema || '',
                prompt: n.prompt || ''
            }))
            : [{ id: 'synthesize_step', type: 'llm', tier: 'standard', parents: [], capability: '', condition: '', map_over: '', repeat: 1, output_schema: 'conversational_with_patches', prompt: '' }];

        const routineForm = {
            id: isNew ? '' : (forkMode ? `${routine.id}_custom` : routine.id),
            original_id: (!isNew && !forkMode) ? routine.id : '',
            title: isNew ? '' : (forkMode ? `${routine.title || routine.name} (Custom)` : (routine.title || routine.name || routine.id)),
            domain: (routine && routine.domain) ? routine.domain : 'Routines',
            description: (routine && routine.description) ? routine.description : '',
            slash_command: isNew ? '' : (routine.slash_command || `/${routine.id}`),
            scope: (routine && routine.source === 'user_template') ? 'user' : 'workspace',
            includes: (routine && Array.isArray(routine.includes)) ? [...routine.includes] : [],
            showIfExists: (routine && Array.isArray(routine.show_if_exists)) ? [...routine.show_if_exists] : [],
            showIfMissing: (routine && Array.isArray(routine.show_if_missing)) ? [...routine.show_if_missing] : [],
            includePrompt: (routine && routine.include_prompt) ? routine.include_prompt : '',
            responsePath: (routine && routine.response_path) ? routine.response_path : '',
            archivePath: (routine && routine.archive_path) ? routine.archive_path : '',
            nodes: baseNodes,
            filepath: (routine && routine.filepath) ? routine.filepath : ''
        };
        AgentStore.setState({ editingRoutine: routine, routineForm });
        if (window.Sutram?.stores?.Layout) {
            const layout = window.Sutram.stores.Layout.getState();
            layout.openWindow({
                id: 'agent:routine-studio',
                component: 'insetu-agent-routine-projection',
                label: isNew ? 'New Declarative Routine' : `Routine Studio: ${routineForm.title || routineForm.id}`,
                icon: 'workflow',
                intent: 'warning',
                extName: 'agent',
                windowOnly: true
            }, layout.focusedColumn || 'center', 1);
        }
    }
}, {
    onEvict: {
        'agent:routine-studio': { editingRoutine: null, routineForm: {} }
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
export function classifyRoutineTargetUri(rawInc) {
    if (!rawInc || typeof rawInc !== 'string') {
        return { healedUri: '', isUndefined: true, isCleanDiff: false, isSystem: false, candidate: null };
    }
    const appState = window.inSetu?.stores?.App?.getState ? window.inSetu.stores.App.getState() : {};
    const manifestCtx = appState.manifest?.ctx || {};
    const allRepos = appState.allRepos || [];
    const agentState = AgentStore.getState ? AgentStore.getState() : {};
    const opts = agentState.availableOptions || {};
    const availContexts = opts.contexts || [];
    const availDiffs = opts.diffs || [];
    const availPrompts = opts.prompts || [];
    const routines = agentState.routines || [];
    const availWorkflows = routines.map(r => `ctx://workflows/workflow_${r.id}_context.txt`);
    const allDefinedUris = [...availDiffs, ...availContexts, ...availPrompts, ...availWorkflows];
    const uriObj = new window.inSetu.utils.InSetuURI(rawInc);
    const inc = uriObj.isDir ? `${uriObj.toString()}/` : uriObj.toString();
    const isSystem = uriObj.scheme === 'ctx' || uriObj.scheme === 'ws';
    const isDiff = inc.startsWith('ctx://diffs/') || inc.endsWith('_diffs.txt');
    const isWorkflow = inc.startsWith('ctx://workflows/');
    const isPrompt = inc.startsWith('ctx://prompts/') || uriObj.volume === 'prompts';
    const isGatherContext = isSystem && !isDiff && !isWorkflow && !isPrompt;

    const hasTopologyLoaded = availContexts.length > 0 || availDiffs.length > 0 || allRepos.length > 0;
    let isUndefined = false;
    if (hasTopologyLoaded) {
        if (isDiff) isUndefined = !availDiffs.includes(inc);
        else if (isGatherContext) isUndefined = !availContexts.includes(inc) && !manifestCtx[inc];
        else if (isWorkflow) isUndefined = routines.length > 0 && !availWorkflows.includes(inc);
        else if (isPrompt) isUndefined = availPrompts.length > 0 && !availPrompts.includes(inc);
        else if (uriObj.scheme === 'vfs' && uriObj.repo && allRepos.length > 0 && !allRepos.includes(uriObj.repo)) {
            isUndefined = true;
        }
    }
    const isCleanDiff = isDiff && !isUndefined && !manifestCtx[inc];
    let candidate = null;
    if (isUndefined) {
        const base = uriObj.basename;
        candidate = allDefinedUris.find(f => f === `ctx://contexts/${base}` || f === `ctx://diffs/${base}` || f.endsWith('/' + base) || f.endsWith('_' + base)) || null;
    }
    return { healedUri: inc, isUndefined, isCleanDiff, isSystem, isDiff, candidate };
}
function _formatWavefrontBadge(wavefronts) {
    if (!Array.isArray(wavefronts) || wavefronts.length === 0) return '';
    return 'Wavefronts: ' + wavefronts.map(w => Array.isArray(w) ? (w.length > 1 ? `${w.length}∥` : '1') : '1').join(' → ');
}

function _toDagNodeViewModel(node) {
    if (!node || typeof node !== 'object') return { id: String(node || 'node'), title: String(node || 'node') };
    const nType = node.type || 'llm';
    const badges = [
        { text: nType, intent: nType === 'exec' ? 'highlight' : (nType === 'loop' ? 'warning' : 'primary') }
    ];
    if (node.tier && nType === 'llm') {
        badges.push({ text: node.tier, intent: 'neutral' });
    }
    const subtitle = node.map_over
        ? `⚡ map_over: ${node.map_over}`
        : (node.repeat > 1 ? `⚡ repeat ×${node.repeat}` : '');
    return {
        ...node,
        title: node.id || node.name || 'node',
        badges,
        subtitle,
        parents: Array.isArray(node.parents) ? node.parents : []
    };
}

export class InSetuAgentRoutineProjection extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        routineForm: { type: Object },
        availableOptions: { type: Object },
        _editorTab: { type: String },
        _rawMarkdown: { type: String },
        _showContextPicker: { type: Boolean },
        _contextPickerTarget: { type: String },
        _tempSelectedUris: { type: Array },
        _pickerSearch: { type: String }
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
        .studio-section {
            display: flex;
            flex-direction: column;
            gap: 12px;
            padding: 14px 16px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
        }
        .studio-section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        .studio-section-title {
            margin: 0;
            font-size: 0.9rem;
            font-weight: 700;
            color: var(--text);
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .node-editor-card {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 12px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 6px;
        }
    `];

    constructor() {
        super();
        const st = AgentStore.getState();
        this.routineForm = st.routineForm || {};
        this.availableOptions = st.availableOptions || { contexts: [], diffs: [], prompts: [] };
        this._editorTab = 'visual';
        this._rawMarkdown = '';
        this._showContextPicker = false;
        this._contextPickerTarget = 'includes';
        this._tempSelectedUris = [];
        this._pickerSearch = '';
    }

    connectedCallback() {
        super.connectedCallback();
        this.subscribe(
            AgentStore,
            state => ({
                routineForm: state.routineForm || {},
                availableOptions: state.availableOptions || { contexts: [], diffs: [], prompts: [] }
            }),
            ({ routineForm, availableOptions }) => {
                this.routineForm = routineForm;
                this.availableOptions = availableOptions;
                this.requestUpdate();
            }
        );
    }

    _patchForm(patch) {
        AgentStore.setState(s => ({ routineForm: { ...(s.routineForm || {}), ...patch } }));
    }

    _updateNode(idx, patch) {
        const nodes = [...(this.routineForm.nodes || [])];
        if (!nodes[idx]) return;
        nodes[idx] = { ...nodes[idx], ...patch };
        this._patchForm({ nodes });
    }

    _addNode(parentIds = []) {
        const nodes = [...(this.routineForm.nodes || [])];
        const nextIdx = nodes.length + 1;
        nodes.push({
            id: `step_${nextIdx}`,
            type: 'llm',
            tier: 'standard',
            parents: Array.isArray(parentIds) ? [...parentIds] : [],
            capability: '',
            condition: '',
            map_over: '',
            repeat: 1,
            output_schema: '',
            prompt: ''
        });
        this._patchForm({ nodes });
    }

    _removeNode(idx) {
        const nodes = [...(this.routineForm.nodes || [])];
        const removed = nodes.splice(idx, 1)[0];
        if (removed && removed.id) {
            nodes.forEach(n => {
                if (Array.isArray(n.parents)) {
                    n.parents = n.parents.filter(p => p !== removed.id);
                }
            });
        }
        this._patchForm({ nodes });
    }

    _buildMarkdownPreview() {
        const f = this.routineForm || {};
        const rid = this.utils.slugify(f.id || f.title || 'routine') || 'routine';
        const nodes = f.nodes || [];
        const cleanNodes = nodes.map(n => {
            const obj = { id: n.id, type: n.type || 'llm' };
            if (n.type === 'llm') obj.tier = n.tier || 'standard';
            if (n.type === 'exec' && n.capability) obj.capability = n.capability;
            obj.parents = Array.isArray(n.parents) ? n.parents : [];
            if (n.condition) obj.condition = n.condition;
            if (n.map_over) obj.map_over = n.map_over;
            if (n.repeat && Number(n.repeat) > 1) obj.repeat = Number(n.repeat);
            if (n.output_schema) obj.output_schema = n.output_schema;
            return obj;
        });
        const yamlObj = {
            id: rid,
            title: f.title || rid,
            domain: f.domain || 'Routines',
            description: f.description || '',
            slash_command: f.slash_command || `/${rid}`
        };
        if (Array.isArray(f.includes) && f.includes.length > 0) yamlObj.includes = f.includes;
        if (Array.isArray(f.showIfExists) && f.showIfExists.length > 0) yamlObj.show_if_exists = f.showIfExists;
        if (Array.isArray(f.showIfMissing) && f.showIfMissing.length > 0) yamlObj.show_if_missing = f.showIfMissing;
        if (f.includePrompt) yamlObj.include_prompt = f.includePrompt;
        if (f.responsePath) yamlObj.response_path = f.responsePath;
        if (f.archivePath) yamlObj.archive_path = f.archivePath;
        if (cleanNodes.length > 0) yamlObj.nodes = cleanNodes;

        const sections = nodes
            .filter(n => n.prompt && String(n.prompt).trim())
            .map(n => `## ${n.id}\n${String(n.prompt).trim()}`)
            .join('\n\n');
        return window.inSetu.utils.serializeFrontmatter(yamlObj, sections ? `${sections}\n` : '');
    }

    async _saveRoutine() {
        const f = this.routineForm || {};
        const title = (f.title || f.id || '').trim();
        if (!title && !this._rawMarkdown.trim()) {
            alert("Routine title is required.");
            return;
        }
        const rid = this.utils.slugify(f.id || title) || `routine_${Date.now()}`;
        const payload = {
            id: rid,
            original_id: f.original_id || undefined,
            title: title || rid,
            domain: (f.domain || 'Routines').trim(),
            description: (f.description || '').trim(),
            slash_command: (f.slash_command || `/${rid}`).trim(),
            scope: f.scope || 'workspace',
            includes: f.includes || [],
            show_if_exists: f.showIfExists || [],
            show_if_missing: f.showIfMissing || [],
            include_prompt: f.includePrompt || undefined,
            response_path: f.responsePath || undefined,
            archive_path: f.archivePath || undefined,
            nodes: f.nodes || []
        };
        if (this._editorTab === 'raw' && this._rawMarkdown.trim()) {
            payload.raw_content = this._rawMarkdown;
        }
        const res = await this.api.post('agent/routines/save', payload);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.routines)) {
                AgentStore.setState({ routines: data.routines });
            } else {
                await AgentStore.getState().fetchSessions();
            }
            if (window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow('agent:routine-studio');
            }
            this.setStatus(`✅ Saved routine '${payload.title}' (${data.filepath})`, 2500);
        } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || "Failed to save routine.");
        }
    }

    async _deleteRoutine() {
        const f = this.routineForm || {};
        if (!f.id || !confirm(`Delete routine override '${f.title || f.id}'?`)) return;
        const res = await this.api.post('agent/routines/delete', {
            id: f.id,
            filepath: f.filepath,
            scope: f.scope || 'workspace'
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.routines)) {
                AgentStore.setState({ routines: data.routines });
            } else {
                await AgentStore.getState().fetchSessions();
            }
            if (window.Sutram?.stores?.Layout) {
                window.Sutram.stores.Layout.getState().closeWindow('agent:routine-studio');
            }
            this.setStatus(`🗑️ Removed routine override '${f.id}'.`, 2500);
        }
    }
    render() {
        const f = this.routineForm || {};
        const nodes = Array.isArray(f.nodes) ? f.nodes : [];
        const rawStages = this.utils.compileDagWavefronts ? this.utils.compileDagWavefronts(nodes) : [];
        const stages = rawStages.map(wave => wave.map(_toDagNodeViewModel));
        const allSourceText = nodes.map(n => n.prompt || '').join('\n');
        const extractedVars = this.utils.extractTemplateVariables ? this.utils.extractTemplateVariables(allSourceText) : [];
        const allSelectableFiles = [
            ...(this.availableOptions?.diffs || []),
            ...(this.availableOptions?.contexts || []),
            ...(this.availableOptions?.prompts || [])
        ];

        return html`
            <div style="padding: 8px 16px; background: var(--input-bg); border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap;">
                <div style="display: flex; gap: 6px; align-items: center;">
                    <sutram-btn
                        size="sm"
                        icon="layers"
                        label="Visual Step Builder"
                        intent=${this._editorTab === 'visual' ? 'warning' : 'neutral'}
                        ?active=${this._editorTab === 'visual'}
                        @click=${() => { this._editorTab = 'visual'; this.requestUpdate(); }}>
                    </sutram-btn>
                    <sutram-btn
                        size="sm"
                        icon="code"
                        label="Raw Markdown-as-Code (.md)"
                        intent=${this._editorTab === 'raw' ? 'warning' : 'neutral'}
                        ?active=${this._editorTab === 'raw'}
                        @click=${() => {
                            this._rawMarkdown = this._buildMarkdownPreview();
                            this._editorTab = 'raw';
                            this.requestUpdate();
                        }}>
                    </sutram-btn>
                </div>
                <div style="display: flex; gap: 6px; align-items: center;">
                    ${f.filepath ? html`
                        <sutram-btn
                            size="sm"
                            intent="neutral"
                            icon="external-link"
                            label="Open in VFS Editor"
                            @click=${() => {
                                if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('agent:routine-studio');
                                if (this.vfs?.viewSourceFile) this.vfs.viewSourceFile(f.filepath, true, true);
                            }}>
                        </sutram-btn>
                    ` : ''}
                </div>
            </div>

            <sutram-scroll-view padding="16px">
                ${this._editorTab === 'raw' ? html`
                    <div class="studio-section" style="flex: 1;">
                        <div class="studio-section-header">
                            <h4 class="studio-section-title">
                                <yv-icon name="file-code-2" style="width: 15px; height: 15px; color: var(--intent-warning);"></yv-icon>
                                <span>Markdown-as-Code Source (${f.filepath || `ctx://routines/${f.id || 'routine'}.md`})</span>
                            </h4>
                        </div>
                        <sutram-textarea
                            ?flush=${true}
                            .monospace=${true}
                            .minRows=${18}
                            .maxHeight=${700}
                            .value=${this._rawMarkdown}
                            @sutram-input-changed=${e => { this._rawMarkdown = e.detail.value; }}>
                        </sutram-textarea>
                    </div>
                ` : html`
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="studio-section">
                            <div class="studio-section-header">
                                <h4 class="studio-section-title">
                                    <yv-icon name="sliders" style="width: 15px; height: 15px; color: var(--intent-warning);"></yv-icon>
                                    <span>1. Routine Identity & Override Tier</span>
                                </h4>
                                <sutram-tag text=${f.scope === 'user' ? 'Global User Template (.templates/user/)' : 'Workspace Routine (ctx://routines/)'} intent="warning"></sutram-tag>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
                                <sutram-input ?flush=${true} label="Title" .value=${f.title || ''} placeholder="e.g. Pre-Commit Diff Audit" @sutram-input-changed=${e => this._patchForm({ title: e.detail.value })}></sutram-input>
                                <sutram-input ?flush=${true} label="Slash Command" .value=${f.slash_command || ''} placeholder="e.g. /audit" @sutram-input-changed=${e => this._patchForm({ slash_command: e.detail.value })}></sutram-input>
                                <sutram-input ?flush=${true} label="Domain Category" .value=${f.domain || 'Routines'} placeholder="e.g. Workflows" @sutram-input-changed=${e => this._patchForm({ domain: e.detail.value })}></sutram-input>
                                <sutram-select
                                    ?flush=${true}
                                    label="Storage Tier"
                                    .value=${f.scope || 'workspace'}
                                    .options=${[
                                        { value: 'workspace', label: 'Workspace (ctx://routines/)' },
                                        { value: 'user', label: 'Global User Template (.templates/user/)' }
                                    ]}
                                    @sutram-input-changed=${e => this._patchForm({ scope: e.detail.value })}>
                                </sutram-select>
                            </div>
                            <sutram-input ?flush=${true} label="Description" .value=${f.description || ''} placeholder="Brief summary of this DAG routine..." @sutram-input-changed=${e => this._patchForm({ description: e.detail.value })}></sutram-input>
                        </div>
                        <div class="studio-section">
                            <div class="studio-section-header">
                                <h4 class="studio-section-title">
                                    <yv-icon name="git-branch" style="width: 15px; height: 15px; color: var(--intent-highlight);"></yv-icon>
                                    <span>2. Routine Execution Steps (${nodes.length} Step${nodes.length === 1 ? '' : 's'})</span>
                                </h4>
                                <sutram-btn size="sm" intent="success" icon="plus" label="Add Step" @click=${() => {
                                    const lastStage = stages[stages.length - 1] || [];
                                    this._addNode(lastStage.map(n => n.id));
                                }}></sutram-btn>
                            </div>
                            <sutram-dag-tree .stages=${stages}></sutram-dag-tree>
                            ${extractedVars.length > 0 ? html`
                                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding-top: 6px; border-top: 1px dashed var(--border);">
                                    <span style="font-size: 0.75rem; font-weight: bold; color: var(--text-muted);">Discovered Template Variables:</span>
                                    ${extractedVars.map(v => html`<sutram-tag text=${v.default ? `{{ ${v.name} | ${v.default} }}` : `{{ ${v.name} }}`} intent="highlight"></sutram-tag>`)}
                                </div>
                            ` : ''}
                        </div>
                        <insetu-schema-repeater
                            .field=${{
                                id: 'nodes',
                                label: '3. DAG Node Definitions',
                                scope: f.scope || 'workspace',
                                min_items: 1,
                                max_items: 32,
                                item_label: 'Step',
                                item_title_key: 'id',
                                item_subtitle_key: 'type',
                                add_label: 'Add DAG Step',
                                description: 'Define sequential or parallel LLM inference and deterministic capability nodes.',
                                item_actions: (node) => html`
                                    <sutram-btn size="sm" intent="highlight" icon="git-branch" label="+ Sibling" style="margin: 0;" @click=${(e) => { e.stopPropagation(); this._addNode(node.parents || []); }}></sutram-btn>
                                    <sutram-btn size="sm" intent="primary" icon="arrow-down" label="+ Downstream" style="margin: 0;" @click=${(e) => { e.stopPropagation(); this._addNode([node.id]); }}></sutram-btn>
                                `,
                                item_schema: [
                                    { id: 'id', label: 'Node ID', type: 'text', default: (idx) => `step_${idx}` },
                                    {
                                        id: 'type',
                                        label: 'Node Type',
                                        type: 'select',
                                        default: 'llm',
                                        options: [
                                            { value: 'llm', label: 'LLM Inference (llm)' },
                                            { value: 'exec', label: 'Capability Call (exec)' },
                                            { value: 'loop', label: 'Convergence Loop (loop)' }
                                        ]
                                    },
                                    {
                                        id: 'tier',
                                        label: 'Cognitive Tier',
                                        type: 'select',
                                        default: 'standard',
                                        show_if: { field: 'type', equals: 'llm' },
                                        options: [
                                            { value: 'decision', label: 'Decision Tier (Jev / Fast Fallback)' },
                                            { value: 'fast', label: 'Fast Tier' },
                                            { value: 'standard', label: 'Standard Tier' },
                                            { value: 'thinking', label: 'Thinking / High Tier' },
                                            { value: 'frontier', label: 'Frontier Tier' }
                                        ]
                                    },
                                    {
                                        id: 'capability',
                                        label: 'Capability (e.g. bridge.sync)',
                                        type: 'text',
                                        default: '',
                                        show_if: { field: 'type', not_equals: 'llm' }
                                    },
                                    {
                                        id: 'parents',
                                        label: 'Parents (comma-separated)',
                                        type: 'comma_list',
                                        default: [],
                                        placeholder: 'root (no parents)'
                                    },
                                    {
                                        id: 'condition',
                                        label: 'When Condition (Optional)',
                                        type: 'text',
                                        default: '',
                                        placeholder: "{{ nodes.prev.parsed.has_patches }}"
                                    },
                                    {
                                        id: 'output_schema',
                                        label: 'Output Schema Contract (Optional)',
                                        type: 'text',
                                        default: '',
                                        placeholder: 'conversational_with_patches, yomama_patch, json',
                                        show_if: { field: 'type', equals: 'llm' }
                                    },
                                    {
                                        id: 'prompt',
                                        label: 'Prompt Section (Markdown Body)',
                                        type: 'textarea',
                                        rows: 4,
                                        default: '',
                                        placeholder: 'Prompt instructions for this node (supports {{ var | default }})...',
                                        show_if: { field: 'type', equals: 'llm' }
                                    }
                                ]
                            }}
                            .items=${nodes}
                            @insetu-repeater-changed=${(e) => this._patchForm({ nodes: e.detail.value })}>
                        </insetu-schema-repeater>

                        <div class="studio-section">
                            <div class="studio-section-header">
                                <h4 class="studio-section-title">
                                    <yv-icon name="package" style="width: 15px; height: 15px; color: var(--intent-primary);"></yv-icon>
                                    <span>4. Static Context Includes & Visibility Prerequisites (Batch Parity)</span>
                                </h4>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                    <sutram-btn size="sm" intent="primary" icon="package" label="Select Contexts" @click=${() => {
                                        this._contextPickerTarget = 'includes';
                                        this._tempSelectedUris = [...(f.includes || [])];
                                        this._showContextPicker = true;
                                    }}></sutram-btn>
                                    <sutram-btn size="sm" intent="neutral" icon="eye" label="Show If Exists" @click=${() => {
                                        this._contextPickerTarget = 'showIfExists';
                                        this._tempSelectedUris = [...(f.showIfExists || [])];
                                        this._showContextPicker = true;
                                    }}></sutram-btn>
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 6px;">
                                ${(f.includes || []).length === 0 ? html`<span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No static context files mapped.</span>` : (f.includes || []).map((rawUri, uIdx) => {
                                    const { healedUri, isUndefined, isCleanDiff, candidate } = classifyRoutineTargetUri(rawUri);
                                    return html`
                                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 8px; background: var(--bg); border: 1px solid var(--border); border-radius: 4px;">
                                            <span style="font-family: var(--font-mono); font-size: 0.8rem; color: ${isUndefined ? 'var(--intent-danger)' : 'var(--text)'}; text-decoration: ${isUndefined ? 'line-through' : 'none'};">${healedUri}</span>
                                            <div style="display: flex; align-items: center; gap: 6px;">
                                                ${isUndefined ? html`<sutram-tag text="Undefined" intent="danger"></sutram-tag>` : ''}
                                                ${isCleanDiff ? html`<sutram-tag text="Clean" intent="neutral"></sutram-tag>` : ''}
                                                ${candidate ? html`
                                                    <sutram-btn size="sm" intent="success" icon="sparkles" label="Fix → ${candidate}" @click=${() => {
                                                        const nextInc = [...(f.includes || [])];
                                                        nextInc[uIdx] = candidate;
                                                        this._patchForm({ includes: nextInc });
                                                    }}></sutram-btn>
                                                ` : ''}
                                            </div>
                                        </div>
                                    `;
                                })}
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                                <sutram-input ?flush=${true} label="Response Save Path (Optional)" .value=${f.responsePath || ''} placeholder="e.g. vfs://repo/sotu/sotu_{date}.md" @sutram-input-changed=${e => this._patchForm({ responsePath: e.detail.value })}></sutram-input>
                                <sutram-input ?flush=${true} label="Archive Prior Dated Files To (Optional)" .value=${f.archivePath || ''} placeholder="e.g. vfs://repo/sotu/archive/" @sutram-input-changed=${e => this._patchForm({ archivePath: e.detail.value })}></sutram-input>
                            </div>
                        </div>
                    </div>
                `}
            </sutram-scroll-view>

            <div style="padding: 12px 16px; border-top: 1px solid var(--border); background: var(--input-bg); display: flex; gap: 10px; flex-shrink: 0; align-items: center;">
                ${f.id && f.source && f.source !== 'builtin' ? html`
                    <sutram-async-btn intent="danger" icon="trash-2" label="Delete Override" style="flex: 1; margin: 0;" .onClick=${() => this._deleteRoutine()}></sutram-async-btn>
                ` : ''}
                <sutram-async-btn intent="primary" icon="save" label="Save Routine (.md)" style="flex: 2; margin: 0;" .onClick=${() => this._saveRoutine()}></sutram-async-btn>
            </div>

            ${this._showContextPicker ? html`
                <sutram-modal ?open=${true} titleText="Select Context & Prompt URIs" @sutram-modal-closed=${() => { this._showContextPicker = false; }}>
                    <div slot="body" style="display: contents;">
                        <sutram-input placeholder="Search contexts, diffs, or prompts..." .value=${this._pickerSearch} @sutram-input-changed=${e => { this._pickerSearch = e.detail.value; }}></sutram-input>
                        <div style="display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto;">
                            ${this.filterItems(allSelectableFiles, { pinnedRepos: new Set(['ALL']), searchQuery: this._pickerSearch, searchFields: x => String(x) }).map(uri => {
                                const checked = this._tempSelectedUris.includes(uri);
                                return html`
                                    <sutram-toggle
                                        ?flush=${true}
                                        .label=${uri}
                                        .checked=${checked}
                                        @sutram-input-changed=${e => {
                                            const set = new Set(this._tempSelectedUris);
                                            e.detail.value ? set.add(uri) : set.delete(uri);
                                            this._tempSelectedUris = Array.from(set);
                                        }}>
                                    </sutram-toggle>
                                `;
                            })}
                        </div>
                    </div>
                    <sutram-btn slot="footer" intent="primary" icon="check" label="Apply Selection" @click=${() => {
                        this._patchForm({ [this._contextPickerTarget]: [...this._tempSelectedUris] });
                        this._showContextPicker = false;
                    }}></sutram-btn>
                </sutram-modal>
            ` : ''}
        `;
    }
}
customElements.define('insetu-agent-routine-projection', InSetuAgentRoutineProjection);

export class InSetuCoreAgentRoutines extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        routines: { type: Array },
        searchQuery: { type: String },
        _applyVisibilityFilter: { type: Boolean }
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
        this.searchQuery = '';
        this._applyVisibilityFilter = true;
    }

    connectedCallback() {
        super.connectedCallback();
        this.bindStore(
            AgentStore,
            state => ({ routines: state.routines || [] }),
            { autoFetch: 'fetchSessions' }
        );
        this.registerGlobalListener('insetu:agent:edit-routine', window, (e) => {
            AgentStore.getState().openRoutineStudio(e.detail?.routine || null, !!e.detail?.fork);
        });
        this.registerGlobalListener('insetu:agent:delete-routine', window, async (e) => {
            const r = e.detail?.routine;
            if (!r || !confirm(`Delete routine override '${r.title || r.name || r.id}'?`)) return;
            const res = await this.api.post('agent/routines/delete', { id: r.id, filepath: r.filepath });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.routines)) AgentStore.setState({ routines: data.routines });
                else await AgentStore.getState().fetchSessions();
            }
        });
    }

    render() {
        const appState = window.inSetu?.stores?.App?.getState ? window.inSetu.stores.App.getState() : {};
        const manifestCtx = appState.manifest?.ctx || {};
        const availPrompts = AgentStore.getState().availableOptions?.prompts || [];

        const visibleRoutines = (this.routines || []).filter(r => {
            if (!this._applyVisibilityFilter) return true;
            const checkExists = (uri) => Boolean(manifestCtx[uri] || availPrompts.includes(uri));
            const reqExists = Array.isArray(r.show_if_exists) ? r.show_if_exists : [];
            if (reqExists.length > 0 && !reqExists.some(checkExists)) return false;
            const reqMissing = Array.isArray(r.show_if_missing) ? r.show_if_missing : [];
            if (reqMissing.length > 0 && !reqMissing.every(u => !checkExists(u))) return false;
            return true;
        });

        const filtered = this.filterItems(visibleRoutines, {
            pinnedRepos: new Set(['ALL']),
            searchQuery: this.searchQuery,
            searchFields: r => `${r.title || r.name || ''} ${r.id || ''} ${r.domain || ''} ${r.slash_command || ''} ${r.description || ''}`
        });

        const grouped = {};
        filtered.forEach(r => {
            const dom = r.domain || 'Routines';
            if (!grouped[dom]) grouped[dom] = [];
            grouped[dom].push(r);
        });

        return html`
            <sutram-toolbar
                searchPlaceholder="Fuzzy search routines & workflows..."
                .searchQuery=${this.searchQuery}
                @search-changed=${e => { this.searchQuery = e.detail.value; }}
                .enableFilterDropdown=${true}>
                <div slot="filters" style="padding: 10px 15px;">
                    <sutram-toggle
                        ?flush=${true}
                        label="Apply Visibility Prerequisites"
                        .checked=${this._applyVisibilityFilter}
                        @sutram-input-changed=${e => { this._applyVisibilityFilter = e.detail.value; this.requestUpdate(); }}>
                    </sutram-toggle>
                </div>
            </sutram-toolbar>
            <sutram-scroll-view padding="16px" style="gap: 12px;">
                ${Object.keys(grouped).sort().map(domainName => html`
                    <sutram-collapsible titleText=${domainName} intent="warning" ?open=${true}>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            ${grouped[domainName].map(r => {
                                const srcBadge = r.source === 'workspace' ? 'Workspace Override' : (r.source === 'user_template' ? 'User Template' : (r.is_shared ? `Shared (${r.source_workspace})` : 'Built-In'));
                                const incCount = Array.isArray(r.includes) ? r.includes.length : 0;
                                const detailSuffix = incCount > 0 ? ` | ${incCount} context(s)` : '';
                                return html`
                                    <sutram-card
                                        .filename=${r.filepath || `ctx://routines/${r.id}.md`}
                                        .titleText=${r.title || r.name || r.id}
                                        .descriptionText=${r.description}
                                        .detailPrefix=${`[${srcBadge}] `}
                                        .detailText=${r.slash_command || `/${r.id}`}
                                        .detailSuffix=${detailSuffix}
                                        icon="workflow"
                                        intent=${r.source === 'workspace' ? 'highlight' : 'warning'}
                                        .entityType=${'agent_routine'}
                                        .entityData=${{
                                            ...r,
                                            filepath: r.filepath || `ctx://routines/${r.id}.md`,
                                            isFS: r.source === 'workspace' || r.source === 'user_template'
                                        }}
                                        ?disableSelection=${true}
                                        @card-clicked=${() => {
                                            AgentStore.getState().selectRoutine({
                                                routineId: r.id,
                                                mode: r.default_mode || r.id,
                                                slashCommand: r.slash_command || `/${r.id}`
                                            });
                                            this.dispatch('insetu:yomama:navigate', { surface: 'chat' });
                                        }}>
                                    </sutram-card>
                                `;
                            })}
                        </div>
                    </sutram-collapsible>
                `)}
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
                    intent="success"
                    icon="plus"
                    label="New Routine"
                    style="flex: 1; margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
                    @click=${() => AgentStore.getState().openRoutineStudio(null, false)}>
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
        llmProfiles: { type: Array },
        activeProfileId: { type: String },
        activeSessionId: { type: String },
        messages: { type: Array },
        loading: { type: Boolean },
        attachedFiles: { type: Array },
        readOnlyFiles: { type: Array },
        agentRoutineId: { type: String },
        agentMode: { type: String },
        promptInput: { type: String },
        activeJobMessage: { type: String },
        pendingHandoff: { type: Object },
        _handoffPasteText: { type: String }
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
        this.llmProfiles = [];
        this.activeProfileId = 'default';
        this.activeSessionId = null;
        this.messages = [];
        this.loading = false;
        this.attachedFiles = [];
        this.readOnlyFiles = [];
        this.agentRoutineId = 'workspace_turn';
        this.agentMode = 'auto';
        this.promptInput = '';
        this.activeJobMessage = '';
        this.pendingHandoff = null;
        this._handoffPasteText = '';
        this._handoffBranchIdx = 0;
        this._handoffBranchResponses = {};
        this._lastTurnCommittedFiles = [];
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
                attachedFiles: state.attachedFiles || [],
                readOnlyFiles: state.readOnlyFiles || [],
                agentRoutineId: state.agentRoutineId || 'workspace_turn',
                agentMode: state.agentMode || 'auto',
                promptInput: state.promptInput || '',
                pendingHandoff: state.pendingHandoff || null,
                _handoffBranchIdx: state.handoffBranchIdx || 0,
                _handoffBranchResponses: state.handoffBranchResponses || {},
                _handoffPasteText: state.handoffPasteText || '',
                _lastTurnCommittedFiles: state.lastTurnCommittedFiles || []
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
                AgentStore.getState().selectRoutine(e.detail);
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
            this.requestUpdate();
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
                        this.requestUpdate();
                    },
                    onComplete: async (sData) => {
                        this.activeJobMessage = '';
                        const art = sData?.artifact || sData;
                        if (art?.status === 'paused_for_user' && art.pending_handoff) {
                            AgentStore.setState({ pendingHandoff: art, handoffBranchIdx: 0, handoffBranchResponses: {}, handoffPasteText: '' });
                        } else {
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

        const isCustomRoutine = this.agentRoutineId && this.agentRoutineId !== 'workspace_turn';
        if (!rawInput && !isCustomRoutine) return;
        const activeR = (this.routines || []).find(r => r.id === this.agentRoutineId);
        const userText = rawInput || (activeR?.slash_command || `/${this.agentRoutineId}`);

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
            messages: [...(s.messages || []), { role: 'user', content: userText, timestamp: Date.now() / 1000 }]
        }));
        this.activeJobMessage = "Submitting prompt...";
        this.requestUpdate();
        const runTurn = this.api.bindJobAction(
            'agent/prompt',
            {
                session_id: sesId,
                prompt: userText,
                mode: this.agentMode,
                profile_id: this.activeProfileId,
                routine_id: this.agentRoutineId,
                attached_files: this.attachedFiles,
                read_only_files: this.readOnlyFiles
            },
            {
                onProgress: (msg) => {
                    this.activeJobMessage = msg;
                    this.requestUpdate();
                },
                onComplete: async (statusData) => {
                    this.activeJobMessage = '';
                    const art = statusData?.artifact || statusData;
                    if (art?.status === 'paused_for_user' && art.pending_handoff) {
                        AgentStore.setState({
                            pendingHandoff: art,
                            handoffBranchIdx: 0,
                            handoffBranchResponses: {},
                            handoffPasteText: ''
                        });
                        return;
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
                    ${this._lastTurnCommittedFiles && this._lastTurnCommittedFiles.length > 0 ? html`
                        <div style="display: flex; flex-direction: column; gap: 6px; max-width: 88%;">
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
                        </div>
                    ` : ''}
                    ${this.pendingHandoff && this.pendingHandoff.pending_handoff ? (() => {
                        const ph = this.pendingHandoff.pending_handoff;
                        const branches = Array.isArray(ph.branches) && ph.branches.length > 0 ? ph.branches : [ph];
                        const safeIdx = Math.min(this._handoffBranchIdx || 0, branches.length - 1);
                        const activeBranch = branches[safeIdx] || ph;
                        const routineObj = (this.routines || []).find(r => r.id === (this.pendingHandoff.routine_id || this.agentRoutineId));
                        const displayTitle = this.pendingHandoff.routine_title || activeBranch.routine_title || routineObj?.title || routineObj?.name || this.pendingHandoff.routine_id || 'Routine';
                        const wfCtxUri = activeBranch.workflow_context_uri || (routineObj?.includes?.length ? `ctx://workflows/workflow_${routineObj.id}_context.txt` : '');
                        const incFiles = Array.isArray(activeBranch.includes) && activeBranch.includes.length > 0
                            ? activeBranch.includes
                            : (routineObj?.includes || []);
                        const promptToCopy = activeBranch.prompt_text || activeBranch.compiled_prompt || '';
                        return html`
                            <div class="msg-bubble assistant" style="max-width: 96%; border: 2px solid var(--intent-warning); display: flex; flex-direction: column; gap: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-weight: bold; color: var(--intent-warning); display: inline-flex; align-items: center; gap: 6px; font-size: 0.95rem;">
                                        <yv-icon name="workflow" style="width: 16px; height: 16px;"></yv-icon>
                                        <span>${displayTitle}</span>
                                    </span>
                                    <sutram-btn size="sm" intent="neutral" icon="x" label="Dismiss" @click=${() => {
                                        AgentStore.setState({
                                            pendingHandoff: null,
                                            handoffBranchIdx: 0,
                                            handoffBranchResponses: {},
                                            handoffPasteText: ''
                                        });
                                    }}></sutram-btn>
                                </div>
                                ${branches.length > 1 ? html`
                                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                        ${branches.map((b, bIdx) => {
                                            const isDone = Boolean((this._handoffBranchResponses[b.node_id] || '').trim());
                                            return html`
                                                <sutram-btn
                                                    size="sm"
                                                    intent=${bIdx === safeIdx ? 'warning' : (isDone ? 'success' : 'neutral')}
                                                    ?active=${bIdx === safeIdx}
                                                    label="${isDone ? '●' : '○'} Step ${bIdx + 1}: ${b.node_id}"
                                                    @click=${() => { AgentStore.setState({ handoffBranchIdx: bIdx }); }}>
                                                </sutram-btn>
                                            `;
                                        })}
                                    </div>
                                ` : ''}
                                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                                    ${incFiles.length > 0 && wfCtxUri ? html`
                                        <sutram-async-btn
                                            size="sm"
                                            intent="highlight"
                                            icon="package"
                                            label="Copy Context (${incFiles.length} file${incFiles.length === 1 ? '' : 's'})"
                                            .onClick=${async () => {
                                                if (this.vfs?.fetchAndCopy) {
                                                    await this.vfs.fetchAndCopy(wfCtxUri);
                                                }
                                            }}>
                                        </sutram-async-btn>
                                        <sutram-async-btn
                                            size="sm"
                                            intent="neutral"
                                            icon="share-2"
                                            label="Share Context"
                                            .onClick=${async () => {
                                                if (this.vfs?.shareFiles) {
                                                    await this.vfs.shareFiles(wfCtxUri);
                                                }
                                            }}>
                                        </sutram-async-btn>
                                    ` : ''}
                                    <sutram-btn
                                        size="sm"
                                        intent="primary"
                                        icon="copy"
                                        label="Copy Prompt"
                                        @click=${() => this.utils.copyRawText(promptToCopy, () => this.setStatus("📋 Prompt copied!", 2000))}>
                                    </sutram-btn>
                                </div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">
                                    Copy the context and prompt above into your external chatbot, then paste the response into the chat input box below and press <b>Send</b>.
                                </div>
                            </div>
                        `;
                    })() : ''}
                    ${this.activeJobMessage ? html`
                        <div class="msg-bubble assistant" style="border: 1px dashed var(--intent-primary);">
                            <sutram-spinner .text=${this.activeJobMessage}></sutram-spinner>
                        </div>
                    ` : ''}
                </div>
                <!-- Gemini-Style Two-Tier Bottom Composer -->
                <div class="input-panel" style="padding: 12px 16px; gap: 10px;">
                    ${(() => {
                        const raw = this.promptInput || '';
                        const userMatch = raw.match(/^\/user:([a-zA-Z0-9_-]*)(?::([a-zA-Z0-9_:-]*))?(?:\s|$)/);
                        const directScopeMatch = !userMatch ? raw.match(/^\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_:-]*)(?:\s|$)/) : null;
                        const isUserMode = this.agentMode === 'user' || Boolean(userMatch) || Boolean(directScopeMatch);
                        if (!isUserMode) return '';

                        const queryToken = userMatch ? (userMatch[1] || '').trim() : (directScopeMatch ? directScopeMatch[1].trim() : '');
                        const scopeToken = userMatch ? (userMatch[2] ?? null) : (directScopeMatch ? (directScopeMatch[2] ?? '') : null);
                        const baseIds = new Set(['workspace_turn', 'code', 'plan', 'ask', 'yomama']);
                        const userRoutines = (this.routines || []).filter(r => r && r.id && !baseIds.has(r.id));
                        const matchedRoutine = userRoutines.find(r => r.id.toLowerCase() === queryToken.toLowerCase());
                        const routineScopes = Array.isArray(matchedRoutine?.scopes) ? matchedRoutine.scopes : [];
                        const isTypingScope = Boolean(matchedRoutine && scopeToken !== null && !raw.match(/^\/(?:user:)?[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_:-]+)?\s/));

                        if (isTypingScope && routineScopes.length > 0) {
                            const filteredScopes = scopeToken
                                ? routineScopes.filter(s => s.toLowerCase().includes(scopeToken.toLowerCase()))
                                : routineScopes;
                            return html`
                                <div style="display: flex; flex-direction: column; gap: 4px; max-height: 150px; overflow-y: auto; background: var(--bg); border: 1px solid color-mix(in srgb, var(--intent-warning) 50%, var(--border)); border-radius: 6px; padding: 6px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 6px; font-size: 0.72rem; font-family: var(--font-mono); color: var(--intent-warning); font-weight: bold;">
                                        <span>Select Scope for ${matchedRoutine.title || matchedRoutine.id}</span>
                                        <span style="cursor: pointer; color: var(--text-muted);" @click=${() => AgentStore.getState().setModePrefix('user', matchedRoutine.id)}>✕ Clear Scope</span>
                                    </div>
                                    ${filteredScopes.map(sc => html`
                                        <div
                                            class="yv-interactive-row"
                                            style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 8px; border-radius: 4px; cursor: pointer;"
                                            @click=${() => AgentStore.getState().setModePrefix('user', matchedRoutine.id, sc)}>
                                            <span style="font-family: var(--font-mono); font-size: 0.8rem; font-weight: bold; color: var(--intent-warning);">/user:${matchedRoutine.id}:${sc}</span>
                                        </div>
                                    `)}
                                </div>
                            `;
                        }

                        const isSettledSelection = Boolean(matchedRoutine && raw.match(/^\/(?:user:)?[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_:-]+)?\s/));
                        if (isSettledSelection) {
                            const incList = Array.isArray(matchedRoutine.includes) ? matchedRoutine.includes : [];
                            const activeScopeTag = scopeToken ? `/user:${matchedRoutine.id}:${scopeToken}` : `/user:${matchedRoutine.id}`;
                            return html`
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; background: color-mix(in srgb, var(--intent-warning) 14%, var(--bg)); border: 1px solid color-mix(in srgb, var(--intent-warning) 45%, var(--border)); border-radius: 6px; flex-wrap: wrap;">
                                    <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap;">
                                        <yv-icon name="workflow" style="width: 14px; height: 14px; color: var(--intent-warning); flex-shrink: 0;"></yv-icon>
                                        <span style="font-size: 0.8rem; font-weight: bold; color: var(--text);">${matchedRoutine.title || matchedRoutine.name || matchedRoutine.id}</span>
                                        <sutram-tag text=${activeScopeTag} intent="warning"></sutram-tag>
                                        ${routineScopes.length > 0 ? html`
                                            <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                                                ${routineScopes.map(sc => html`
                                                    <sutram-btn
                                                        size="sm"
                                                        intent=${scopeToken === sc ? 'warning' : 'neutral'}
                                                        label=":${sc}"
                                                        style="margin: 0; --btn-padding: 1px 6px; --btn-font-size: 0.7rem; font-family: var(--font-mono);"
                                                        @click=${() => AgentStore.getState().setModePrefix('user', matchedRoutine.id, sc)}>
                                                    </sutram-btn>
                                                `)}
                                            </div>
                                        ` : ''}
                                        ${incList.length > 0 ? html`
                                            <span style="font-size: 0.75rem; font-family: var(--font-mono); color: var(--text-muted);">
                                                (${incList.length} context include${incList.length === 1 ? '' : 's'} staged)
                                            </span>
                                        ` : ''}
                                    </div>
                                    <div style="display: flex; gap: 6px; align-items: center;">
                                        <sutram-btn
                                            size="sm"
                                            intent="warning"
                                            icon="list"
                                            label="Change Routine"
                                            style="margin: 0; --btn-padding: 2px 8px; --btn-font-size: 0.75rem;"
                                            @click=${() => AgentStore.getState().setModePrefix('user', null)}>
                                        </sutram-btn>
                                        <sutram-btn
                                            size="sm"
                                            intent="neutral"
                                            icon="x"
                                            label="/auto"
                                            style="margin: 0; --btn-padding: 2px 8px; --btn-font-size: 0.75rem;"
                                            @click=${() => AgentStore.getState().setModePrefix('auto')}>
                                        </sutram-btn>
                                    </div>
                                </div>
                            `;
                        }

                        const filteredRoutines = queryToken
                            ? this.utils.fuzzyFilterObjects(
                                userRoutines,
                                queryToken,
                                r => `${r.id} ${r.title || r.name || ''} ${r.domain || ''} ${r.description || ''}`
                            )
                            : userRoutines;

                        return html`
                            <div style="display: flex; flex-direction: column; gap: 4px; max-height: 165px; overflow-y: auto; background: var(--bg); border: 1px solid color-mix(in srgb, var(--intent-warning) 50%, var(--border)); border-radius: 6px; padding: 6px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 6px; font-size: 0.72rem; font-family: var(--font-mono); color: var(--intent-warning); font-weight: bold;">
                                    <span>Select Routine (${filteredRoutines.length} matching${queryToken ? ` "${queryToken}"` : ''})</span>
                                    <span style="cursor: pointer; color: var(--text-muted);" @click=${() => AgentStore.getState().setModePrefix('auto')}>✕ Reset to /auto</span>
                                </div>
                                ${filteredRoutines.length === 0 ? html`
                                    <div style="padding: 6px 8px; font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No routines match "/user:${queryToken}".</div>
                                ` : filteredRoutines.map(r => {
                                    const incCount = Array.isArray(r.includes) ? r.includes.length : 0;
                                    return html`
                                        <div
                                            class="yv-interactive-row"
                                            style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 8px; border-radius: 4px; cursor: pointer;"
                                            @click=${() => AgentStore.getState().setModePrefix('user', r.id)}>
                                            <div style="display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;">
                                                <yv-icon name="workflow" style="width: 14px; height: 14px; color: var(--intent-warning); flex-shrink: 0;"></yv-icon>
                                                <span style="font-family: var(--font-mono); font-size: 0.8rem; font-weight: bold; color: var(--intent-warning); flex-shrink: 0;">/user:${r.id}</span>
                                                <span style="font-size: 0.82rem; font-weight: bold; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.title || r.name || r.id}</span>
                                            </div>
                                            ${incCount > 0 ? html`
                                                <sutram-tag text="${incCount} ctx" intent="neutral"></sutram-tag>
                                            ` : ''}
                                        </div>
                                    `;
                                })}
                            </div>
                        `;
                    })()}
                    ${(this.attachedFiles.length > 0 || this.readOnlyFiles.length > 0) ? html`
                        <div class="attachment-pills">
                            ${this.attachedFiles.map(f => html`
                                <sutram-pill 
                                    labelText=${`✏️ ${new this.utils.InSetuURI(f).basename}`} 
                                    pillId=${f} 
                                    title="Editable Target (Click to switch to Read-Only, Shift+Click to remove)"
                                    ?active=${true}
                                    @sutram-pill-toggled=${(e) => {
                                        const nextAttached = this.attachedFiles.filter(x => x !== f);
                                        if (e.detail?.originalEvent?.shiftKey) {
                                            AgentStore.setState({ attachedFiles: nextAttached });
                                        } else {
                                            const nextRo = this.readOnlyFiles.includes(f) ? this.readOnlyFiles : [...this.readOnlyFiles, f];
                                            AgentStore.setState({ attachedFiles: nextAttached, readOnlyFiles: nextRo });
                                        }
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
                                        AgentStore.setState({ readOnlyFiles: this.readOnlyFiles.filter(x => x !== f) });
                                    }}>
                                </sutram-pill>
                            `)}
                        </div>
                    ` : ''}
                    <!-- Row 1: Full-Width Input Box -->
                    <sutram-textarea 
                        placeholder=${this.pendingHandoff?.pending_handoff
                            ? `Paste the external response for "${this.pendingHandoff.routine_title || this.pendingHandoff.routine_id}" here and press Send...`
                            : "Ask Yomama or paste patches (/code, /plan, /ask, /yomama, /user:<routine>, /undo)..."}
                        .value=${this.promptInput} 
                        ?flush=${true}
                        style="width: 100%; margin: 0;"
                        @keydown=${e => {
                            if (e.key === 'Tab') {
                                const raw = this.promptInput || '';
                                const baseIds = new Set(['workspace_turn', 'code', 'plan', 'ask', 'yomama']);
                                const userRoutines = (this.routines || []).filter(r => r && r.id && !baseIds.has(r.id));
                                const scopeMatch = raw.match(/^\/(?:user:)?([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]*)$/);
                                if (scopeMatch) {
                                    const rId = scopeMatch[1];
                                    const sQuery = (scopeMatch[2] || '').toLowerCase();
                                    const foundR = userRoutines.find(r => r.id.toLowerCase() === rId.toLowerCase());
                                    const scopes = Array.isArray(foundR?.scopes) ? foundR.scopes : [];
                                    const matchingScopes = sQuery ? scopes.filter(s => s.toLowerCase().startsWith(sQuery) || s.toLowerCase().includes(sQuery)) : scopes;
                                    if (foundR && matchingScopes.length > 0) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        AgentStore.getState().setModePrefix('user', foundR.id, matchingScopes[0]);
                                        return;
                                    }
                                }
                                const userMatch = raw.match(/^\/user:([a-zA-Z0-9_-]*)$/);
                                if (userMatch) {
                                    const qTok = (userMatch[1] || '').trim();
                                    const matches = qTok
                                        ? this.utils.fuzzyFilterObjects(
                                            userRoutines,
                                            qTok,
                                            r => `${r.id} ${r.title || r.name || ''} ${r.domain || ''} ${r.description || ''}`
                                        )
                                        : userRoutines;
                                    if (matches.length > 0) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        AgentStore.getState().setModePrefix('user', matches[0].id);
                                    }
                                }
                            }
                        }}
                        @sutram-input-changed=${e => {
                            const val = e.detail.value;
                            const patch = { promptInput: val };
                            const coreMatch = val.match(/^\/(auto|code|plan|ask|yomama)(?:\s|$)/);
                            const userMatch = val.match(/^\/user:([a-zA-Z0-9_-]*)/);
                            const directRoutineMatch = !coreMatch && !userMatch ? val.match(/^\/([a-zA-Z0-9_-]+)(?::[a-zA-Z0-9_:-]*)?(?:\s|$)/) : null;
                            if (coreMatch) {
                                const mId = coreMatch[1];
                                patch.agentMode = mId;
                                patch.agentRoutineId = mId === 'auto' ? 'workspace_turn' : mId;
                            } else if (userMatch) {
                                patch.agentMode = 'user';
                                const rCand = userMatch[1];
                                const matchedR = (this.routines || []).find(r => r.id.toLowerCase() === rCand.toLowerCase());
                                patch.agentRoutineId = matchedR ? matchedR.id : 'workspace_turn';
                            } else if (directRoutineMatch) {
                                const rCand = directRoutineMatch[1];
                                const matchedR = (this.routines || []).find(r => r.id.toLowerCase() === rCand.toLowerCase());
                                if (matchedR) {
                                    patch.agentMode = 'user';
                                    patch.agentRoutineId = matchedR.id;
                                }
                            } else if (!val.startsWith('/') && this.agentMode !== 'auto') {
                                patch.agentMode = 'auto';
                                patch.agentRoutineId = 'workspace_turn';
                            }
                            AgentStore.setState(patch);
                        }}>
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
                                    const baseModes = [
                                        { id: 'auto', label: '/auto (Smart Router)', icon: 'sparkles' },
                                        { id: 'code', label: '/code (Edit Code)', icon: 'code' },
                                        { id: 'plan', label: '/plan (Draft Plan)', icon: 'file-text' },
                                        { id: 'ask', label: '/ask (Read-Only Q&A)', icon: 'help-circle' },
                                        { id: 'yomama', label: '/yomama (Heal Patches)', icon: 'bridge' },
                                        { id: 'user', label: '/user (Custom & Extended Routines)', icon: 'workflow' }
                                    ];
                                    return baseModes.map(m => ({
                                        label: m.label,
                                        icon: this.agentMode === m.id ? 'check' : m.icon,
                                        onClick: () => AgentStore.getState().setModePrefix(m.id)
                                    }));
                                })()}>
                                <sutram-btn
                                    slot="trigger"
                                    intent=${this.agentMode === 'user' ? 'warning' : (this.agentMode && this.agentMode !== 'auto' ? 'highlight' : 'neutral')}
                                    icon="chevron-up"
                                    label=${`/${this.agentMode || 'auto'}`}
                                    title="Select Slash Mode"
                                    style="margin: 0; flex-shrink: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem; font-family: var(--font-mono);">
                                </sutram-btn>
                            </sutram-dropdown>
                            <sutram-dropdown
                                align="left"
                                direction="up"
                                .items=${(() => {
                                    const profs = (this.llmProfiles && this.llmProfiles.length > 0)
                                        ? this.llmProfiles
                                        : [{ id: 'default', title: 'Default Configuration' }];
                                    const items = profs.map(p => ({
                                        label: p.title || p.id,
                                        icon: this.activeProfileId === p.id ? 'check' : 'cpu',
                                        onClick: () => AgentStore.getState().selectProfile(p.id)
                                    }));
                                    items.push({ divider: true });
                                    items.push({
                                        label: 'Configure Compute Pool & Profiles...',
                                        icon: 'sliders',
                                        onClick: () => window.inSetu?.events?.emit('insetu:system:open-settings-view', { view: 'ext:llm' })
                                    });
                                    return items;
                                })()}>
                                <sutram-btn
                                    slot="trigger"
                                    intent="neutral"
                                    icon="cpu"
                                    label=${(() => {
                                        const found = (this.llmProfiles || []).find(p => p.id === this.activeProfileId);
                                        return found ? (found.title || found.id) : (this.activeProfileId || 'Default');
                                    })()}
                                    title="Switch Active LLM Configuration Profile"
                                    style="margin: 0; flex-shrink: 0; --btn-padding: 10px 12px; --btn-font-size: 0.82rem; font-family: var(--font-mono);">
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
                                                    AgentStore.setState({ attachedFiles: [...this.attachedFiles, filepath] });
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