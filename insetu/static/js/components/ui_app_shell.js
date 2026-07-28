import { LitElement, html, css } from 'lit';
import { InSetuElement } from '../sdk.js';
import { AppStore } from '../store.js';
import '../../vendor/yenvui/js/tabs.js';

export class InSetuAppShell extends InSetuElement {
    static properties = {
        activePrimary: { type: String },
        activeSubs: { type: Object },
        primaryTabs: { type: Array },
        subTabs: { type: Object },
        subActions: { type: Object },
        globalComponents: { type: Array },
        configMissing: { type: Boolean }
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100vw;
            height: 100dvh;
            background: var(--bg-deep);
            overflow: hidden;
        }
        .nested-tab-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            overflow: hidden;
            background: var(--bg);
        }
    `;
    constructor() {
        super();
        this.activePrimary = 'context';
        this.activeSubs = {};
        this.primaryTabs = [];
        this.subTabs = {};
        this.subActions = {};
        this.globalComponents = [];
        this.configMissing = false;
        this._compileListener = this._compileFromRegistry.bind(this);
        this._componentCache = new Map();
    }
    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('insetu-layout-recompile', this._compileListener);
        this.subscribe(AppStore, state => {
            this.activePrimary = state.activeTab || 'context';
            this.activeSubs = state.activeSubTabs || {};
            this.configMissing = !!state.configMissing;
            this.requestUpdate();
        });
        if (window.inSetu.stores.Gather) {
            this.subscribe(window.inSetu.stores.Gather, state => {
                if (state.tabOrder) this._compileFromRegistry();
            });
        }

        const state = AppStore.getState();
        this.activePrimary = state.activeTab || 'context';
        this.activeSubs = state.activeSubTabs || {};
        this.configMissing = !!state.configMissing;

        // Rebuild layout on boot
        setTimeout(() => this._compileFromRegistry(), 0);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('insetu-layout-recompile', this._compileListener);
    }

    _compileFromRegistry() {
        const pTabs = [
            { id: 'context', label: 'Context', order: 10 },
            { id: 'edit', label: 'Edit', order: 20 }
        ];
        const sTabs = {};
        const sActions = {};
        const globals = [];

        if (window.ExtensionRegistry && window.ExtensionRegistry._manifests) {
            window.ExtensionRegistry._manifests.forEach((config, extName) => {
                const isCore = ['bridge', 'gather', 'config', 'files'].includes(extName);
                if (isCore || (window.ACTIVE_EXTENSIONS && window.ACTIVE_EXTENSIONS.includes(extName))) {
                    
                    if (config.layoutSlots) {
                        config.layoutSlots.forEach(slotDef => {
                            const cleanSlot = slotDef.slot.replace('slots:', '');
                            if (cleanSlot === 'primary-navigation') {
                                if (!pTabs.find(t => t.id === slotDef.id)) {
                                    pTabs.push({ id: slotDef.id, label: slotDef.label, order: slotDef.order || 99 });
                                }
                            } else if (cleanSlot === 'sub-navigation') {
                                const parent = slotDef.targetParent;
                                if (!sTabs[parent]) sTabs[parent] = [];
                                if (!sTabs[parent].find(s => s.id === slotDef.id)) {
                                    sTabs[parent].push({ id: slotDef.id, label: slotDef.label, component: slotDef.component, ext: extName, order: slotDef.order || 99 });
                                }
                            } else if (cleanSlot === 'sub-navigation-actions') {
                                const parent = slotDef.targetParent;
                                if (!sActions[parent]) sActions[parent] = {};
                                if (!sActions[parent][slotDef.targetSub]) sActions[parent][slotDef.targetSub] = [];
                                sActions[parent][slotDef.targetSub].push({ component: slotDef.component, ext: extName, order: slotDef.order || 99 });
                            } else if (cleanSlot === 'global') {
                                globals.push({ component: slotDef.component, ext: extName });
                            }
                        });
                    }
                }
            });
        }
        // Sort arrays, applying user-defined GatherStore ordering overrides for primary tabs
        const tabOrder = window.inSetu.stores.Gather?.getState()?.tabOrder || [];
        pTabs.sort((a, b) => {
            let iA = tabOrder.indexOf(a.id);
            let iB = tabOrder.indexOf(b.id);
            if (iA === -1) iA = 999;
            if (iB === -1) iB = 999;
            if (iA !== iB) return iA - iB;
            return a.order - b.order;
        });
        Object.keys(sTabs).forEach(parent => sTabs[parent].sort((a, b) => a.order - b.order));
        // Fallback for missing sub-tabs if not explicitly set by the router
        const activeSubTabs = AppStore.getState().activeSubTabs || {};
        Object.keys(sTabs).forEach(parent => {
            if (!activeSubTabs[parent] && sTabs[parent].length > 0) {
                this.activeSubs[parent] = sTabs[parent][0].id;
            } else if (activeSubTabs[parent]) {
                this.activeSubs[parent] = activeSubTabs[parent];
            }
        });

        this.primaryTabs = pTabs;
        this.subTabs = sTabs;
        this.subActions = sActions;
        this.globalComponents = globals;
        this.requestUpdate();
    }
    _handlePrimarySelect(e) {
        e.stopPropagation();
        const tabId = e.detail.tabId;
        const isAlreadyActive = this.activePrimary === tabId;

        // Drive routing purely via the URL hash
        const ws = this.workspaceId || 'default';
        const subId = this.activeSubs[tabId] || '';
        window.location.hash = `#/${encodeURIComponent(ws)}/${encodeURIComponent(tabId)}/${encodeURIComponent(subId)}`;

        if (isAlreadyActive) {
            const activeSub = this.activeSubs[tabId];
            if (activeSub) window.inSetu.events.emitHook('zone:subtab-changed', { parentId: tabId, subId: activeSub, forceRefresh: true });
        } else {
            window.inSetu.events.emitHook('zone:tab-changed', tabId);
        }
    }

    _handleSubSelect(parentId, e) {
        e.stopPropagation();
        const subId = e.detail.tabId;
        const isAlreadyActive = this.activeSubs[parentId] === subId;

        const ws = this.workspaceId || 'default';
        window.location.hash = `#/${encodeURIComponent(ws)}/${encodeURIComponent(parentId)}/${encodeURIComponent(subId)}`;

        window.inSetu.events.emitHook('zone:subtab-changed', { parentId, subId, forceRefresh: isAlreadyActive });
    }

    // A helper method bound to the global window object to catch legacy programmatic routing
    forceSwitch(tabId, subId = null) {
        const ws = this.workspaceId || 'default';
        const finalSub = subId || this.activeSubs[tabId] || '';
        window.location.hash = `#/${encodeURIComponent(ws)}/${encodeURIComponent(tabId)}/${encodeURIComponent(finalSub)}`;
    }
    render() {
        return html`
            ${this.configMissing ? html`
                <div style="background: var(--intent-warning); color: #000; padding: 8px; text-align: center; font-weight: bold; position: fixed; bottom: 30px; left: 0; right: 0; z-index: 1000; box-shadow: 0 -2px 5px rgba(0,0,0,0.2); font-size: 0.9rem;">
                    ⚠️ Configuration file missing. Operating in empty fallback state.
                    <span style="cursor:pointer; text-decoration:underline; margin-left:15px; opacity:0.8;" @click=${() => window.inSetu.stores.App.setState({ configMissing: false })}>Dismiss</span>
                </div>
            ` : ''}
            <yenvui-tabs .tabs=${this.primaryTabs} .activeTab=${this.activePrimary} @yenvui-tab-selected=${this._handlePrimarySelect}>
                <!-- Project the generic settings button to the far right of the primary header -->
                <div slot="header-actions" style="display: flex; align-items: center;">
                    <insetu-selection-tray></insetu-selection-tray>
                    <insetu-system-settings></insetu-system-settings>
                </div>

                <!-- Iterate over all primary tabs, physically rendering their specific nested yenvui-tabs -->
                ${this.primaryTabs.map(pTab => html`
                    <div style="display: ${this.activePrimary === pTab.id ? 'flex' : 'none'}; flex-direction: column; flex: 1; height: 100%; min-height: 0;">
                        ${this.subTabs[pTab.id] && this.subTabs[pTab.id].length > 0 ? html`
                            <yenvui-tabs 
                                variant="sub"
                                ?cacheViews=${true}
                                .tabs=${this.subTabs[pTab.id]} 
                                .activeTab=${this.activeSubs[pTab.id]} 
                                @yenvui-tab-selected=${(e) => this._handleSubSelect(pTab.id, e)}>
                                <div slot="header-actions" style="display: flex; gap: 8px; align-items: center;">
                                    ${(this.subActions[pTab.id]?.[this.activeSubs[pTab.id]] || []).map(act => html`
                                        <div style="display: contents;" data-ext="${act.ext}">
                                            ${this._renderDynamicComponent(act.component, this.activeSubs[pTab.id])}
                                        </div>
                                    `)}
                                </div>
                            </yenvui-tabs>
                        ` : html`
                            <div class="nested-tab-container">
                                <div style="padding: 20px; color: var(--text-muted); font-style: italic;">No extensions mapped to this workspace partition.</div>
                            </div>
                        `}
                    </div>
                `)}
            </yenvui-tabs>
            <!-- Global invisible components (like the sync bridge background logic) -->
            <div style="display: contents;">
                ${this.globalComponents.map(g => html`<div data-ext="${g.ext}" style="display: contents;">${this._renderDynamicComponent(g.component)}</div>`)}
            </div>
        `;
    }
    _renderDynamicComponent(tag, subId = null) {
        // Cache components to prevent Lit from destroying DOM nodes on tab switch, 
        // which protects WebSockets (Terminal) and iframe state.
        const cacheKey = tag + (subId ? '-' + subId : '');
        if (!this._componentCache.has(cacheKey)) {
            const el = document.createElement(tag);
            if (subId) el.dataset.subId = subId;
            this._componentCache.set(cacheKey, el);
        }
        return this._componentCache.get(cacheKey);
    }
}
customElements.define('insetu-app-shell', InSetuAppShell);

