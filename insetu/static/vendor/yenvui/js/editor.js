import{LitElement as L,html as O,css as T}from"lit";async function k(l){try{const t=await import("codemirror-core");if(l==="python")return t.python();if(l==="json")return t.json();if(l==="javascript"||l==="ts")return t.javascript();if(l==="yaml"||l==="yml")return t.yaml();if(l==="html"||l==="htm")return t.htmlLang();if(l==="css")return t.cssLang();if(l==="markdown"||l==="md"){const e=t.markdown(),a=Array.isArray(e.extensions)?e.extensions.filter(i=>{const d=String(i?.value||i||"");return!d.includes("htmlCompletion")&&!d.includes("closeTags")}):[];return t.LanguageSupport?new t.LanguageSupport(e.language,a):e.language}try{const e=await import(`@codemirror/lang-${l}`),a=e[l]||e.default;if(typeof a=="function")return a()}catch{const a=window.ExtensionRegistry?.executeUIHook&&window.ExtensionRegistry.executeUIHook("sutram:vendorize-language",l)||(typeof window.Sutram?.vendorizeLanguage=="function"?window.Sutram.vendorizeLanguage(l):null);if(a)try{const i=await a;if(i){const d=await import(i),c=d[l]||d.default;if(typeof c=="function")return c()}}catch(i){console.warn(`[yenVUI] JIT vendorization failed for '${l}':`,i)}}return t.markdown()}catch(t){return console.warn(`[yenVUI] Failed to dynamically load language: ${l}`,t),[]}}export class YenvuiEditor extends L{static properties={value:{type:String},readOnly:{type:Boolean},language:{type:String},writingMode:{type:Boolean},customExtensions:{type:Array}};static styles=T`
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
    `;constructor(){super(),this.value="",this.readOnly=!1,this.language="markdown",this.writingMode=!1,this.customExtensions=[],this._view=null,this._EditorView=null,this._initializingEditor=!1,this.languageConf=null,this.readOnlyConf=null,this.writingModeConf=null,this.customConf=null,this.themeConf=null,this.attributesConf=null}connectedCallback(){super.connectedCallback(),this._themeListener=()=>{const t=document.body.getAttribute("data-theme")||"dark";this.getAttribute("data-theme")!==t&&(this.setAttribute("data-theme",t),this._updateTheme())},window.addEventListener("yenvui-theme-changed",this._themeListener),typeof MutationObserver<"u"&&document.body&&(this._themeObserver=new MutationObserver(()=>this._themeListener()),this._themeObserver.observe(document.body,{attributes:!0,attributeFilter:["data-theme"]})),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark"),setTimeout(()=>this._initEditor(),0)}disconnectedCallback(){super.disconnectedCallback(),this._themeListener&&window.removeEventListener("yenvui-theme-changed",this._themeListener),this._themeObserver&&(this._themeObserver.disconnect(),this._themeObserver=null),this._view&&(this._view.destroy(),this._view=null)}_applyMinimalDiff(t,e,a=!0){if(!this._view||t===e)return;let i=0;const d=Math.min(t.length,e.length);for(;i<d&&t.charCodeAt(i)===e.charCodeAt(i);)i++;let c=t.length,m=e.length;for(;c>i&&m>i&&t.charCodeAt(c-1)===e.charCodeAt(m-1);)c--,m--;const g=e.slice(i,m),b=g.length-(c-i),u=r=>r<=i?r:r>=c?Math.max(0,Math.min(e.length,r+b)):Math.max(i,Math.min(i+g.length,r)),f=this._view.state.selection?.main,x=a&&f?{anchor:u(f.anchor),head:u(f.head)}:{anchor:0,head:0},o=this._view.scrollDOM,n=a&&o?o.scrollTop:null;this._view.dispatch({changes:{from:i,to:c,insert:g},selection:x}),n!==null&&o&&requestAnimationFrame(()=>{this._view?.scrollDOM&&(this._view.scrollDOM.scrollTop=n)})}updated(t){if(this._view&&this._EditorView){if(t.has("value")){const e=this._view.state.doc.toString(),a=this.value||`
`,i=e==="Loading..."||e===`
`;e!==this.value&&e!==a&&this._applyMinimalDiff(e,a,!i)}t.has("readOnly")&&this.readOnlyConf&&this._view.dispatch({effects:this.readOnlyConf.reconfigure(this._EditorView.editable.of(!this.readOnly))}),t.has("language")&&this.languageConf&&k(this.language).then(e=>{this._view&&this._view.dispatch({effects:this.languageConf.reconfigure(e)})}),t.has("customExtensions")&&this.customConf&&this._view.dispatch({effects:this.customConf.reconfigure(this.customExtensions||[])}),t.has("writingMode")&&this.writingModeConf&&this._updateWritingMode()}}async _updateWritingMode(){if(!(!this._view||!this.writingModeConf))if(this.writingMode){const{EditorView:t,keymap:e,EditorSelection:a,Prec:i,syntaxTree:d,isolateHistory:c}=await import("codemirror-core"),m=(o,n)=>{try{if(typeof d=="function"){let s=d(o).resolveInner(n,-1);for(;s;){if(/Code|Fenced|HTML|URL|Link/i.test(s.name))return!0;s=s.parent}}}catch{}return(o.doc.lineAt(n).text.slice(0,n-o.doc.lineAt(n).from).match(/`/g)||[]).length%2===1},g=(o,n)=>{const{state:r,dispatch:h}=o,y=r.changeByRange(s=>{const p=r.sliceDoc(s.from,s.to);if(p.startsWith(n)&&p.endsWith(n)&&p.length>=n.length*2){const v=p.slice(n.length,-n.length);return{changes:{from:s.from,to:s.to,insert:v},range:a.range(s.from,s.from+v.length)}}else{const v=`${n}${p}${n}`,w=s.empty?n.length:v.length;return{changes:{from:s.from,to:s.to,insert:v},range:a.range(s.from+w,s.from+w)}}});return h(y),!0},b=t.theme({".cm-scroller .cm-content":{fontFamily:"var(--font-serif, 'Georgia', 'Cambria', 'Times New Roman', 'Source Serif Pro', serif) !important",fontSize:"1.1rem",lineHeight:"1.8",maxWidth:"720px",margin:"0 auto",padding:"30px 10px 80px 10px"},".cm-scroller .cm-line":{maxWidth:"720px"},".cm-gutters":{display:"none"}}),u=t.inputHandler.of((o,n,r,h)=>{if(n!==r||m(o.state,n))return!1;if(h==="-"&&n>=1&&o.state.sliceDoc(n-1,n)==="\u2014")return o.dispatch({changes:{from:n-1,to:r,insert:"---"},selection:{anchor:n+2},userEvent:"input.type"}),!0;if(h==="-"&&n>=1&&o.state.sliceDoc(n-1,n)==="-"&&(n>=2?o.state.sliceDoc(n-2,n-1):"")!=="-"){const s=typeof c?.of=="function"?[c.of("full")]:[];return o.dispatch({changes:{from:n,to:r,insert:"-"},selection:{anchor:n+1},userEvent:"input.type",annotations:s}),o.dispatch({changes:{from:n-1,to:n+1,insert:"\u2014"},selection:{anchor:n},userEvent:"input.complete",annotations:s}),!0}return!1}),f=o=>{const{state:n}=o,r=n.selection.main;if(!r.empty||m(n,r.head))return!1;const h=n.doc.lineAt(r.head),y=h.text.slice(0,r.head-h.from),s=y.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+(.*)$/);if(s){const[,w,_,,E]=s;if(!E.trim()&&r.head===h.to)return o.dispatch({changes:{from:h.from,to:h.to,insert:""},selection:{anchor:h.from},userEvent:"input"}),!0;const C=`
${w}${_} [ ] `;return o.dispatch({changes:{from:r.head,to:r.head,insert:C},selection:{anchor:r.head+C.length},scrollIntoView:!0,userEvent:"input"}),!0}const p=y.match(/^(\s*)([-*+])\s+(.*)$/);if(p){const[,w,_,E]=p;if(!E.trim()&&r.head===h.to)return o.dispatch({changes:{from:h.from,to:h.to,insert:""},selection:{anchor:h.from},userEvent:"input"}),!0;const C=`
${w}${_} `;return o.dispatch({changes:{from:r.head,to:r.head,insert:C},selection:{anchor:r.head+C.length},scrollIntoView:!0,userEvent:"input"}),!0}const v=y.match(/^(\s*)(\d+)([.)])\s+(.*)$/);if(v){const[,w,_,E,C]=v;if(!C.trim()&&r.head===h.to)return o.dispatch({changes:{from:h.from,to:h.to,insert:""},selection:{anchor:h.from},userEvent:"input"}),!0;const S=parseInt(_,10)+1,M=`
${w}${S}${E} `;return o.dispatch({changes:{from:r.head,to:r.head,insert:M},selection:{anchor:r.head+M.length},scrollIntoView:!0,userEvent:"input"}),!0}return!1},x=(typeof i?.high=="function"?i.high:o=>o)(e.of([{key:"Enter",run:f},{key:"Mod-b",run:o=>g(o,"**")},{key:"Mod-i",run:o=>g(o,"*")},{key:"Mod-`",run:o=>g(o,"`")}]));this._view.dispatch({effects:[this.writingModeConf.reconfigure([b,u,x]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"true",autocorrect:"on",autocapitalize:"on"}))]})}else this._view.dispatch({effects:[this.writingModeConf.reconfigure([]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"false",autocorrect:"off",autocapitalize:"off"}))]})}async _updateTheme(){if(this._view&&this.themeConf){const t=document.body.getAttribute("data-theme")||"dark";try{const{oneDarkHighlightStyle:e,syntaxHighlighting:a}=await import("codemirror-core");this._view.dispatch({effects:this.themeConf.reconfigure(t!=="light"?a(e):[])})}catch(e){console.warn("[yenVUI] Failed to update CodeMirror theme",e)}}this._view&&this.requestUpdate()}render(){return O`<div id="cm-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%;"></div>`}async _initEditor(){if(this._view||this._initializingEditor)return;this._initializingEditor=!0;const{EditorState:t,Compartment:e,basicSetup:a,EditorView:i,oneDarkHighlightStyle:d,syntaxHighlighting:c}=await import("codemirror-core");this.languageConf=new e,this.readOnlyConf=new e,this.writingModeConf=new e,this.customConf=new e,this.themeConf=new e,this.attributesConf=new e,this._EditorView=i;const m=i.theme({"&":{backgroundColor:"transparent",color:"var(--text)"},".cm-gutters":{backgroundColor:"var(--pane-bg)",color:"var(--text-muted)",borderRight:"1px solid var(--border)"},".cm-content":{fontFamily:"var(--font-mono, monospace)",fontSize:"13px",fontVariantLigatures:"none",fontFeatureSettings:'"liga" 0, "calt" 0'},"&.cm-focused .cm-cursor":{borderLeftColor:"var(--text)"},"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":{backgroundColor:"rgba(56, 189, 248, 0.35) !important"},".cm-searchMatch":{backgroundColor:"rgba(234, 179, 8, 0.4)"},".cm-activeLine":{backgroundColor:"rgba(255, 255, 255, 0.04)"},".cm-selectionMatch":{backgroundColor:"rgba(255, 255, 255, 0.1)"}});let g=await k(this.language);if(!this.isConnected){this._initializingEditor=!1;return}const b=this.shadowRoot.getElementById("cm-container");if(!b){this._initializingEditor=!1;return}this._view=new i({state:t.create({doc:this.value||`
`,extensions:[a,m,i.lineWrapping,this.attributesConf.of(i.contentAttributes.of(this.writingMode?{spellcheck:"true",autocorrect:"on",autocapitalize:"on"}:{spellcheck:"false",autocorrect:"off",autocapitalize:"off"})),i.exceptionSink.of(u=>console.warn("[CodeMirror] Suppressed internal plugin crash:",u)),this.languageConf.of(g),this.writingModeConf.of([]),this.themeConf.of(document.body.getAttribute("data-theme")!=="light"?c(d):[]),this.readOnlyConf.of(i.editable.of(!this.readOnly)),this.customConf.of(this.customExtensions||[]),i.updateListener.of(u=>{if(u.docChanged){const f=u.state.doc.toString();this.value=f,this.dispatchEvent(new CustomEvent("yenvui-editor-changed",{detail:{value:f},bubbles:!0,composed:!0}))}u.selectionSet&&this.dispatchEvent(new CustomEvent("yenvui-editor-selection",{detail:{cursor:u.state.selection.main.head},bubbles:!0,composed:!0}))}),i.domEventHandlers({scroll:(u,f)=>{this.dispatchEvent(new CustomEvent("yenvui-editor-scroll",{detail:{top:f.scrollDOM.scrollTop},bubbles:!0,composed:!0}))}})]}),parent:b,root:this.shadowRoot}),this._initializingEditor=!1,this._pendingCursor!==void 0&&(this.setCursor(this._pendingCursor),this._pendingCursor=void 0),this._pendingScrollTop!==void 0&&(this.setScrollInfo(this._pendingScrollTop),this._pendingScrollTop=void 0),this.writingMode&&this._updateWritingMode()}getCursor(){return this._view?this._view.state.selection.main.head:this._pendingCursor||0}setCursor(t){this._view&&t!==void 0?this._view.dispatch({selection:{anchor:t}}):t!==void 0&&(this._pendingCursor=t)}getScrollInfo(){return this._view?this._view.scrollDOM.scrollTop:this._pendingScrollTop||0}setScrollInfo(t){this._view&&t!==void 0?requestAnimationFrame(()=>{this._view&&(this._view.scrollDOM.scrollTop=t)}):t!==void 0&&(this._pendingScrollTop=t)}insertAtCursor(t){if(this._view){const e=this.getCursor();this._view.dispatch({changes:{from:e,insert:t},selection:{anchor:e+t.length},scrollIntoView:!0})}}transformContent(t){if(!this._view||typeof t!="function")return!1;const{state:e,dispatch:a}=this._view,i=e.selection.main;if(i.empty){const d=e.doc.toString(),c=t(d);if(c!==d)return this._applyMinimalDiff(d,c,!0),!0}else{const d=e.sliceDoc(i.from,i.to),c=t(d);if(c!==d)return a({changes:{from:i.from,to:i.to,insert:c}}),!0}return!1}}customElements.define("yenvui-editor",YenvuiEditor);
