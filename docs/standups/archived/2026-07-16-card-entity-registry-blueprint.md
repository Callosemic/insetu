title: "Blueprint: Entity-Action Card Registry"
date: 2026-07-16
author: Architect
status: approved
tags: ["Architecture", "UI", "UDF"]
Blueprint: Entity-Action Card Registry (Polymorphic Cards)
1. Context & Motivation
Currently, inSetu relies on hardcoding action buttons directly into <insetu-card> wrappers, <insetu-file-tree> loops, or relying on extensions to inject raw lit-html template strings via zone:file-card-actions. This violates strict Unidirectional Data Flow (UDF) presentation rules, causes visual ordering inconsistencies, and makes horizontal cross-talk between extensions brittle.
We are migrating to a Polymorphic Entity-Action Architecture (similar to an OS MIME-type registry). <insetu-card> will become completely stateless regarding business logic. It will declare what it is (entityType) and what data it holds (entityData). The central registry will dynamically supply the correct action buttons, sorted by strict CSS-order scale rules.
2. Core Architecture Implementation
A. The Declarative Registration API (ExtensionRegistry)
Extensions will no longer call imperative hooks to inject HTML. They will append an entityActions array to their core window.ExtensionRegistry.registerExtension payload.
window.ExtensionRegistry.registerExtension('format', {
    name: "Document Formatting",
    version: "2.0.0",
    entityActions: [
        {
            targetEntity: 'file',
            id: 'format-doc',
            label: 'Publish', 
            icon: '📄',
            intent: 'primary',
            order: 40, // Standard Scale (0-49: Primary Domain)
            match: (data) => data.filepath && data.filepath.endsWith('.md'),
            onClick: (data, e) => {
                // Navigation/Modals use onClick (renders <button>)
                FormatStore.setState({ formatModalOpen: true, currentFormatTarget: data.filepath });
            }
        }
    ]
});

B. Dynamic Property Evaluation (State Reflection)
To support reactive buttons (like Star/Unstar), properties like label, icon, and intent can be passed as functions (data) => string evaluated dynamically during the card's render() cycle.
{
    targetEntity: 'file',
    id: 'fave_toggle',
    label: (data) => data.isFavorited ? 'Unpin' : 'Pin',
    icon: (data) => data.isFavorited ? '⭐' : '☆',
    intent: (data) => data.isFavorited ? 'warning' : 'neutral',
    order: -1, // Pinned to the far left
    component: (data) => html`<insetu-fav-btn .filepath=${data.filepath}></insetu-fav-btn>`
}

C. Standardized entityData Dictionary
To ensure extensions can safely cross-talk, cards must provide a standardized dictionary.
 * filepath (String): The workspace-relative path (if applicable).
 * repoDir (String): The parent repository bounding the entity.
 * isFS (Boolean): True if the entity is a physical file on disk, False if virtual/compiled.
D. Multiple Inheritance (file:prompt)
Cards can declare compound entities using a colon separator (e.g., entityType="file:prompt").
When <insetu-card> evaluates its actions, it will:
 * Split the string into an array of inherited types: ['file', 'prompt'].
 * Query the registry for actions mapped to file AND actions mapped to prompt.
 * Filter the combined list using the match(data) predicate to strip irrelevancies.
 * Sort the surviving actions strictly by their order integer.
The sorting is strictly mathematical based on the order property. A generic file action with order: 10 will always render to the left of a prompt action with order: 50. No magic class-depth priority overriding is allowed.
E. The <insetu-card> Web Component Update
The ui_file_tree.js component will be updated to automatically query the registry based on its properties, generating native <insetu-async-btn> or standard <button> blocks declaratively:
// Inside <insetu-card> render() method:
const actions = window.ExtensionRegistry.getEntityActions(this.entityType, this.entityData || {});
this._hasActions = actions.length > 0;

