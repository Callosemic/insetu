import{LitElement as L,html as O,css as T}from"lit";async function k(d,i=null){try{const t=await import("codemirror-core");if(d==="python")return t.python();if(d==="json")return t.json();if(d==="javascript"||d==="ts")return t.javascript();if(d==="yaml"||d==="yml")return t.yaml();if(d==="html"||d==="htm")return t.htmlLang();if(d==="css")return t.cssLang();if(d==="markdown"||d==="md"){const s=t.markdown(),e=Array.isArray(s.extensions)?s.extensions.filter(l=>{const a=String(l?.value||l||"");return!a.includes("htmlCompletion")&&!a.includes("closeTags")}):[];return t.LanguageSupport?new t.LanguageSupport(s.language,e):s.language}try{const s=await import(`@codemirror/lang-${d}`),e=s[d]||s.default;if(typeof e=="function")return e()}catch{const e=i||YenvuiEditor.languageResolver;if(typeof e=="function")try{const l=await e(d),a=typeof l=="string"?l:l?.url;if(a){const u=await import(a),f=u[d]||u.default;if(typeof f=="function")return f()}}catch(l){console.warn(`[yenVUI] JIT vendorization failed for '${d}':`,l)}}return t.markdown()}catch(t){return console.warn(`[yenVUI] Failed to dynamically load language: ${d}`,t),[]}}export class YenvuiEditor extends L{static languageResolver=null;static properties={value:{type:String},readOnly:{type:Boolean},language:{type:String},writingMode:{type:Boolean},customExtensions:{type:Array},languageResolver:{attribute:!1}};static styles=T`
        :host { 
            display: flex; 
            flex-direction: column; 
            flex: 1; 
            min-height: 0; 
            height: 100%; 
        }
        .cm-editor { 
            height: 100%; 
            background: transparent;
        }
        .cm-scroller { 
            overflow: auto; 
            font-family: var(--font-mono, monospace); 
            font-variant-ligatures: none;
            font-feature-settings: "liga" 0, "calt" 0;
        }
        .cm-content, .cm-line {
            font-variant-ligatures: none !important;
            font-feature-settings: "liga" 0, "calt" 0 !important;
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
    `;constructor(){super(),this.value="",this.readOnly=!1,this.language="markdown",this.writingMode=!1,this.customExtensions=[],this._view=null,this._EditorView=null,this._initializingEditor=!1,this.languageConf=null,this.readOnlyConf=null,this.writingModeConf=null,this.customConf=null,this.themeConf=null,this.attributesConf=null}connectedCallback(){super.connectedCallback(),this._themeListener=()=>{const i=document.body.getAttribute("data-theme")||"dark";this.getAttribute("data-theme")!==i&&(this.setAttribute("data-theme",i),this._updateTheme())},window.addEventListener("yenvui-theme-changed",this._themeListener),typeof MutationObserver<"u"&&document.body&&(this._themeObserver=new MutationObserver(()=>this._themeListener()),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]})),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark"),setTimeout(()=>this._initEditor(),0)}disconnectedCallback(){super.disconnectedCallback(),this._themeListener&&window.removeEventListener("yenvui-theme-changed",this._themeListener),this._themeObserver&&(this._themeObserver.disconnect(),this._themeObserver=null),this._view&&(this._view.destroy(),this._view=null)}_applyMinimalDiff(i,t,s=!0){if(!this._view||i===t)return;let e=0;const l=Math.min(i.length,t.length);for(;e<l&&i.charCodeAt(e)===t.charCodeAt(e);)e++;let a=i.length,u=t.length;for(;a>e&&u>e&&i.charCodeAt(a-1)===t.charCodeAt(u-1);)a--,u--;const f=t.slice(e,u),b=f.length-(a-e),m=r=>r<=e?r:r>=a?Math.max(0,Math.min(t.length,r+b)):Math.max(e,Math.min(e+f.length,r)),g=this._view.state.selection?.main,M=s&&g?{anchor:m(g.anchor),head:m(g.head)}:{anchor:0,head:0},o=this._view.scrollDOM,n=s&&o?o.scrollTop:null;this._view.dispatch({changes:{from:e,to:a,insert:f},selection:M}),n!==null&&o&&requestAnimationFrame(()=>{this._view?.scrollDOM&&(this._view.scrollDOM.scrollTop=n)})}updated(i){if(this._view&&this._EditorView){if(i.has("value")){const t=this._view.state.doc.toString(),s=this.value||`
