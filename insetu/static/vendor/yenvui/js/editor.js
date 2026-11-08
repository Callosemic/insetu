import{LitElement as $,html as R,css as j}from"lit";const S=new Map;function B(h){const t=h.markdown(),e=Array.isArray(t.extensions)?t.extensions.filter(c=>{const n=String(c?.value||c||"");return!n.includes("htmlCompletion")&&!n.includes("closeTags")}):[];return h.LanguageSupport?new h.LanguageSupport(t.language,e):t.language}function T(h,t,e=void 0){return t==="python"?h.python():t==="json"?h.json():t==="javascript"||t==="js"?e?h.javascript(e):h.javascript():t==="jsx"?h.javascript({jsx:!0,...e||{}}):t==="typescript"||t==="ts"?h.javascript({typescript:!0,...e||{}}):t==="tsx"?h.javascript({jsx:!0,typescript:!0,...e||{}}):t==="yaml"||t==="yml"?h.yaml():t==="html"||t==="htm"||t==="htmlLang"?h.htmlLang():t==="css"||t==="cssLang"?h.cssLang():t==="markdown"||t==="md"?B(h):null}async function I(h,t=null){try{const e=await import("codemirror-core"),c=T(e,h);if(c!==null)return c;if(typeof t=="function")try{const n=await t(h);if(!n)return[];if(typeof n=="string"){const u=await import(n),d=u[h]||u.default;return typeof d=="function"?d():[]}if(typeof n=="object"){const u=n.kind||"lezer",d=n.export||h,f=n.options;if(u==="builtin"){const m=T(e,d,f);if(m!==null)return m;const y=e[d];return typeof y=="function"?f?y(f):y():[]}const v=n.url||n.path;if(!v)return[];const x=await import(v),g=x[d]??x[h]??x.default;if(u==="stream")return g&&e.StreamLanguage&&typeof e.StreamLanguage.define=="function"?e.StreamLanguage.define(g):[];if(typeof g=="function")return f?g(f):g()}}catch(n){console.warn(`[yenVUI] Language resolution failed for '${h}':`,n)}return[]}catch(e){return console.warn(`[yenVUI] Failed to dynamically load language: ${h}`,e),[]}}export function loadLanguageExtension(h,t=null){const e=String(h||"").trim().toLowerCase();if(!e||e==="plain"||e==="plaintext"||e==="text"||e==="txt")return Promise.resolve([]);if(t)return I(e,t);if(S.has(e))return S.get(e);const c=I(e,YenvuiEditor.languageResolver).then(n=>(Array.isArray(n)&&n.length===0&&S.delete(e),n));return S.set(e,c),c}export class YenvuiEditor extends ${static languageResolver=null;static properties={value:{type:String},readOnly:{type:Boolean},language:{type:String},writingMode:{type:Boolean},enableMarkdownLinks:{type:Boolean},customExtensions:{type:Array},languageResolver:{attribute:!1}};static styles=j`
        :host { 
            display: flex; 
            flex-direction: column; 
            flex: 1 1 0%; 
            min-height: 0; 
            min-width: 0;
            height: 100%; 
            width: 100%;
            overflow: hidden;
        }
        #cm-container {
            flex: 1 1 0%;
            display: flex;
            flex-direction: column;
            min-height: 0;
            min-width: 0;
            height: 100%;
            width: 100%;
            overflow: hidden;
        }
        .cm-editor { 
            flex: 1 1 0%;
            min-height: 0;
            min-width: 0;
            height: 100%; 
            width: 100%;
            overflow: hidden;
            background: transparent;
        }
        .cm-scroller { 
            flex: 1 1 0%;
            min-height: 0;
            height: 100%;
            overflow: auto !important; 
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            font-family: var(--font-mono, monospace); 
            font-variant-ligatures: none;
            font-feature-settings: "liga" 0, "calt" 0;
        }
        .cm-content, .cm-line {
            font-variant-ligatures: none !important;
            font-feature-settings: "liga" 0, "calt" 0 !important;
        }
        .cm-md-link-widget {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-left: 3px;
            padding: 0 5px;
            height: 1.15em;
            border-radius: 4px;
            background: color-mix(in srgb, var(--intent-highlight, #06b6d4) 18%, var(--input-bg, #0b0d14));
            border: 1px solid color-mix(in srgb, var(--intent-highlight, #06b6d4) 45%, var(--border, #334155));
            color: var(--intent-highlight, #06b6d4);
            font-family: var(--font-mono, monospace);
            font-size: 0.75em;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            user-select: none;
            vertical-align: baseline;
            transition: background 0.15s ease, transform 0.1s ease;
        }
        .cm-md-link-widget:hover {
            background: color-mix(in srgb, var(--intent-highlight, #06b6d4) 32%, var(--input-bg, #0b0d14));
            transform: translateY(-1px);
        }

        /* Legacy CodeMirror & Dialog Fallbacks */
        .CodeMirror-dialog {
            background: var(--input-bg) !important;
            color: var(--text) !important;
            border-bottom: 1px solid var(--border) !important;
            padding: 8px 10px !important;
        }
        .CodeMirror-dialog input {
            background: var(--bg) !important;
            color: var(--text) !important;
            border: 1px solid var(--border) !important;
            border-radius: 4px;
            padding: 4px 8px !important;
            font-family: var(--font-mono, monospace);
            outline: none;
        }
        .CodeMirror-dialog input:focus {
            border-color: var(--intent-primary) !important;
        }
        .CodeMirror-search-match { background: var(--intent-warning, #f59e0b); color: var(--bg-deep, #000000); }
        .CodeMirror-search-hint { color: var(--text-muted, #888888); font-style: italic; }

        .EasyMDEContainer { flex: 1; display: flex; flex-direction: column; min-height: 0; }
        .EasyMDEContainer .CodeMirror {
            background: var(--input-bg);
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 4px;
            font-family: var(--font-mono, monospace) !important;
            font-size: 13px;
            line-height: 1.5;
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        .EasyMDEContainer .CodeMirror-scroll { flex: 1; min-height: 100%; }
        .EasyMDEContainer .CodeMirror .cm-header-1 { font-size: 1.25em; line-height: 1.3; }
        .EasyMDEContainer .CodeMirror .cm-header-2 { font-size: 1.15em; line-height: 1.3; }
        .EasyMDEContainer .CodeMirror .cm-header-3 { font-size: 1.05em; line-height: 1.3; }
        .EasyMDEContainer .CodeMirror .cm-header-4,
        .EasyMDEContainer .CodeMirror .cm-header-5,
        .EasyMDEContainer .CodeMirror .cm-header-6 { font-size: 1em; line-height: 1.3; }
        .editor-preview { background: var(--input-bg); color: var(--text); }
    `;constructor(){super(),this.value="",this.readOnly=!1,this.language="markdown",this.writingMode=!1,this.enableMarkdownLinks=!0,this.customExtensions=[],this._view=null,this._EditorView=null,this._initializingEditor=!1,this.languageConf=null,this.readOnlyConf=null,this.writingModeConf=null,this.mdLinksConf=null,this.customConf=null,this.themeConf=null,this.attributesConf=null}connectedCallback(){super.connectedCallback(),this._themeListener=()=>{const t=document.body.getAttribute("data-theme")||"dark";this.getAttribute("data-theme")!==t&&(this.setAttribute("data-theme",t),this._updateTheme())},window.addEventListener("yenvui-theme-changed",this._themeListener),typeof MutationObserver<"u"&&document.body&&(this._themeObserver=new MutationObserver(()=>this._themeListener()),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]})),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark"),setTimeout(()=>this._initEditor(),0)}disconnectedCallback(){super.disconnectedCallback(),this._themeListener&&window.removeEventListener("yenvui-theme-changed",this._themeListener),this._themeObserver&&(this._themeObserver.disconnect(),this._themeObserver=null),this._view&&(this._view.destroy(),this._view=null)}_applyMinimalDiff(t,e,c=!0){if(!this._view||t===e)return;let n=0;const u=Math.min(t.length,e.length);for(;n<u&&t.charCodeAt(n)===e.charCodeAt(n);)n++;let d=t.length,f=e.length;for(;d>n&&f>n&&t.charCodeAt(d-1)===e.charCodeAt(f-1);)d--,f--;const v=e.slice(n,f),x=v.length-(d-n),g=a=>a<=n?a:a>=d?Math.max(0,Math.min(e.length,a+x)):Math.max(n,Math.min(n+v.length,a)),m=this._view.state.selection?.main,y=c&&m?{anchor:g(m.anchor),head:g(m.head)}:{anchor:0,head:0},s=this._view.scrollDOM,r=c&&s?s.scrollTop:null;this._view.dispatch({changes:{from:n,to:d,insert:v},selection:y}),r!==null&&s&&requestAnimationFrame(()=>{this._view?.scrollDOM&&(this._view.scrollDOM.scrollTop=r)})}updated(t){if(this._view&&this._EditorView){if(t.has("value")){const e=this._view.state.doc.toString(),c=this.value||`
