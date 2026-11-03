import{LitElement as O,html as D,css as T}from"lit";const M=new Map;function z(s){const t=s.markdown(),e=Array.isArray(t.extensions)?t.extensions.filter(c=>{const n=String(c?.value||c||"");return!n.includes("htmlCompletion")&&!n.includes("closeTags")}):[];return s.LanguageSupport?new s.LanguageSupport(t.language,e):t.language}function S(s,t,e=void 0){return t==="python"?s.python():t==="json"?s.json():t==="javascript"||t==="js"?e?s.javascript(e):s.javascript():t==="jsx"?s.javascript({jsx:!0,...e||{}}):t==="typescript"||t==="ts"?s.javascript({typescript:!0,...e||{}}):t==="tsx"?s.javascript({jsx:!0,typescript:!0,...e||{}}):t==="yaml"||t==="yml"?s.yaml():t==="html"||t==="htm"||t==="htmlLang"?s.htmlLang():t==="css"||t==="cssLang"?s.cssLang():t==="markdown"||t==="md"?z(s):null}async function L(s,t=null){try{const e=await import("codemirror-core"),c=S(e,s);if(c!==null)return c;if(typeof t=="function")try{const n=await t(s);if(!n)return[];if(typeof n=="string"){const u=await import(n),a=u[s]||u.default;return typeof a=="function"?a():[]}if(typeof n=="object"){const u=n.kind||"lezer",a=n.export||s,f=n.options;if(u==="builtin"){const g=S(e,a,f);if(g!==null)return g;const C=e[a];return typeof C=="function"?f?C(f):C():[]}const m=n.url||n.path;if(!m)return[];const p=await import(m),d=p[a]??p[s]??p.default;if(u==="stream")return d&&e.StreamLanguage&&typeof e.StreamLanguage.define=="function"?e.StreamLanguage.define(d):[];if(typeof d=="function")return f?d(f):d()}}catch(n){console.warn(`[yenVUI] Language resolution failed for '${s}':`,n)}return[]}catch(e){return console.warn(`[yenVUI] Failed to dynamically load language: ${s}`,e),[]}}export function loadLanguageExtension(s,t=null){const e=String(s||"").trim().toLowerCase();if(!e||e==="plain"||e==="plaintext"||e==="text"||e==="txt")return Promise.resolve([]);if(t)return L(e,t);if(M.has(e))return M.get(e);const c=L(e,YenvuiEditor.languageResolver).then(n=>(Array.isArray(n)&&n.length===0&&M.delete(e),n));return M.set(e,c),c}export class YenvuiEditor extends O{static languageResolver=null;static properties={value:{type:String},readOnly:{type:Boolean},language:{type:String},writingMode:{type:Boolean},customExtensions:{type:Array},languageResolver:{attribute:!1}};static styles=T`
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
    `;constructor(){super(),this.value="",this.readOnly=!1,this.language="markdown",this.writingMode=!1,this.customExtensions=[],this._view=null,this._EditorView=null,this._initializingEditor=!1,this.languageConf=null,this.readOnlyConf=null,this.writingModeConf=null,this.customConf=null,this.themeConf=null,this.attributesConf=null}connectedCallback(){super.connectedCallback(),this._themeListener=()=>{const t=document.body.getAttribute("data-theme")||"dark";this.getAttribute("data-theme")!==t&&(this.setAttribute("data-theme",t),this._updateTheme())},window.addEventListener("yenvui-theme-changed",this._themeListener),typeof MutationObserver<"u"&&document.body&&(this._themeObserver=new MutationObserver(()=>this._themeListener()),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]})),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark"),setTimeout(()=>this._initEditor(),0)}disconnectedCallback(){super.disconnectedCallback(),this._themeListener&&window.removeEventListener("yenvui-theme-changed",this._themeListener),this._themeObserver&&(this._themeObserver.disconnect(),this._themeObserver=null),this._view&&(this._view.destroy(),this._view=null)}_applyMinimalDiff(t,e,c=!0){if(!this._view||t===e)return;let n=0;const u=Math.min(t.length,e.length);for(;n<u&&t.charCodeAt(n)===e.charCodeAt(n);)n++;let a=t.length,f=e.length;for(;a>n&&f>n&&t.charCodeAt(a-1)===e.charCodeAt(f-1);)a--,f--;const m=e.slice(n,f),p=m.length-(a-n),d=r=>r<=n?r:r>=a?Math.max(0,Math.min(e.length,r+p)):Math.max(n,Math.min(n+m.length,r)),g=this._view.state.selection?.main,C=c&&g?{anchor:d(g.anchor),head:d(g.head)}:{anchor:0,head:0},o=this._view.scrollDOM,i=c&&o?o.scrollTop:null;this._view.dispatch({changes:{from:n,to:a,insert:m},selection:C}),i!==null&&o&&requestAnimationFrame(()=>{this._view?.scrollDOM&&(this._view.scrollDOM.scrollTop=i)})}updated(t){if(this._view&&this._EditorView){if(t.has("value")){const e=this._view.state.doc.toString(),c=this.value||`
