import{html as o,css as r}from"lit";import{YenvuiBase as n}from"./yenvui-base.js";import{BAND_QUERY as e}from"./physics.js";export class YenvuiCollapsible extends n{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},intent:{type:String},compact:{type:Boolean,reflect:!0},flush:{type:Boolean,reflect:!0}};static styles=r`
        :host {
            display: block;
            margin-bottom: 0;
        }
        :host([open]) {
            margin-bottom: 8px;
        }
        .header {
            background: var(--collapsible-header-bg, var(--input-bg));
            padding: 10px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            user-select: none;
            transition: background 0.2s ease, border-color 0.2s ease;
            border: 1px solid var(--border);
            border-bottom: none;
            border-left: 4px solid var(--intent-color, var(--intent-primary));
            border-radius: 0;
            margin: 0;
            box-sizing: border-box;
        }
        :host(:first-child) .header {
            border-top-left-radius: 6px;
            border-top-right-radius: 6px;
        }
        :host(:last-child:not([open])) .header {
            border-bottom: 1px solid var(--border);
            border-bottom-left-radius: 6px;
            border-bottom-right-radius: 6px;
        }
        .header:hover {
            background: var(--bg-hover);
        }
        :host([open]) .header {
            background: color-mix(in srgb, var(--intent-color, var(--intent-primary)) var(--header-bg-mix, 10%), var(--input-bg));
            border-bottom: 1px solid var(--border);
            border-color: var(--border);
            border-left-color: var(--intent-color, var(--intent-primary));
            border-bottom-left-radius: 6px;
            border-bottom-right-radius: 6px;
            margin-bottom: 12px;
        }
        :host([flush]) .header {
            border-radius: 0;
            border-left: none;
            border-right: none;
            margin: 0;
        }
        :host([flush]:last-child:not([open])) .header {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
        }
        :host([flush][open]) .header {
            border-bottom-left-radius: 0;
            border-bottom-right-radius: 0;
            margin-bottom: 12px;
        }
        .title {
            font-weight: var(--title-weight, 700);
            font-size: var(--title-size, 0.85rem);
            font-family: var(--font-mono);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text);
            min-width: 0;
            flex: 1 1 0%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        :host([compact]) .header {
            padding: 6px 10px;
            border-radius: 6px;
            border-bottom: 1px solid var(--border);
        }
        :host([compact][open]) .header {
            margin-bottom: 6px;
        }
        :host([compact]) .title {
            font-size: 0.76rem;
            text-transform: none;
            letter-spacing: 0.01em;
        }
        :host([compact][open]) .content {
            padding: 0 0 6px 0;
        }

        /* Semantic Intent Accents */
        :host([intent="primary"]) { --intent-color: var(--intent-primary); }
        :host([intent="success"]) { --intent-color: var(--intent-success); }
        :host([intent="highlight"]) { --intent-color: var(--intent-highlight); }
        :host([intent="warning"]) { --intent-color: var(--intent-warning); }
        :host([intent="danger"]) { --intent-color: var(--intent-danger); }
        :host([intent="neutral"]) { --intent-color: var(--intent-neutral); }

        .chevron {
            color: var(--text-muted);
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            align-items: center;
        }

        :host([open]) .chevron {
            transform: rotate(180deg);
            color: var(--text);
        }
        .content {
            display: none;
            background: transparent;
        }
        :host([open]) .content {
            display: flex;
            flex-direction: column;
            padding: 0 0 12px 0;
            content-visibility: auto;
            contain-intrinsic-size: auto 180px;
        }

        :host([flush]) .content {
            padding: 0;
        }
        @container ${e.compact} {
            :host { margin-bottom: 0 !important; }
            .header, :host(:first-child) .header, :host(:last-child:not([open])) .header, :host([open]) .header {
                margin: 0 !important;
                border-radius: 0 !important;
                border-left: 4px solid var(--intent-color, var(--intent-primary)) !important;
                border-right: none !important;
                border-top: none !important;
                border-bottom: 1px solid var(--border) !important;
            }
            :host([open]) .header, :host([flush][open]) .header {
                margin-bottom: 12px !important;
            }
            :host([compact][open]) .header {
                margin-bottom: 6px !important;
            }
            :host([open]) .content { padding: 0 0 12px 0 !important; }
            :host([compact][open]) .content { padding: 0 0 6px 0 !important; }
        }
        /* High Contrast Theme Hooks */
        :host([data-theme="e-ink"]) .header {
            border: 2px solid #000000;
            border-bottom: none;
            background: var(--pane-bg);
        }
        :host([data-theme="e-ink"]:last-child:not([open])) .header {
            border-bottom: 2px solid #000000;
        }
        :host([data-theme="e-ink"][open]) .header {
            border-bottom: 2px solid #000000;
        }
        @container ${e.compact} {
            :host([data-theme="e-ink"]) .header,
            :host([data-theme="e-ink"]:first-child) .header,
            :host([data-theme="e-ink"]:last-child:not([open])) .header,
            :host([data-theme="e-ink"][open]) .header {
                border-left: none !important;
                border-right: none !important;
                border-top: none !important;
                border-bottom: 2px dotted #000000 !important;
            }
        }
    `;constructor(){super(),this.open=!0,this.intent="neutral",this.compact=!1,this.flush=!1}render(){return o`
            <div class="header" @click=${t=>{t.stopPropagation(),this.open=!this.open,this.dispatchEvent(new CustomEvent("yenvui-collapsible-toggled",{detail:{open:this.open},bubbles:!1,composed:!1}))}}>
                <span class="title intent-${this.intent}">${this.titleText}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <slot name="actions" @click=${t=>t.stopPropagation()}></slot>
                    <span class="chevron">
                        <yenvui-icon name="chevron-down" size="md"></yenvui-icon>
                    </span>
                </div>
            </div>
            <div class="content">
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-collapsible",YenvuiCollapsible);
