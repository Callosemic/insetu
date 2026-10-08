import{html as e,css as n}from"lit";import{YenvuiBase as a}from"./yenvui-base.js";export class YenvuiSearchBar extends a{static properties={placeholder:{type:String},value:{type:String}};static styles=n`
        :host { display: block; }
        .fuzzy-search-wrapper {
            display: flex;
            align-items: center;
            background: transparent;
            border: none;
            border-radius: 4px;
            padding: 0;
            width: 100%;
            height: 34px;
            box-sizing: border-box;
        }
        input {
            flex: 1;
            border: none !important;
            background: transparent !important;
            outline: none;
            color: var(--text, #e0e0e0);
            padding: 0;
            margin: 0;
            height: 100%;
            font-size: 0.95rem;
            box-shadow: none !important;
            font-family: inherit;
        }
        input::placeholder {
            color: var(--text-muted, #888);
            opacity: 0.6;
        }
        .fuzzy-search-clear {
            background: var(--intent-neutral, #64748b);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 0.65rem;
            font-weight: bold;
            padding: 2px 8px;
            cursor: pointer;
            margin-left: 8px;
        }
        /* High Contrast Themes */
        :host([data-theme="light"]) .fuzzy-search-wrapper {
            background: transparent;
            border: none;
        }
        :host([data-theme="e-ink"]) .fuzzy-search-wrapper {
            border: none !important;
            border-radius: 0 !important;
            background: transparent !important;
        }
        :host([data-theme="e-ink"]) input {
            border: none !important;
            box-shadow: none !important;
        }
    `;constructor(){super(),this.placeholder="Search...",this.value="",this._debounceTimer=null}disconnectedCallback(){super.disconnectedCallback(),this._debounceTimer&&clearTimeout(this._debounceTimer)}_handleInput(t){const r=t.target.value;this._debounceTimer&&clearTimeout(this._debounceTimer),this._debounceTimer=setTimeout(()=>{this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:r},bubbles:!0,composed:!0}))},250)}_handleClear(){this._debounceTimer&&clearTimeout(this._debounceTimer),this.dispatchEvent(new CustomEvent("yenvui-search-changed",{detail:{value:""},bubbles:!0,composed:!0}))}render(){return e`
            <div class="fuzzy-search-wrapper">
                <yv-icon name="search" stroke-width="2.5" style="width: 14px; height: 14px; color: var(--text-muted); margin-right: 8px; flex-shrink: 0;"></yv-icon>
                <input type="text" .placeholder=${this.placeholder} .value=${this.value} @input=${this._handleInput}>
                ${this.value?e`<button class="fuzzy-search-clear" @click=${this._handleClear}>Clear</button>`:""}
            </div>
        `}}customElements.define("yenvui-search-bar",YenvuiSearchBar);