`,e=t==="Loading..."||t===`
`;t!==this.value&&t!==s&&this._applyMinimalDiff(t,s,!e)}i.has("readOnly")&&this.readOnlyConf&&this._view.dispatch({effects:this.readOnlyConf.reconfigure(this._EditorView.editable.of(!this.readOnly))}),i.has("language")&&this.languageConf&&k(this.language,this.languageResolver).then(t=>{this._view&&this._view.dispatch({effects:this.languageConf.reconfigure(t)})}),i.has("customExtensions")&&this.customConf&&this._view.dispatch({effects:this.customConf.reconfigure(this.customExtensions||[])}),i.has("writingMode")&&this.writingModeConf&&this._updateWritingMode()}}async _updateWritingMode(){if(!(!this._view||!this.writingModeConf))if(this.writingMode){const{EditorView:i,keymap:t,EditorSelection:s,Prec:e,syntaxTree:l,isolateHistory:a}=await import("codemirror-core"),u=(o,n)=>{try{if(typeof l=="function"){let c=l(o).resolveInner(n,-1);for(;c;){if(/Code|Fenced|HTML|URL|Link/i.test(c.name))return!0;c=c.parent}}}catch{}return(o.doc.lineAt(n).text.slice(0,n-o.doc.lineAt(n).from).match(/`/g)||[]).length%2===1},f=(o,n)=>{const{state:r,dispatch:h}=o,C=r.changeByRange(c=>{const p=r.sliceDoc(c.from,c.to);if(p.startsWith(n)&&p.endsWith(n)&&p.length>=n.length*2){const v=p.slice(n.length,-n.length);return{changes:{from:c.from,to:c.to,insert:v},range:s.range(c.from,c.from+v.length)}}else{const v=`${n}${p}${n}`,y=c.empty?n.length:v.length;return{changes:{from:c.from,to:c.to,insert:v},range:s.range(c.from+y,c.from+y)}}});return h(C),!0},b=i.theme({".cm-scroller .cm-content":{fontFamily:"var(--font-serif, 'Georgia', 'Cambria', 'Times New Roman', 'Source Serif Pro', serif) !important",fontSize:"1.1rem",lineHeight:"1.8",maxWidth:"720px",margin:"0 auto",padding:"30px 10px 80px 10px"},".cm-scroller .cm-line":{maxWidth:"720px"},".cm-gutters":{display:"none"}}),m=i.inputHandler.of((o,n,r,h)=>{if(n!==r||u(o.state,n))return!1;if(h==="-"&&n>=1&&o.state.sliceDoc(n-1,n)==="\u2014")return o.dispatch({changes:{from:n-1,to:r,insert:"---"},selection:{anchor:n+2},userEvent:"input.type"}),!0;if(h==="-"&&n>=1&&o.state.sliceDoc(n-1,n)==="-"&&(n>=2?o.state.sliceDoc(n-2,n-1):"")!=="-"){const c=typeof a?.of=="function"?[a.of("full")]:[];return o.dispatch({changes:{from:n,to:r,insert:"-"},selection:{anchor:n+1},userEvent:"input.type",annotations:c}),o.dispatch({changes:{from:n-1,to:n+1,insert:"\u2014"},selection:{anchor:n},userEvent:"input.complete",annotations:c}),!0}return!1}),g=o=>{const{state:n}=o,r=n.selection.main;if(!r.empty||u(n,r.head))return!1;const h=n.doc.lineAt(r.head),C=h.text.slice(0,r.head-h.from),c=C.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/);if(c){const[,y,_,,E]=c;if(!E.trim()&&r.head===h.to)return o.dispatch({changes:{from:h.from,to:h.to,insert:""},selection:{anchor:h.from},userEvent:"input"}),!0;const w=`
${y}${_} [ ] `;return o.dispatch({changes:{from:r.head,to:r.head,insert:w},selection:{anchor:r.head+w.length},scrollIntoView:!0,userEvent:"input"}),!0}const p=C.match(/^(\s*)([-*+])\s+(.*)$/);if(p){const[,y,_,E]=p;if(!E.trim()&&r.head===h.to)return o.dispatch({changes:{from:h.from,to:h.to,insert:""},selection:{anchor:h.from},userEvent:"input"}),!0;const w=`
${y}${_} `;return o.dispatch({changes:{from:r.head,to:r.head,insert:w},selection:{anchor:r.head+w.length},scrollIntoView:!0,userEvent:"input"}),!0}const v=C.match(/^(\s*)(\d+)([.)])\s+(.*)$/);if(v){const[,y,_,E,w]=v;if(!w.trim()&&r.head===h.to)return o.dispatch({changes:{from:h.from,to:h.to,insert:""},selection:{anchor:h.from},userEvent:"input"}),!0;const S=parseInt(_,10)+1,x=`
${y}${S}${E} `;return o.dispatch({changes:{from:r.head,to:r.head,insert:x},selection:{anchor:r.head+x.length},scrollIntoView:!0,userEvent:"input"}),!0}return!1},M=(typeof e?.high=="function"?e.high:o=>o)(t.of([{key:"Enter",run:g},{key:"Mod-b",run:o=>f(o,"**")},{key:"Mod-i",run:o=>f(o,"*")},{key:"Mod-`",run:o=>f(o,"`")}]));this._view.dispatch({effects:[this.writingModeConf.reconfigure([b,m,M]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"true",autocorrect:"on",autocapitalize:"on"}))]})}else this._view.dispatch({effects:[this.writingModeConf.reconfigure([]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"false",autocorrect:"off",autocapitalize:"off"}))]})}async _updateTheme(){if(this._view&&this.themeConf){const i=document.body.getAttribute("data-theme")||"dark";try{const{oneDarkHighlightStyle:t,syntaxHighlighting:s}=await import("codemirror-core");this._view.dispatch({effects:this.themeConf.reconfigure(i!=="light"?s(t):[])})}catch(t){console.warn("[yenVUI] Failed to update CodeMirror theme",t)}}this._view&&this.requestUpdate()}render(){return O`<div id="cm-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%;"></div>`}async _initEditor(){if(this._view||this._initializingEditor)return;this._initializingEditor=!0;const{EditorState:i,Compartment:t,basicSetup:s,EditorView:e,oneDarkHighlightStyle:l,syntaxHighlighting:a}=await import("codemirror-core");this.languageConf=new t,this.readOnlyConf=new t,this.writingModeConf=new t,this.customConf=new t,this.themeConf=new t,this.attributesConf=new t,this._EditorView=e;const u=e.theme({"&":{backgroundColor:"transparent",color:"var(--text)"},".cm-gutters":{backgroundColor:"var(--pane-bg)",color:"var(--text-muted)",borderRight:"1px solid var(--border)"},".cm-content":{fontFamily:"var(--font-mono, monospace)",fontSize:"13px",fontVariantLigatures:"none",fontFeatureSettings:'"liga" 0, "calt" 0'},"&.cm-focused .cm-cursor":{borderLeftColor:"var(--text)"},"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":{backgroundColor:"rgba(56, 189, 248, 0.35) !important"},".cm-searchMatch":{backgroundColor:"rgba(234, 179, 8, 0.4)"},".cm-activeLine":{backgroundColor:"rgba(255, 255, 255, 0.04)"},".cm-selectionMatch":{backgroundColor:"rgba(255, 255, 255, 0.1)"}});let f=await k(this.language,this.languageResolver);if(!this.isConnected){this._initializingEditor=!1;return}const b=this.shadowRoot.getElementById("cm-container");if(!b){this._initializingEditor=!1;return}this._view=new e({state:i.create({doc:this.value||`
`,extensions:[s,u,e.lineWrapping,this.attributesConf.of(e.contentAttributes.of(this.writingMode?{spellcheck:"true",autocorrect:"on",autocapitalize:"on"}:{spellcheck:"false",autocorrect:"off",autocapitalize:"off"})),e.exceptionSink.of(m=>console.warn("[CodeMirror] Suppressed internal plugin crash:",m)),this.languageConf.of(f),this.writingModeConf.of([]),this.themeConf.of(document.body.getAttribute("data-theme")!=="light"?a(l):[]),this.readOnlyConf.of(e.editable.of(!this.readOnly)),this.customConf.of(this.customExtensions||[]),e.updateListener.of(m=>{if(m.docChanged){const g=m.state.doc.toString();this.value=g,this.dispatchEvent(new CustomEvent("yenvui-editor-changed",{detail:{value:g},bubbles:!0,composed:!0}))}m.selectionSet&&this.dispatchEvent(new CustomEvent("yenvui-editor-selection",{detail:{cursor:m.state.selection.main.head},bubbles:!0,composed:!0}))}),e.domEventHandlers({scroll:(m,g)=>{this.dispatchEvent(new CustomEvent("yenvui-editor-scroll",{detail:{top:g.scrollDOM.scrollTop},bubbles:!0,composed:!0}))}})]}),parent:b,root:this.shadowRoot}),this._initializingEditor=!1,this._pendingCursor!==void 0&&(this.setCursor(this._pendingCursor),this._pendingCursor=void 0),this._pendingScrollTop!==void 0&&(this.setScrollInfo(this._pendingScrollTop),this._pendingScrollTop=void 0),this.writingMode&&this._updateWritingMode()}getCursor(){return this._view?this._view.state.selection.main.head:this._pendingCursor||0}setCursor(i){this._view&&i!==void 0?this._view.dispatch({selection:{anchor:i}}):i!==void 0&&(this._pendingCursor=i)}getScrollInfo(){return this._view?this._view.scrollDOM.scrollTop:this._pendingScrollTop||0}setScrollInfo(i){this._view&&i!==void 0?requestAnimationFrame(()=>{this._view&&(this._view.scrollDOM.scrollTop=i)}):i!==void 0&&(this._pendingScrollTop=i)}insertAtCursor(i){if(this._view){const t=this.getCursor();this._view.dispatch({changes:{from:t,insert:i},selection:{anchor:t+i.length},scrollIntoView:!0})}}transformContent(i){if(!this._view||typeof i!="function")return!1;const{state:t,dispatch:s}=this._view,e=t.selection.main;if(e.empty){const l=t.doc.toString(),a=i(l);if(a!==l)return this._applyMinimalDiff(l,a,!0),!0}else{const l=t.sliceDoc(e.from,e.to),a=i(l);if(a!==l)return s({changes:{from:e.from,to:e.to,insert:a}}),!0}return!1}}customElements.define("yenvui-editor",YenvuiEditor);
