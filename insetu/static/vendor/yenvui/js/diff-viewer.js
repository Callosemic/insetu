import{html as c,css as v}from"lit";import{YenvuiBase as x}from"./yenvui-base.js";import{BAND_QUERY as u,observeColumnBand as g}from"./physics.js";import{parseDiffPayload as b}from"./diff-utils.js";export class YenvuiDiffViewer extends x{static properties={diffText:{type:String},searchStr:{type:String},replaceStr:{type:String},searchLines:{type:Array},replaceLines:{type:Array},leftTitle:{type:String},rightTitle:{type:String},mode:{type:String,reflect:!0},wrap:{type:String},_columnBand:{type:Object,state:!0},activeLineIndex:{type:Number},_parsedData:{type:Object,state:!0}};static styles=v`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            width: 100%;
            min-width: 0;
            min-height: 0;
            background: var(--bg);
            box-sizing: border-box;
            container-type: inline-size;
            overflow: hidden;
        }

        .diff-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            background: var(--input-bg);
            border-bottom: 1px solid var(--border);
            font-family: var(--font-mono);
            font-size: 0.75rem;
            flex-shrink: 0;
            gap: 8px;
            min-width: 0;
        }

        .toolbar-label {
            font-weight: bold;
            color: var(--text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
        }

        .toolbar-controls {
            display: inline-flex;
            gap: 6px;
            flex-shrink: 0;
        }
        .mode-toggle-group {
            display: inline-flex;
            border: 1px solid var(--border);
            border-radius: 4px;
            overflow: hidden;
            flex-shrink: 0;
        }
        .mode-btn {
            background: transparent;
            color: var(--text-muted);
            border: none;
            border-right: 1px solid var(--border);
            padding: 4px 8px;
            font-size: 0.72rem;
            cursor: pointer;
            font-family: var(--font-mono);
            display: inline-flex;
            align-items: center;
            gap: 4px;
            transition: background 0.15s ease, color 0.15s ease;
        }

        .mode-text {
            display: inline;
        }

        @container ${u.compact} {
            .mode-text {
                display: none;
            }
            .mode-btn {
                padding: 4px 6px;
            }
        }

        .mode-btn:disabled {
            opacity: 0.4;
            cursor: default;
        }
        .mode-btn:last-child {
            border-right: none;
        }

        .mode-btn:hover {
            background: var(--bg-hover);
            color: var(--text);
        }

        .mode-btn.active {
            background: var(--intent-primary);
            color: var(--pane-bg);
            font-weight: bold;
        }

        .diff-viewport {
            display: flex;
            flex: 1;
            min-height: 0;
            min-width: 0;
            overflow: hidden;
            box-sizing: border-box;
        }

        .diff-split-container {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            min-width: 0;
            gap: 10px;
            padding: 10px;
            box-sizing: border-box;
            background: var(--bg);
        }

        @container ${u.mediumUp} {
            :host([mode="auto"]) .diff-split-container {
                flex-direction: row !important;
            }
        }

        :host([mode="split-side"]) .diff-split-container {
            flex-direction: row !important;
        }

        :host([mode="split-stacked"]) .diff-split-container {
            flex-direction: column !important;
        }

        .diff-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--input-bg);
            overflow: hidden;
        }

        .diff-pane-header {
            padding: 6px 12px;
            font-family: var(--font-mono);
            font-size: 0.75rem;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 1px solid var(--border);
            background: var(--bg-deep);
            color: var(--text-muted);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
            min-width: 0;
        }

        .diff-box {
            flex: 1;
            overflow: auto;
            font-family: var(--font-mono);
            font-size: 0.82rem;
            white-space: pre;
            min-width: 0;
            min-height: 0;
            overscroll-behavior: contain;
        }

        .diff-track {
            display: flex;
            flex-direction: column;
            min-width: max(100%, calc(var(--diff-min-char-width, 0ch) + 64px));
            width: max-content;
        }
        :host([wrapped]) .diff-box { white-space: pre-wrap; overflow-x: hidden; }
        :host([wrapped]) .diff-track { min-width: 0; width: 100%; }
        :host([wrapped]) .diff-line { height: auto; min-height: 1.45rem; align-items: flex-start; }
        :host([wrapped]) .line-text { min-width: 0; overflow-wrap: anywhere; }

        .diff-line {
            display: flex;
            align-items: baseline;
            padding: 0 10px;
            height: 1.45rem;
            line-height: 1.45rem;
            cursor: pointer;
            user-select: none;
            border-left: 3px solid transparent;
            box-sizing: border-box;
            width: 100%;
        }

        .diff-line:hover {
            background: var(--bg-hover);
        }

        .line-num {
            width: 38px;
            flex-shrink: 0;
            color: var(--text-muted);
            opacity: 0.55;
            text-align: right;
            padding-right: 10px;
            margin-right: 8px;
            border-right: 1px solid var(--border);
            user-select: none;
            box-sizing: border-box;
        }

        .line-marker {
            width: 16px;
            flex-shrink: 0;
            text-align: center;
            font-weight: bold;
            user-select: none;
            color: var(--text-muted);
        }
        .line-text {
            flex: 1;
            user-select: text;
        }

        .intraline-del {
            text-decoration-line: underline;
            text-decoration-style: wavy;
            text-decoration-color: var(--intent-danger);
            text-underline-offset: 3px;
            background: color-mix(in srgb, var(--intent-danger) 24%, transparent);
            border-radius: 2px;
        }

        .intraline-ins {
            text-decoration-line: underline;
            text-decoration-style: wavy;
            text-decoration-color: var(--intent-success);
            text-underline-offset: 3px;
            background: color-mix(in srgb, var(--intent-success) 24%, transparent);
            border-radius: 2px;
        }

        .diff-line.removed {
            background: color-mix(in srgb, var(--intent-danger) 12%, transparent);
            border-left-color: var(--intent-danger);
        }

        .diff-line.removed .line-marker {
            color: var(--intent-danger);
        }

        .diff-line.added {
            background: color-mix(in srgb, var(--intent-success) 12%, transparent);
            border-left-color: var(--intent-success);
        }

        .diff-line.added .line-marker {
            color: var(--intent-success);
        }

        .diff-line.active {
            background: color-mix(in srgb, var(--intent-highlight) 25%, transparent) !important;
            border-left-color: var(--intent-highlight) !important;
        }

        .diff-line.dummy {
            background: repeating-linear-gradient(
                45deg,
                transparent,
                transparent 5px,
                color-mix(in srgb, var(--border) 45%, transparent) 5px,
                color-mix(in srgb, var(--border) 45%, transparent) 10px
            );
            opacity: 0.5;
        }

        .diff-interleaved-pane {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 0;
            margin: 10px;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--input-bg);
            overflow: hidden;
        }

        :host-context([data-theme="e-ink"]) .diff-line.active {
            background: transparent !important;
            border-top: 2px dashed var(--border) !important;
            border-bottom: 2px dashed var(--border) !important;
            font-weight: 900;
        }

        :host-context([data-theme="e-ink"]) .diff-line.removed {
            background: transparent !important;
            border-left: 3px solid var(--border) !important;
            text-decoration: line-through;
        }

        :host-context([data-theme="e-ink"]) .diff-line.added {
            background: transparent !important;
            border-left: 3px solid var(--border) !important;
            font-weight: bold;
        }
        :host-context([data-theme="e-ink"]) .diff-line.dummy {
            background: transparent !important;
            border-bottom: 1px dotted var(--border);
        }
        :host-context([data-theme="e-ink"]) .intraline-del,
        :host-context([data-theme="e-ink"]) .intraline-ins {
            background: transparent !important;
            text-decoration-line: underline !important;
            text-decoration-style: wavy !important;
            text-decoration-color: var(--border) !important;
            font-weight: 900;
        }

        .diff-box {
            cursor: grab;
        }
        .diff-box.is-panning {
            cursor: grabbing;
            user-select: none;
        }
        .diff-line.hover-sync {
            background: color-mix(in srgb, var(--intent-highlight) 10%, transparent);
        }
        .ghost-caret-marker {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2px;
            height: 1.45rem;
            background: var(--intent-highlight);
            box-shadow: 0 0 8px var(--intent-highlight);
            pointer-events: none;
            z-index: 10;
            animation: pulse 1s infinite alternate;
        }
        @keyframes pulse {
            0% { opacity: 0.5; }
            100% { opacity: 1; }
        }
    `;constructor(){super(),this.diffText="",this.searchStr="",this.replaceStr="",this.searchLines=null,this.replaceLines=null,this.leftTitle="SEARCH (Expected / Original)",this.rightTitle="REPLACE (Actual / Modified)",this.mode="auto",this.wrap="auto",this._columnBand=null,this._scrolledToChangeKey=null,this.activeLineIndex=null,this._parsedData={split:{searchLines:[],replaceLines:[]},interleaved:[],maxChars:0},this._activeScrollSource=null,this._scrollReleaseTimer=null,this._hoveredLineIndex=null,this._activeCharCol=null,this._isDragging=!1,this._dragStartX=0,this._dragStartY=0,this._dragStartScrollLeft=0,this._dragStartScrollTop=0,this._dragSourceBox=null,this._historySamples=[],this._momentumRafId=null}connectedCallback(){super.connectedCallback(),this._stopBandObserver=g(this,e=>{this._columnBand=e})}disconnectedCallback(){super.disconnectedCallback(),this._stopBandObserver&&(this._stopBandObserver(),this._stopBandObserver=null),this._scrollReleaseTimer&&clearTimeout(this._scrollReleaseTimer),this._momentumRafId&&cancelAnimationFrame(this._momentumRafId)}_handlePointerDownPan(e,r){if(e.pointerType!=="mouse"||e.button!==0||e.target.classList.contains("line-text")&&window.getSelection().toString().length>0)return;const n=this.shadowRoot.getElementById(r);if(!n)return;this._momentumRafId&&(cancelAnimationFrame(this._momentumRafId),this._momentumRafId=null),this._isDragging=!1,this._dragSourceBox=n,this._dragStartX=e.clientX,this._dragStartY=e.clientY,this._dragStartScrollLeft=n.scrollLeft,this._dragStartScrollTop=n.scrollTop,this._historySamples=[{x:e.clientX,y:e.clientY,t:performance.now()}];const s=i=>{const l=i.clientX-this._dragStartX,a=i.clientY-this._dragStartY;if(!this._isDragging&&(Math.abs(l)>4||Math.abs(a)>4)&&(this._isDragging=!0,n.classList.add("is-panning")),this._isDragging){i.preventDefault(),this._claimScrollSource(r);const d=r==="box-a"?"box-b":"box-a",h=this.shadowRoot.getElementById(d),p=this._dragStartScrollLeft-l,m=this._dragStartScrollTop-a;n.scrollLeft=p,n.scrollTop=m,h&&(h.scrollLeft=p,h.scrollTop=m);const f=performance.now();this._historySamples.push({x:i.clientX,y:i.clientY,t:f}),this._historySamples.length>5&&this._historySamples.shift()}},t=i=>{if(window.removeEventListener("pointermove",s),window.removeEventListener("pointerup",t),window.removeEventListener("pointercancel",t),n.classList.remove("is-panning"),this._isDragging&&this._historySamples.length>=2){const l=performance.now(),a=this._historySamples.filter(d=>l-d.t<100);if(a.length>=2){const d=a[0],h=a[a.length-1],p=Math.max(10,h.t-d.t);let m=(h.x-d.x)/p,f=(h.y-d.y)/p;(Math.abs(m)>.15||Math.abs(f)>.15)&&this._executeThrow(r,m*16,f*16)}}};window.addEventListener("pointermove",s,{passive:!1}),window.addEventListener("pointerup",t),window.addEventListener("pointercancel",t)}_executeThrow(e,r,o){let n=r,s=o;const t=.94,i=e==="box-a"?"box-b":"box-a",l=()=>{if(n*=t,s*=t,Math.abs(n)<.2&&Math.abs(s)<.2){this._momentumRafId=null;return}const a=this.shadowRoot.getElementById(e),d=this.shadowRoot.getElementById(i);a&&(this._claimScrollSource(e),a.scrollLeft-=n,a.scrollTop-=s,d&&(d.scrollLeft=a.scrollLeft,d.scrollTop=a.scrollTop)),this._momentumRafId=requestAnimationFrame(l)};this._momentumRafId=requestAnimationFrame(l)}_handleLineHover(e,r){this._hoveredLineIndex=e;const o=r.currentTarget,n=o?o.querySelector(".line-text"):null;if(o&&n){const s=n.getBoundingClientRect(),t=Math.max(0,r.clientX-s.left);this._activeCharCol=Math.floor(t/8)}this.requestUpdate()}_clearLineHover(){this._hoveredLineIndex=null,this._activeCharCol=null,this.requestUpdate()}willUpdate(e){if(e.has("diffText")||e.has("searchStr")||e.has("replaceStr")||e.has("searchLines")||e.has("replaceLines"))if(Array.isArray(this.searchLines)&&Array.isArray(this.replaceLines)){let r=0;const o=(i,l)=>i.map((a,d)=>typeof a=="string"?{lineNumber:d+1,text:a,type:l,isDummy:!1,tokens:null}:a),n=o(this.searchLines,"removed"),s=o(this.replaceLines,"added"),t=[];n.forEach(i=>{(i.text||"").length>r&&(r=(i.text||"").length),i.isDummy||t.push({oldLineNumber:i.lineNumber,newLineNumber:null,text:i.text,type:i.type||"context",tokens:i.tokens})}),s.forEach(i=>{(i.text||"").length>r&&(r=(i.text||"").length),!i.isDummy&&i.type==="added"&&t.push({oldLineNumber:null,newLineNumber:i.lineNumber,text:i.text,type:"added",tokens:i.tokens})}),this._parsedData={split:{searchLines:n,replaceLines:s},interleaved:t,maxChars:r}}else this._parsedData=b({diffText:this.diffText,searchStr:this.searchStr,replaceStr:this.replaceStr})}_claimScrollSource(e){this._activeScrollSource=e,this._scrollReleaseTimer&&clearTimeout(this._scrollReleaseTimer),this._scrollReleaseTimer=setTimeout(()=>{this._activeScrollSource=null},160)}_handleScroll(e,r){if(this._activeScrollSource&&this._activeScrollSource!==e)return;this._claimScrollSource(e);const o=this.shadowRoot.getElementById(e),n=this.shadowRoot.getElementById(r);if(!o||!n)return;const s=o.scrollTop,t=o.scrollLeft;n.scrollTop!==s&&(n.scrollTop=s),n.scrollLeft!==t&&(n.scrollLeft=t)}_setActiveLine(e){this.activeLineIndex=this.activeLineIndex===e?null:e,this.dispatchEvent(new CustomEvent("yenvui-diff-line-selected",{detail:{index:this.activeLineIndex},bubbles:!0,composed:!0}))}_isSideBySide(){return this.mode==="split-side"||this.mode==="auto"&&(this._columnBand?.capability||1)>=2}_isWrapped(){return this._isSideBySide()?!1:this.wrap==="on"?!0:this.wrap==="off"?!1:(this._columnBand?.band||"narrow")==="narrow"}_toggleWrap(){this.wrap=this._isWrapped()?"off":"on",this.dispatchEvent(new CustomEvent("yenvui-diff-wrap-changed",{detail:{wrap:this.wrap},bubbles:!0,composed:!0}))}updated(e){super.updated?.(e),this.toggleAttribute("wrapped",this._isWrapped()),this._scrollUnifiedToFirstChange()}_scrollUnifiedToFirstChange(){if(this.mode!=="interleaved")return;const r=`${(this._parsedData?.interleaved||[]).length}:${this.diffText?.length||0}:${this.searchStr?.length||0}:${this.replaceStr?.length||0}`;if(this._scrolledToChangeKey===r)return;const o=this.shadowRoot?.getElementById("box-interleaved"),n=o?.querySelector(".diff-line.added, .diff-line.removed");!o||!n||(this._scrolledToChangeKey=r,o.scrollTop=Math.max(0,n.offsetTop-Math.round(o.clientHeight/3)))}_setMode(e){this.mode=e,this.dispatchEvent(new CustomEvent("yenvui-diff-mode-changed",{detail:{mode:e},bubbles:!0,composed:!0}))}_renderLineContent(e,r="context"){if(!e||e.isDummy)return" ";if(Array.isArray(e.tokens)&&e.tokens.length>0){const n=r==="removed"||e.type==="removed"?"intraline-del":"intraline-ins";return e.tokens.map(s=>s.changed?c`<span class="${n}">${s.text}</span>`:s.text)}return e.text||" "}render(){const{split:e,interleaved:r,maxChars:o}=this._parsedData,n=this.mode==="interleaved",s=`--diff-min-char-width: ${o||0}ch;`;return c`
            <div class="diff-toolbar">
                <span class="toolbar-label">
                    ${n?`${this.leftTitle} /${this.rightTitle} (Interleaved)`:`${this.leftTitle} \u27F7${this.rightTitle}`}
                </span>
                <div class="toolbar-controls">
                <div class="mode-toggle-group">
                    <button class="mode-btn ${this.mode==="auto"?"active":""}" @click=${()=>this._setMode("auto")} title="Responsive Container Split">
                        <yenvui-icon name="sparkles" size="xs"></yenvui-icon><span class="mode-text">Auto</span>
                    </button>
                    <button class="mode-btn ${this.mode==="split-side"?"active":""}" @click=${()=>this._setMode("split-side")} title="Side-by-Side Split">
                        <yenvui-icon name="columns" size="xs"></yenvui-icon><span class="mode-text">Side</span>
                    </button>
                    <button class="mode-btn ${this.mode==="split-stacked"?"active":""}" @click=${()=>this._setMode("split-stacked")} title="Top/Bottom Stacked Split">
                        <yenvui-icon name="rows" size="xs"></yenvui-icon><span class="mode-text">Stacked</span>
                    </button>
                    <button class="mode-btn ${this.mode==="interleaved"?"active":""}" @click=${()=>this._setMode("interleaved")} title="Interleaved Unified Lines">
                        <yenvui-icon name="align-justify" size="xs"></yenvui-icon><span class="mode-text">Unified</span>
                    </button>
                </div>
                <div class="mode-toggle-group">
                    <button class="mode-btn ${this._isWrapped()?"active":""}" ?disabled=${this._isSideBySide()} @click=${()=>this._toggleWrap()} title="Wrap long lines (not side by side)">
                        <yenvui-icon name="wrap-text" size="xs"></yenvui-icon><span class="mode-text">Wrap</span>
                    </button>
                </div>
                </div>
            </div>

            <div class="diff-viewport">
                ${n?c`
                    <div class="diff-interleaved-pane">
                        <div class="diff-pane-header">
                            <span>Unified Interleaved Stream</span>
                            <span>${r.length} lines</span>
                        </div>
                        <div class="diff-box" id="box-interleaved"
                            @pointerdown=${t=>this._handlePointerDownPan(t,"box-interleaved")}>
                            <div class="diff-track" style="${s}">
                                ${r.map((t,i)=>c`
                                    <div class="diff-line ${t.type||""} ${this.activeLineIndex===i?"active":""}"
                                        @pointerdown=${()=>this._setActiveLine(i)}>
                                        <span class="line-num">${t.oldLineNumber??""}</span>
                                        <span class="line-num">${t.newLineNumber??""}</span>
                                        <span class="line-marker">${t.type==="added"?"+":t.type==="removed"?"-":" "}</span>
                                        <span class="line-text">${this._renderLineContent(t,t.type)}</span>
                                    </div>
                                `)}
                            </div>
                        </div>
                    </div>
                `:c`
                    <div class="diff-split-container">
                        <div class="diff-pane">
                            <div class="diff-pane-header">
                                <span>${this.leftTitle}</span>
                                <span>${e.searchLines.filter(t=>!t.isDummy).length} lines</span>
                            </div>
                            <div class="diff-box" id="box-a"
                                @pointerdown=${t=>this._handlePointerDownPan(t,"box-a")}
                                @wheel=${()=>this._claimScrollSource("box-a")}
                                @scroll=${()=>this._handleScroll("box-a","box-b")}>
                                <div class="diff-track" style="${s}">
                                    ${e.searchLines.map((t,i)=>c`
                                        <div class="diff-line ${t.isDummy?"dummy":t.type||""} ${this.activeLineIndex===i?"active":""} ${this._hoveredLineIndex===i?"hover-sync":""}"
                                            @pointerdown=${()=>this._setActiveLine(i)}
                                            @pointerenter=${l=>this._handleLineHover(i,l)}
                                            @pointerleave=${()=>this._clearLineHover()}
                                            style="position: relative;">
                                            <span class="line-num">${t.lineNumber??""}</span>
                                            <span class="line-marker">${t.isDummy?"":t.type==="removed"?"-":" "}</span>
                                            <span class="line-text">${this._renderLineContent(t,"removed")}</span>${this._hoveredLineIndex===i&&this._activeCharCol!==null?c`
                                                <div class="ghost-caret-marker" style="left: ${72+this._activeCharCol*8}px;"></div>
                                            `:""}
                                        </div>
                                    `)}
                                </div>
                            </div>
                        </div>

                        <div class="diff-pane">
                            <div class="diff-pane-header">
                                <span>${this.rightTitle}</span>
                                <span>${e.replaceLines.filter(t=>!t.isDummy).length} lines</span>
                            </div>
                            <div class="diff-box" id="box-b"
                                @pointerdown=${t=>this._handlePointerDownPan(t,"box-b")}
                                @wheel=${()=>this._claimScrollSource("box-b")}
                                @scroll=${()=>this._handleScroll("box-b","box-a")}>
                                <div class="diff-track" style="${s}">
                                    ${e.replaceLines.map((t,i)=>c`
                                        <div class="diff-line ${t.isDummy?"dummy":t.type||""} ${this.activeLineIndex===i?"active":""} ${this._hoveredLineIndex===i?"hover-sync":""}"
                                            @pointerdown=${()=>this._setActiveLine(i)}
                                            @pointerenter=${l=>this._handleLineHover(i,l)}
                                            @pointerleave=${()=>this._clearLineHover()}
                                            style="position: relative;">
                                            <span class="line-num">${t.lineNumber??""}</span>
                                            <span class="line-marker">${t.isDummy?"":t.type==="added"?"+":" "}</span>
                                            <span class="line-text">${this._renderLineContent(t,"added")}</span>${this._hoveredLineIndex===i&&this._activeCharCol!==null?c`
                                                <div class="ghost-caret-marker" style="left: ${72+this._activeCharCol*8}px;"></div>
                                            `:""}
                                        </div>
                                    `)}
                                </div>
                            </div>
                        </div>
                    </div>
                `}
            </div>
        `}}customElements.define("yenvui-diff-viewer",YenvuiDiffViewer);
