import{html as t,css as e}from"lit";import{YenvuiBase as o}from"./yenvui-base.js";export class YenvuiCategorySection extends o{static properties={titleText:{type:String}};static styles=e`
        :host {
            display: block;
        }
        .category-heading {
            margin-top: 25px;
            margin-bottom: 15px;
            font-size: 1.2rem;
            font-weight: bold;
            color: var(--text, #e0e0e0);
            border-bottom: 1px solid var(--border, #444);
            padding-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        :host([data-theme="e-ink"]) .category-heading {
            color: #000000;
            border-bottom: 2px solid #000000;
        }
    `;render(){return t`
            <div class="category-heading">
                <span>${this.titleText}</span>
                <slot name="header-actions"></slot>
            </div>
            <div class="category-content">
                <slot></slot>
            </div>
        `}}customElements.define("yenvui-category-section",YenvuiCategorySection);
