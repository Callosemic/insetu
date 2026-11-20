import { LitElement, html } from 'lit';
import { sharedStyles, toggleRepoInPinSet } from '/static/extensions/system/insetu_sdk.js';

/** Reusable repository filter pill strip emitting repo-filter-changed events. */
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
        const newSet = toggleRepoInPinSet(this.activeRepos, id, active);

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