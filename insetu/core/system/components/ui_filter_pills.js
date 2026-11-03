import { LitElement, html } from 'lit';
import { sharedStyles } from '/static/extensions/system/insetu_sdk.js';

export class InSetuRepoFilter extends LitElement {
    static properties = {
        label: { type: String },
        repos: { type: Array },
        activeRepos: { type: Array },
        extraRepos: { type: Array }
    };
    static styles = [sharedStyles];
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
            <sutram-stack direction="row" align="center" gap="xs" ?wrap=${true} @sutram-pill-toggled=${this._handleRepoToggle}>
                ${this.label ? html`
                    <sutram-stack direction="row" align="center" gap="xs">
                        <sutram-icon name="pin" size="sm" intent="primary"></sutram-icon>
                        <sutram-label .text=${this.label}></sutram-label>
                    </sutram-stack>
                ` : ''}
                <sutram-pill pillId="ALL" labelText="All" ?active=${activeRepoSet.has('ALL')}></sutram-pill>
                ${visibleExtra.map(ex => html`
                    <sutram-pill pillId=${ex.id} labelText=${ex.label} ?active=${activeRepoSet.has(ex.id)}></sutram-pill>
                `)}
                ${visibleRepos.map(repo => html`
                    <sutram-pill pillId=${repo} labelText=${repo} ?active=${activeRepoSet.has(repo)}></sutram-pill>
                `)}
            </sutram-stack>
        `;
    }
}
customElements.define('insetu-repo-filter', InSetuRepoFilter);