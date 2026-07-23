import '../../vendor/yenvui/js/pill.js';
import '../../vendor/yenvui/js/filter-group.js';
import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';

export class InSetuRepoFilter extends LitElement {
    static properties = {
        label: { type: String },
        repos: { type: Array },
        activeRepos: { type: Array },
        extraRepos: { type: Array }
    };

    static styles = [
        sharedStyles,
        css`
            .wrap { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
            .label { font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap; user-select: none; }
        `
    ];
    _handleRepoToggle(e) {
            e.stopPropagation();
            const { id, active } = e.detail;
            let newSet = new Set(this.activeRepos);
            if (id === 'ALL') {
                newSet.clear();
                newSet.add('ALL');
                if (this.activeRepos.includes('ALL')) {
                    this.collapsed = !this.collapsed;
                }
            } else {
            newSet.delete('ALL');
            if (active) newSet.add(id);
            else newSet.delete(id);
            if (newSet.size === 0) newSet.add('ALL');
        }

        this.dispatchEvent(new CustomEvent('repo-filter-changed', {
            detail: { activeRepos: Array.from(newSet) },
            bubbles: true,
            composed: true
        }));
    }
    render() {
        const activeRepoSet = new Set(this.activeRepos);
        const visibleRepos = this.repos || [];
        const visibleExtra = this.extraRepos || [];

        return html`
            <div class="wrap">
                ${this.label ? html`<span class="label">${this.label}</span>` : ''}

                <div @yenvui-pill-toggled=${this._handleRepoToggle} style="display: contents;">
                    <yenvui-pill pillId="ALL" labelText="All" ?active=${activeRepoSet.has('ALL')}></yenvui-pill>
                    ${visibleExtra.map(ex => html`
                        <yenvui-pill pillId=${ex.id} labelText=${ex.label} ?active=${activeRepoSet.has(ex.id)}></yenvui-pill>
                    `)}
                    ${visibleRepos.map(repo => html`
                        <yenvui-pill pillId=${repo} labelText=${repo} ?active=${activeRepoSet.has(repo)}></yenvui-pill>
                    `)}
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-repo-filter', InSetuRepoFilter);