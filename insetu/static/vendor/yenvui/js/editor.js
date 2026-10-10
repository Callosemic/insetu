import{LitElement as w,html as C,css as v}from"lit";async function p(i){try{const t=await import("codemirror-core");return i==="python"?t.python():i==="json"?t.json():i==="javascript"||i==="ts"?t.javascript():i==="yaml"||i==="yml"?t.yaml():i==="html"||i==="htm"?t.htmlLang():i==="css"?t.cssLang():i==="rust"&&t.rust?t.rust():i==="go"&&t.go?t.go():t.markdown()}catch(t){return console.warn(`[yenVUI] Failed to dynamically load language: ${i}`,t),[]}}export class YenvuiEditor extends w{static properties={value:{type:String},readOnly:{type:Boolean},language:{type:String},writingMode:{type:Boolean},customExtensions:{type:Array}};static styles=v`
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
    `;constructor(){super(),this.value="",this.readOnly=!1,this.language="markdown",this.writingMode=!1,this.customExtensions=[],this._view=null,this._EditorView=null,this._initializingEditor=!1,this.languageConf=null,this.readOnlyConf=null,this.writingModeConf=null,this.customConf=null,this.themeConf=null,this.attributesConf=null}connectedCallback(){super.connectedCallback(),this._themeListener=()=>{const t=document.body.getAttribute("data-theme")||"dark";this.setAttribute("data-theme",t),this._updateTheme()},window.addEventListener("insetu:theme-changed",this._themeListener),this.setAttribute("data-theme",document.body.getAttribute("data-theme")||"dark"),setTimeout(()=>this._initEditor(),0)}disconnectedCallback(){super.disconnectedCallback(),this._themeListener&&window.removeEventListener("insetu:theme-changed",this._themeListener),this._view&&(this._view.destroy(),this._view=null)}updated(t){if(this._view&&this._EditorView){if(t.has("value")){const e=this._view.state.doc.toString(),s=this.value||`
`;e!==this.value&&e!==s&&this._view.dispatch({changes:{from:0,to:e.length,insert:s}})}t.has("readOnly")&&this.readOnlyConf&&this._view.dispatch({effects:this.readOnlyConf.reconfigure(this._EditorView.editable.of(!this.readOnly))}),t.has("language")&&this.languageConf&&p(this.language).then(e=>{this._view&&this._view.dispatch({effects:this.languageConf.reconfigure(e)})}),t.has("customExtensions")&&this.customConf&&this._view.dispatch({effects:this.customConf.reconfigure(this.customExtensions||[])}),t.has("writingMode")&&this.writingModeConf&&this._updateWritingMode()}}async _updateWritingMode(){if(!(!this._view||!this.writingModeConf))if(this.writingMode){const{EditorView:t,keymap:e,EditorSelection:s}=await import("codemirror-core"),o=(a,r)=>{const{state:l,dispatch:c}=a,h=l.changeByRange(n=>{const d=l.sliceDoc(n.from,n.to);if(d.startsWith(r)&&d.endsWith(r)&&d.length>=r.length*2){const u=d.slice(r.length,-r.length);return{changes:{from:n.from,to:n.to,insert:u},range:s.range(n.from,n.from+u.length)}}else{const u=`${r}${d}${r}`,g=n.empty?r.length:u.length;return{changes:{from:n.from,to:n.to,insert:u},range:s.range(n.from+g,n.from+g)}}});return c(h),!0},f=t.theme({".cm-scroller .cm-content":{fontFamily:"var(--font-serif, 'Georgia', 'Cambria', 'Times New Roman', 'Source Serif Pro', serif) !important",fontSize:"1.1rem",lineHeight:"1.8",maxWidth:"720px",margin:"0 auto",padding:"30px 10px 80px 10px"},".cm-scroller .cm-line":{maxWidth:"720px"},".cm-gutters":{display:"none"}}),m=e.of([{key:"Mod-b",run:a=>o(a,"**")},{key:"Mod-i",run:a=>o(a,"*")},{key:"Mod-`",run:a=>o(a,"`")}]);this._view.dispatch({effects:[this.writingModeConf.reconfigure([f,m]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"true",autocorrect:"on",autocapitalize:"on"}))]})}else this._view.dispatch({effects:[this.writingModeConf.reconfigure([]),this.attributesConf.reconfigure(this._EditorView.contentAttributes.of({spellcheck:"false",autocorrect:"off",autocapitalize:"off"}))]})}async _updateTheme(){if(this._view&&this.themeConf){const t=document.body.getAttribute("data-theme")||"dark";try{const{oneDarkHighlightStyle:e,syntaxHighlighting:s}=await import("codemirror-core");this._view.dispatch({effects:this.themeConf.reconfigure(t!=="light"?s(e):[])})}catch(e){console.warn("[yenVUI] Failed to update CodeMirror theme",e)}}this._view&&this.requestUpdate()}render(){return C`<div id="cm-container" style="flex: 1; display: flex; flex-direction: column; min-height: 0; height: 100%;"></div>`}async _initEditor(){if(this._view||this._initializingEditor)return;this._initializingEditor=!0;const{EditorState:t,Compartment:e,basicSetup:s,EditorView:o,oneDarkHighlightStyle:f,syntaxHighlighting:m}=await import("codemirror-core");this.languageConf=new e,this.readOnlyConf=new e,this.writingModeConf=new e,this.customConf=new e,this.themeConf=new e,this.attributesConf=new e,this._EditorView=o;const a=o.theme({"&":{backgroundColor:"transparent",color:"var(--text)"},".cm-gutters":{backgroundColor:"var(--pane-bg)",color:"var(--text-muted)",borderRight:"1px solid var(--border)"},".cm-content":{fontFamily:"var(--font-mono, monospace)",fontSize:"13px"},"&.cm-focused .cm-cursor":{borderLeftColor:"var(--text)"},"&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":{backgroundColor:"rgba(56, 189, 248, 0.35) !important"},".cm-searchMatch":{backgroundColor:"rgba(234, 179, 8, 0.4)"},".cm-activeLine":{backgroundColor:"rgba(255, 255, 255, 0.04)"},".cm-selectionMatch":{backgroundColor:"rgba(255, 255, 255, 0.1)"}});let r=await p(this.language);if(!this.isConnected){this._initializingEditor=!1;return}const l=this.shadowRoot.getElementById("cm-container");if(!l){this._initializingEditor=!1;return}this._view=new o({state:t.create({doc:this.value||`
`,extensions:[s,a,o.lineWrapping,this.attributesConf.of(o.contentAttributes.of(this.writingMode?{spellcheck:"true",autocorrect:"on",autocapitalize:"on"}:{spellcheck:"false",autocorrect:"off",autocapitalize:"off"})),o.exceptionSink.of(c=>console.warn("[CodeMirror] Suppressed internal plugin crash:",c)),this.languageConf.of(r),this.writingModeConf.of([]),this.themeConf.of(document.body.getAttribute("data-theme")!=="light"?m(f):[]),this.readOnlyConf.of(o.editable.of(!this.readOnly)),this.customConf.of(this.customExtensions||[]),o.updateListener.of(c=>{if(c.docChanged){const h=c.state.doc.toString();this.value=h,this.dispatchEvent(new CustomEvent("yenvui-editor-changed",{detail:{value:h},bubbles:!0,composed:!0}))}c.selectionSet&&this.dispatchEvent(new CustomEvent("yenvui-editor-selection",{detail:{cursor:c.state.selection.main.head},bubbles:!0,composed:!0}))}),o.domEventHandlers({scroll:(c,h)=>{this.dispatchEvent(new CustomEvent("yenvui-editor-scroll",{detail:{top:h.scrollDOM.scrollTop},bubbles:!0,composed:!0}))}})]}),parent:l,root:this.shadowRoot}),this._initializingEditor=!1,this._pendingCursor!==void 0&&(this.setCursor(this._pendingCursor),this._pendingCursor=void 0),this._pendingScrollTop!==void 0&&(this.setScrollInfo(this._pendingScrollTop),this._pendingScrollTop=void 0),this.writingMode&&this._updateWritingMode()}getCursor(){return this._view?this._view.state.selection.main.head:this._pendingCursor||0}setCursor(t){this._view&&t!==void 0?this._view.dispatch({selection:{anchor:t}}):t!==void 0&&(this._pendingCursor=t)}getScrollInfo(){return this._view?this._view.scrollDOM.scrollTop:this._pendingScrollTop||0}setScrollInfo(t){this._view&&t!==void 0?requestAnimationFrame(()=>{this._view&&(this._view.scrollDOM.scrollTop=t)}):t!==void 0&&(this._pendingScrollTop=t)}insertAtCursor(t){if(this._view){const e=this.getCursor();this._view.dispatch({changes:{from:e,insert:t},selection:{anchor:e+t.length},scrollIntoView:!0})}}}customElements.define("yenvui-editor",YenvuiEditor);
