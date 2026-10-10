import{html as i,css as d}from"lit";import{YenvuiBase as n}from"./yenvui-base.js";export class YenvuiScrollView extends n{static properties={padding:{type:String}};static styles=d`
        :host {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            box-sizing: border-box;
            padding: var(--scroll-padding, 0 12px);
            --mobile-edge-padding: 0px;
            --content-padding-x: 12px;
        }
        :host([padding="none"]) {
            padding: 0 !important;
        }
        @container (max-width: 480px) {
            :host {
                --content-padding-x: 0px;
            }
            :host(:not([padding="none"])) {
                padding: 0 !important;
                --mobile-edge-padding: 20px;
            }
        }
    `;constructor(){super(),this.padding="0 12px"}updated(t){super.updated(t),t.has("padding")&&this.padding&&this.padding!=="none"&&this.style.setProperty("--scroll-padding",this.padding)}render(){return i`<slot></slot>`}}customElements.define("yenvui-scroll-view",YenvuiScrollView);
