import{LitElement as r,html as a,css as c}from"lit";import{YenvuiGestureController as l,getEventPath as h,startKineticThrow as d}from"./physics.js";export class YenvuiBase extends r{connectedCallback(){super.connectedCallback()}disconnectedCallback(){super.disconnectedCallback(),this._managedListeners&&(this._managedListeners.forEach(e=>e.target.removeEventListener(e.type,e.listener)),this._managedListeners=[])}updated(e){super.updated(e)}registerOutsideClick(e){const i=t=>{h(t).includes(this)||e(t)};document.addEventListener("click",i),this._managedListeners||(this._managedListeners=[]),this._managedListeners.push({type:"click",target:document,listener:i})}}export class YenvuiScrubTrack extends YenvuiBase{static properties={grow:{type:Boolean,reflect:!0},monospace:{type:Boolean,reflect:!0}};static styles=c`
        :host { 
            display: block; 
            width: 100%; 
            overflow: hidden; 
            touch-action: pan-y;
            overscroll-behavior-x: none;
        }
        :host([grow]) {
            flex: 1 1 0%;
            min-width: 0;
        }
        :host([monospace]) {
            font-family: var(--font-mono, monospace);
            font-size: 0.85rem;
        }
        .scrub-container {
            display: flex;
            align-items: center;
            width: 100%;
            height: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            overscroll-behavior-x: none;
            touch-action: pan-y;
            scrollbar-width: none;
            white-space: nowrap;
            cursor: grab;
            box-sizing: border-box;
        }
        .scrub-container::-webkit-scrollbar { display: none; }
        .scrub-container:active { cursor: grabbing; }
    `;constructor(){super(),this.grow=!1,this.monospace=!1,this._isSwiping=!1,this._rafId=null,this._cancelMomentum=null,this._velocitySamples=[],this._containerNode=null,this._gestureController=new l(this,{onPanStart:(e,i)=>{this._cancelMomentum&&(this._cancelMomentum(),this._cancelMomentum=null);const t=this._getContainer();t&&(this._startScroll=t.scrollLeft,this._isSwiping=!1,this._velocitySamples=[{x:e,y:i,t:performance.now()}],this._rafId&&cancelAnimationFrame(this._rafId))},onPanMove:(e,i,t)=>{if(t==="horizontal"){const n=e-this._gestureController.startX;Math.abs(n)>5&&(this._isSwiping=!0),this._velocitySamples.push({x:e,y:i,t:performance.now()}),this._velocitySamples.length>6&&this._velocitySamples.shift(),this._rafId&&cancelAnimationFrame(this._rafId),this._rafId=requestAnimationFrame(()=>{const s=this._getContainer();s&&(s.scrollLeft=this._startScroll-n)})}},onPanEnd:(e,i,t)=>{if(this._rafId&&cancelAnimationFrame(this._rafId),t==="horizontal"){const n=this._getContainer();n&&this._velocitySamples.length>=2&&(this._cancelMomentum=d(n,this._velocitySamples,{axis:"x"}))}this._velocitySamples=[]}})}_getContainer(){return this._containerNode||(this._containerNode=this.shadowRoot.querySelector(".scrub-container")),this._containerNode}disconnectedCallback(){super.disconnectedCallback(),this._rafId&&cancelAnimationFrame(this._rafId),this._cancelMomentum&&(this._cancelMomentum(),this._cancelMomentum=null),this._gestureController&&this._gestureController.active&&this._gestureController._handlePointerUp(new Event("pointerup"))}render(){return a`
            <div class="scrub-container" 
                @pointerdown=${e=>this._gestureController.start(e,{lockAxis:"horizontal"})}
                @click=${e=>{this._isSwiping&&(e.stopPropagation(),e.preventDefault(),this._isSwiping=!1)}}>
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-scrub-track",YenvuiScrubTrack);
