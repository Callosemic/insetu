import{LitElement,html,css}from'lit';export class YenvuiAsyncBtn extends LitElement{static properties={label:{type:String},loadingLabel:{type:String},successLabel:{type:String},errorLabel:{type:String},intent:{type:String},status:{type:String},btntype:{type:String}};static styles=css`
        :host { 
            display: inline-block; 
        }
        button {
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 8px 14px;
            font-size: 0.9rem;
            font-family: inherit;
            font-weight: bold;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            white-space: nowrap;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            transition: filter 0.2s ease, transform 0.1s ease;
            color: var(--text, #ffffff);
        }
        
        button:hover:not(:disabled) {
            filter: brightness(1.1);
        }
        
        button:active:not(:disabled) {
            transform: scale(0.98);
        }

        button:disabled {
            opacity: 0.7;
            cursor: not-allowed;
        }

        /* Semantic Intent Mapping */
        .intent-primary { background: var(--intent-primary, #3b82f6); }
        .intent-success { background: var(--intent-success, #10b981); }
        .intent-danger { background: var(--intent-danger, #ef4444); }
        .intent-warning { background: var(--intent-warning, #f59e0b); color: #000000; } /* Amber needs dark text */
        .intent-highlight { background: var(--intent-highlight, #8b5cf6); }
        .intent-neutral { background: var(--intent-neutral, #64748b); }
    `;constructor(){super();this.label='Submit';this.loadingLabel='⏳...';this.successLabel='✅';this.errorLabel='❌';this.intent='primary';this.status='idle';this.btntype='button';}
_handleClick(e){if(this.status==='loading'){if(e){e.stopPropagation();e.preventDefault();}
return;}
this.dispatchEvent(new CustomEvent('yv-click',{bubbles:true,composed:true,detail:{originalEvent:e}}));}
render(){let text=this.label;if(this.status==='loading')text=this.loadingLabel;if(this.status==='success')text=this.successLabel;if(this.status==='error')text=this.errorLabel;let activeIntent=this.intent;if(this.status==='success')activeIntent='success';if(this.status==='error')activeIntent='danger';return html`
            <button 
                type="${this.btntype}"
                class="intent-${activeIntent}" 
                ?disabled=${this.status === 'loading'}
                @click=${this._handleClick}>
                ${text}
            </button>
        `;}}
customElements.define('yenvui-async-btn',YenvuiAsyncBtn);