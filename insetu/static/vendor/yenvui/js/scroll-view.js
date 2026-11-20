import{html as o,css as d}from"lit";import{YenvuiBase as n}from"./yenvui-base.js";import{BAND_QUERY as t}from"./physics.js";export class YenvuiScrollView extends n{static properties={padding:{type:String,reflect:!0}};static styles=d`
        :host {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            overflow-x: hidden;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            box-sizing: border-box;
            padding: var(--scroll-padding, 0 12px);
            --mobile-edge-padding: 0px;
            --content-padding-x: 12px;
        }
        :host([padding="none"]) { padding: 0 !important; }
        :host([padding="xs"]) { --scroll-padding: 4px 8px; }
        :host([padding="compact"]),
        :host([padding="sm"]) { --scroll-padding: 8px 12px; }
        :host([padding="normal"]),
        :host([padding="md"]) { --scroll-padding: 12px 16px; }
        :host([padding="wide"]),
        :host([padding="lg"]) { --scroll-padding: 16px 20px; }
        @container ${t.compact} {
            :host {
                --content-padding-x: 0px;
            }
            :host(:not([padding="none"])) {
                padding: 0 !important;
                --mobile-edge-padding: 20px;
            }
        }
    `;constructor(){super(),this.padding="compact"}render(){return o`<slot></slot>`}}customElements.define("yenvui-scroll-view",YenvuiScrollView);
