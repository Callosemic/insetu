import{html as e,css as n}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";export class YenvuiCollapsible extends r{static properties={titleText:{type:String},open:{type:Boolean,reflect:!0},intent:{type:String},flush:{type:Boolean,reflect:!0}};static styles=n`
        :host {
            display: block;
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
            border-left: 4px solid var(--intent-color, var(--intent-primary));
            border-radius: 6px;
            margin: 0;
            box-sizing: border-box;
        }
        .header:hover {
            background: var(--bg-hover);
        }
        :host([open]) .header {
            background: color-mix(in srgb, var(--intent-color, var(--intent-primary)) var(--header-bg-mix, 10%), var(--input-bg));
            border-color: var(--border);
            border-left-color: var(--intent-color, var(--intent-primary));
            margin-bottom: 12px;
        }
        :host([flush]) .header {
            border-radius: 0;
            border-left: none;
            border-right: none;
            margin: 0;
        }
        :host([flush][open]) .header {
            margin-bottom: 12px;
        }
        .title {
            font-weight: var(--title-weight, 700);
            font-size: var(--title-size, 0.85rem);
            font-family: var(--font-mono);
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text);
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
        }

        :host([flush]) .content {
            padding: 0;
        }
        @container (max-width: 480px) {
            :host { margin-bottom: 0; }
            .header {
                margin: 0;
                border-radius: 0;
                border-left: 4px solid var(--intent-color, var(--intent-primary));
                border-right: none;
                border-top: none;
                border-bottom: 1px solid var(--border);
            }
            :host([open]) .header, :host([flush][open]) .header {
                margin-bottom: 12px;
            }
            :host([open]) .content { padding: 0 0 12px 0; }
        }

        /* High Contrast Theme Hooks */
        :host([data-theme="e-ink"]) .header {
            border: 2px solid #000000;
            background: var(--pane-bg);
        }
        @container (max-width: 480px) {
            :host([data-theme="e-ink"]) .header {
                border-left: none;
                border-right: none;
                border-top: none;
                border-bottom: 2px dotted #000000;
            }
        }
    `;constructor(){super(),this.open=!0,this.intent="neutral",this.flush=!1}render(){return e`
            <div class="header" @click=${t=>{t.stopPropagation(),this.open=!this.open,this.dispatchEvent(new CustomEvent("yenvui-collapsible-toggled",{detail:{open:this.open},bubbles:!0,composed:!0}))}}>
                <span class="title intent-${this.intent}">${this.titleText}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <slot name="actions" @click=${t=>t.stopPropagation()}></slot>
                    <span class="chevron">
                        <yv-icon name="chevron-down" style="width: 16px; height: 16px;"></yv-icon>
                    </span>
                </div>
            </div>
            <div class="content">
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-collapsible",YenvuiCollapsible);
