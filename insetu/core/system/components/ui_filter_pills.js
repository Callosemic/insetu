import { LitElement, html, css } from 'lit';
import { sharedStyles } from '/static/vendor/sutram/js/shared_styles.js';

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
    constructor() {
        super();
        this.label = 'Repos:';
        this.repos = [];
        this.activeRepos = ['ALL'];
        this.extraRepos = [];
    }

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
                ${this.label ? html`<span class="label" style="display: inline-flex; align-items: center; gap: 4px;"><yv-icon name="pin" style="width: 14px; height: 14px; color: var(--intent-primary);"></yv-icon>${this.label}</span>` : ''}

                <div @sutram-pill-toggled=${this._handleRepoToggle} style="display: contents;">
                    <sutram-pill pillId="ALL" labelText="All" ?active=${activeRepoSet.has('ALL')}></sutram-pill>
                    ${visibleExtra.map(ex => html`
                        <sutram-pill pillId=${ex.id} labelText=${ex.label} ?active=${activeRepoSet.has(ex.id)}></sutram-pill>
                    `)}
                    ${visibleRepos.map(repo => html`
                        <sutram-pill pillId=${repo} labelText=${repo} ?active=${activeRepoSet.has(repo)}></sutram-pill>
                    `)}
                </div>
            </div>
        `;
    }
}
customElements.define('insetu-repo-filter', InSetuRepoFilter);