import { html, css } from 'lit';
import { InSetuElement, createExtensionStore } from '../core/sdk.js';
import { sharedStyles } from '../core/shared_styles.js';
export const DevStore = createExtensionStore('Dev', {
    thrashingFiles: [],
    bridgeErrors: [],
    lastUpdate: null,
    forceRefreshTick: 0
});
export class InSetuExtDevDash extends InSetuElement {
    static get extensionName() { return 'dev'; }

    static properties = {
        thrashingFiles: { type: Array },
        bridgeErrors: { type: Array },
        lastUpdate: { type: String },
        _expandedGraphs: { type: Object }
    };

    static styles = [sharedStyles, css`
        :host { display: flex; flex-direction: column; height: 100%; overflow-y: auto; padding: 20px; box-sizing: border-box; background: var(--bg); }
    `];

    constructor() {
        super();
        this.thrashingFiles = [];
        this.bridgeErrors = [];
        this.lastUpdate = '';
        this._expandedGraphs = {};
    }
    connectedCallback() {
        super.connectedCallback();
        this.subscribe(DevStore, state => {
            this.thrashingFiles = state.thrashingFiles || [];
            this.bridgeErrors = state.bridgeErrors || [];
            this.lastUpdate = state.lastUpdate;
        });

        this.subscribe(DevStore, state => state.forceRefreshTick, (tick) => {
            if (tick) {
                this.fetchMetrics();
            }
        });

        this.fetchMetrics();
    }
    async fetchMetrics() {
        if (window.ACTIVE_EXTENSIONS && !window.ACTIVE_EXTENSIONS.includes('dev')) return;
        try {
            const res = await this.api.get('metrics');
            if (res.ok) {
                const data = await res.json();
                DevStore.setState({ 
                    thrashingFiles: data.thrashing || [],
                    bridgeErrors: data.bridge_errors || [],
                    lastUpdate: this.utils.formatDate(new Date())
                });
            } else {
                DevStore.setState({ lastUpdate: `Error (HTTP ${res.status})` });
            }
        } catch(e) {
            console.error("Telemetry fetch failed", e);
            DevStore.setState({ lastUpdate: 'Network Error' });
        }
    }

