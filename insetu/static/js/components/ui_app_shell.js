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
        globalComponents: { type: Array }
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
        this._compileListener = this._compileFromRegistry.bind(this);
        this._componentCache = new Map();
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('insetu-layout-recompile', this._compileListener);
        
        // Restore active states from storage
        const ws = this.workspaceId || 'default';
        this.activePrimary = localStorage.getItem(`insetu_tab_${ws}`) || localStorage.getItem('insetu_tab') || 'context';
        
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
        // Sort arrays, applying user-defined AppStore ordering overrides for primary tabs
        const tabOrder = AppStore.getState()?.tabOrder || [];
        pTabs.sort((a, b) => {
            let iA = tabOrder.indexOf(a.id);
            let iB = tabOrder.indexOf(b.id);
            if (iA === -1) iA = 999;
            if (iB === -1) iB = 999;
            if (iA !== iB) return iA - iB;
            return a.order - b.order;
        });
        Object.keys(sTabs).forEach(parent => sTabs[parent].sort((a, b) => a.order - b.order));
        
        // Restore active sub-tabs from storage statelessly
        const ws = this.workspaceId || 'default';
        Object.keys(sTabs).forEach(parent => {
            const savedSub = localStorage.getItem(`insetu_subtab_${parent}`);
            if (savedSub && sTabs[parent].find(s => s.id === savedSub)) {
                this.activeSubs[parent] = savedSub;
            } else if (sTabs[parent].length > 0) {
                this.activeSubs[parent] = sTabs[parent][0].id;
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

        this.activePrimary = tabId;
        const ws = this.workspaceId || 'default';
        localStorage.setItem(`insetu_tab_${ws}`, tabId);
        localStorage.setItem('insetu_tab', tabId);

        if (isAlreadyActive) {
            const activeSub = this.activeSubs[tabId];
            if (activeSub && window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
                window.ExtensionRegistry.executeUIHook('zone:subtab-changed', { parentId: tabId, subId: activeSub, forceRefresh: true });
            }
        } else if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
            window.ExtensionRegistry.executeUIHook('zone:tab-changed', tabId);
        }
    }

    _handleSubSelect(parentId, e) {
        e.stopPropagation();
        const subId = e.detail.tabId;
        const isAlreadyActive = this.activeSubs[parentId] === subId;

        this.activeSubs = { ...this.activeSubs, [parentId]: subId };
        localStorage.setItem(`insetu_subtab_${parentId}`, subId);

        if (window.ExtensionRegistry && window.ExtensionRegistry.executeUIHook) {
            window.ExtensionRegistry.executeUIHook('zone:subtab-changed', { parentId, subId, forceRefresh: isAlreadyActive });
        }
    }

    // A helper method bound to the global window object to catch legacy programmatic routing
    forceSwitch(tabId, subId = null) {
        if (this.primaryTabs.find(t => t.id === tabId)) {
            this.activePrimary = tabId;
            const ws = this.workspaceId || 'default';
            localStorage.setItem(`insetu_tab_${ws}`, tabId);
        }
        if (subId && this.subTabs[tabId] && this.subTabs[tabId].find(s => s.id === subId)) {
            this.activeSubs = { ...this.activeSubs, [tabId]: subId };
            localStorage.setItem(`insetu_subtab_${tabId}`, subId);
        }
        this.requestUpdate();
    }

    render() {
        return html`
            <yenvui-tabs .tabs=${this.primaryTabs} .activeTab=${this.activePrimary} @yenvui-tab-selected=${this._handlePrimarySelect}>
                
                <!-- Project the generic settings button to the far right of the primary header -->
                <div slot="header-actions" style="display: flex; align-items: center;">
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
    const shell = document.querySelector('insetu-app-shell');
    if (shell) shell.forceSwitch(tabId);
};
window.inSetu.sys.switchSubTab = (subId, forceRefresh = false, isProgrammatic = false) => {
    const shell = document.querySelector('insetu-app-shell');
    if (shell) shell.forceSwitch(shell.activePrimary, subId);
};