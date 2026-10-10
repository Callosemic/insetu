import{LitElement as a,html as o,css as c}from"lit";import{YenvuiGestureController as l}from"./physics.js";export class YenvuiBase extends a{connectedCallback(){super.connectedCallback()}disconnectedCallback(){super.disconnectedCallback(),this._managedListeners&&(this._managedListeners.forEach(e=>e.target.removeEventListener(e.type,e.listener)),this._managedListeners=[])}updated(e){super.updated(e)}registerOutsideClick(e){const i=t=>{t.composedPath().includes(this)||e(t)};document.addEventListener("click",i),this._managedListeners||(this._managedListeners=[]),this._managedListeners.push({type:"click",target:document,listener:i})}}export class YenvuiScrubTrack extends YenvuiBase{static styles=c`
        :host { 
            display: block; 
            width: 100%; 
            overflow: hidden; 
            touch-action: pan-x pan-y;
        }
        .scrub-container {
            display: flex;
            align-items: center;
            width: 100%;
            height: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            overscroll-behavior-x: none;
            touch-action: pan-x pan-y;
            scrollbar-width: none;
            white-space: nowrap;
            cursor: grab;
            box-sizing: border-box;
        }
        .scrub-container::-webkit-scrollbar { display: none; }
        .scrub-container:active { cursor: grabbing; }
    `;constructor(){super(),this._isSwiping=!1,this._rafId=null,this._containerNode=null,this._gestureController=new l(this,{onPanStart:()=>{const e=this._getContainer();e&&(this._startScroll=e.scrollLeft,this._isSwiping=!1,this._rafId&&cancelAnimationFrame(this._rafId))},onPanMove:(e,i,t)=>{if(t==="horizontal"){const n=e-this._gestureController.startX;Math.abs(n)>5&&(this._isSwiping=!0),this._rafId&&cancelAnimationFrame(this._rafId),this._rafId=requestAnimationFrame(()=>{const r=this._getContainer();r&&(r.scrollLeft=this._startScroll-n)})}},onPanEnd:()=>{this._rafId&&cancelAnimationFrame(this._rafId)}})}_getContainer(){return this._containerNode||(this._containerNode=this.shadowRoot.querySelector(".scrub-container")),this._containerNode}disconnectedCallback(){super.disconnectedCallback(),this._rafId&&cancelAnimationFrame(this._rafId),this._gestureController&&this._gestureController.active&&this._gestureController._handlePointerUp(new Event("pointerup"))}render(){return o`
            <div class="scrub-container" 
                @pointerdown=${e=>this._gestureController.start(e,{lockAxis:"horizontal"})}
                @click=${e=>{this._isSwiping&&(e.stopPropagation(),e.preventDefault(),this._isSwiping=!1)}}>
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-scrub-track",YenvuiScrubTrack);