`,n=e==="Loading..."||e===`
`;e!==this.value&&e!==c&&this._applyMinimalDiff(e,c,!n)}t.has("readOnly")&&this.readOnlyConf&&this._view.dispatch({effects:this.readOnlyConf.reconfigure(this._EditorView.editable.of(!this.readOnly))}),t.has("language")&&this.languageConf&&loadLanguageExtension(this.language,this.languageResolver).then(e=>{this._view&&this._view.dispatch({effects:this.languageConf.reconfigure(e)})}),t.has("customExtensions")&&this.customConf&&this._view.dispatch({effects:this.customConf.reconfigure(this.customExtensions||[])}),t.has("writingMode")&&this.writingModeConf&&this._updateWritingMode()}}async _updateWritingMode(){if(!(!this._view||!this.writingModeConf))if(this.writingMode){const{EditorView:t,keymap:e,EditorSelection:c,Prec:n,syntaxTree:u,isolateHistory:a}=await import("codemirror-core"),f=(o,i)=>{try{if(typeof u=="function"){let l=u(o).resolveInner(i,-1);for(;l;){if(/Code|Fenced|HTML|URL|Link/i.test(l.name))return!0;l=l.parent}}}catch{}return(o.doc.lineAt(i).text.slice(0,i-o.doc.lineAt(i).from).match(/`/g)||[]).length%2===1},m=(o,i)=>{const{state:r,dispatch:h}=o,b=r.changeByRange(l=>{const v=r.sliceDoc(l.from,l.to);if(v.startsWith(i)&&v.endsWith(i)&&v.length>=i.length*2){const w=v.slice(i.length,-i.length);return{changes:{from:l.from,to:l.to,insert:w},range:c.range(l.from,l.from+w.length)}}else{const w=`${i}${v}${i}`,y=l.empty?i.length:w.length;return{changes:{from:l.from,to:l.to,insert:w},range:c.range(l.from+y,l.from+y)}}});return h(b),!0},p=t.theme({".cm-scroller .cm-content":{fontFamily:"var(--font-serif, 'Georgia', 'Cambria', 'Times New Roman', 'Source Serif Pro', serif) !important",fontSize:"1.1rem",lineHeight:"1.8",maxWidth:"720px",margin:"0 auto",padding:"30px 10px 80px 10px"},".cm-scroller .cm-line":{maxWidth:"720px"},".cm-gutters":{display:"none"}}),d=t.inputHandler.of((o,i,r,h)=>{if(i!==r||f(o.state,i))return!1;if(h==="-"&&i>=1&&o.state.sliceDoc(i-1,i)==="\u2014")return o.dispatch({changes:{from:i-1,to:r,insert:"---"},selection:{anchor:i+2},userEvent:"input.type"}),!0;if(h==="-"&&i>=1&&o.state.sliceDoc(i-1,i)==="-"&&(i>=2?o.state.sliceDoc(i-2,i-1):"")!=="-"){const l=typeof a?.of=="function"?[a.of("full")]:[];return o.dispatch({changes:{from:i,to:r,insert:"-"},selection:{anchor:i+1},userEvent:"input.type",annotations:l}),o.dispatch({changes:{from:i-1,to:i+1,insert:"\u2014"},selection:{anchor:i},userEvent:"input.complete",annotations:l}),!0}return!1}),g=o=>{const{state:i}=o,r=i.selection.main;if(!r.empty||f(i,r.head))return!1;const h=i.doc.lineAt(r.head),b=h.text.slice(0,r.head-h.from),l=b.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/);if(l){const[,y,x,,E]=l;if(!E.trim()&&r.head===h.to)return o.dispatch({changes:{from:h.from,to:h.to,insert:""},selection:{anchor:h.from},userEvent:"input"}),!0;const _=`
${y}${x} [ ] `;return o.dispatch({changes:{from:r.head,to:r.head,insert:_},selection:{anchor:r.head+_.length},scrollIntoView:!0,userEvent:"input"}),!0}const v=b.match(/^(\s*)([-*+])\s+(.*)$/);if(v){const[,y,x,E]=v;if(!E.trim()&&r.head===h.to)return o.dispatch({changes:{from:h.from,to:h.to,insert:""},selection:{anchor:h.from},userEvent:"input"}),!0;const _=`
${y}${x} `;return o.dispatch({changes:{from:r.head,to:r.head,insert:_},selection:{anchor:r.head+_.length},scrollIntoView:!0,userEvent:"input"}),!0}const w=b.match(/^(\s*)(\d+)([.)])\s+(.*)$/);if(w){const[,y,x,E,_]=w;if(!_.trim()&&r.head===h.to)return o.dispatch({changes:{from:h.from,to:h.to,insert:""},selection:{anchor:h.from},userEvent:"input"}),!0;const A=parseInt(x,10)+1,k=`
${y}${A}${E} `;return o.dispatch({changes:{from:r.head,to:r.head,insert:k},selection:{anchor:r.head+k.length},scrollIntoView:!0,userEvent:"input"}),!0}return!1},C=(typeof n?.high=="function"?n.high:o=>o)(e.of([{key:"Enter",run:g},{key:"Mod-b",run:o=>m(o,"**")},{key:"Mod-i",run:o=>m(o,"*")},{key:"Mod-`",run:o=>m(o,"`")}]));this._view.dispatch({effects:[this.writingModeConf.reconfigure([p,d,C]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"true",autocorrect:"on",autocapitalize:"on"}))]})}else this._view.dispatch({effects:[this.writingModeConf.reconfigure([]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"false",autocorrect:"off",autocapitalize:"off"}))]})}async _updateTheme(){if(this._view&&this.themeConf){const t=document.body.getAttribute("data-theme")||"dark";try{const{oneDarkHighlightStyle:e,syntaxHighlighting:c}=await import("codemirror-core");this._view.dispatch({effects:this.themeConf.reconfigure(t!=="light"?c(e):[])})}catch(e){console.warn("[yenVUI] Failed to update CodeMirror theme",e)}}this._view&&this.requestUpdate()}render(){return D`<div id="cm-container"></div>`}async _initEditor(){if(this._view||this._initializingEditor)return;this._initializingEditor=!0;const{EditorState:t,Compartment:e,basicSetup:c,EditorView:n,oneDarkHighlightStyle:u,syntaxHighlighting:a}=await import("codemirror-core");this.languageConf=new e,this.readOnlyConf=new e,this.writingModeConf=new e,this.customConf=new e,this.themeConf=new e,this.attributesConf=new e,this._EditorView=n;const f=n.theme({"&":{backgroundColor:"transparent",color:"var(--text)"},".cm-gutters":{backgroundColor:"var(--pane-bg)",color:"var(--text-muted)",borderRight:"1px solid var(--border)"},".cm-content":{fontFamily:"var(--font-mono, monospace)",fontSize:"13px",fontVariantLigatures:"none",fontFeatureSettings:'"liga" 0, "calt" 0'},"&.cm-focused .cm-cursor":{borderLeftColor:"var(--text)"},"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":{backgroundColor:"rgba(56, 189, 248, 0.35) !important"},".cm-searchMatch":{backgroundColor:"rgba(234, 179, 8, 0.4)"},".cm-activeLine":{backgroundColor:"rgba(255, 255, 255, 0.04)"},".cm-selectionMatch":{backgroundColor:"rgba(255, 255, 255, 0.1)"}});let m=await loadLanguageExtension(this.language,this.languageResolver);if(!this.isConnected){this._initializingEditor=!1;return}const p=this.shadowRoot.getElementById("cm-container");if(!p){this._initializingEditor=!1;return}this._view=new n({state:t.create({doc:this.value||`
`,extensions:[c,f,n.lineWrapping,this.attributesConf.of(n.contentAttributes.of(this.writingMode?{spellcheck:"true",autocorrect:"on",autocapitalize:"on"}:{spellcheck:"false",autocorrect:"off",autocapitalize:"off"})),n.exceptionSink.of(d=>console.warn("[CodeMirror] Suppressed internal plugin crash:",d)),this.languageConf.of(m),this.writingModeConf.of([]),this.themeConf.of(document.body.getAttribute("data-theme")!=="light"?a(u):[]),this.readOnlyConf.of(n.editable.of(!this.readOnly)),this.customConf.of(this.customExtensions||[]),n.updateListener.of(d=>{if(d.docChanged){const g=d.state.doc.toString();this.value=g,this.dispatchEvent(new CustomEvent("yenvui-editor-changed",{detail:{value:g},bubbles:!0,composed:!0}))}d.selectionSet&&this.dispatchEvent(new CustomEvent("yenvui-editor-selection",{detail:{cursor:d.state.selection.main.head},bubbles:!0,composed:!0}))}),n.domEventHandlers({scroll:(d,g)=>{this.dispatchEvent(new CustomEvent("yenvui-editor-scroll",{detail:{top:g.scrollDOM.scrollTop},bubbles:!0,composed:!0}))}})]}),parent:p,root:this.shadowRoot}),this._initializingEditor=!1,this._pendingCursor!==void 0&&(this.setCursor(this._pendingCursor),this._pendingCursor=void 0),this._pendingScrollTop!==void 0&&(this.setScrollInfo(this._pendingScrollTop),this._pendingScrollTop=void 0),this.writingMode&&this._updateWritingMode()}getCursor(){return this._view?this._view.state.selection.main.head:this._pendingCursor||0}setCursor(t){this._view&&t!==void 0?this._view.dispatch({selection:{anchor:t}}):t!==void 0&&(this._pendingCursor=t)}getScrollInfo(){return this._view?this._view.scrollDOM.scrollTop:this._pendingScrollTop||0}setScrollInfo(t){this._view&&t!==void 0?requestAnimationFrame(()=>{this._view&&(this._view.scrollDOM.scrollTop=t)}):t!==void 0&&(this._pendingScrollTop=t)}insertAtCursor(t){if(this._view){const e=this.getCursor();this._view.dispatch({changes:{from:e,insert:t},selection:{anchor:e+t.length},scrollIntoView:!0})}}transformContent(t){if(!this._view||typeof t!="function")return!1;const{state:e,dispatch:c}=this._view,n=e.selection.main;if(n.empty){const u=e.doc.toString(),a=t(u);if(a!==u)return this._applyMinimalDiff(u,a,!0),!0}else{const u=e.sliceDoc(n.from,n.to),a=t(u);if(a!==u)return c({changes:{from:n.from,to:n.to,insert:a}}),!0}return!1}}customElements.define("yenvui-editor",YenvuiEditor);
