import { LitElement, html } from 'lit';
import { buildFileTree } from '../app.js';

export class InSetuFolderBrowser extends LitElement {
    static properties = {
        files: { type: Array },
        currentPath: { type: Array }
    };

    constructor() {
        super();
        this.files = [];
        this.currentPath = [];
    }

    createRenderRoot() {
        return this; // Render in Light DOM to inherit OS CSS
    }

    _setPath(newPath) {
        this.currentPath = newPath;
        this.dispatchEvent(new CustomEvent('path-changed', {
            detail: { path: newPath.join('/') },
            bubbles: true,
            composed: true
        }));
    }

    render() {
        const tree = buildFileTree(this.files);
        let current = tree;
        for (const p of this.currentPath) {
            if (current[p]) {
                current = current[p];
            } else {
                current = tree;
                this.currentPath = [];
                break;
            }
        }

        const keys = Object.keys(current).filter(k => k !== '_isFile' && !current[k]._isFile).sort((a, b) => a.localeCompare(b));

        return html`
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 10px;">
                <button class="btn-sm" style="background: var(--intent-neutral);" ?disabled=${this.currentPath.length === 0} @click=${() => this._setPath(this.currentPath.slice(0, -1))}>⬆️ Up</button>
                <span style="font-family: monospace; color: var(--text); opacity: 0.7; word-break: break-all; font-size: 0.9rem;">/${this.currentPath.join('/')}</span>
            </div>
            <div style="flex: 1; overflow-y: auto;">
                ${keys.length === 0 ? html`<div style="color: var(--text-muted); font-style: italic; font-size: 0.9rem; margin-top: 10px;">No sub-folders available.</div>` : keys.map(key => html`
                    <div style="padding: 8px 10px; cursor: pointer; display: flex; align-items: center; border-radius: 4px; transition: background 0.2s; margin-bottom: 4px;" 
                        onmouseover="this.style.background='var(--input-bg)'" 
                        onmouseout="this.style.background='transparent'"
                        @click=${() => this._setPath([...this.currentPath, key])}>
                        <span style="font-family: monospace; font-weight: bold; color: var(--intent-warning); margin-right: 8px;">📁</span>
                        <span style="color: var(--text); font-size: 0.9rem; font-weight: bold;">${key}</span>
                    </div>
                `)}
            </div>
        `;
    }
}
customElements.define('insetu-folder-browser', InSetuFolderBrowser);