/**
 * Agent Harness state store (AgentStore) and routine target URI classifier extracted from agent.js (God-Objects Wave 3.3).
 */
import { createExtensionStore } from '/static/extensions/system/insetu_sdk.js';

export const CORE_MODE_ROUTINES = {
    auto: 'workspace_turn',
    code: 'code',
    plan: 'plan',
    ask: 'ask',
    yomama: 'yomama',
    undo: 'workspace_turn'
};
export const ONE_SHOT_ROUTINES = new Set(['test', 'wrap', 'close_session', 'upkeep', 'debt_ratchet', 'yomama', 'undo']);

export function preWarmHandoffContext(handoffWrapper) {
    const ph = handoffWrapper?.pending_handoff || handoffWrapper;
    if (!ph || !window.inSetu?.vfs?.preWarmShareArtifact) return;
    const branches = Array.isArray(ph.branches) && ph.branches.length > 0 ? ph.branches : [ph];
    branches.forEach(b => {
        const uri = b?.full_context_uri || b?.workflow_context_uri || b?.delta_context_uri;
        if (uri) window.inSetu.vfs.preWarmShareArtifact(uri, null, false);
    });
}

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
    fileTokenMap: {},
    executionTrace: [],
    tokenLedger: { prompt_tokens: 0, completion_tokens: 0, saved_by_slicing: 0, by_tier: {}, total_cost_usd: 0 },
    activePlan: null,
    activePlanPath: '',
    pendingCheckpoint: null,
    agentRoutineId: 'workspace_turn',
    agentMode: 'auto',
    agentScope: '',
    agentSettings: {
        helper_mode: 'ai_assisted',
        rag_strategy: 'blast_radius',
        compaction_strategy: 'deterministic',
        run_tests_on_code: false,
        strict_test_enforcement: false
    },
    promptInput: '',
    webChatWindowMode: 'same_window',
    pendingHandoff: null,
    handoffBranchIdx: 0,
    handoffBranchResponses: {},
    lastTurnCommittedFiles: [],
    setModePrefix: (modeId, explicitRoutineId = null, explicitScope = null) => {
        const st = AgentStore.getState();
        const raw = st.promptInput || '';
        const stripped = raw.replace(/^\/(?:user:[a-zA-Z0-9_:-]*|[a-zA-Z0-9_:-]+)\s*/, '');
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
            await window.inSetu.api.post('agent/settings', { [key]: value });
        } catch (e) {
            console.warn("Failed to persist agent setting:", e);
        }
    },
    selectRoutine: ({ routineId, mode } = {}) => {
        if (!routineId) return;
        if (routineId === 'workspace_turn' && (!mode || CORE_MODE_ROUTINES[mode])) {
            AgentStore.getState().setModePrefix(mode || 'auto');
            return;
        }
        if (CORE_MODE_ROUTINES[routineId]) {
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
                const rawLedger = data.token_ledger || {};
                const normalizedLedger = {
                    prompt_tokens: Number(rawLedger.prompt_tokens || 0),
                    completion_tokens: Number(rawLedger.completion_tokens || 0),
                    saved_by_slicing: Number(rawLedger.saved_by_slicing ?? rawLedger.saved_by_slicing_tokens ?? 0),
                    saved_by_slicing_tokens: Number(rawLedger.saved_by_slicing_tokens ?? rawLedger.saved_by_slicing ?? 0),
                    by_tier: rawLedger.by_tier || {},
                    total_cost_usd: Number(rawLedger.total_cost_usd || 0)
                };
                const cp = (data.checkpoint && data.checkpoint.chain_context) ? data.checkpoint : null;
                const isPausedHandoff = Boolean(cp && cp.pending_handoff);
                const cpTrace = cp?.chain_context?.global?.execution_trace || [];
                AgentStore.setState({
                    messages: data.messages || [],
                    workingSetRaw: wsList,
                    fileTokenMap: data.file_token_map || {},
                    pinnedFiles: pinned,
                    referenceFiles: ref,
                    constitutionFiles: data.constitution_files || [],
                    tokenLedger: normalizedLedger,
                    activePlanPath: data.active_plan_path || '',
                    pendingHandoff: isPausedHandoff ? cp : null,
                    pendingCheckpoint: (cp && !isPausedHandoff) ? cp : null,
                    executionTrace: cpTrace,
                    handoffBranchIdx: 0,
                    handoffBranchResponses: {},
                    lastTurnCommittedFiles: [],
                    sessionSummary: data.summary || '',
                });
                if (isPausedHandoff) preWarmHandoffContext(cp);
            }
        } catch (e) {
            console.error("Failed to fetch messages:", e);
        }
    },
    selectProfile: async (profileId) => {
        if (!profileId) return;
        AgentStore.setState({ activeProfileId: profileId });
        try {
            await window.inSetu.api.post('llm/profiles', { active_profile_id: profileId });
        } catch (e) {
            console.warn("Failed to persist active LLM profile:", e);
        }
    },
    hydrateCatalog: window.inSetu.utils.coalescedAsync(async () => {
        const [routRes, profRes, setRes] = await Promise.all([
            window.inSetu.api.get('agent/routines'),
            window.inSetu.api.get('llm/profiles'),
            window.inSetu.api.get('agent/settings').catch(() => null)
        ]);
        const patch = {};
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
                    helper_mode: sData.settings.helper_mode || 'ai_assisted',
                    rag_strategy: sData.settings.rag_strategy || 'blast_radius',
                    compaction_strategy: sData.settings.compaction_strategy || 'deterministic',
                    run_tests_on_code: Boolean(sData.settings.run_tests_on_code),
                    strict_test_enforcement: Boolean(sData.settings.strict_test_enforcement)
                };
            }
        }
        AgentStore.setState(patch);
    }),
    fetchSessions: window.inSetu.utils.coalescedAsync(async (forceFull = false) => {
        const curState = AgentStore.getState();
        const needsMetadata = forceFull || !(curState.routines && curState.routines.length > 0);
        if (needsMetadata) AgentStore.setState({ loading: true });
        try {
            const [sesRes] = await Promise.all([
                window.inSetu.api.get('agent/sessions'),
                needsMetadata ? AgentStore.getState().hydrateCatalog() : Promise.resolve()
            ]);
            if (sesRes && sesRes.ok) {
                const data = await sesRes.json();
                const sessions = data.sessions || [];
                const patch = { sessions };
                if (Array.isArray(data.constitution_files)) patch.constitutionFiles = data.constitution_files;
                AgentStore.setState(patch);
                if (!AgentStore.getState().activeSessionId && sessions.length > 0) {
                    await AgentStore.getState().selectSession(sessions[0].session_id);
                }
            }
        } catch (e) {
            console.error("Failed to fetch chat sessions:", e);
        } finally {
            AgentStore.setState({ loading: false });
        }
    }),
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
window.inSetu.stores = window.inSetu.stores || {};
window.inSetu.stores.Agent = AgentStore;


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
    const allDefinedUris = [...availDiffs, ...availContexts, ...availPrompts];
    const uriObj = new window.inSetu.utils.InSetuURI(rawInc);
    const inc = uriObj.isDir ? `${uriObj.toString()}/` : uriObj.toString();
    const isSystem = uriObj.scheme === 'ctx' || uriObj.scheme === 'ws';
    const isDiff = inc.startsWith('ctx://diffs/') || inc.endsWith('_diffs.txt');
    const isPrompt = inc.startsWith('ctx://prompts/') || uriObj.volume === 'prompts';
    const isGatherContext = isSystem && !isDiff && !isPrompt;

    const hasTopologyLoaded = availContexts.length > 0 || availDiffs.length > 0 || allRepos.length > 0;
    let isUndefined = false;
    if (hasTopologyLoaded) {
        if (isDiff) isUndefined = !availDiffs.includes(inc);
        else if (isGatherContext) isUndefined = !availContexts.includes(inc) && !manifestCtx[inc];
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
