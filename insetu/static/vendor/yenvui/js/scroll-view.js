import{html as n,css as t}from"lit";import{YenvuiBase as e}from"./yenvui-base.js";export class YenvuiScrollView extends e{static properties={padding:{type:String}};static styles=t`
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
    `;constructor(){super(),this.padding="0 12px"}updated(i){super.updated(i),i.has("padding")&&this.padding&&this.padding!=="none"&&this.style.setProperty("--scroll-padding",this.padding)}render(){return n`<slot></slot>`}}customElements.define("yenvui-scroll-view",YenvuiScrollView);