return html`
    <div class="action-overlay">
        ${actions.map(act => {
            // Escape hatch for highly reactive state-bound components
            if (act.component) {
                return html`<div style="display: contents; order: ${act.order || 99};">${act.component(this.entityData)}</div>`;
            }

            const label = typeof act.label === 'function' ? act.label(this.entityData) : act.label;
            const icon = typeof act.icon === 'function' ? act.icon(this.entityData) : (act.icon || '');
            const intent = typeof act.intent === 'function' ? act.intent(this.entityData) : (act.intent || 'primary');
            
            if (act.asyncAction) {
                return html`<insetu-async-btn style="margin: 0; order: ${act.order || 99};" label="${icon} ${label}" intent="${intent}" .onClick=${(e) => act.asyncAction(this.entityData, e)}></insetu-async-btn>`;
            }
            return html`<button class="btn-sm" style="background: var(--intent-${intent}); margin: 0; color: white; border: none; cursor: pointer; order: ${act.order || 99};" @click=${(e) => act.onClick(this.entityData, e)}>${icon} ${label}</button>`;
        })}
    </div>
`;

3. Migration Checklist
The following extensions and core systems must be refactored to register and consume the new Entity-Action API.
Core Systems
 * [x] store.js / ExtensionRegistry: Implement registerEntityAction, getEntityActions, and the _entityActions central map inside the registry bootloader. (Completed)
 * [x] ui_file_tree.js: Update <insetu-card> properties to accept entityType (String) and entityData (Object) and execute _renderDynamicActions(). Wipe insetu-file-actions legacy component. (Completed)
 * [x] fs.js: Register base file actions (Browse, Download, Copy, Delete, Rename). Update createFileCard, <insetu-file-tree>, and <insetu-vfs-explorer> to pass entityType="file". (Completed)
 * [x] gather.js: Register base context actions (View Parts, Download). Update <insetu-ext-gather> to pass entityType="file:context". (Completed)
Extension Domains
 * [x] git:
   * Register repo actions (Sweep Repo).
   * Register diff actions (Push).
   * Update Diff views to use entityType="file:diff".
 * [x] tracker:
   * Register task actions (Start, Pause, Resolve, Close, Re-open).
   * Update Kanban rendering to pass entityType="task".
 * [x] citations:
   * Register citation actions (Notes, Edit, Pin to Repo).
   * Register explore_citation actions (Import / Force Import).
   * Update library lists to pass entityType="citation".
 * [x] research:
   * Register research_job actions (Pause, Resume, Cancel, Retry, Delete).
   * Update Inbox views to pass entityType="research_job".
 * [x] skills:
   * Register skill actions (Train, Edit).
   * Update Repertoire UI to pass entityType="skill".
 * [x] flow:
   * Register workflow_batch actions (Edit).
   * Update Flow UI to pass entityType="workflow_batch".
 * [x] prompts:
   * Rely natively on core file actions. No custom actions required, just update the file tree to pass entityType="file:prompt". (Completed)
 * [x] favorites:
   * Register fave_toggle action (Star/Unstar). Uses negative order (order: -1) to pin to the far left. Map to file and repo entity types. Use the component property to encapsulate its Zustand subscription natively. (Completed)
 * [x] format:
   * Register file action (Publish). Match strictly against .md files via the new declarative payload. (Completed)
4. Guardrails & Compliance
 * No DOM Reading: Actions receive their context purely from the entityData object. They must never query e.target.parentElement to scrape filenames.
 * Declarative Routing: If an action needs to open a modal, it dispatches an event or calls a central UDF store mutator. It does not imperatively inject HTML overlays.
 * Async Mutators vs Sync Navigation: Network mutations MUST use asyncAction (which utilizes <insetu-async-btn>). Navigating UI states MUST use onClick (which utilizes <button>). Mixing these freezes the UI or skips loading spinners.
 * Graceful Degradation: If an entityType requests an action for an extension that is disabled for the current tenant, getEntityActions must safely omit those actions without crashing the render loop.
 * State Binding: Use the component property to return an isolated LitElement for highly reactive buttons (e.g., Favorites toggle) to prevent re-rendering the entire card when external state changes.