// Bind legacy globals to the new shell instance
window.inSetu = window.inSetu || {};
window.inSetu.sys = window.inSetu.sys || {};
window.inSetu.sys.switchTab = (e, tabId) => {
    const targetTab = typeof e === 'string' ? e : tabId;
    if (!targetTab) return;
    const { activeSubTabs, globalBrowsePath } = AppStore.getState();
    const subId = activeSubTabs[targetTab] || '';
    const deepStr = (globalBrowsePath && globalBrowsePath.length > 0) ? '/' + globalBrowsePath.map(encodeURIComponent).join('/') : '';
    window.location.hash = `#/${encodeURIComponent(window.inSetu.utils.getActiveWorkspace())}/${encodeURIComponent(targetTab)}/${encodeURIComponent(subId)}${deepStr}`;
};
window.inSetu.sys.switchSubTab = (subId, forceRefresh = false, isProgrammatic = false) => {
    if (!subId) return;
    const { activeTab, globalBrowsePath } = AppStore.getState();
    const deepStr = (globalBrowsePath && globalBrowsePath.length > 0) ? '/' + globalBrowsePath.map(encodeURIComponent).join('/') : '';
    window.location.hash = `#/${encodeURIComponent(window.inSetu.utils.getActiveWorkspace())}/${encodeURIComponent(activeTab)}/${encodeURIComponent(subId)}${deepStr}`;
};