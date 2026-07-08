import { LitElement, html, css } from 'lit';
import { sharedStyles } from '../shared_styles.js';
export class InSetuFilterPill extends LitElement {
    static properties = {
        pillId: { type: String },
        labelText: { type: String },
        active: { type: Boolean },
        small: { type: Boolean },
        variant: { type: String } // 'standard' or 'text'
    };
static styles = [
        sharedStyles,
        css`
            button {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.75rem;
                border: 1px solid var(--border);
                cursor: pointer;
                font-weight: bold;
                margin: 0;
                transition: background 0.2s, color 0.2s, border-color 0.2s;
            }
            button.small {
                padding: 2px 6px;
                font-size: 0.7rem;
            }

            /* Standard Variant (Repos/Tags) */
            button.variant-standard.active {
                background: var(--btn);
                color: #fff;
            }
            button.variant-standard.inactive {
                background: transparent;
                color: var(--text);
            }
            /* Text Variant (Sub-buckets) */
            button.variant-text {
                background: transparent;
                font-weight: normal;
                border-radius: 0;
                border-left: none;
                border-right: none;
                border-top: 1px solid transparent;
                border-bottom: 1px solid transparent;
            }
            button.variant-text.inactive {
                color: var(--text-muted);
            }
            button.variant-text.inactive:hover {
                color: var(--text);
            }
            button.variant-text.active {
                border-top: 1px solid var(--text);
                border-bottom: 1px solid var(--text);
                color: var(--text);
                font-weight: bold;
                background: transparent;
            }

            /* E-Ink overrides */
            :host-context([data-theme="e-ink"]) button.variant-standard.active {
                background: #000000 !important;
                color: #ffffff !important;
                border: 2px solid #000000 !important;
                box-shadow: 3px 3px 0 #9ca3af !important;
            }
            :host-context([data-theme="e-ink"]) button.variant-text.active {
                border-top: 2px solid #000000 !important;
                border-bottom: 2px solid #000000 !important;
                border-left: none !important;
                border-right: none !important;
            }
        `
    ];

    constructor() {
        super();
        this.variant = 'standard';
    }

    render() {
        return html`
            <button 
                class="${this.active ? 'active' : 'inactive'} ${this.small ? 'small' : ''} variant-${this.variant}"
                @click=${this._onClick}>
                ${this.labelText}
            </button>
        `;
    }

    _onClick(e) {
        this.dispatchEvent(new CustomEvent('pill-toggled', {
            detail: { id: this.pillId, active: !this.active },
            bubbles: true,
            composed: true
        }));
    }
}
export class InSetuFilterGroup extends LitElement {
    static properties = {
        label: { type: String },
        items: { type: Array }, // [{id, label}]
        activeItems: { type: Array },
        allowAll: { type: Boolean },
        collapsed: { type: Boolean }
    };

    static styles = [
        sharedStyles,
        css`
            .wrap { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
            .label { font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap; cursor: pointer; user-select: none; }
            .label:hover { opacity: 1; }
        `
    ];

    constructor() {
        super();
        this.collapsed = true;
    }

    _handleToggle(e) {
        const { id, active } = e.detail;
        let newSet = new Set(this.activeItems);
        
        if (this.allowAll && id === 'ALL') {
            newSet.clear();
            newSet.add('ALL');
        } else {
            newSet.delete('ALL');
            if (active) newSet.add(id);
            else newSet.delete(id);
            if (newSet.size === 0 && this.allowAll) newSet.add('ALL');
        }
        
        this.dispatchEvent(new CustomEvent('filter-changed', {
            detail: { activeItems: Array.from(newSet) },
            bubbles: true,
            composed: true
        }));
    }
    render() {
        const activeSet = new Set(this.activeItems);

        const visibleItems = this.collapsed 
            ? (this.items || []).filter(item => activeSet.has(item.id)) 
            : (this.items || []);

        const showAllPill = this.allowAll && (!this.collapsed || activeSet.has('ALL'));

        return html`
            <div class="wrap" @pill-toggled=${this._handleToggle}>
                ${this.label ?
html`<span class="label" @click=${() => this.collapsed = !this.collapsed} title="Toggle expand/collapse">${this.label} ${this.collapsed ? '▸' : '▾'}</span>` : ''}
                ${showAllPill ?
html`<insetu-filter-pill pillId="ALL" labelText="All" ?active=${activeSet.has('ALL')}></insetu-filter-pill>` : ''}
                ${visibleItems.map(item => html`
                    <insetu-filter-pill 
                        pillId=${item.id} 
                        labelText=${item.label} 
                        ?active=${activeSet.has(item.id)}>
                    </insetu-filter-pill>
                `)}
            </div>
        `;
    }
}
export class InSetuRepoFilter extends LitElement {
    static properties = {
        label: { type: String },
        repos: { type: Array },
        activeRepos: { type: Array },
        extraRepos: { type: Array },
        enableBuckets: { type: Boolean },
        activeBuckets: { type: Array },
        getBucketsFn: { type: Object }, // Function passed as property
        collapsed: { type: Boolean }
    };

