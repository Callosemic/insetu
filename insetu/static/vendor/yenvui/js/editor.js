import{LitElement as w,html as v,css as C}from"lit";async function p(n){try{const t=await import("codemirror-core");if(n==="python")return t.python();if(n==="json")return t.json();if(n==="javascript"||n==="ts")return t.javascript();if(n==="yaml"||n==="yml")return t.yaml();if(n==="html"||n==="htm")return t.htmlLang();if(n==="css")return t.cssLang();if(n==="markdown"||n==="md")return t.markdown();try{const e=await import(`@codemirror/lang-${n}`),o=e[n]||e.default;if(typeof o=="function")return o()}catch{if(typeof window.Sutram?.vendorizeLanguage=="function")try{const o=await window.Sutram.vendorizeLanguage(n);if(o){const i=await import(o),r=i[n]||i.default;if(typeof r=="function")return r()}}catch(o){console.warn(`[yenVUI] JIT vendorization failed for '${n}':`,o)}}return t.markdown()}catch(t){return console.warn(`[yenVUI] Failed to dynamically load language: ${n}`,t),[]}}export class YenvuiEditor extends w{static properties={value:{type:String},readOnly:{type:Boolean},language:{type:String},writingMode:{type:Boolean},customExtensions:{type:Array}};static styles=C`
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
        .CodeMirror-search-match { background: #f59e0b; color: #000; }
        .CodeMirror-search-hint { color: #888; font-style: italic; }

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
    `;constructor(){super(),this.value="",this.readOnly=!1,this.language="markdown",this.writingMode=!1,this.customExtensions=[],this._view=null,this._EditorView=null,this._initializingEditor=!1,this.languageConf=null,this.readOnlyConf=null,this.writingModeConf=null,this.customConf=null,this.themeConf=null,this.attributesConf=null}connectedCallback(){super.connectedCallback(),this._themeListener=()=>{const t=document.body.getAttribute("data-theme")||"dark";this.setAttribute("data-theme",t),this._updateTheme()},window.addEventListener("insetu:theme-changed",this._themeListener),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark"),setTimeout(()=>this._initEditor(),0)}disconnectedCallback(){super.disconnectedCallback(),this._themeListener&&window.removeEventListener("insetu:theme-changed",this._themeListener),this._view&&(this._view.destroy(),this._view=null)}updated(t){if(this._view&&this._EditorView){if(t.has("value")){const e=this._view.state.doc.toString(),o=this.value||`
`;e!==this.value&&e!==o&&this._view.dispatch({changes:{from:0,to:e.length,insert:o}})}t.has("readOnly")&&this.readOnlyConf&&this._view.dispatch({effects:this.readOnlyConf.reconfigure(this._EditorView.editable.of(!this.readOnly))}),t.has("language")&&this.languageConf&&p(this.language).then(e=>{this._view&&this._view.dispatch({effects:this.languageConf.reconfigure(e)})}),t.has("customExtensions")&&this.customConf&&this._view.dispatch({effects:this.customConf.reconfigure(this.customExtensions||[])}),t.has("writingMode")&&this.writingModeConf&&this._updateWritingMode()}}async _updateWritingMode(){if(!(!this._view||!this.writingModeConf))if(this.writingMode){const{EditorView:t,keymap:e,EditorSelection:o}=await import("codemirror-core"),i=(h,a)=>{const{state:f,dispatch:d}=h,l=f.changeByRange(s=>{const u=f.sliceDoc(s.from,s.to);if(u.startsWith(a)&&u.endsWith(a)&&u.length>=a.length*2){const m=u.slice(a.length,-a.length);return{changes:{from:s.from,to:s.to,insert:m},range:o.range(s.from,s.from+m.length)}}else{const m=`${a}${u}${a}`,g=s.empty?a.length:m.length;return{changes:{from:s.from,to:s.to,insert:m},range:o.range(s.from+g,s.from+g)}}});return d(l),!0},r=t.theme({".cm-scroller .cm-content":{fontFamily:"var(--font-serif, 'Georgia', 'Cambria', 'Times New Roman', 'Source Serif Pro', serif) !important",fontSize:"1.1rem",lineHeight:"1.8",maxWidth:"720px",margin:"0 auto",padding:"30px 10px 80px 10px"},".cm-scroller .cm-line":{maxWidth:"720px"},".cm-gutters":{display:"none"}}),c=e.of([{key:"Mod-b",run:h=>i(h,"**")},{key:"Mod-i",run:h=>i(h,"*")},{key:"Mod-`",run:h=>i(h,"`")}]);this._view.dispatch({effects:[this.writingModeConf.reconfigure([r,c]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"true",autocorrect:"on",autocapitalize:"on"}))]})}else this._view.dispatch({effects:[this.writingModeConf.reconfigure([]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"false",autocorrect:"off",autocapitalize:"off"}))]})}async _updateTheme(){if(this._view&&this.themeConf){const t=document.body.getAttribute("data-theme")||"dark";try{const{oneDarkHighlightStyle:e,syntaxHighlighting:o}=await import("codemirror-core");this._view.dispatch({effects:this.themeConf.reconfigure(t!=="light"?o(e):[])})}catch(e){console.warn("[yenVUI] Failed to update CodeMirror theme",e)}}this._view&&this.requestUpdate()}render(){return v`<div id="cm-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%;"></div>`}async _initEditor(){if(this._view||this._initializingEditor)return;this._initializingEditor=!0;const{EditorState:t,Compartment:e,basicSetup:o,EditorView:i,oneDarkHighlightStyle:r,syntaxHighlighting:c}=await import("codemirror-core");this.languageConf=new e,this.readOnlyConf=new e,this.writingModeConf=new e,this.customConf=new e,this.themeConf=new e,this.attributesConf=new e,this._EditorView=i;const h=i.theme({"&":{backgroundColor:"transparent",color:"var(--text)"},".cm-gutters":{backgroundColor:"var(--pane-bg)",color:"var(--text-muted)",borderRight:"1px solid var(--border)"},".cm-content":{fontFamily:"var(--font-mono, monospace)",fontSize:"13px"},"&.cm-focused .cm-cursor":{borderLeftColor:"var(--text)"},"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":{backgroundColor:"rgba(56, 189, 248, 0.35) !important"},".cm-searchMatch":{backgroundColor:"rgba(234, 179, 8, 0.4)"},".cm-activeLine":{backgroundColor:"rgba(255, 255, 255, 0.04)"},".cm-selectionMatch":{backgroundColor:"rgba(255, 255, 255, 0.1)"}});let a=await p(this.language);if(!this.isConnected){this._initializingEditor=!1;return}const f=this.shadowRoot.getElementById("cm-container");if(!f){this._initializingEditor=!1;return}this._view=new i({state:t.create({doc:this.value||`
`,extensions:[o,h,i.lineWrapping,this.attributesConf.of(i.contentAttributes.of(this.writingMode?{spellcheck:"true",autocorrect:"on",autocapitalize:"on"}:{spellcheck:"false",autocorrect:"off",autocapitalize:"off"})),i.exceptionSink.of(d=>console.warn("[CodeMirror] Suppressed internal plugin crash:",d)),this.languageConf.of(a),this.writingModeConf.of([]),this.themeConf.of(document.body.getAttribute("data-theme")!=="light"?c(r):[]),this.readOnlyConf.of(i.editable.of(!this.readOnly)),this.customConf.of(this.customExtensions||[]),i.updateListener.of(d=>{if(d.docChanged){const l=d.state.doc.toString();this.value=l,this.dispatchEvent(new CustomEvent("yenvui-editor-changed",{detail:{value:l},bubbles:!0,composed:!0}))}d.selectionSet&&this.dispatchEvent(new CustomEvent("yenvui-editor-selection",{detail:{cursor:d.state.selection.main.head},bubbles:!0,composed:!0}))}),i.domEventHandlers({scroll:(d,l)=>{this.dispatchEvent(new CustomEvent("yenvui-editor-scroll",{detail:{top:l.scrollDOM.scrollTop},bubbles:!0,composed:!0}))}})]}),parent:f,root:this.shadowRoot}),this._initializingEditor=!1,this._pendingCursor!==void 0&&(this.setCursor(this._pendingCursor),this._pendingCursor=void 0),this._pendingScrollTop!==void 0&&(this.setScrollInfo(this._pendingScrollTop),this._pendingScrollTop=void 0),this.writingMode&&this._updateWritingMode()}getCursor(){return this._view?this._view.state.selection.main.head:this._pendingCursor||0}setCursor(t){this._view&&t!==void 0?this._view.dispatch({selection:{anchor:t}}):t!==void 0&&(this._pendingCursor=t)}getScrollInfo(){return this._view?this._view.scrollDOM.scrollTop:this._pendingScrollTop||0}setScrollInfo(t){this._view&&t!==void 0?requestAnimationFrame(()=>{this._view&&(this._view.scrollDOM.scrollTop=t)}):t!==void 0&&(this._pendingScrollTop=t)}insertAtCursor(t){if(this._view){const e=this.getCursor();this._view.dispatch({changes:{from:e,insert:t},selection:{anchor:e+t.length},scrollIntoView:!0})}}transformContent(t){if(!this._view||typeof t!="function")return!1;const{state:e,dispatch:o}=this._view,i=e.selection.main;if(i.empty){const r=e.doc.toString(),c=t(r);if(c!==r)return o({changes:{from:0,to:r.length,insert:c}}),!0}else{const r=e.sliceDoc(i.from,i.to),c=t(r);if(c!==r)return o({changes:{from:i.from,to:i.to,insert:c}}),!0}return!1}}customElements.define("yenvui-editor",YenvuiEditor);
