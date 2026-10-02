import{html as t,css as o}from"lit";import{YenvuiBase as r}from"./yenvui-base.js";export class YenvuiDropdown extends r{static properties={items:{type:Array},open:{type:Boolean,reflect:!0},align:{type:String}};static styles=o`
        :host { display: block; height: 100%; }
        .dropdown-menu {
            position: absolute;
            top: calc(100% + 5px);
            background: var(--pane-bg, #1e1e1e);
            border: 1px solid var(--border, #444);
            border-radius: 6px;
            padding: 5px;
            min-width: 220px;
            box-shadow: var(--overlay-shadow);
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        :host([align="left"]) .dropdown-menu { left: 0; right: auto; }
        :host([align="right"]) .dropdown-menu { right: 0; left: auto; }
        :host(:not([align])) .dropdown-menu { right: 0; left: auto; }

        .divider { height: 1px; background: var(--border, #444); margin: 4px 0; }
        .menu-item {
            background: transparent; color: var(--text, #e0e0e0); text-align: left; 
            padding: 8px 12px; border: none; border-radius: 4px; cursor: pointer; 
            font-size: 0.9rem; font-weight: bold; margin: 0; display: flex; 
            align-items: center; gap: 8px; width: 100%; box-sizing: border-box;
        }
        .menu-item:hover { background: var(--input-bg, #2d2d2d); }
        .icon { font-size: 1.1rem; line-height: 1; }
    `;constructor(){super(),this.items=[],this.open=!1,this.align="right"}connectedCallback(){super.connectedCallback(),this.registerOutsideClick&&this.registerOutsideClick(()=>{this.open&&(this.open=!1)})}_toggle(e){this.open=!this.open}_executeItem(e,i){this.open=!1,e.onClick&&e.onClick(i)}render(){return t`
            <div style="position: relative; display: flex; align-items: stretch; width: 100%; height: 100%;">
                <div @click=${this._toggle} style="display: flex; align-items: stretch; width: 100%; height: 100%;">
                    <slot name="trigger"></slot>
                </div>
                ${this.open&&this.items&&this.items.length>0?t`
                    <div class="dropdown-menu">
                        ${this.items.map(e=>e.divider?t`<div class="divider"></div>`:t`
                            <button class="menu-item" @click=${i=>this._executeItem(e,i)}>
                                ${e.icon?t`<span class="icon">${e.icon}</span>`:""}
                                <span>${e.label}</span>
                            </button>
                        `)}
                    </div>
                `:""}
            </div>
        `}}customElements.define("yenvui-dropdown",YenvuiDropdown);export class YenvuiFilterDropdown extends r{static properties={filterText:{type:String},open:{type:Boolean,reflect:!0},hasFilters:{type:Boolean}};static styles=o`
        :host { display: block; position: static; height: 100%; }
        .container { display: flex; align-items: stretch; height: 100%; }
        .panel {
            display: none; position: absolute; top: 100%; left: 0; right: 0;
            z-index: 2000; padding: 15px 20px; background: var(--pane-bg, #1e1e1e); border-bottom: 1px solid var(--border, #444);
            box-shadow: var(--overlay-shadow);
            max-height: 50vh; overflow-y: auto;
        }
        :host([open]) .panel { display: flex; flex-direction: column; }

        .system-action-btn { 
            background: var(--rail-bg, transparent); color: var(--text-muted, #888); border: none;
            border-left: 1px solid var(--border, #444); 
            border-radius: 0; border-top-right-radius: inherit; border-bottom-right-radius: inherit;
            cursor: pointer; font-weight: bold; width: 44px; height: 100%; 
            display: flex; align-items: center; justify-content: center; padding: 0; 
            font-size: 1.1rem; transition: background 0.2s, color 0.2s; margin: 0; box-sizing: border-box;
        }
        .system-action-btn:hover { background: var(--rail-hover, var(--input-bg, #2d2d2d)); color: var(--text); }
        
        .btn {
            padding: 4px 8px; margin: 0; font-size: 0.85rem; white-space: nowrap;
            max-width: 250px; overflow: hidden; text-overflow: ellipsis;
            background: transparent; border: 1px solid transparent; color: var(--text, #e0e0e0);
        }
        :host([open]) .btn { background: var(--input-bg, #2d2d2d); border-color: var(--border, #444); }
    `;constructor(){super(),this.open=!1,this.filterText="Filters",this.hasFilters=!1}connectedCallback(){super.connectedCallback(),this.registerOutsideClick(()=>{this.open&&(this.open=!1)})}render(){return t`
            <div class="container">
                <button class="system-action-btn" title=${this.filterText} @click=${()=>this.open=!this.open} style="opacity: ${this.hasFilters?"1":"0.5"};">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                </button>
                <div class="panel">
                    <slot></slot>
                </div>
            </div>
        `}}customElements.define("yenvui-filter-dropdown",YenvuiFilterDropdown);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiPHN0ZGluPiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgaHRtbCwgY3NzIH0gZnJvbSAnbGl0JztcbmltcG9ydCB7IFllbnZ1aUJhc2UgfSBmcm9tICcuL3llbnZ1aS1iYXNlLmpzJztcblxuZXhwb3J0IGNsYXNzIFllbnZ1aURyb3Bkb3duIGV4dGVuZHMgWWVudnVpQmFzZSB7XG4gICAgc3RhdGljIHByb3BlcnRpZXMgPSB7XG4gICAgICAgIGl0ZW1zOiB7IHR5cGU6IEFycmF5IH0sXG4gICAgICAgIG9wZW46IHsgdHlwZTogQm9vbGVhbiwgcmVmbGVjdDogdHJ1ZSB9LFxuICAgICAgICBhbGlnbjogeyB0eXBlOiBTdHJpbmcgfVxuICAgIH07XG4gICAgc3RhdGljIHN0eWxlcyA9IGNzc2BcbiAgICAgICAgOmhvc3QgeyBkaXNwbGF5OiBibG9jazsgaGVpZ2h0OiAxMDAlOyB9XG4gICAgICAgIC5kcm9wZG93bi1tZW51IHtcbiAgICAgICAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgICAgICAgIHRvcDogY2FsYygxMDAlICsgNXB4KTtcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLXBhbmUtYmcsICMxZTFlMWUpO1xuICAgICAgICAgICAgYm9yZGVyOiAxcHggc29saWQgdmFyKC0tYm9yZGVyLCAjNDQ0KTtcbiAgICAgICAgICAgIGJvcmRlci1yYWRpdXM6IDZweDtcbiAgICAgICAgICAgIHBhZGRpbmc6IDVweDtcbiAgICAgICAgICAgIG1pbi13aWR0aDogMjIwcHg7XG4gICAgICAgICAgICBib3gtc2hhZG93OiB2YXIoLS1vdmVybGF5LXNoYWRvdyk7XG4gICAgICAgICAgICB6LWluZGV4OiAyMDAwO1xuICAgICAgICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XG4gICAgICAgICAgICBnYXA6IDJweDtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbYWxpZ249XCJsZWZ0XCJdKSAuZHJvcGRvd24tbWVudSB7IGxlZnQ6IDA7IHJpZ2h0OiBhdXRvOyB9XG4gICAgICAgIDpob3N0KFthbGlnbj1cInJpZ2h0XCJdKSAuZHJvcGRvd24tbWVudSB7IHJpZ2h0OiAwOyBsZWZ0OiBhdXRvOyB9XG4gICAgICAgIDpob3N0KDpub3QoW2FsaWduXSkpIC5kcm9wZG93bi1tZW51IHsgcmlnaHQ6IDA7IGxlZnQ6IGF1dG87IH1cblxuICAgICAgICAuZGl2aWRlciB7IGhlaWdodDogMXB4OyBiYWNrZ3JvdW5kOiB2YXIoLS1ib3JkZXIsICM0NDQpOyBtYXJnaW46IDRweCAwOyB9XG4gICAgICAgIC5tZW51LWl0ZW0ge1xuICAgICAgICAgICAgYmFja2dyb3VuZDogdHJhbnNwYXJlbnQ7IGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTsgdGV4dC1hbGlnbjogbGVmdDsgXG4gICAgICAgICAgICBwYWRkaW5nOiA4cHggMTJweDsgYm9yZGVyOiBub25lOyBib3JkZXItcmFkaXVzOiA0cHg7IGN1cnNvcjogcG9pbnRlcjsgXG4gICAgICAgICAgICBmb250LXNpemU6IDAuOXJlbTsgZm9udC13ZWlnaHQ6IGJvbGQ7IG1hcmdpbjogMDsgZGlzcGxheTogZmxleDsgXG4gICAgICAgICAgICBhbGlnbi1pdGVtczogY2VudGVyOyBnYXA6IDhweDsgd2lkdGg6IDEwMCU7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgLm1lbnUtaXRlbTpob3ZlciB7IGJhY2tncm91bmQ6IHZhcigtLWlucHV0LWJnLCAjMmQyZDJkKTsgfVxuICAgICAgICAuaWNvbiB7IGZvbnQtc2l6ZTogMS4xcmVtOyBsaW5lLWhlaWdodDogMTsgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuaXRlbXMgPSBbXTtcbiAgICAgICAgdGhpcy5vcGVuID0gZmFsc2U7XG4gICAgICAgIHRoaXMuYWxpZ24gPSAncmlnaHQnO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBzdXBlci5jb25uZWN0ZWRDYWxsYmFjaygpO1xuICAgICAgICBpZiAodGhpcy5yZWdpc3Rlck91dHNpZGVDbGljaykge1xuICAgICAgICAgICAgdGhpcy5yZWdpc3Rlck91dHNpZGVDbGljaygoKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMub3BlbikgdGhpcy5vcGVuID0gZmFsc2U7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF90b2dnbGUoZSkge1xuICAgICAgICB0aGlzLm9wZW4gPSAhdGhpcy5vcGVuO1xuICAgIH1cblxuICAgIF9leGVjdXRlSXRlbShpdGVtLCBlKSB7XG4gICAgICAgIHRoaXMub3BlbiA9IGZhbHNlO1xuICAgICAgICBpZiAoaXRlbS5vbkNsaWNrKSBpdGVtLm9uQ2xpY2soZSk7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPVwicG9zaXRpb246IHJlbGF0aXZlOyBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogc3RyZXRjaDsgd2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTtcIj5cbiAgICAgICAgICAgICAgICA8ZGl2IEBjbGljaz0ke3RoaXMuX3RvZ2dsZX0gc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogc3RyZXRjaDsgd2lkdGg6IDEwMCU7IGhlaWdodDogMTAwJTtcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNsb3QgbmFtZT1cInRyaWdnZXJcIj48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgJHt0aGlzLm9wZW4gJiYgdGhpcy5pdGVtcyAmJiB0aGlzLml0ZW1zLmxlbmd0aCA+IDAgPyBodG1sYFxuICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZHJvcGRvd24tbWVudVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgJHt0aGlzLml0ZW1zLm1hcChpdGVtID0+IGl0ZW0uZGl2aWRlciA/IGh0bWxgPGRpdiBjbGFzcz1cImRpdmlkZXJcIj48L2Rpdj5gIDogaHRtbGBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzPVwibWVudS1pdGVtXCIgQGNsaWNrPSR7KGUpID0+IHRoaXMuX2V4ZWN1dGVJdGVtKGl0ZW0sIGUpfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtpdGVtLmljb24gPyBodG1sYDxzcGFuIGNsYXNzPVwiaWNvblwiPiR7aXRlbS5pY29ufTwvc3Bhbj5gIDogJyd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPiR7aXRlbS5sYWJlbH08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgICBgKX1cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgYCA6ICcnfVxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgIGA7XG4gICAgfVxufVxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKCd5ZW52dWktZHJvcGRvd24nLCBZZW52dWlEcm9wZG93bik7XG5leHBvcnQgY2xhc3MgWWVudnVpRmlsdGVyRHJvcGRvd24gZXh0ZW5kcyBZZW52dWlCYXNlIHtcbiAgICBzdGF0aWMgcHJvcGVydGllcyA9IHtcbiAgICAgICAgZmlsdGVyVGV4dDogeyB0eXBlOiBTdHJpbmcgfSxcbiAgICAgICAgb3BlbjogeyB0eXBlOiBCb29sZWFuLCByZWZsZWN0OiB0cnVlIH0sXG4gICAgICAgIGhhc0ZpbHRlcnM6IHsgdHlwZTogQm9vbGVhbiB9XG4gICAgfTtcbiAgICBzdGF0aWMgc3R5bGVzID0gY3NzYFxuICAgICAgICA6aG9zdCB7IGRpc3BsYXk6IGJsb2NrOyBwb3NpdGlvbjogc3RhdGljOyBoZWlnaHQ6IDEwMCU7IH1cbiAgICAgICAgLmNvbnRhaW5lciB7IGRpc3BsYXk6IGZsZXg7IGFsaWduLWl0ZW1zOiBzdHJldGNoOyBoZWlnaHQ6IDEwMCU7IH1cbiAgICAgICAgLnBhbmVsIHtcbiAgICAgICAgICAgIGRpc3BsYXk6IG5vbmU7IHBvc2l0aW9uOiBhYnNvbHV0ZTsgdG9wOiAxMDAlOyBsZWZ0OiAwOyByaWdodDogMDtcbiAgICAgICAgICAgIHotaW5kZXg6IDIwMDA7IHBhZGRpbmc6IDE1cHggMjBweDsgYmFja2dyb3VuZDogdmFyKC0tcGFuZS1iZywgIzFlMWUxZSk7IGJvcmRlci1ib3R0b206IDFweCBzb2xpZCB2YXIoLS1ib3JkZXIsICM0NDQpO1xuICAgICAgICAgICAgYm94LXNoYWRvdzogdmFyKC0tb3ZlcmxheS1zaGFkb3cpO1xuICAgICAgICAgICAgbWF4LWhlaWdodDogNTB2aDsgb3ZlcmZsb3cteTogYXV0bztcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbb3Blbl0pIC5wYW5lbCB7IGRpc3BsYXk6IGZsZXg7IGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IH1cblxuICAgICAgICAuc3lzdGVtLWFjdGlvbi1idG4geyBcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IHZhcigtLXJhaWwtYmcsIHRyYW5zcGFyZW50KTsgY29sb3I6IHZhcigtLXRleHQtbXV0ZWQsICM4ODgpOyBib3JkZXI6IG5vbmU7XG4gICAgICAgICAgICBib3JkZXItbGVmdDogMXB4IHNvbGlkIHZhcigtLWJvcmRlciwgIzQ0NCk7IFxuICAgICAgICAgICAgYm9yZGVyLXJhZGl1czogMDsgYm9yZGVyLXRvcC1yaWdodC1yYWRpdXM6IGluaGVyaXQ7IGJvcmRlci1ib3R0b20tcmlnaHQtcmFkaXVzOiBpbmhlcml0O1xuICAgICAgICAgICAgY3Vyc29yOiBwb2ludGVyOyBmb250LXdlaWdodDogYm9sZDsgd2lkdGg6IDQ0cHg7IGhlaWdodDogMTAwJTsgXG4gICAgICAgICAgICBkaXNwbGF5OiBmbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjsgcGFkZGluZzogMDsgXG4gICAgICAgICAgICBmb250LXNpemU6IDEuMXJlbTsgdHJhbnNpdGlvbjogYmFja2dyb3VuZCAwLjJzLCBjb2xvciAwLjJzOyBtYXJnaW46IDA7IGJveC1zaXppbmc6IGJvcmRlci1ib3g7XG4gICAgICAgIH1cbiAgICAgICAgLnN5c3RlbS1hY3Rpb24tYnRuOmhvdmVyIHsgYmFja2dyb3VuZDogdmFyKC0tcmFpbC1ob3ZlciwgdmFyKC0taW5wdXQtYmcsICMyZDJkMmQpKTsgY29sb3I6IHZhcigtLXRleHQpOyB9XG4gICAgICAgIFxuICAgICAgICAuYnRuIHtcbiAgICAgICAgICAgIHBhZGRpbmc6IDRweCA4cHg7IG1hcmdpbjogMDsgZm9udC1zaXplOiAwLjg1cmVtOyB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgICAgICAgbWF4LXdpZHRoOiAyNTBweDsgb3ZlcmZsb3c6IGhpZGRlbjsgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDsgYm9yZGVyOiAxcHggc29saWQgdHJhbnNwYXJlbnQ7IGNvbG9yOiB2YXIoLS10ZXh0LCAjZTBlMGUwKTtcbiAgICAgICAgfVxuICAgICAgICA6aG9zdChbb3Blbl0pIC5idG4geyBiYWNrZ3JvdW5kOiB2YXIoLS1pbnB1dC1iZywgIzJkMmQyZCk7IGJvcmRlci1jb2xvcjogdmFyKC0tYm9yZGVyLCAjNDQ0KTsgfVxuICAgIGA7XG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMub3BlbiA9IGZhbHNlO1xuICAgICAgICB0aGlzLmZpbHRlclRleHQgPSAnRmlsdGVycyc7XG4gICAgICAgIHRoaXMuaGFzRmlsdGVycyA9IGZhbHNlO1xuICAgIH1cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgc3VwZXIuY29ubmVjdGVkQ2FsbGJhY2soKTtcbiAgICAgICAgdGhpcy5yZWdpc3Rlck91dHNpZGVDbGljaygoKSA9PiB7XG4gICAgICAgICAgICBpZiAodGhpcy5vcGVuKSB0aGlzLm9wZW4gPSBmYWxzZTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIHJlbmRlcigpIHtcbiAgICAgICAgcmV0dXJuIGh0bWxgXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiY29udGFpbmVyXCI+XG4gICAgICAgICAgICAgICAgPGJ1dHRvbiBjbGFzcz1cInN5c3RlbS1hY3Rpb24tYnRuXCIgdGl0bGU9JHt0aGlzLmZpbHRlclRleHR9IEBjbGljaz0keygpID0+IHRoaXMub3BlbiA9ICF0aGlzLm9wZW59IHN0eWxlPVwib3BhY2l0eTogJHt0aGlzLmhhc0ZpbHRlcnMgPyAnMScgOiAnMC41J307XCI+XG4gICAgICAgICAgICAgICAgICAgIDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHdpZHRoPVwiMTRcIiBoZWlnaHQ9XCIxNFwiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48cG9seWdvbiBwb2ludHM9XCIyMiAzIDIgMyAxMCAxMi40NiAxMCAxOSAxNCAyMSAxNCAxMi40NiAyMiAzXCI+PC9wb2x5Z29uPjwvc3ZnPlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJwYW5lbFwiPlxuICAgICAgICAgICAgICAgICAgICA8c2xvdD48L3Nsb3Q+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgYDtcbiAgICB9XG59XG5jdXN0b21FbGVtZW50cy5kZWZpbmUoJ3llbnZ1aS1maWx0ZXItZHJvcGRvd24nLCBZZW52dWlGaWx0ZXJEcm9wZG93bik7Il0sCiAgIm1hcHBp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
