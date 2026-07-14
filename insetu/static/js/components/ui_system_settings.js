import { html, css } from 'lit';
import { InSetuElement } from '../sdk.js';
import { sharedStyles } from '../shared_styles.js';
import { AppStore } from '../store.js';

export class InSetuSystemSettings extends InSetuElement {
    static properties = {
        menuOpen: { type: Boolean },
        modalOpen: { type: Boolean },
        workspaces: { type: Object },
        emoji: { type: String },
        currentTheme: { type: String },
        settingsActions: { type: Array }
    };
    static styles = [sharedStyles, css`
        :host-context([data-theme="e-ink"]) .menu-btn {
            border: 1px solid transparent !important;
            box-shadow: none !important;
        }
        :host-context([data-theme="e-ink"]) .menu-btn.active {
            border: 2px solid #000 !important;
        }
    `];

    constructor() {
        super();
        this.menuOpen = false;
        this.modalOpen = false;
        this.workspaces = {};
        this.emoji = '⚙️';
        this.currentTheme = document.body.getAttribute('data-theme') || 'dark';
        this.settingsActions = [];
        this._handleOutsideClick = this._handleOutsideClick.bind(this);
        this._handleActionsUpdate = () => {
            this.settingsActions = window.ExtensionRegistry._settingsActions || [];
        };
    }
    connectedCallback() {
        super.connectedCallback();
        this.currentTheme = document.body.getAttribute('data-theme') || localStorage.getItem('insetu_theme') || 'dark';
        this.subscribe(AppStore, state => {
            this.workspaces = state.workspaces || {};
            this.emoji = state.instanceEmoji || '⚙️';
        });
        document.addEventListener('click', this._handleOutsideClick);
        window.addEventListener('insetu-settings-actions-updated', this._handleActionsUpdate);
        this.settingsActions = window.ExtensionRegistry?._settingsActions || [];
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this._handleOutsideClick);
        window.removeEventListener('insetu-settings-actions-updated', this._handleActionsUpdate);
    }

    _handleOutsideClick(e) {
        if (!this.menuOpen) return;
        const path = e.composedPath();
        if (!path.includes(this)) {
            this.menuOpen = false;
        }
    }

    _setTheme(theme) {
        this.currentTheme = theme;
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('insetu_theme', theme);
        this.menuOpen = false;
    }

    render() {
        const activeWs = AppStore.getState().activeWorkspace || 'default';
        const groupedActions = this.settingsActions.reduce((acc, act) => {
            const sec = act.section || 'Extensions';
            if (!acc[sec]) acc[sec] = [];
            acc[sec].push(act);
            return acc;
        }, {});

        return html`
            <div style="position: relative; display: inline-block;">
                <button class="system-action-btn" @click=${() => this.menuOpen = !this.menuOpen}>${this.emoji}</button>
                
                ${this.menuOpen ? html`
                    <div style="position: absolute; top: 100%; right: 0; margin-top: 10px; background: var(--pane-bg); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); width: 280px; z-index: 2000; overflow: hidden; padding: 15px;">
                        ${Object.keys(this.workspaces).length > 0 ? html`
                            <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid var(--border); padding-bottom: 5px; font-size: 0.9rem; color: var(--text);">Workspace</h4>
                            <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px;">
                                ${Object.entries(this.workspaces).map(([key, ws]) => {
                                    const isActive = activeWs === key;
                                    return html`
                                        <button class="menu-btn ${isActive ? 'active' : ''}" style="margin: 0; background: ${isActive ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${isActive ? 'var(--border)' : 'transparent'}; cursor: pointer; border-radius: 4px; font-weight: ${isActive ? 'bold' : 'normal'};"
                                            @click=${() => { this.menuOpen = false; if(window.executeWorkspaceSwap) window.executeWorkspaceSwap(key, ws.title); }}>
                                            ${isActive ? '🟢 ' : '⚪ '} ${ws.title || key}
                                        </button>
                                    `;
                                })}
                            </div>
                        ` : ''}

                        <h4 style="margin: 0 0 10px 0; border-bottom: 1px solid var(--border); padding-bottom: 5px; font-size: 0.9rem; color: var(--text);">Theme</h4>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <button class="menu-btn ${this.currentTheme === 'light' ? 'active' : ''}" style="margin: 0; background: ${this.currentTheme === 'light' ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${this.currentTheme === 'light' ? 'var(--border)' : 'transparent'}; cursor: pointer; font-weight: ${this.currentTheme === 'light' ? 'bold' : 'normal'}; border-radius: 4px;" @click=${() => this._setTheme('light')}>☀️ Light</button>
                            <button class="menu-btn ${this.currentTheme === 'dark' ? 'active' : ''}" style="margin: 0; background: ${this.currentTheme === 'dark' ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${this.currentTheme === 'dark' ? 'var(--border)' : 'transparent'}; cursor: pointer; font-weight: ${this.currentTheme === 'dark' ? 'bold' : 'normal'}; border-radius: 4px;" @click=${() => this._setTheme('dark')}>🌙 Dark</button>
                            <button class="menu-btn ${this.currentTheme === 'e-ink' ? 'active' : ''}" style="margin: 0; background: ${this.currentTheme === 'e-ink' ? 'var(--input-bg)' : 'transparent'}; color: var(--text); text-align: left; padding: 6px; border: 1px solid ${this.currentTheme === 'e-ink' ? 'var(--border)' : 'transparent'}; cursor: pointer; font-weight: ${this.currentTheme === 'e-ink' ? 'bold' : 'normal'}; border-radius: 4px;" @click=${() => this._setTheme('e-ink')}>📖 E-Ink</button>
                        </div>
                        <h4 style="margin: 15px 0 10px 0; border-bottom: 1px solid var(--border); padding-bottom: 5px; font-size: 0.9rem; color: var(--text);">System</h4>
                        <div style="display: flex; flex-direction: column; gap: 5px;">
                            <button class="menu-btn" @click=${() => { this.menuOpen = false; if(window.fullRefresh) window.fullRefresh(); }} style="margin: 0; background: transparent; color: #ef4444; text-align: left; padding: 6px; border: 1px solid transparent; cursor: pointer; font-weight: bold;">🔄 Full UI Refresh</button>
                            <button class="menu-btn" @click=${() => { this.menuOpen = false; this.modalOpen = true; }} style="margin: 0; background: transparent; color: var(--btn); text-align: left; padding: 6px; border: 1px solid transparent; cursor: pointer; font-weight: bold;">⚙️ More...</button>
                        </div>
                    </div>
                ` : ''}
            </div>

            <insetu-modal ?open=${this.modalOpen} titleText="System Settings & Extensions" @modal-closed=${() => this.modalOpen = false}>
                <div slot="body" style="display: flex; flex-direction: column; gap: 10px; flex: 1; overflow-y: auto; margin-bottom: 20px;">
                    ${Object.keys(groupedActions).map(section => html`
                        <div style="font-weight: bold; font-size: 0.85rem; color: var(--intent-primary); margin-top: 12px; margin-bottom: 6px; border-bottom: 1px solid var(--border); padding-bottom: 4px;">${section}:</div>
                        ${groupedActions[section].map(act => html`
                            <button class="btn-sm" style="background: var(--input-bg); color: var(--text); border: 1px solid var(--border); text-align: left; padding: 10px 15px; font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 10px; font-weight: bold; transition: background 0.2s; width: 100%;"
                                onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='var(--input-bg)'"
                                @click=${() => { this.modalOpen = false; act.callback(); }}>
                                <span style="font-size: 1.2rem;">${act.icon}</span> <span>${act.label}</span>
                            </button>
                        `)}
                    `)}
                    <div style="border-top: 1px solid var(--border); padding-top: 15px; display: flex; justify-content: flex-end; margin-top: auto; gap: 8px;">
                        <button class="btn-sm" style="background: var(--intent-primary); margin: 0; font-weight: bold; color: white;" 
                            @click=${async (e) => {
                                const btn = e.target;
                                const orig = btn.innerText;
                                btn.innerText = "⏳ Recompiling...";
                                try {
                                    if (window.executeSystemCompile) await window.executeSystemCompile(null, true);
                                } catch(err) {}
                                btn.innerText = orig;
                            }}>⚙️ Full Context Recompile</button>
                        <button class="btn-sm" style="background: var(--intent-warning); margin: 0; font-weight: bold; color: black;" @click=${() => { this.modalOpen = false; if(window.simulatePanic) window.simulatePanic(); }}>⚠️ Test Recovery</button>
                    </div>
                </div>
            </insetu-modal>
        `;
    }
}
customElements.define('insetu-system-settings', InSetuSystemSettings);