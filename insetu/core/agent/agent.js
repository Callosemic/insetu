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
    constitutionFiles: [],
    referenceFiles: [],
    pinnedFiles: [],
    attachedFiles: [],
    readOnlyFiles: [],
    tokenLedger: { prompt_tokens: 0, completion_tokens: 0, saved_by_slicing: 0 },
    activePlan: null,
    activePlanPath: '',
    pendingCheckpoint: null,
    agentRoutineId: 'workspace_turn',
    agentMode: 'auto',
    agentScope: '',
    agentSettings: {
        rag_strategy: 'blast_radius',
        compaction_strategy: 'deterministic',
        run_tests_on_code: false,
        strict_test_enforcement: false
    },
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
            yomama: 'yomama',
            undo: 'workspace_turn'
        };
        if (modeId === 'auto') {
            AgentStore.setState({
                agentRoutineId: 'workspace_turn',
                agentMode: 'auto',
                agentScope: '',
                promptInput: stripped
            });
            return;
        }
        if (CORE_MODE_ROUTINES[modeId]) {
            AgentStore.setState({
                agentRoutineId: CORE_MODE_ROUTINES[modeId],
                agentMode: modeId,
                agentScope: '',
                promptInput: stripped
            });
            return;
        }
        if (modeId === 'user') {
            AgentStore.setState({
                agentRoutineId: explicitRoutineId || 'workspace_turn',
                agentMode: 'user',
                agentScope: explicitScope || '',
                promptInput: stripped
            });
        }
    },
    updateAgentSetting: async (key, value) => {
        const cur = AgentStore.getState().agentSettings || {};
        const next = { ...cur, [key]: value };
        AgentStore.setState({ agentSettings: next });
        try {
            await window.inSetu.api.workspace.post('agent/settings', { [key]: value });
        } catch (e) {
            console.warn("Failed to persist agent setting:", e);
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
                const wsList = data.working_set || [];
                const pinned = wsList.filter(x => x.tier === 'pinned').map(x => x.filepath).filter(Boolean);
                const ref = wsList.filter(x => x.tier === 'reference').map(x => x.filepath).filter(Boolean);
                AgentStore.setState({
                    messages: data.messages || [],
                    workingSetRaw: wsList,
                    pinnedFiles: pinned,
                    attachedFiles: pinned,
                    referenceFiles: ref,
                    readOnlyFiles: ref,
                    constitutionFiles: data.constitution_files || [],
                    tokenLedger: data.token_ledger || { prompt_tokens: 0, completion_tokens: 0, saved_by_slicing: 0 },
                    activePlanPath: data.active_plan_path || '',
                    pendingCheckpoint: data.checkpoint || null,
                    sessionSummary: data.summary || '',
                });
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
            const [sesRes, routRes, profRes, setRes] = await Promise.all([
                window.inSetu.api.get('agent/sessions'),
                window.inSetu.api.get('agent/routines'),
                window.inSetu.api.workspace.get('llm/profiles'),
                window.inSetu.api.workspace.get('agent/settings').catch(() => null)
            ]);
            const patch = {};
            if (sesRes && sesRes.ok) {
                const data = await sesRes.json();
                patch.sessions = data.sessions || [];
            }
            if (routRes && routRes.ok) {
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
            if (setRes && setRes.ok) {
                const sData = await setRes.json();
                if (sData && sData.settings) {
                    patch.agentSettings = {
                        rag_strategy: sData.settings.rag_strategy || 'blast_radius',
                        compaction_strategy: sData.settings.compaction_strategy || 'deterministic',
                        run_tests_on_code: Boolean(sData.settings.run_tests_on_code),
                        strict_test_enforcement: Boolean(sData.settings.strict_test_enforcement)
                    };
                }
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
        constitutionFiles: { type: Array },
        referenceFiles: { type: Array },
        pinnedFiles: { type: Array },
        attachedFiles: { type: Array },
        readOnlyFiles: { type: Array },
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
        _handoffPasteText: { type: String },
        _hudExpanded: { type: Boolean, state: true },
        _cmdMenuOpen: { type: Boolean, state: true },
        _cmdSearchQuery: { type: String, state: true },
        _settingsMenuOpen: { type: Boolean, state: true },
        _isWideStream: { type: Boolean, state: true }
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
            container-type: inline-size;
        }
        .chat-main {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            width: 100%;
            background: var(--bg);
            position: relative;
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
            transition: background 0.2s ease, border-color 0.2s ease;
        }
        .input-panel.handoff-mode {
            border-top: 2px solid var(--intent-warning);
            background: color-mix(in srgb, var(--intent-warning) 10%, var(--input-bg));
        }
        .attachment-pills {
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            align-items: center;
        }
        .hud-floating-trigger {
            position: absolute;
            top: 10px;
            right: 14px;
            z-index: 30;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-radius: 9999px;
            background: color-mix(in srgb, var(--pane-bg) 90%, transparent);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border: 1px solid var(--border);
            box-shadow: var(--overlay-shadow);
            font-family: var(--font-mono, monospace);
            font-size: 0.74rem;
            font-weight: 700;
            color: var(--text);
            cursor: pointer;
            user-select: none;
        }
        .hud-top-drawer {
            background: color-mix(in srgb, var(--pane-bg) 96%, transparent);
            border-bottom: 1px solid var(--border);
            padding: 10px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 25;
            flex-shrink: 0;
        }
        .composer-shell {
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 6px 10px;
            min-height: 40px;
            width: 100%;
            box-sizing: border-box;
        }
        .composer-shell.multiline {
            align-items: flex-start;
        }
        .composer-shell:focus-within {
            border-color: var(--intent-primary);
        }
        .composer-shell sutram-pill .yv-pill {
            display: inline-flex;
            align-items: center;
            height: 26px;
            padding: 0 8px;
            line-height: 1;
            font-family: var(--font-mono, monospace);
        }
        .composer-shell sutram-textarea .yv-form-wrapper {
            margin: 0 !important;
            display: flex;
            align-items: center;
        }
        .composer-shell sutram-textarea textarea.yv-textarea--borderless {
            min-height: 26px !important;
            line-height: 20px !important;
            padding: 3px 0 !important;
            margin: 0 !important;
            font-size: 0.92rem;
            box-sizing: border-box;
        }
        .upward-popover {
            position: absolute;
            bottom: calc(100% + 6px);
            left: 14px;
            right: 14px;
            max-width: 420px;
            max-height: 310px;
            overflow-y: auto;
            background: var(--pane-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            box-shadow: var(--overlay-shadow);
            padding: 8px;
            z-index: 200;
            display: flex;
            flex-direction: column;
            gap: 6px;
            box-sizing: border-box;
        }
        .checkpoint-card {
            background: color-mix(in srgb, var(--intent-warning) 12%, var(--input-bg));
            border: 1px solid var(--intent-warning);
            border-radius: 6px;
            padding: 10px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
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
        this.constitutionFiles = [];
        this.referenceFiles = [];
        this.pinnedFiles = [];
        this.attachedFiles = [];
        this.readOnlyFiles = [];
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
        this._handoffPasteText = '';
        this._handoffBranchIdx = 0;
        this._handoffBranchResponses = {};
        this._lastTurnCommittedFiles = [];
        this._hudExpanded = false;
        this._cmdMenuOpen = false;
        this._cmdSearchQuery = '';
        this._settingsMenuOpen = false;
        this._isWideStream = false;
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
                referenceFiles: state.referenceFiles || state.readOnlyFiles || [],
                pinnedFiles: state.pinnedFiles || state.attachedFiles || [],
                attachedFiles: state.pinnedFiles || state.attachedFiles || [],
                readOnlyFiles: state.referenceFiles || state.readOnlyFiles || [],
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
                _handoffPasteText: state.handoffPasteText || '',
                _lastTurnCommittedFiles: state.lastTurnCommittedFiles || []
            }),
            { autoFetch: 'fetchSessions' }
        );

        this.registerOutsideClick(() => {
            if (this._cmdMenuOpen || this._settingsMenuOpen) {
                this._cmdMenuOpen = false;
                this._settingsMenuOpen = false;
            }
        });

        if (typeof ResizeObserver !== 'undefined') {
            this._streamResizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const isWide = entry.contentRect.width >= 720;
                    if (this._isWideStream !== isWide) {
                        this._isWideStream = isWide;
                    }
                }
            });
            this._streamResizeObserver.observe(this);
        }

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

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._streamResizeObserver) {
            this._streamResizeObserver.disconnect();
            this._streamResizeObserver = null;
        }
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

    _selectCommandOption(opt, remainingPrompt = null) {
        if (!opt) return;
        if (opt.mode === 'undo' && remainingPrompt === null) {
            this._cmdMenuOpen = false;
            this._cmdSearchQuery = '';
            this._undoLastTurn();
            return;
        }
        const currentRaw = remainingPrompt !== null
            ? remainingPrompt
            : (this.promptInput || '').replace(/^\/[a-zA-Z0-9_:-]*\s*/, '');
        AgentStore.setState({
            agentMode: opt.mode,
            agentRoutineId: opt.routineId || 'workspace_turn',
            agentScope: opt.scope || '',
            promptInput: currentRaw
        });
        this._cmdMenuOpen = false;
        this._cmdSearchQuery = '';
    }

    _tryAbsorbLeadingSlashCommand(val) {
        if (!val || !val.startsWith('/')) {
            if (this._cmdMenuOpen && !this._cmdSearchQuery) {
                this._cmdMenuOpen = false;
            }
            AgentStore.setState({ promptInput: val });
            return;
        }
        // Check if user completed a slash token with a trailing space (e.g. "/code " or "/upkeep:docs ")
        const completedMatch = val.match(/^\/([a-zA-Z0-9_:-]+)\s+([\s\S]*)$/);
        if (completedMatch) {
            const token = completedMatch[1].toLowerCase();
            const rest = completedMatch[2] || '';
            const allOpts = this._getAllCommandOptions();
            const exact = allOpts.find(o =>
                o.slash.slice(1).toLowerCase() === token ||
                (o.altSlash && o.altSlash.slice(1).toLowerCase() === token)
            );
            if (exact) {
                if (exact.mode === 'undo' && !rest.trim()) {
                    AgentStore.setState({ promptInput: '' });
                    this._cmdMenuOpen = false;
                    this._undoLastTurn();
                    return;
                }
                this._selectCommandOption(exact, rest);
                return;
            }
        }
        // While typing "/something" without a space yet, open the searchable command menu and filter live
        const partialMatch = val.match(/^\/([a-zA-Z0-9_:-]*)$/);
        if (partialMatch) {
            this._cmdSearchQuery = partialMatch[1];
            this._cmdMenuOpen = true;
            this._settingsMenuOpen = false;
        }
        AgentStore.setState({ promptInput: val });
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
                            if (art?.unapplied_patches && window.inSetu?.stores?.Bridge?.getState()?.parseAndAppendCells) {
                                window.inSetu.stores.Bridge.getState().parseAndAppendCells(art.unapplied_patches);
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
            messages: [...(s.messages || []), { role: 'user', content: displayUserBubble, timestamp: Date.now() / 1000 }]
        }));
        this.activeJobMessage = "Submitting prompt...";
        this.requestUpdate();
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
                    if (art?.status === 'paused_for_budget') {
                        AgentStore.setState({
                            pendingCheckpoint: art.checkpoint || art,
                        });
                        return;
                    }
                    if (art?.unapplied_patches && window.inSetu?.stores?.Bridge?.getState()?.parseAndAppendCells) {
                        window.inSetu.stores.Bridge.getState().parseAndAppendCells(art.unapplied_patches);
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

    _estimateWorkingSetTokens() {
        const charPerTok = 4;
        let cTokens = (this.constitutionFiles || []).length * 450;
        let rTokens = (this.referenceFiles || []).length * 200; // AST Sliced
        let pTokens = (this.pinnedFiles || []).length * 1500; // Full Source
        let promptTokens = Math.round((this.promptInput || '').length / charPerTok);
        return {
            constitution: cTokens,
            references: rTokens,
            pinned: pTokens,
            prompt: promptTokens,
            total: cTokens + rTokens + pTokens + promptTokens
        };
    }

    render() {
        const tokenEst = this._estimateWorkingSetTokens();
        const softCeiling = 12000;
        const ceilingRatio = tokenEst.total / softCeiling;
        const tokenIntent = ceilingRatio > 1.0 ? 'danger' : (ceilingRatio > 0.75 ? 'warning' : 'success');

        const totalContextFiles = (this.constitutionFiles?.length || 0) + (this.referenceFiles?.length || 0) + (this.pinnedFiles?.length || 0);
        const compactTokStr = tokenEst.total >= 1000 ? `${(tokenEst.total / 1000).toFixed(1)}k` : `${tokenEst.total}`;

        return html`
            <div class="chat-main">
                <!-- Top-Right Collapsible Context Budget HUD -->
                ${!this._hudExpanded ? html`
                    <div
                        class="hud-floating-trigger"
                        title="Context Budget: ~${tokenEst.total.toLocaleString()} / ${softCeiling.toLocaleString()} tok (${totalContextFiles} files in working set). Click to expand."
                        style="border-color: var(--intent-${tokenIntent});"
                        @click=${(e) => { e.stopPropagation(); this._hudExpanded = true; }}>
                        <yv-icon name="database" style="width: 13px; height: 13px; color: var(--intent-${tokenIntent});"></yv-icon>
                        <span>~${compactTokStr}</span>
                        ${totalContextFiles > 0 ? html`<sutram-tag text="${totalContextFiles}" intent=${tokenIntent}></sutram-tag>` : ''}
                    </div>
                ` : html`
                    <div class="hud-top-drawer">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; font-family: var(--font-mono); font-size: 0.74rem;">
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <yv-icon name="database" style="width: 14px; height: 14px; color: var(--intent-${tokenIntent});"></yv-icon>
                                <span style="font-weight: bold; color: var(--text);">Context Budget: ~${tokenEst.total.toLocaleString()} / ${softCeiling.toLocaleString()} tok</span>
                                <sutram-tag text=${tokenIntent === 'danger' ? 'Over Soft Budget' : (tokenIntent === 'warning' ? 'Near Ceiling' : 'Optimal')} intent=${tokenIntent}></sutram-tag>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="color: var(--text-muted);">
                                    Session: ${(this.tokenLedger?.prompt_tokens || 0).toLocaleString()} in / ${(this.tokenLedger?.completion_tokens || 0).toLocaleString()} out / <strong style="color: var(--intent-success);">~${(this.tokenLedger?.saved_by_slicing || 0).toLocaleString()} saved</strong>
                                </span>
                                <sutram-btn
                                    size="sm"
                                    intent="neutral"
                                    icon="chevron-up"
                                    title="Collapse Context HUD"
                                    style="margin: 0; --btn-padding: 2px 6px;"
                                    @click=${() => { this._hudExpanded = false; }}>
                                </sutram-btn>
                            </div>
                        </div>
                        <div style="font-size: 0.7rem; font-family: var(--font-mono); color: var(--text-muted);">
                            Breakdown: Constitution ${tokenEst.constitution} tok · Reference Slices ${tokenEst.references} tok · Pinned Targets ${tokenEst.pinned} tok · Prompt ${tokenEst.prompt} tok
                        </div>
                        ${totalContextFiles > 0 ? html`
                            <div class="attachment-pills">
                                ${(this.constitutionFiles || []).map(f => html`
                                    <sutram-pill
                                        labelText=${`📜 ${new this.utils.InSetuURI(f).basename} [Auto]`}
                                        pillId=${f}
                                        title="Tier 0 Constitution File (Auto-Pinned Architectural Standards)"
                                        ?active=${true}>
                                    </sutram-pill>
                                `)}
                                ${(this.referenceFiles || []).map(f => html`
                                    <sutram-pill
                                        labelText=${`🔒 ${new this.utils.InSetuURI(f).basename} [Slice]`}
                                        pillId=${f}
                                        title="Tier 1 Reference Interface (Click to promote to Full Source, Shift+Click to dismiss)"
                                        ?active=${false}
                                        @sutram-pill-toggled=${(e) => {
                                            if (e.detail?.originalEvent?.shiftKey) {
                                                AgentStore.setState({
                                                    referenceFiles: this.referenceFiles.filter(x => x !== f),
                                                    readOnlyFiles: this.referenceFiles.filter(x => x !== f)
                                                });
                                            } else {
                                                AgentStore.setState({
                                                    referenceFiles: this.referenceFiles.filter(x => x !== f),
                                                    readOnlyFiles: this.referenceFiles.filter(x => x !== f),
                                                    pinnedFiles: [...this.pinnedFiles, f],
                                                    attachedFiles: [...this.pinnedFiles, f]
                                                });
                                            }
                                        }}>
                                    </sutram-pill>
                                `)}
                                ${(this.pinnedFiles || []).map(f => html`
                                    <sutram-pill
                                        labelText=${`✏️ ${new this.utils.InSetuURI(f).basename} [Full]`}
                                        pillId=${f}
                                        title="Tier 2 Pinned Edit Target (Click to demote to AST Slice, Shift+Click to dismiss)"
                                        ?active=${true}
                                        @sutram-pill-toggled=${(e) => {
                                            if (e.detail?.originalEvent?.shiftKey) {
                                                AgentStore.setState({
                                                    pinnedFiles: this.pinnedFiles.filter(x => x !== f),
                                                    attachedFiles: this.pinnedFiles.filter(x => x !== f)
                                                });
                                            } else {
                                                AgentStore.setState({
                                                    pinnedFiles: this.pinnedFiles.filter(x => x !== f),
                                                    attachedFiles: this.pinnedFiles.filter(x => x !== f),
                                                    referenceFiles: [...this.referenceFiles, f],
                                                    readOnlyFiles: [...this.referenceFiles, f]
                                                });
                                            }
                                        }}>
                                    </sutram-pill>
                                `)}
                            </div>
                        ` : html`<span style="font-size: 0.72rem; color: var(--text-muted); font-style: italic;">Working set empty. Use [+] below to attach files or run a turn to auto-populate.</span>`}
                    </div>
                `}

                <div class="messages-scroll">
                    ${this.activePlanPath ? html`
                        <div style="background: color-mix(in srgb, var(--intent-highlight) 10%, var(--bg)); border: 1px solid var(--intent-highlight); border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: bold; color: var(--intent-highlight);">
                                <yv-icon name="list-checks" style="width: 15px; height: 15px;"></yv-icon>
                                <span>Active Plan: ${new this.utils.InSetuURI(this.activePlanPath).basename}</span>
                            </div>
                            <sutram-btn
                                size="sm"
                                intent="highlight"
                                icon="external-link"
                                label="Open Plan"
                                style="margin: 0; --btn-padding: 2px 8px; --btn-font-size: 0.75rem;"
                                @click=${() => {
                                    if (this.vfs?.viewSourceFile) this.vfs.viewSourceFile(this.activePlanPath, true);
                                }}>
                            </sutram-btn>
                        </div>
                    ` : ''}
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
                    ${this.pendingCheckpoint ? html`
                        <div class="checkpoint-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px; font-weight: bold; font-size: 0.85rem; color: var(--intent-warning);">
                                    <yv-icon name="alert-circle" style="width: 16px; height: 16px;"></yv-icon>
                                    <span>P1 Execution Budget Checkpoint Reached</span>
                                </div>
                                <sutram-tag text="Wavefront ${this.pendingCheckpoint.wavefront_index ?? 0}" intent="warning"></sutram-tag>
                            </div>
                            <span style="font-size: 0.8rem; color: var(--text-muted);">Turn paused at step budget limit to prevent unbounded execution. Resume to continue the next wavefront:</span>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <sutram-btn
                                    size="sm"
                                    intent="warning"
                                    icon="play"
                                    label="Resume Turn"
                                    style="margin: 0;"
                                    @click=${() => {
                                        AgentStore.setState({ promptInput: 'Resume from budget checkpoint' });
                                        this._sendPrompt();
                                    }}>
                                </sutram-btn>
                                <sutram-btn
                                    size="sm"
                                    intent="neutral"
                                    icon="x"
                                    label="Dismiss"
                                    style="margin: 0;"
                                    @click=${() => AgentStore.setState({ pendingCheckpoint: null })}>
                                </sutram-btn>
                            </div>
                        </div>
                    ` : ''}
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
                    ${this.activeJobMessage ? html`
                        <div class="msg-bubble assistant" style="border: 1px dashed var(--intent-primary);">
                            <sutram-spinner .text=${this.activeJobMessage}></sutram-spinner>
                        </div>
                    ` : ''}
                </div>
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
                        <div class="input-panel handoff-mode" style="padding: 12px 16px; gap: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <yv-icon name="zap" style="width: 15px; height: 15px; color: var(--intent-warning);"></yv-icon>
                                    <span style="font-family: var(--font-mono); font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--intent-warning);">
                                        External LLM Handoff • ${displayTitle} (${activeBranch.node_id})
                                    </span>
                                    ${activeBranch.tier ? html`<sutram-tag text=${activeBranch.tier} intent="warning"></sutram-tag>` : ''}
                                </div>
                                <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                                    ${incFiles.length > 0 && wfCtxUri ? html`
                                        <sutram-async-btn
                                            size="sm"
                                            intent="highlight"
                                            icon="package"
                                            label="Copy Context (${incFiles.length})"
                                            style="margin: 0;"
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
                                            label="Share"
                                            style="margin: 0;"
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
                                        label="Copy Prompt + Directives"
                                        style="margin: 0;"
                                        @click=${() => this.utils.copyRawText(promptToCopy, () => this.setStatus("📋 Prompt & directives copied!", 2000))}>
                                    </sutram-btn>
                                </div>
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
                            <sutram-textarea
                                placeholder=${`Paste the external LLM's response for "${activeBranch.node_id}" here (prose & Yomama patches will split automatically)...`}
                                .value=${this.promptInput}
                                ?flush=${true}
                                style="width: 100%; margin: 0; --bg-input: var(--bg);"
                                @sutram-input-changed=${e => AgentStore.setState({ promptInput: e.detail.value })}>
                            </sutram-textarea>
                            <div style="display: flex; align-items: stretch; justify-content: space-between; gap: 10px; width: 100%;">
                                <sutram-btn
                                    intent="neutral"
                                    icon="x"
                                    label="Cancel Handoff"
                                    style="margin: 0; --btn-padding: 10px 14px; --btn-font-size: 0.9rem;"
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
                                    style="flex: 1; margin: 0; --btn-padding: 10px 16px; --btn-font-size: 0.9rem;"
                                    .onClick=${() => this._sendPrompt()}>
                                </sutram-async-btn>
                            </div>
                        </div>
                    `;
                })() : html`
                <!-- Bottom Composer with Embedded /command Pill & 2-Column Responsive Action Bar -->
                <div class="input-panel" style="padding: 10px 14px; gap: 8px; position: relative;">
                    ${this._cmdMenuOpen ? (() => {
                        const allOpts = this._getAllCommandOptions();
                        const q = (this._cmdSearchQuery || '').trim().replace(/^\//, '').toLowerCase();
                        const filtered = q
                            ? this.utils.fuzzyFilterObjects(allOpts, q, o => `${o.slash} ${o.altSlash || ''} ${o.label}`)
                            : allOpts;
                        return html`
                            <div class="upward-popover" @click=${e => e.stopPropagation()}>
                                <sutram-input
                                    placeholder="Search commands & routines..."
                                    .value=${this._cmdSearchQuery}
                                    ?flush=${true}
                                    @sutram-input-changed=${e => { this._cmdSearchQuery = e.detail.value; }}
                                    @keydown=${e => {
                                        if (e.key === 'Enter' && filtered.length > 0) {
                                            e.preventDefault();
                                            this._selectCommandOption(filtered[0]);
                                        } else if (e.key === 'Escape') {
                                            this._cmdMenuOpen = false;
                                        }
                                    }}>
                                </sutram-input>
                                <div style="display: flex; flex-direction: column; gap: 2px; max-height: 210px; overflow-y: auto;">
                                    ${filtered.length === 0 ? html`
                                        <span style="padding: 6px 8px; font-size: 0.78rem; color: var(--text-muted); font-style: italic;">No matching commands.</span>
                                    ` : filtered.map(opt => html`
                                        <div
                                            class="yv-interactive-row"
                                            style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border-radius: 6px; cursor: pointer;"
                                            @click=${() => this._selectCommandOption(opt)}>
                                            <div style="display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1;">
                                                <yv-icon name=${opt.icon || 'terminal'} style="width: 14px; height: 14px; color: var(--intent-${opt.intent || 'primary'}); flex-shrink: 0;"></yv-icon>
                                                <span style="font-family: var(--font-mono); font-size: 0.8rem; font-weight: bold; color: var(--intent-${opt.intent || 'primary'}); min-width: 78px; flex-shrink: 0;">${opt.slash}</span>
                                                <span style="font-size: 0.82rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${opt.label}</span>
                                            </div>
                                            ${opt.ctxCount ? html`<sutram-tag text="${opt.ctxCount} ctx" intent="neutral"></sutram-tag>` : ''}
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `;
                    })() : ''}

                    ${this._settingsMenuOpen ? (() => {
                        const profs = (this.llmProfiles && this.llmProfiles.length > 0)
                            ? this.llmProfiles
                            : [{ id: 'default', title: 'Default Configuration' }];
                        const curSettings = this.agentSettings || {};
                        return html`
                            <div class="upward-popover" style="max-width: 360px; gap: 10px; padding: 12px;" @click=${e => e.stopPropagation()}>
                                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 6px;">
                                    <span style="font-family: var(--font-mono); font-size: 0.76rem; font-weight: bold; text-transform: uppercase; color: var(--intent-primary);">Agent Quick Settings</span>
                                    <sutram-btn size="sm" intent="neutral" icon="x" style="margin: 0; --btn-padding: 2px 6px;" @click=${() => { this._settingsMenuOpen = false; }}></sutram-btn>
                                </div>
                                <sutram-select
                                    label="Compute Profile"
                                    ?flush=${true}
                                    .value=${this.activeProfileId || 'default'}
                                    .options=${profs.map(p => ({ value: p.id, label: p.title || p.id }))}
                                    @sutram-input-changed=${e => AgentStore.getState().selectProfile(e.detail.value)}>
                                </sutram-select>
                                <sutram-select
                                    label="RAG Retrieval Strategy"
                                    ?flush=${true}
                                    .value=${curSettings.rag_strategy || 'blast_radius'}
                                    .options=${[
                                        { value: 'blast_radius', label: 'Blast Radius (0 tok AST + Affinity)' },
                                        { value: 'llm_scout', label: 'LLM Scout (Fast-Tier Discovery)' }
                                    ]}
                                    @sutram-input-changed=${e => AgentStore.getState().updateAgentSetting('rag_strategy', e.detail.value)}>
                                </sutram-select>
                                <sutram-select
                                    label="History Compaction"
                                    ?flush=${true}
                                    .value=${curSettings.compaction_strategy || 'deterministic'}
                                    .options=${[
                                        { value: 'deterministic', label: 'Deterministic Receipts (0 tok)' },
                                        { value: 'llm_compactor', label: 'Fast-Tier LLM Summarizer' }
                                    ]}
                                    @sutram-input-changed=${e => AgentStore.getState().updateAgentSetting('compaction_strategy', e.detail.value)}>
                                </sutram-select>
                                <sutram-toggle
                                    label="Run Test Gate After /code"
                                    ?flush=${true}
                                    .checked=${Boolean(curSettings.run_tests_on_code)}
                                    @sutram-input-changed=${e => AgentStore.getState().updateAgentSetting('run_tests_on_code', e.detail.value)}>
                                </sutram-toggle>
                                <div style="display: flex; gap: 6px; padding-top: 4px; border-top: 1px solid var(--border);">
                                    <sutram-btn
                                        size="sm"
                                        intent="neutral"
                                        icon="cpu"
                                        label="Compute Pool..."
                                        style="flex: 1; margin: 0;"
                                        @click=${() => {
                                            this._settingsMenuOpen = false;
                                            window.inSetu?.events?.emit('insetu:system:open-settings-view', { view: 'ext:llm' });
                                        }}>
                                    </sutram-btn>
                                    <sutram-btn
                                        size="sm"
                                        intent="neutral"
                                        icon="sliders"
                                        label="All Settings..."
                                        style="flex: 1; margin: 0;"
                                        @click=${() => {
                                            this._settingsMenuOpen = false;
                                            window.inSetu?.events?.emit('insetu:system:open-settings-view', { view: 'ext:agent' });
                                        }}>
                                    </sutram-btn>
                                </div>
                            </div>
                        `;
                    })() : ''}

                    <!-- Row 1: Unified Input Box with Leading /command Pill -->
                    <div class="composer-shell ${(this.promptInput || '').includes('\n') ? 'multiline' : ''}">
                        <sutram-pill
                            labelText=${`${this._getActiveCommandPillText()} ▾`}
                            pillId="active-command-pill"
                            title="Click to search & switch /command (or type / in the input)"
                            ?active=${this.agentMode !== 'auto'}
                            style="flex-shrink: 0; font-family: var(--font-mono); margin: 0;"
                            @click=${(e) => {
                                e.stopPropagation();
                                this._settingsMenuOpen = false;
                                this._cmdMenuOpen = !this._cmdMenuOpen;
                                if (this._cmdMenuOpen) this._cmdSearchQuery = '';
                            }}>
                        </sutram-pill>
                        <sutram-textarea
                            placeholder="Ask Yomama."
                            .value=${this.promptInput}
                            .autoSize=${Boolean((this.promptInput || '').includes('\n') || (this.promptInput || '').length > 60)}
                            ?flush=${true}
                            ?borderless=${true}
                            style="flex: 1; min-width: 0; margin: 0;"
                            @keydown=${e => {
                                if (e.key === 'Backspace' && !this.promptInput && this.agentMode !== 'auto') {
                                    e.preventDefault();
                                    AgentStore.getState().setModePrefix('auto');
                                    return;
                                }
                                if ((e.key === 'Tab' || e.key === 'Enter') && this._cmdMenuOpen && (this.promptInput || '').startsWith('/')) {
                                    const allOpts = this._getAllCommandOptions();
                                    const q = (this._cmdSearchQuery || '').trim().replace(/^\//, '').toLowerCase();
                                    const matches = q
                                        ? this.utils.fuzzyFilterObjects(allOpts, q, o => `${o.slash} ${o.altSlash || ''} ${o.label}`)
                                        : allOpts;
                                    if (matches.length > 0) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        this._selectCommandOption(matches[0], '');
                                    }
                                }
                            }}
                            @sutram-input-changed=${e => this._tryAbsorbLeadingSlashCommand(e.detail.value)}>
                        </sutram-textarea>
                    </div>

                    <!-- Row 2: Responsive Bottom Action Bar (Icon-only < 720px; Icon + Label >= 720px) -->
                    <div style="display: flex; align-items: stretch; justify-content: space-between; gap: 8px; width: 100%;">
                        <div style="display: flex; align-items: stretch; gap: 8px; min-width: 0;">
                            <sutram-btn
                                intent="primary"
                                icon="message-square"
                                .label=${this._isWideStream ? 'Conversations' : ''}
                                title="Toggle Yomama Conversations Drawer"
                                style="margin: 0; flex-shrink: 0; --btn-padding: 8px 12px;"
                                @click=${() => this.dispatch('insetu:yomama:toggle-drawer')}>
                            </sutram-btn>

                            <sutram-btn
                                intent=${this._settingsMenuOpen ? 'highlight' : 'neutral'}
                                icon="settings"
                                .label=${this._isWideStream ? 'Settings' : ''}
                                title="Agent & Compute Profile Settings"
                                style="margin: 0; flex-shrink: 0; --btn-padding: 8px 12px;"
                                @click=${(e) => {
                                    e.stopPropagation();
                                    this._cmdMenuOpen = false;
                                    this._settingsMenuOpen = !this._settingsMenuOpen;
                                }}>
                            </sutram-btn>

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
                                                                    pinnedFiles: [...this.pinnedFiles, filepath],
                                                                    attachedFiles: [...this.pinnedFiles, filepath]
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
                                                AgentStore.setState({ pinnedFiles: combined, attachedFiles: combined });
                                            }
                                        },
                                        {
                                            label: `✏️ Add Active Editor File (${activeEditorName})`,
                                            icon: "edit-3",
                                            disabled: !activeEditorFile,
                                            onClick: () => {
                                                if (activeEditorFile && !this.pinnedFiles.includes(activeEditorFile)) {
                                                    AgentStore.setState({
                                                        pinnedFiles: [...this.pinnedFiles, activeEditorFile],
                                                        attachedFiles: [...this.pinnedFiles, activeEditorFile]
                                                    });
                                                }
                                            }
                                        }
                                    ];
                                })()}>
                                <sutram-btn
                                    slot="trigger"
                                    icon="plus"
                                    .label=${this._isWideStream ? 'Add Context' : ''}
                                    intent="neutral"
                                    title="Add Working Set Context (+)"
                                    style="margin: 0; flex-shrink: 0; --btn-padding: 8px 12px;">
                                </sutram-btn>
                            </sutram-dropdown>
                        </div>

                        <div style="display: flex; align-items: stretch; gap: 8px; flex-shrink: 0;">
                            ${this.activeJobMessage ? html`
                                <sutram-async-btn
                                    icon="square"
                                    .label=${this._isWideStream ? 'Stop' : ''}
                                    intent="danger"
                                    title="Stop Active Turn"
                                    style="margin: 0; --btn-padding: 8px 12px;"
                                    .onClick=${() => this._cancelTurn()}>
                                </sutram-async-btn>
                            ` : ''}
                            <sutram-async-btn
                                .label=${this._isWideStream ? 'Send' : ''}
                                icon="send"
                                intent="primary"
                                title="Send Prompt"
                                style="margin: 0; flex-shrink: 0; --btn-padding: 8px 14px;"
                                .onClick=${() => this._sendPrompt()}>
                            </sutram-async-btn>
                        </div>
                    </div>
                </div>
                `}
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