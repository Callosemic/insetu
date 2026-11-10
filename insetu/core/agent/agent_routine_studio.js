/**
 * Declarative Routine Studio and Routine Catalog UI components extracted from agent.js (God-Objects Wave 3.3).
 */
import { html } from 'lit';
import { InSetuElement } from '/static/extensions/system/insetu_element.js';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';
import '/static/extensions/system/components/ui_schema_repeater.js';
import { AgentStore, classifyRoutineTargetUri } from '/static/extensions/agent/agent_store.js';

export function formatWavefrontBadge(wavefronts) {
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
    static styles = [sharedStyles];

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
            <sutram-view>
                <sutram-surface slot="header" variant="panel" border="bottom" padding="sm">
                    <sutram-action-bar collapse="sm" align="between">
                        <sutram-stack direction="row" align="center" gap="xs">
                            <sutram-btn
                                ?compact=${true}
                                icon="layers"
                                label="Visual Step Builder"
                                intent=${this._editorTab === 'visual' ? 'warning' : 'neutral'}
                                ?active=${this._editorTab === 'visual'}
                                @click=${() => { this._editorTab = 'visual'; }}>
                            </sutram-btn>
                            <sutram-btn
                                ?compact=${true}
                                icon="code"
                                label="Raw Markdown-as-Code (.md)"
                                intent=${this._editorTab === 'raw' ? 'warning' : 'neutral'}
                                ?active=${this._editorTab === 'raw'}
                                @click=${() => {
                                    this._rawMarkdown = this._buildMarkdownPreview();
                                    this._editorTab = 'raw';
                                }}>
                            </sutram-btn>
                        </sutram-stack>
                        <sutram-stack direction="row" align="center" gap="xs">
                            ${f.filepath ? html`
                                <sutram-btn
                                    ?compact=${true}
                                    intent="neutral"
                                    icon="external-link"
                                    label="Open in VFS Editor"
                                    @click=${() => {
                                        if (window.Sutram?.stores?.Layout) window.Sutram.stores.Layout.getState().closeWindow('agent:routine-studio');
                                        if (this.vfs?.viewSourceFile) this.vfs.viewSourceFile(f.filepath, true, true);
                                    }}>
                                </sutram-btn>
                            ` : ''}
                        </sutram-stack>
                    </sutram-action-bar>
                </sutram-surface>

                ${this._editorTab === 'raw' ? html`
                    <sutram-surface variant="panel" padding="md" gap="md">
                        <sutram-stack direction="row" align="center" gap="sm">
                            <sutram-icon name="file-code-2" size="md" intent="warning"></sutram-icon>
                            <h4>Markdown-as-Code Source (${f.filepath || `ctx://routines/${f.id || 'routine'}.md`})</h4>
                        </sutram-stack>
                        <sutram-textarea
                            ?flush=${true}
                            .monospace=${true}
                            size="full"
                            .value=${this._rawMarkdown}
                            @sutram-input-changed=${e => { this._rawMarkdown = e.detail.value; }}>
                        </sutram-textarea>
                    </sutram-surface>
                ` : html`
                    <sutram-stack direction="col" gap="lg">
                        <sutram-surface variant="panel" padding="md" gap="md">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                <sutram-stack direction="row" align="center" gap="sm">
                                    <sutram-icon name="sliders" size="md" intent="warning"></sutram-icon>
                                    <h4>1. Routine Identity & Override Tier</h4>
                                </sutram-stack>
                                <sutram-tag text=${f.scope === 'user' ? 'Global User Template (.templates/user/)' : 'Workspace Routine (ctx://routines/)'} intent="warning"></sutram-tag>
                            </sutram-stack>
                            <sutram-stack direction="grid" ?compact=${true}>
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
                            </sutram-stack>
                            <sutram-input ?flush=${true} label="Description" .value=${f.description || ''} placeholder="Brief summary of this DAG routine..." @sutram-input-changed=${e => this._patchForm({ description: e.detail.value })}></sutram-input>
                        </sutram-surface>

                        <sutram-surface variant="panel" padding="md" gap="md">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                <sutram-stack direction="row" align="center" gap="sm">
                                    <sutram-icon name="git-branch" size="md" intent="highlight"></sutram-icon>
                                    <h4>2. Routine Execution Steps (${nodes.length} Step${nodes.length === 1 ? '' : 's'})</h4>
                                </sutram-stack>
                                <sutram-btn ?compact=${true} intent="success" icon="plus" label="Add Step" @click=${() => {
                                    const lastStage = stages[stages.length - 1] || [];
                                    this._addNode(lastStage.map(n => n.id));
                                }}></sutram-btn>
                            </sutram-stack>
                            <sutram-dag-tree .stages=${stages}></sutram-dag-tree>
                            ${extractedVars.length > 0 ? html`
                                <sutram-surface variant="ghost" border="top" padding="xs">
                                    <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true}>
                                        <sutram-label text="Discovered Template Variables:"></sutram-label>
                                        ${extractedVars.map(v => html`<sutram-tag text=${v.default ? `{{ ${v.name} | ${v.default} }}` : `{{ ${v.name} }}`} intent="highlight"></sutram-tag>`)}
                                    </sutram-stack>
                                </sutram-surface>
                            ` : ''}
                        </sutram-surface>

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
                                    <sutram-btn ?compact=${true} intent="highlight" icon="git-branch" label="+ Sibling" @click=${(e) => { e.stopPropagation(); this._addNode(node.parents || []); }}></sutram-btn>
                                    <sutram-btn ?compact=${true} intent="primary" icon="arrow-down" label="+ Downstream" @click=${(e) => { e.stopPropagation(); this._addNode([node.id]); }}></sutram-btn>
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
                                        id: 'prompt_uri',
                                        label: 'External Prompt File URI (Optional)',
                                        type: 'text',
                                        default: '',
                                        placeholder: 'e.g. ctx://prompts/my_prompt.md',
                                        show_if: { field: 'type', equals: 'llm' }
                                    },
                                    {
                                        id: 'prompt',
                                        label: 'Prompt Section (Markdown Body)',
                                        type: 'textarea',
                                        rows: 4,
                                        default: '',
                                        placeholder: 'Prompt instructions for this node (supports {{ var | default }} and {{include_prompt:...}})...',
                                        show_if: { field: 'type', equals: 'llm' }
                                    }
                                ]
                            }}
                            .items=${nodes}
                            @insetu-repeater-changed=${(e) => this._patchForm({ nodes: e.detail.value })}>
                        </insetu-schema-repeater>

                        <sutram-surface variant="panel" padding="md" gap="md">
                            <sutram-stack direction="row" justify="between" align="center" gap="sm" ?wrap=${true}>
                                <sutram-stack direction="row" align="center" gap="sm">
                                    <sutram-icon name="package" size="md" intent="primary"></sutram-icon>
                                    <h4>4. Static Context Includes & Visibility Prerequisites (Batch Parity)</h4>
                                </sutram-stack>
                                <sutram-stack direction="row" gap="xs" ?wrap=${true}>
                                    <sutram-btn ?compact=${true} intent="primary" icon="package" label="Select Contexts" @click=${() => {
                                        this._contextPickerTarget = 'includes';
                                        this._tempSelectedUris = [...(f.includes || [])];
                                        this._showContextPicker = true;
                                    }}></sutram-btn>
                                    <sutram-btn ?compact=${true} intent="neutral" icon="eye" label="Show If Exists" @click=${() => {
                                        this._contextPickerTarget = 'showIfExists';
                                        this._tempSelectedUris = [...(f.showIfExists || [])];
                                        this._showContextPicker = true;
                                    }}></sutram-btn>
                                </sutram-stack>
                            </sutram-stack>
                            <sutram-stack direction="col" gap="xs">
                                ${(f.includes || []).length === 0 ? html`<sutram-label text="No static context files mapped."></sutram-label>` : (f.includes || []).map((rawUri, uIdx) => {
                                    const { healedUri, isUndefined, isCleanDiff, candidate } = classifyRoutineTargetUri(rawUri);
                                    return html`
                                        <sutram-surface variant="inset" padding="xs">
                                            <sutram-stack direction="row" justify="between" align="center" gap="sm">
                                                <sutram-label ?monospace=${true} intent=${isUndefined ? 'danger' : 'neutral'} ?invalid=${isUndefined} .text=${healedUri}></sutram-label>
                                                <sutram-stack direction="row" align="center" gap="xs">
                                                    ${isUndefined ? html`<sutram-tag text="Undefined" intent="danger"></sutram-tag>` : ''}
                                                    ${isCleanDiff ? html`<sutram-tag text="Clean" intent="neutral"></sutram-tag>` : ''}
                                                    ${candidate ? html`
                                                        <sutram-btn ?compact=${true} intent="success" icon="sparkles" label="Fix → ${candidate}" @click=${() => {
                                                            const nextInc = [...(f.includes || [])];
                                                            nextInc[uIdx] = candidate;
                                                            this._patchForm({ includes: nextInc });
                                                        }}></sutram-btn>
                                                    ` : ''}
                                                </sutram-stack>
                                            </sutram-stack>
                                        </sutram-surface>
                                    `;
                                })}
                            </sutram-stack>
                            <sutram-stack direction="grid" ?compact=${true}>
                                <sutram-input ?flush=${true} label="Response Save Path (Optional)" .value=${f.responsePath || ''} placeholder="e.g. vfs://repo/sotu/sotu_{date}.md" @sutram-input-changed=${e => this._patchForm({ responsePath: e.detail.value })}></sutram-input>
                                <sutram-input ?flush=${true} label="Archive Prior Dated Files To (Optional)" .value=${f.archivePath || ''} placeholder="e.g. vfs://repo/sotu/archive/" @sutram-input-changed=${e => this._patchForm({ archivePath: e.detail.value })}></sutram-input>
                            </sutram-stack>
                        </sutram-surface>
                    </sutram-stack>
                `}

                <sutram-surface slot="footer" variant="panel" border="top" padding="sm">
                    <sutram-stack direction="row" align="center" gap="sm">
                        ${f.id && f.source && f.source !== 'builtin' ? html`
                            <sutram-async-btn intent="danger" icon="trash-2" label="Delete Override" ?grow=${true} .onClick=${() => this._deleteRoutine()}></sutram-async-btn>
                        ` : ''}
                        <sutram-async-btn intent="primary" icon="save" label="Save Routine (.md)" ?grow=${true} .onClick=${() => this._saveRoutine()}></sutram-async-btn>
                    </sutram-stack>
                </sutram-surface>

            ${this._showContextPicker ? html`
                <sutram-modal ?open=${true} titleText="Select Context & Prompt URIs" @sutram-modal-closed=${() => { this._showContextPicker = false; }}>
                    <sutram-stack slot="body" direction="col" gap="sm">
                        <sutram-input placeholder="Search contexts, diffs, or prompts..." .value=${this._pickerSearch} @sutram-input-changed=${e => { this._pickerSearch = e.detail.value; }}></sutram-input>
                        <sutram-stack direction="col" gap="xs" ?scrollable=${true}>
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
                        </sutram-stack>
                    </sutram-stack>
                    <sutram-btn slot="footer" intent="primary" icon="check" label="Apply Selection" @click=${() => {
                        this._patchForm({ [this._contextPickerTarget]: [...this._tempSelectedUris] });
                        this._showContextPicker = false;
                    }}></sutram-btn>
                </sutram-modal>
            ` : ''}
            </sutram-view>
        `;
    }
}


