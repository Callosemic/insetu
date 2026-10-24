import{LitElement as o,html as a,css as c}from"lit";import{YenvuiGestureController as l,getEventPath as h,startKineticThrow as d}from"./physics.js";export class YenvuiBase extends o{connectedCallback(){super.connectedCallback()}disconnectedCallback(){super.disconnectedCallback(),this._managedListeners&&(this._managedListeners.forEach(t=>t.target.removeEventListener(t.type,t.listener)),this._managedListeners=[])}updated(t){super.updated(t)}registerOutsideClick(t){const i=e=>{h(e).includes(this)||t(e)};document.addEventListener("click",i),this._managedListeners||(this._managedListeners=[]),this._managedListeners.push({type:"click",target:document,listener:i})}}export class YenvuiScrubTrack extends YenvuiBase{static styles=c`
        :host { 
            display: block; 
            width: 100%; 
            overflow: hidden; 
            touch-action: pan-y;
            overscroll-behavior-x: none;
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
    `;constructor(){super(),this._isSwiping=!1,this._rafId=null,this._cancelMomentum=null,this._velocitySamples=[],this._containerNode=null,this._gestureController=new l(this,{onPanStart:(t,i)=>{this._cancelMomentum&&(this._cancelMomentum(),this._cancelMomentum=null);const e=this._getContainer();e&&(this._startScroll=e.scrollLeft,this._isSwiping=!1,this._velocitySamples=[{x:t,y:i,t:performance.now()}],this._rafId&&cancelAnimationFrame(this._rafId))},onPanMove:(t,i,e)=>{if(e==="horizontal"){const n=t-this._gestureController.startX;Math.abs(n)>5&&(this._isSwiping=!0),this._velocitySamples.push({x:t,y:i,t:performance.now()}),this._velocitySamples.length>6&&this._velocitySamples.shift(),this._rafId&&cancelAnimationFrame(this._rafId),this._rafId=requestAnimationFrame(()=>{const s=this._getContainer();s&&(s.scrollLeft=this._startScroll-n)})}},onPanEnd:(t,i,e)=>{if(this._rafId&&cancelAnimationFrame(this._rafId),e==="horizontal"){const n=this._getContainer();n&&this._velocitySamples.length>=2&&(this._cancelMomentum=d(n,this._velocitySamples,{axis:"x"}))}this._velocitySamples=[]}})}_getContainer(){return this._containerNode||(this._containerNode=this.shadowRoot.querySelector(".scrub-container")),this._containerNode}disconnectedCallback(){super.disconnectedCallback(),this._rafId&&cancelAnimationFrame(this._rafId),this._cancelMomentum&&(this._cancelMomentum(),this._cancelMomentum=null),this._gestureController&&this._gestureController.active&&this._gestureController._handlePointerUp(new Event("pointerup"))}render(){return a`
            <div class="scrub-container" 
                @pointerdown=${t=>this._gestureController.start(t,{lockAxis:"horizontal"})}
                @click=${t=>{this._isSwiping&&(t.stopPropagation(),t.preventDefault(),this._isSwiping=!1)}}>
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-scrub-track",YenvuiScrubTrack);