    render() {
        return html`
            <div style="max-width: 1200px; margin: 0 auto; width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: var(--text);">Developer Dashboard</h2>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">Last Updated: ${this.lastUpdate || '...'}</span>
                </div>
                <sutram-card-group>
                    <insetu-card
                        titleText="File Thrashing (Last 1 Hour)"
                        descriptionText="Files mutated more than 3 times in the past hour."
                        icon="🔥"
                        intentColor="var(--intent-danger)"
                        ?disableSelection=${true}
                        style="margin-bottom: 20px;">
                        
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                            ${this.thrashingFiles.length === 0 ? html`
                                <div style="color: var(--intent-success); font-style: italic; font-size: 0.9rem;">
                                    ✅ File system is stable. No thrashing detected.
                                </div>
                            ` : this.thrashingFiles.map(f => html`
                                <div style="display: flex; flex-direction: column; background: var(--bg); border-radius: 4px; border: 1px solid var(--border); overflow: hidden;">
                                    <div style="display: flex; justify-content: space-between; padding: 8px 12px; cursor: pointer; transition: background 0.2s;"
                                        onmouseover="this.style.background='var(--input-bg)'"
                                        onmouseout="this.style.background='transparent'"
                                        @click=${() => {
                                            this._expandedGraphs = { ...this._expandedGraphs, [f.filepath]: !this._expandedGraphs[f.filepath] };
                                            this.requestUpdate();
                                        }}>
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="color: var(--text-muted); font-size: 0.7rem;">${this._expandedGraphs[f.filepath] ? '▼' : '▶'}</span>
                                            <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--text); word-break: break-all;">${f.filepath}</span>
                                        </div>
                                        <span style="font-weight: bold; color: var(--intent-danger);">${f.peak_mutations} mut/min peak</span>
                                    </div>
                                    ${this._expandedGraphs[f.filepath] ? html`
                                        <div style="padding: 15px; border-top: 1px solid var(--border); background: var(--pane-bg);">
                                            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 8px;">
                                                <span>60 mins ago</span>
                                                <span style="font-weight: bold; color: var(--text);">${f.total_mutations} total mutations</span>
                                                <span>Now</span>
                                            </div>
                                            <div style="display: flex; align-items: flex-end; height: 60px; gap: 2px;">
                                                ${f.history.map(val => {
                                                    const heightPct = f.peak_mutations > 0 ? Math.max(5, (val / f.peak_mutations) * 100) : 0;
                                                    return html`
                                                        <div style="flex: 1; background: ${val >= 3 ? 'var(--intent-danger)' : (val > 0 ? 'var(--intent-primary)' : 'transparent')}; height: ${val > 0 ? heightPct + '%' : '2px'}; opacity: ${val > 0 ? '1' : '0.2'}; border-radius: 2px 2px 0 0;" title="${val} mutations"></div>
                                                    `;
                                                })}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            `)}
                        </div>
                    </insetu-card>

                    <insetu-card
                        titleText="Bridge Error Ledger"
                        descriptionText="AST validation and patch diff failures for LLM analysis."
                        icon="🌉"
                        intentColor="var(--intent-warning)"
                        ?disableSelection=${true}>
                        
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px;">
                            ${this.bridgeErrors.length === 0 ? html`
                                <div style="color: var(--intent-success); font-style: italic; font-size: 0.9rem;">
                                    ✅ No bridge errors recorded.
                                </div>
                            ` : this.bridgeErrors.map(err => html`
                                <div style="display: flex; flex-direction: column; background: var(--bg); padding: 10px; border-radius: 4px; border: 1px solid var(--border);">
                                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <span style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--intent-primary); word-break: break-all;">${err.filepath}</span>
                                            ${err.attempt_count > 1 ? html`<span style="background: var(--intent-warning); color: #000; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; font-weight: bold;">${err.attempt_count}x Attempts</span>` : ''}
                                        </div>
                                        <span style="font-size: 0.75rem; color: var(--text-muted);">${this.utils.formatDate(err.timestamp * 1000)}</span>
                                    </div>
                                    <div style="font-size: 0.85rem; font-weight: bold; color: var(--intent-warning); margin-bottom: 4px;">[${err.error_type}]</div>
                                    <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); white-space: pre-wrap; background: var(--input-bg); padding: 6px; border-radius: 4px;">${err.details}</div>
                                    ${(err.file_content || err.patch_payload) ? html`
                                        <div style="margin-top: 8px;">
                                            <sutram-collapsible titleText="🔍 View Full Context" intent="neutral" style="--title-size: 0.8rem;">
                                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                                    <div style="font-weight: bold; font-size: 0.8rem; color: var(--text-muted);">Patch Payload:</div>
                                                    <textarea readonly style="width: 100%; height: 100px; font-family: var(--font-mono); font-size: 0.75rem; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 6px; resize: vertical;">${err.patch_payload ? (typeof err.patch_payload === 'string' && (err.patch_payload.startsWith('{') || err.patch_payload.startsWith('[')) ? JSON.stringify(JSON.parse(err.patch_payload), null, 2) : err.patch_payload) : 'N/A'}</textarea>
                                                    <div style="font-weight: bold; font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">Target File Content:</div>
                                                    <textarea readonly style="width: 100%; height: 150px; font-family: var(--font-mono); font-size: 0.75rem; background: var(--input-bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 6px; resize: vertical;">${err.file_content || 'N/A'}</textarea>
                                                </div>
                                            </sutram-collapsible>
                                        </div>
                                    ` : ''}
                                </div>
                            `)}
                        </div>
                    </insetu-card>
                </sutram-card-group>
            </div>
        `;
    }
}
customElements.define('insetu-ext-dev-dash', InSetuExtDevDash);

window.ExtensionRegistry.registerExtension('dev', {
    name: "Developer Tools",
    version: "1.0.0",
    layoutSlots: [
        {
            slot: "slots:primary-navigation",
            id: "dev",
            label: "Dev",
            order: 90
        },
        {
            slot: "slots:sub-navigation",
            targetParent: "dev",
            id: "dash",
            label: "Dashboard",
            order: 1,
            component: "insetu-ext-dev-dash"
        }
    ],
    uiHooks: {
        'zone:tab-changed': (tabId) => {
            if (tabId === 'dev') {
                DevStore.setState({ forceRefreshTick: Date.now() });
            }
        },
        'zone:subtab-changed': (data) => {
            if ((data.parentId === 'dev' && data.subId === 'dash') || data.subId === 'dash') {
                DevStore.setState({ forceRefreshTick: Date.now() });
            }
        },
        'zone:soft-refresh': () => {
            DevStore.setState({ thrashingFiles: [], bridgeErrors: [] });
            return false;
        },
        'zone:vfs-mutated': (payload) => {
            if (!payload || !payload.mutations) return false;
            const activeTab = window.inSetu.stores.App.getState().activeTab;
            if (activeTab === 'dev') {
                if (window._devDashRefreshTimer) clearTimeout(window._devDashRefreshTimer);
                window._devDashRefreshTimer = setTimeout(() => {
                    DevStore.setState({ forceRefreshTick: Date.now() });
                }, 2000);
            }
            return false;
        }
    }
});