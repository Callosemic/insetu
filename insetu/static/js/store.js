// insetu/static/js/store.js
// Strict Unidirectional Data Flow (UDF) State Manager
import { createStore } from 'https://esm.sh/zustand/vanilla';
import { devtools, subscribeWithSelector } from 'https://esm.sh/zustand/middleware';
window.inSetu = window.inSetu || { stores: {}, extensions: {}, ui: {} };

export const AppStore = createStore(
    devtools(
        subscribeWithSelector((set) => ({
            activeWorkspace: localStorage.getItem('insetu_workspace') || 'default',
            manifest: {},
            allRepos: [],
            targetConfigs: [],
            virtualContexts: [],
            categoryOrder: [],
            tabOrder: [],
            hiddenOutputs: [],

            pinnedRepos: new Set(JSON.parse(localStorage.getItem('insetu_pinned_repos')) || ["ALL"]),
            gatherOptions: { contexts: [], diffs: [], prompts: [], artifactsDir: "", profileDir: "" },

            globalBrowsePath: [],
            currentBrowsePath: [],
            browserConfig: { mode: 'view', callback: null },
            currentPushRepo: '',
            currentPushDiffFile: '',
            currentFormatTarget: '',
            currentPromptsPath: [],

            resetState: () => set({
                globalBrowsePath: [],
                currentBrowsePath: [],
                browserConfig: { mode: 'view', callback: null },
                currentPushRepo: '',
                currentPushDiffFile: '',
                currentFormatTarget: '',
                currentPromptsPath: []
            })
        })),
        { name: 'AppStore' }
    )
);
window.inSetu.stores.App = AppStore;