# 05: inSetu Extension Developer Guide (The "Pit of Success")

**Identity**: The Architect.
**Mission**: To define the required pathways for building inSetu extensions. By utilizing the SDK, the easiest way to write an extension is mathematically the safest, most compliant way.

---

## 1. The SDK Philosophy (ADR 0017)
Extensions must never manually wire multi-tenant boundaries, write raw SQLite creation loops, or orchestrate manual DOM teardowns. The core Micro-Kernel provides an SDK that encapsulates these responsibilities. If you find yourself importing raw `os`, `sqlite3`, or `zustand/vanilla`, you are violating the architecture.

## 2. Backend: The `InSetuExtension` Contract
All backend extensions must be instantiated using the `InSetuExtension` wrapper, not raw Flask Blueprints.

### The Declarative Schema
Do not hook into `system_boot` to execute `CREATE TABLE`. Pass a `schema` dictionary to the constructor. The OS will automatically handle schema migrations via diffing on boot.

```python
from insetu.sdk import InSetuExtension

MY_SCHEMA = {
    "my_table": {
        "id": "TEXT PRIMARY KEY",
        "name": "TEXT NOT NULL"
    }
}

my_ext_bp = InSetuExtension('my_ext', __name__, schema=MY_SCHEMA)
```

### The Extension Context (`ctx`)
Routes must be declared relative to the extension root (e.g., `@bp.route('list')`). The SDK automatically resolves this to `/api/<workspace_id>/ext_name/list`. 

Handlers must accept the `ctx` object. This object enforces spatial physics and prevents cross-tenant contamination:
* **`ctx.db`**: Returns an SQLite connection already keyed to the active workspace.
* **`ctx.paths`**: Returns the active tenant's directory resolution maps.
* **`ctx.vfs.save()`**: Routes all file writes through the atomic background commit queue.
* **`ctx.resolve_path(filepath)`**: Anchors relative paths to the physical workspace bounds natively.
```python
@my_ext_bp.route('save', methods=['POST'])
def save_data(ctx):
    data = ctx.req.json
    # Write to the DB safely
    ctx.db.execute("INSERT INTO my_table (id, name) VALUES (?, ?)", (data['id'], data['name']))
    ctx.db.commit()
    return {"status": "success"}
```

### 2.5 Multi-Track Event Parity
When building performance-optimized extensions that cache filesystem metadata into an SQLite layer (CQRS), do not assume all workspace updates arrive in batch arrays. 

Cache-rebuilding functions must listen to the complete lifecycle triad:
1. `vfs_transaction_committed` (For multi-file bridge syncs).
2. `post_file_save` (For individual UI editor/modal saves).
3. `post_file_delete` (For individual UI deletion actions).
### The Typed Event Bus (Hook Signatures)
When subscribing to OS lifecycle events via `@hooks.on()`, always cross-reference the `TypedDict` definitions at the top of `insetu/hooks.py`. These structural contracts (e.g., `HookPayload_FileMutation`) guarantee the exact `kwargs` available, eliminating payload hallucination.

## 3. Frontend: The `InSetuElement` Contract
All UI components must extend the `InSetuElement` Lit wrapper. 

### Unidirectional Data Flow (UDF) & State
Never import `createStore` from `zustand` directly. Use `createExtensionStore`, which automatically scopes `localStorage` keys by `workspace_id` to prevent cross-tenant bleeding.

```javascript
import { createExtensionStore, InSetuElement } from '../sdk.js';

export const MyStore = createExtensionStore('MyExt', {
    items: [],
    loading: false
});
```

### Memory Hygiene & Subscriptions
Never manually assign and tear down store subscriptions inside `disconnectedCallback`. Use `this.subscribe()`.

```javascript
export class MyComponent extends InSetuElement {
    connectedCallback() {
        super.connectedCallback();
        // The SDK automatically destroys this listener on unmount
        this.subscribe(MyStore, state => {
            this.items = state.items;
        });
    }
    
    // Natively reacts to the user hot-swapping workspaces
    onWorkspaceChanged(newWorkspaceId) {
        // Fetch new data for the new tenant
    }
}
```

### Network Requests
Raw `fetch()` calls and manual URL strings (e.g., `/api/${workspace}/...`) are strictly banned. Use the native `this.api` wrapper, which enforces ADR 0016 compliance.

```javascript
async fetchData() {
    const res = await this.api.get('list');
    const data = await res.json();
}
```

## 4. Declarative Layout Registration
Extensions do not imperatively append themselves to the DOM. They expose a layout schema to `window.ExtensionRegistry`, mapping their Web Components to OS slots.

```javascript
window.ExtensionRegistry.registerExtension('my_ext', {
    name: "My Extension",
    version: "1.0.0",
    layoutSlots: [
        {
            slot: "slots:sub-navigation",
            targetParent: "edit",
            id: "my_tab",
            label: "My Feature",
            component: "insetu-ext-myfeature"
        }
    ]
});
```

## 5. The Component Graduation Checklist (Compliance Guardrails)

Before an extension is considered fully migrated to the V2 SDK, it must pass the following structural checks:

### Frontend (The `InSetuElement` Contract)
1. **Inheritance**: The primary UI class must `extend InSetuElement` (not `LitElement`).
2. **State Management**: Banned raw Zustand `createStore` imports. Must use `createExtensionStore('Name', initialState)`.
3. **Network Routing**: Raw `fetch()` calls and manual URL concatenations (`/api/${workspace}/...`) are strictly banned. Use `this.api.get()`, `this.api.post()`, etc.
4. **Store Subscriptions**: Manual un-subscription variables (`this._unsub`) inside `disconnectedCallback` are banned. Use `this.subscribe(Store, selector, callback)`.
5. **Tenant Lifecycle**: Do not manually subscribe to `activeWorkspace` changes in the AppStore. Implement the `onWorkspaceChanged(ws)` method instead.

### Backend (The `InSetuExtension` Contract)
1. **Inheritance**: The Flask blueprint must be instantiated via `InSetuExtension('name', __name__)`.
2. **Declarative Schemas**: Banned `@hooks.on('system_boot')` loops that run `CREATE TABLE`. Must pass a declarative schema dictionary to the `InSetuExtension` constructor.
3. **Auto-Routing**: Banned explicit route prefixes (`@bp.route('/api/<workspace_id>/name/list')`). Routes must be strictly relative (`@bp.route('list')`).
4. **The Context Object**: Route handlers must accept the `ctx` object instead of raw `workspace_id` strings.
5. **Path Physics**: Banned `get_gather_paths()` and `resolve_workspace_path` imports. Use `ctx.paths` and `ctx.resolve_path()`.
6. **VFS Walk & Read**: Banned raw `os.walk` and `open(f, 'r')`. Use `ctx.vfs.walk()` and `ctx.vfs.read()`.
7. **Config Cache**: Banned `load_config()` imports. Use `ctx.config`.