import{LitElement as c,html as l,css as d}from"lit";import{YenvuiGestureController as h}from"./physics.js";let n=null;const s=new Set;function u(t){s.add(t),t.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark"),n||(n=new MutationObserver(()=>{const e=document.body.getAttribute("data-theme")||"dark";s.forEach(i=>i.setAttribute("data-theme",e))}),n.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]}))}function b(t){s.delete(t)}export class YenvuiBase extends c{connectedCallback(){super.connectedCallback(),u(this)}disconnectedCallback(){super.disconnectedCallback(),b(this),this._managedListeners&&(this._managedListeners.forEach(e=>e.target.removeEventListener(e.type,e.listener)),this._managedListeners=[])}updated(e){super.updated(e)}registerOutsideClick(e){const i=r=>{r.composedPath().includes(this)||e(r)};document.addEventListener("click",i),this._managedListeners||(this._managedListeners=[]),this._managedListeners.push({type:"click",target:document,listener:i})}}export class YenvuiScrubTrack extends YenvuiBase{static styles=d`
        :host { 
            display: block; 
            width: 100%; 
            overflow: hidden; 
            touch-action: pan-x;
        }
        .scrub-container {
            display: flex;
            align-items: center;
            width: 100%;
            height: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            overscroll-behavior: none;
            touch-action: pan-x;
            scrollbar-width: none;
            white-space: nowrap;
            cursor: grab;
            box-sizing: border-box;
        }
        .scrub-container::-webkit-scrollbar { display: none; }
        .scrub-container:active { cursor: grabbing; }
    `;constructor(){super(),this._isSwiping=!1,this._rafId=null,this._containerNode=null,this._gestureController=new h(this,{onPanStart:()=>{const e=this._getContainer();e&&(this._startScroll=e.scrollLeft,this._isSwiping=!1,this._rafId&&cancelAnimationFrame(this._rafId))},onPanMove:(e,i,r)=>{if(r==="horizontal"){const a=e-this._gestureController.startX;Math.abs(a)>5&&(this._isSwiping=!0),this._rafId&&cancelAnimationFrame(this._rafId),this._rafId=requestAnimationFrame(()=>{const o=this._getContainer();o&&(o.scrollLeft=this._startScroll-a)})}},onPanEnd:()=>{this._rafId&&cancelAnimationFrame(this._rafId)}})}_getContainer(){return this._containerNode||(this._containerNode=this.shadowRoot.querySelector(".scrub-container")),this._containerNode}disconnectedCallback(){super.disconnectedCallback(),this._rafId&&cancelAnimationFrame(this._rafId),this._gestureController&&this._gestureController.active&&this._gestureController._handlePointerUp(new Event("pointerup"))}render(){return l`
            <div class="scrub-container" 
                @pointerdown=${e=>this._gestureController.start(e,{lockAxis:"horizontal"})}
                @click=${e=>{this._isSwiping&&(e.stopPropagation(),e.preventDefault(),this._isSwiping=!1)}}>
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-scrub-track",YenvuiScrubTrack);