export class InSetuCoreAgentRoutines extends InSetuElement {
    static get extensionName() { return 'agent'; }
    static properties = {
        routines: { type: Array },
        searchQuery: { type: String },
        _applyVisibilityFilter: { type: Boolean }
    };
    static styles = [sharedStyles];

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
            <sutram-view>
                <sutram-toolbar
                    slot="toolbar"
                    searchPlaceholder="Fuzzy search routines & workflows..."
                    .searchQuery=${this.searchQuery}
                    @search-changed=${e => { this.searchQuery = e.detail.value; }}
                    .enableFilterDropdown=${true}>
                    <sutram-surface slot="filters" variant="ghost" padding="sm">
                        <sutram-toggle
                            ?flush=${true}
                            label="Apply Visibility Prerequisites"
                            .checked=${this._applyVisibilityFilter}
                            @sutram-input-changed=${e => { this._applyVisibilityFilter = e.detail.value; }}>
                        </sutram-toggle>
                    </sutram-surface>
                </sutram-toolbar>

                <sutram-stack direction="col" gap="md">
                    ${Object.keys(grouped).sort().map(domainName => html`
                        <sutram-collapsible titleText=${domainName} intent="warning" ?open=${true}>
                            <sutram-stack direction="col" gap="sm">
                                ${grouped[domainName].map(r => {
                                    const srcBadge = r.source === 'workspace' ? 'Workspace Override' : (r.source === 'user_template' ? 'User Template' : (r.is_shared ? `Shared (${r.source_workspace})` : 'Built-In'));
                                    const incCount = Array.isArray(r.includes) ? r.includes.length : 0;
                                    const detailSuffix = `${incCount > 0 ? ` | ${incCount} context(s)` : ''}${r.problems?.length ? ` | ⚠️ ${r.problems.length} problem(s)` : ''}`;
                                    return html`
                                        <sutram-card
                                            .filename=${r.filepath || `ctx://routines/${r.id}.md`}
                                            .titleText=${r.title || r.name || r.id}
                                            .descriptionText=${r.problems?.length ? `⚠️ ${r.problems[0].message}` : r.description}
                                            .detailPrefix=${`[${srcBadge}] `}
                                            .detailText=${r.slash_command || `/${r.id}`}
                                            .detailSuffix=${detailSuffix}
                                            icon="workflow"
                                            intent=${r.problems?.some(p => p.severity === 'error') ? 'danger' : (r.source === 'workspace' ? 'highlight' : 'warning')}
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
                            </sutram-stack>
                        </sutram-collapsible>
                    `)}
                </sutram-stack>

                <sutram-surface slot="footer" variant="tinted" intent="warning" border="top" padding="sm">
                    <sutram-action-bar collapse="sm" align="between">
                        <sutram-btn
                            intent="warning"
                            icon="workflow"
                            title="Toggle Yomama Menu (Active: Routines)"
                            @click=${() => this.dispatch('insetu:yomama:toggle-drawer')}>
                        </sutram-btn>
                        <sutram-btn
                            intent="success"
                            icon="plus"
                            label="New Routine"
                            ?grow=${true}
                            @click=${() => AgentStore.getState().openRoutineStudio(null, false)}>
                        </sutram-btn>
                        <sutram-btn
                            intent="primary"
                            icon="message-square"
                            label="Open Chat"
                            ?grow=${true}
                            @click=${() => this.dispatch('insetu:yomama:navigate', { surface: 'chat' })}>
                        </sutram-btn>
                        <sutram-btn
                            intent="warning"
                            icon="refresh-cw"
                            label="Refresh"
                            @click=${() => AgentStore.getState().fetchSessions()}>
                        </sutram-btn>
                    </sutram-action-bar>
                </sutram-surface>
            </sutram-view>
        `;
    }
}

if (!customElements.get('insetu-agent-routine-projection')) {
    customElements.define('insetu-agent-routine-projection', InSetuAgentRoutineProjection);
}
if (!customElements.get('insetu-core-agent-routines')) {
    customElements.define('insetu-core-agent-routines', InSetuCoreAgentRoutines);
}
