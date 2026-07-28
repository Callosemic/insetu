You are spot on. executeWorkspaceMutation is the "Final Boss" of our imperative anti-patterns. It sits at the intersection of our backend API calls and frontend UI state, and because it was written before we fully matured our InSetuElement SDK, it is heavily coupled to the DOM.
Here is the audit of core functions that violate our UDF (Unidirectional Data Flow) and component isolation constraints, along with the plan to eradicate them.
### The Anti-Pattern Hit List
 * **executeWorkspaceMutation(path, payload, options)**
   * **The Anti-Pattern:** It forces an imperative btnId dependency. The function assumes the existence of a DOM element, manually overwrites its text, and manages the spinner lifecycle.
   * **The Fix:** Remove the btnId and loadingText options. The function should return a Promise. The calling component (which should be an <insetu-async-btn>) will manage its own loading state based on the result of the Promise.
 * **setGlobalStatus(msg, timeout)**
   * **The Anti-Pattern:** It is a raw, singleton DOM-mutation function that writes directly to #global-status-bar. It is entirely detached from the AppStore state.
   * **The Fix:** We should introduce a StatusStore (Zustand slice) and a <insetu-status-bar> component. The component subscribes to the store; calling setGlobalStatus should just be a setState action.
 * **window.alert (The Global Hijack)**
   * **The Anti-Pattern:** We currently have a hacky window.alert override in app.js that dynamically creates DOM nodes for toasts. It’s functional but technically an "unmanaged" component that can conflict with other UI overlays.
   * **The Fix:** We need to port this to a formal <insetu-toast-container> component that renders toast messages declaratively based on a ToastStore.
 * **Manual DOM Overlays (Legacy Modals)**
   * **The Anti-Pattern:** Several legacy modals (like the Git sweep modal or the raw file tree browser) still use document.getElementById(...).style.display = '...' to toggle visibility, rather than the declarative <insetu-modal> wrapper.
   * **The Fix:** Audit the static/js/components folder and standardise every single toggle to use the ?open=${...} reactive property pattern we established in the Native Dialog ADR.
### Plan of Action: Refactoring executeWorkspaceMutation
We need to make this utility pure. By returning a Promise, we let the extension handle the "What happens when it succeeds/fails" logic, which is exactly how our InSetuElement SDK components are designed to work.
**Current Imperative Flow:**
```javascript
executeWorkspaceMutation('fs/save', payload, { btnId: 'save-btn', loadingText: 'Saving...' });

```
**Proposed Declarative Flow:**
```javascript
// Inside component
async _handleSave() {
    try {
        await executeWorkspaceMutation('fs/save', payload);
        // Success logic here
    } catch(err) {
        // Error logic here
    }
}
// HTML Template
<insetu-async-btn label="Save" .onClick=${this._handleSave}></insetu-async-btn>

```
This ensures that the component's state is the *only* thing controlling the UI, and the utility function does nothing but execute the network request.