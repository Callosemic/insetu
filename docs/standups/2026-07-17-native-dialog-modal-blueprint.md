---
title: "Blueprint: Native <dialog> Modal Architecture"
date: 2026-07-17
author: Architect
status: draft
tags: ["Architecture", "UI", "UDF", "Modals"]
---

# Blueprint: Native `<dialog>` Modal Architecture

## 1. Context & Motivation

Currently, the inSetu UI relies on CSS `z-index` manipulation to layer transient views (modals, dropdowns) over the main interface. As the OS scales, this has resulted in "z-index wars" and Stacking Context traps. For example, opening the Prompt Library modal from *inside* the File Editor causes the modal to be physically trapped behind the editor overlay.

We are proposing a migration to the native HTML5 `<dialog>` element. Calling `dialog.showModal()` escapes the CSS stacking context entirely by pushing the element into the browser's native `#top-layer`. This mathematically guarantees it will render above all standard DOM elements, eliminating z-index bugs permanently. Furthermore, it provides native focus-trapping and background inertness (accessibility wins).

However, `<dialog>` introduces imperative APIs (`showModal()`, `close()`) and native state mutations (e.g., the `ESC` key closing the modal automatically). To maintain our strict Unidirectional Data Flow (UDF) engineering standards, we must build an "Ironclad Wrapper" around the element.

---

## 2. Core Architecture Implementation

### A. The "Ironclad" Wrapper (`<insetu-modal>`)

Extensions will continue to use `<insetu-modal>` purely declaratively (`<insetu-modal ?open=${this.storeOpen}>`). They will never directly touch the `<dialog>` API. 

The `<insetu-modal>` Web Component will act as the translation layer between declarative UDF state and imperative DOM mutations.

```javascript
import { LitElement, html, css } from 'lit';

export class InSetuModal extends LitElement {
    static properties = {
        open: { type: Boolean },
        titleText: { type: String }
    };

    // Translation Layer: React to declarative state changes
    updated(changedProperties) {
        if (changedProperties.has('open')) {
            const dialog = this.shadowRoot.querySelector('dialog');
            if (this.open && !dialog.open) {
                dialog.showModal(); // Imperative push to #top-layer
            } else if (!this.open && dialog.open) {
                dialog.close();
            }
        }
    }

    render() {
        return html`
            <dialog 
                @cancel=${this._handleNativeCancel}
                @click=${this._handleBackdropClick}>
                
                <div class="modal-header">
                    <h2>${this.titleText}</h2>
                    <button @click=${this._dispatchClose}>✖</button>
                </div>
                <div class="modal-body">
                    <slot name="body"></slot>
                </div>
                
            </dialog>
        `;
    }
}

```

### B. Defeating the ESC Key Trap (UDF Enforcement)

When a user hits `ESC`, the browser naturally fires a `cancel` event and forcibly removes the `<dialog>` from the screen. If we allow this, the modal disappears but our Zustand store still registers `open: true`—creating an illegal ghost state.

We must intercept the browser, stop it from mutating the DOM, and route the intent up through our standard event bus.

```javascript
    _handleNativeCancel(e) {
        // 1. Stop the browser from implicitly closing the dialog
        e.preventDefault(); 
        
        // 2. Dispatch our custom event to trigger a UDF mutation
        this._dispatchClose(); 
    }

    _dispatchClose() {
        this.dispatchEvent(new CustomEvent('modal-closed', {
            bubbles: true,
            composed: true
        }));
    }

```

### C. Native Backdrop Styling

We will delete the manual `<div class="backdrop">` from our current implementation and rely entirely on the native `::backdrop` pseudo-element, styling it via CSS variables to match our theme engine.

```css
dialog::backdrop {
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(2px);
}
/* Handle Light/Dark/E-Ink themes naturally via host context */

```

---

## 3. Migration Checklist

If approved, the following rollout steps must be executed:

* [ ] **Rewrite `<insetu-modal>`:** Update `ui_modal.js` to replace the `div.panel` and `div.backdrop` with a unified `<dialog>` element.
* [ ] **Implement Lifecycle Bridge:** Add the `updated(changedProperties)` hook to call `showModal()` and `close()`.
* [ ] **Intercept Native Mutators:** Add `@cancel` event listener with `e.preventDefault()`. Add logic to detect clicks directly on the `::backdrop` to close the modal when clicking outside.
* [ ] **Purge Z-Indexes:** Sweep `shared_styles.js` and `style.css` to remove all legacy `z-index: 1000` or `3000` hacks mapped to overlays.
* [ ] **QA Test Nested Modals:** Open the File Editor (`FSStore`), then trigger the Embed Prompt browser (`AppStore`) to verify the prompt modal perfectly stacks on top via the `#top-layer`.

---

## 4. Guardrails & Compliance

* **Strictly Declarative Consumption:** No extension or OS component is permitted to query the DOM for a `<dialog>` node or call `.showModal()` directly. They must pass the `?open=` boolean property.
* **No Local State:** `<insetu-modal>` must not maintain an internal `_isOpen` tracker. It strictly mirrors the `this.open` property provided by the parent.

```

```