`,n=e==="Loading..."||e===`
`;e!==this.value&&e!==c&&this._applyMinimalDiff(e,c,!n)}t.has("readOnly")&&this.readOnlyConf&&this._view.dispatch({effects:this.readOnlyConf.reconfigure(this._EditorView.editable.of(!this.readOnly))}),t.has("language")&&this.languageConf&&loadLanguageExtension(this.language,this.languageResolver).then(e=>{this._view&&this._view.dispatch({effects:this.languageConf.reconfigure(e)})}),(t.has("language")||t.has("enableMarkdownLinks"))&&this.mdLinksConf&&this._updateMarkdownLinksExtension(),t.has("customExtensions")&&this.customConf&&this._view.dispatch({effects:this.customConf.reconfigure(this.customExtensions||[])}),t.has("writingMode")&&this.writingModeConf&&this._updateWritingMode()}}async _updateWritingMode(){if(!(!this._view||!this.writingModeConf))if(this.writingMode){const{EditorView:t,keymap:e,EditorSelection:c,Prec:n,syntaxTree:u,isolateHistory:d}=await import("codemirror-core"),f=(s,r)=>{try{if(typeof u=="function"){let o=u(s).resolveInner(r,-1);for(;o;){if(/Code|Fenced|HTML|URL|Link/i.test(o.name))return!0;o=o.parent}}}catch{}return(s.doc.lineAt(r).text.slice(0,r-s.doc.lineAt(r).from).match(/`/g)||[]).length%2===1},v=(s,r)=>{const{state:a,dispatch:i}=s,l=a.changeByRange(o=>{const w=a.sliceDoc(o.from,o.to);if(w.startsWith(r)&&w.endsWith(r)&&w.length>=r.length*2){const C=w.slice(r.length,-r.length);return{changes:{from:o.from,to:o.to,insert:C},range:c.range(o.from,o.from+C.length)}}else{const C=`${r}${w}${r}`,p=o.empty?r.length:C.length;return{changes:{from:o.from,to:o.to,insert:C},range:c.range(o.from+p,o.from+p)}}});return i(l),!0},x=t.theme({".cm-scroller .cm-content":{fontFamily:"var(--font-serif, 'Georgia', 'Cambria', 'Times New Roman', 'Source Serif Pro', serif) !important",fontSize:"1.1rem",lineHeight:"1.8",maxWidth:"720px",margin:"0 auto",padding:"30px 10px 80px 10px"},".cm-scroller .cm-line":{maxWidth:"720px"},".cm-gutters":{display:"none"}}),g=t.inputHandler.of((s,r,a,i)=>{if(r!==a||f(s.state,r))return!1;if(i==="-"&&r>=1&&s.state.sliceDoc(r-1,r)==="\u2014")return s.dispatch({changes:{from:r-1,to:a,insert:"---"},selection:{anchor:r+2},userEvent:"input.type"}),!0;if(i==="-"&&r>=1&&s.state.sliceDoc(r-1,r)==="-"&&(r>=2?s.state.sliceDoc(r-2,r-1):"")!=="-"){const o=typeof d?.of=="function"?[d.of("full")]:[];return s.dispatch({changes:{from:r,to:a,insert:"-"},selection:{anchor:r+1},userEvent:"input.type",annotations:o}),s.dispatch({changes:{from:r-1,to:r+1,insert:"\u2014"},selection:{anchor:r},userEvent:"input.complete",annotations:o}),!0}return!1}),m=s=>{const{state:r}=s,a=r.selection.main;if(!a.empty||f(r,a.head))return!1;const i=r.doc.lineAt(a.head),l=i.text.slice(0,a.head-i.from),o=l.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/);if(o){const[,p,_,,k]=o;if(!k.trim()&&a.head===i.to)return s.dispatch({changes:{from:i.from,to:i.to,insert:""},selection:{anchor:i.from},userEvent:"input"}),!0;const b=`
${p}${_} [ ] `;return s.dispatch({changes:{from:a.head,to:a.head,insert:b},selection:{anchor:a.head+b.length},scrollIntoView:!0,userEvent:"input"}),!0}const w=l.match(/^(\s*)([-*+])\s+(.*)$/);if(w){const[,p,_,k]=w;if(!k.trim()&&a.head===i.to)return s.dispatch({changes:{from:i.from,to:i.to,insert:""},selection:{anchor:i.from},userEvent:"input"}),!0;const b=`
${p}${_} `;return s.dispatch({changes:{from:a.head,to:a.head,insert:b},selection:{anchor:a.head+b.length},scrollIntoView:!0,userEvent:"input"}),!0}const C=l.match(/^(\s*)(\d+)([.)])\s+(.*)$/);if(C){const[,p,_,k,b]=C;if(!b.trim()&&a.head===i.to)return s.dispatch({changes:{from:i.from,to:i.to,insert:""},selection:{anchor:i.from},userEvent:"input"}),!0;const L=parseInt(_,10)+1,E=`
${p}${L}${k} `;return s.dispatch({changes:{from:a.head,to:a.head,insert:E},selection:{anchor:a.head+E.length},scrollIntoView:!0,userEvent:"input"}),!0}return!1},y=(typeof n?.high=="function"?n.high:s=>s)(e.of([{key:"Enter",run:m},{key:"Mod-b",run:s=>v(s,"**")},{key:"Mod-i",run:s=>v(s,"*")},{key:"Mod-`",run:s=>v(s,"`")}]));this._view.dispatch({effects:[this.writingModeConf.reconfigure([x,g,y]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"true",autocorrect:"on",autocapitalize:"on"}))]})}else this._view.dispatch({effects:[this.writingModeConf.reconfigure([]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"false",autocorrect:"off",autocapitalize:"off"}))]})}_emitLinkClicked(t,e="",c=null){const n=String(t||"").trim();n&&this.dispatchEvent(new CustomEvent("yenvui-editor-link-clicked",{detail:{href:n,text:String(e||"").trim(),originalEvent:c},bubbles:!0,composed:!0}))}async _buildMarkdownLinksExtension(){if(!["markdown","md"].includes(String(this.language||"").trim().toLowerCase())||!this.enableMarkdownLinks)return[];const{WidgetType:e,ViewPlugin:c,StateField:n,Decoration:u,RangeSetBuilder:d,EditorView:f,syntaxTree:v}=await import("codemirror-core"),x=this,g=/(?<!!)\[([^\][\n]+)\]\((<[^>\n]+>|[^()\s]+(?:\([^()\s]*\)[^()\s]*)*)(?:\s+"[^"]*")?\)/g;class m extends e{constructor(l,o){super(),this.href=l,this.label=o}eq(l){return l.href===this.href&&l.label===this.label}toDOM(){const l=document.createElement("span");return l.className="cm-md-link-widget",l.title=`Open link: ${this.href}`,l.setAttribute("role","button"),l.setAttribute("aria-label",`Open ${this.href}`),l.textContent="\u2197",l.addEventListener("pointerdown",o=>{o.stopPropagation()}),l.addEventListener("click",o=>{o.preventDefault(),o.stopPropagation(),x._emitLinkClicked(this.href,this.label,o)}),l}ignoreEvent(){return!0}}const y=(i,l)=>{try{if(typeof v=="function"){let o=v(i).resolveInner(l,-1);for(;o;){if(/Code|Fenced/i.test(o.name))return!0;o=o.parent}}}catch{}return!1},s=(i,l)=>{const o=new d;let w=0;for(const{from:C,to:p}of l){const _=i.doc.lineAt(C).number,k=i.doc.lineAt(p).number;for(let b=Math.max(_,w+1);b<=k;b++){w=b;const L=i.doc.line(b),E=L.text;if(E.length>2e3||!E.includes("](")||/^\s*(?:```|~~~)/.test(E))continue;g.lastIndex=0;let M;for(;(M=g.exec(E))!==null;){if((E.slice(0,M.index).match(/`/g)||[]).length%2===1)continue;const A=L.from+M.index;if(y(i,A))continue;const z=M[1],D=M[2].replace(/^<|>$/g,"").trim();if(!D)continue;const O=A+M[0].length;o.add(O,O,u.widget({widget:new m(D,z),side:1}))}}}return o.finish()},r=c?.fromClass?c.fromClass(class{constructor(i){this.decorations=s(i.state,i.visibleRanges)}update(i){(i.docChanged||i.viewportChanged)&&(this.decorations=s(i.state,i.view.visibleRanges))}},{decorations:i=>i.decorations}):n.define({create(i){return s(i,[{from:0,to:i.doc.length}])},update(i,l){return l.docChanged?s(l.state,[{from:0,to:l.state.doc.length}]):i},provide:i=>f.decorations.from(i)}),a=f.domEventHandlers({click:(i,l)=>{if(!(i.metaKey||i.ctrlKey))return!1;const o=l.posAtCoords({x:i.clientX,y:i.clientY});if(o===null)return!1;const w=l.state.doc.lineAt(o);if(w.text.length>2e3)return!1;const C=o-w.from;g.lastIndex=0;let p;for(;(p=g.exec(w.text))!==null;){const _=p.index,k=p.index+p[0].length;if(C>=_&&C<=k){const b=p[2].replace(/^<|>$/g,"").trim();if(b)return i.preventDefault(),i.stopPropagation(),x._emitLinkClicked(b,p[1],i),!0}}return!1}});return[r,a]}async _updateMarkdownLinksExtension(){if(!this._view||!this.mdLinksConf)return;const t=this._mdLinksSeq=(this._mdLinksSeq||0)+1,e=await this._buildMarkdownLinksExtension();this._view&&this.mdLinksConf&&t===this._mdLinksSeq&&this._view.dispatch({effects:this.mdLinksConf.reconfigure(e)})}async _updateTheme(){if(this._view&&this.themeConf){const t=document.body.getAttribute("data-theme")||"dark";try{const{oneDarkHighlightStyle:e,syntaxHighlighting:c}=await import("codemirror-core");this._view.dispatch({effects:this.themeConf.reconfigure(t!=="light"?c(e):[])})}catch(e){console.warn("[yenVUI] Failed to update CodeMirror theme",e)}}this._view&&this.requestUpdate()}render(){return R`<div id="cm-container"></div>`}async _initEditor(){if(this._view||this._initializingEditor)return;this._initializingEditor=!0;const{EditorState:t,Compartment:e,basicSetup:c,EditorView:n,oneDarkHighlightStyle:u,syntaxHighlighting:d}=await import("codemirror-core");this.languageConf=new e,this.readOnlyConf=new e,this.writingModeConf=new e,this.mdLinksConf=new e,this.customConf=new e,this.themeConf=new e,this.attributesConf=new e,this._EditorView=n;const f=n.theme({"&":{backgroundColor:"transparent",color:"var(--text)"},".cm-gutters":{backgroundColor:"var(--pane-bg)",color:"var(--text-muted)",borderRight:"1px solid var(--border)"},".cm-content":{fontFamily:"var(--font-mono, monospace)",fontSize:"13px",fontVariantLigatures:"none",fontFeatureSettings:'"liga" 0, "calt" 0'},"&.cm-focused .cm-cursor":{borderLeftColor:"var(--text)"},"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":{backgroundColor:"rgba(56, 189, 248, 0.35) !important"},".cm-searchMatch":{backgroundColor:"rgba(234, 179, 8, 0.4)"},".cm-activeLine":{backgroundColor:"rgba(255, 255, 255, 0.04)"},".cm-selectionMatch":{backgroundColor:"rgba(255, 255, 255, 0.1)"}});let v=await loadLanguageExtension(this.language,this.languageResolver),x=await this._buildMarkdownLinksExtension();if(!this.isConnected){this._initializingEditor=!1;return}const g=this.shadowRoot.getElementById("cm-container");if(!g){this._initializingEditor=!1;return}this._view=new n({state:t.create({doc:this.value||`
`,extensions:[c,f,n.lineWrapping,this.attributesConf.of(n.contentAttributes.of(this.writingMode?{spellcheck:"true",autocorrect:"on",autocapitalize:"on"}:{spellcheck:"false",autocorrect:"off",autocapitalize:"off"})),n.exceptionSink.of(m=>console.warn("[CodeMirror] Suppressed internal plugin crash:",m)),this.languageConf.of(v),this.writingModeConf.of([]),this.mdLinksConf.of(x),this.themeConf.of(document.body.getAttribute("data-theme")!=="light"?d(u):[]),this.readOnlyConf.of(n.editable.of(!this.readOnly)),this.customConf.of(this.customExtensions||[]),n.updateListener.of(m=>{if(m.docChanged){const y=m.state.doc.toString();this.value=y,this.dispatchEvent(new CustomEvent("yenvui-editor-changed",{detail:{value:y},bubbles:!0,composed:!0}))}m.selectionSet&&this.dispatchEvent(new CustomEvent("yenvui-editor-selection",{detail:{cursor:m.state.selection.main.head},bubbles:!0,composed:!0}))}),n.domEventHandlers({scroll:(m,y)=>{this.dispatchEvent(new CustomEvent("yenvui-editor-scroll",{detail:{top:y.scrollDOM.scrollTop},bubbles:!0,composed:!0}))}})]}),parent:g,root:this.shadowRoot}),this._initializingEditor=!1,this._pendingCursor!==void 0&&(this.setCursor(this._pendingCursor),this._pendingCursor=void 0),this._pendingScrollTop!==void 0&&(this.setScrollInfo(this._pendingScrollTop),this._pendingScrollTop=void 0),this.writingMode&&this._updateWritingMode()}getCursor(){return this._view?this._view.state.selection.main.head:this._pendingCursor||0}setCursor(t){this._view&&t!==void 0?this._view.dispatch({selection:{anchor:t}}):t!==void 0&&(this._pendingCursor=t)}getScrollInfo(){return this._view?this._view.scrollDOM.scrollTop:this._pendingScrollTop||0}setScrollInfo(t){this._view&&t!==void 0?requestAnimationFrame(()=>{this._view&&(this._view.scrollDOM.scrollTop=t)}):t!==void 0&&(this._pendingScrollTop=t)}insertAtCursor(t){if(this._view){const e=this.getCursor();this._view.dispatch({changes:{from:e,insert:t},selection:{anchor:e+t.length},scrollIntoView:!0})}}transformContent(t){if(!this._view||typeof t!="function")return!1;const{state:e,dispatch:c}=this._view,n=e.selection.main;if(n.empty){const u=e.doc.toString(),d=t(u);if(d!==u)return this._applyMinimalDiff(u,d,!0),!0}else{const u=e.sliceDoc(n.from,n.to),d=t(u);if(d!==u)return c({changes:{from:n.from,to:n.to,insert:d}}),!0}return!1}}customElements.define("yenvui-editor",YenvuiEditor);