    static styles = [
        sharedStyles,
        css`
            .wrap { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
            .label { font-size: 0.85rem; font-weight: bold; color: var(--text); opacity: 0.8; margin-right: 5px; white-space: nowrap; cursor: pointer; user-select: none; }
            .label:hover { opacity: 1; }
            .bucket-wrap { display: contents; }
            .bucket-icon { font-size: 0.85rem; color: var(--text-muted); opacity: 0.7; font-weight: bold; margin-left: 2px; margin-right: 2px; }
        `
    ];

    constructor() {
        super();
        this.collapsed = true;
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

    _handleBucketToggle(e, repo) {
        e.stopPropagation();
        const { id, active } = e.detail;
        let newSet = new Set(this.activeBuckets);
        
        if (id === 'ALL') {
            newSet.clear();
            newSet.add('ALL');
        } else {
            newSet.delete('ALL');
            if (active) newSet.add(id);
            else newSet.delete(id);
            if (newSet.size === 0) newSet.add('ALL');
        }
        
        this.dispatchEvent(new CustomEvent('bucket-filter-changed', {
            detail: { activeBuckets: Array.from(newSet), repo: repo },
            bubbles: true,
            composed: true
        }));
    }
    render() {
        const activeRepoSet = new Set(this.activeRepos);
        const activeBucketSet = new Set(this.activeBuckets);

        const visibleRepos = this.collapsed 
            ? (this.repos || []).filter(r => activeRepoSet.has(r))
            : (this.repos || []);

        const visibleExtra = this.collapsed
            ? (this.extraRepos || []).filter(ex => activeRepoSet.has(ex.id))
            : (this.extraRepos || []);

        const showAllRepoPill = !this.collapsed || activeRepoSet.has('ALL');

        return html`
            <div class="wrap">
                ${this.label ?
html`<span class="label" @click=${() => this.collapsed = !this.collapsed} title="Toggle expand/collapse">${this.label} ${this.collapsed ? '▸' : '▾'}</span>` : ''}

                <div @pill-toggled=${this._handleRepoToggle} style="display: contents;">
                    ${showAllRepoPill ? html`<insetu-filter-pill pillId="ALL" labelText="All" ?active=${activeRepoSet.has('ALL')}></insetu-filter-pill>` : ''}
                    ${visibleExtra.map(ex => html`
                        <insetu-filter-pill pillId=${ex.id} labelText=${ex.label} ?active=${activeRepoSet.has(ex.id)}></insetu-filter-pill>
                    `)}
                    ${visibleRepos.map(repo => html`
                        <span style="display: contents;">
                            <insetu-filter-pill pillId=${repo} labelText=${repo} ?active=${activeRepoSet.has(repo)}></insetu-filter-pill>
                            ${(this.enableBuckets && activeRepoSet.has(repo) && repo !== 'ALL') ? (() => {
                                const buckets = this.getBucketsFn ? this.getBucketsFn(repo) : [];
                                if (buckets.length === 0) return '';

                                return html`
                                    <span class="bucket-wrap" @pill-toggled=${(e) => this._handleBucketToggle(e, repo)}>
                                        <span class="bucket-icon">→</span>
                                        <insetu-filter-pill variant="text" pillId="ALL" labelText="All" ?active=${activeBucketSet.has('ALL')} ?small=${true}></insetu-filter-pill>
                                        ${buckets.map(b => html`
                                            <insetu-filter-pill variant="text" pillId=${b.id} labelText=${b.title} ?active=${activeBucketSet.has(b.id)} ?small=${true}></insetu-filter-pill>
                                        `)}
                                    </span>
                                `;
                            })() : ''}
                        </span>
                    `)}
                </div>
            </div>
        `;
    }
}

customElements.define('insetu-filter-pill', InSetuFilterPill);
customElements.define('insetu-filter-group', InSetuFilterGroup);
customElements.define('insetu-repo-filter', InSetuRepoFilter);