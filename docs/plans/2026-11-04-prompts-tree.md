---
title: "Plan Stub: One Prompts Tree for Templates, Repository Scope, Overrides and Directives"
status: "discussion"
created: "2026-11-04"
depends_on: ["2026-11-04-system-notices.md", "2026-10-30-repo-facts-and-directives.md"]
---
# Plan Stub: The Prompts Tree

> **Status: discussion.** This records the direction agreed on 2026-11-04 and the questions to settle before it becomes sprints. It is P13 Phase 5 (one view with provenance) applied to prompts and directives together.

## Roadmap placement (2026-11-07)

- **Review-ready:** nothing. Moving Language Guidelines into your user-tier `agent.md` can happen any time.
- **1.0:** rule (a) is frozen with 1.0 (decided 2026-11-04). Nothing else.
- **After 1.0:** the tree itself (after N1 and P13 Phase 2), prompts that bring their own context, and prompts as compute units.


## Context

P13 Phase 1 moved every difference between repositories into stored variables (`sys.*` landmarks, directives). The per-repository wrapper prompts (`.insetu-data/prompts/session-start-base.md`, `housekeeping-base.md`) now only include a template, so they are window dressing. People still need to make their own versions of a prompt where it matters, and to get back to the original when they want.

Directives are edited in a separate panel on the Agent settings page, which is easy to miss, and "Language Guidelines" is a hardcoded section of the close template that duplicates what directives do.

## Direction

### The tree

`ctx://prompts` is the one place for everything that can go into the prompt part of a request. Canonical top folders:

```
.templates/      canonical templates, grouped by provider: .templates/<ext>/, .templates/user/
<repo a>/        repository scope
<repo b>/
<custom>/        folders people add to organize their own prompts
```

- **Every prompt has a canonical source and can be overridden.** An override stands in for the canonical source everywhere it applies but never overwrites it. Deleting the override brings the original back.
- **Templates materialize into every repository folder without being files.** `.templates/git/audit-diffs.md` appears as `<repo a>/audit-diffs.md` and `<repo b>/audit-diffs.md`. Opening or running one of those runs the template with that repository's scope (`sys.*`). Nothing is stored for them. `.templates/<ext>/` stays the place to find a template and see where it came from.
- **`.templates/user/` is yours.** A prompt written there materializes into every repository. A prompt written into `<repo>/` stays there.
- **Editing a template in `.templates/` (other than `user/`) creates an override,** which takes the template's place in every repository.
- **The path sets the scope for includes.** `{{include_prompt: ctx://prompts/<repo b>/p2.md}}` inside `<repo a>/p1.md` renders that part with repository b's facts.
- **Optional filter.** A `.templates/user/` prompt may carry `repos: [a, b]` in its frontmatter to limit where it materializes. Nothing more elaborate.

### Directives live in the tree, and stack

Directives are the `agent.md` file at each level:

| Level | File | Directive tier |
| --- | --- | --- |
| User | `.templates/user/agent.md` | Your directives |
| Workspace | `agent.md` at the top of the tree (question h) | Workspace directives |
| Repository | `<repo>/agent.md`, shared or local (question a) | Repository shared / local |

**The one difference that stays visible: prompts override, directives stack.** Every level's `agent.md` is included in every prompt, in the order set on 2026-11-04 (repository shared, user, workspace, repository local; later wins). The tree pins `agent.md` at each level with an "included in every prompt" badge and a combined view. This replaces the Directives panel on the Agent settings page.

Protection (S8) and acceptance (`repo_directive`) carry over unchanged.

### Language guidelines become directives

A language guideline is a directive that is always on. The "Language Guidelines" section leaves `close_session_protocol.md`; its text moves to the user's `agent.md`. The directive editor offers insertable starter snippets (tone and language, testing habits, commit style) so the idea stays visible to new users. A guideline meant for certain output says so in prose ("In commit messages and changelogs, ...").

### Prompts that bring their own context (direction only)

A prompt may declare the context it needs, so running it packs that context too: `housekeeping.md` would ask for this session's diffs, the open tracker tickets and the full source of the changed files, instead of assuming they were attached. This used to be part of the Flow extension; today the same result comes from running the equivalent routine, which works but is more rigid than a prompt.

- **One declaration, shared with routines.** Six-bucket Sprint 3 (`2026-11-03-six-bucket-orchestrator-and-composable-rag.md`) designs `requires:` with fallbacks and the RAG units (`rag.seed_diffs`, `rag.scout_tests`) for routines. Prompts use the same declaration rather than a second one.
- **Scope comes from the path.** The context is packed for the repository the prompt runs in.
- **Repository content.** In a shared repository prompt the declaration decides which of your files are packed, so it is covered by the same acceptance as the prompt's text.
- **UX is open:** whether the declared context is packed silently, shown for review before sending, or offered as a one-click pack beside the prompt.

### Prompts are the LLM compute units of routines (direction only)

A routine node is a prompt plus declarations: the context it needs (`requires:`), the model or tier that runs it, the output contract (Yomama patches, a JSON schema), and the capabilities it may call. With those in its frontmatter, a prompt is a complete unit on its own, a routine of one node, and a routine is a graph of units. The routine adds only composition: edges, `when:` and `until:`, fork-join, and piping one node's output into the next.

The tree then holds three kinds of thing:

- **LLM units:** prompts with a context declaration or an output contract. They run in any transport: pasted into web chat or sent to a model's API. The unit defines what goes in and what must come back; the transport only decides how it is sent.
- **Deterministic units:** no model involved. A capability call, a RAG step (`rag.seed_diffs`, `rag.scout_tests`, retrieval over the AST and dependency graph), tests, git. They are routine nodes too, with the same inputs, outputs and declarations, so a routine can mix them freely with LLM units.
- **Fragments:** text with no context or output of its own (the patch protocol, the tracker phase, directives). They are only ever included.

**Alternate routes.** A node may name more than one way to produce its output, most usefully a deterministic route beside an LLM one. Retrieval is the main case: a deterministic walk of the dependency graph and CODE_INDEX first, with an LLM scout as the fallback when it finds too little, or the reverse when the deterministic route is the check. Which route runs is the routine's choice (`when:`, a fallback on empty output), and the node's output contract is the same either way, so the next node never knows which route ran.

Consequences, if adopted: the tree is the library of units and routines compose them by path, so scope, overrides and acceptance apply to routines too; Routine Studio becomes a graph editor over the tree rather than a separate format. This reshapes the routine compiler stub and six-bucket Sprints 2 and 3, which point here.

## Questions to settle

- **a) Storage and trust of repository prompts. Decided 2026-11-04.** `.insetu-data/` is how everyone working on a repository shares insetu settings across their own instances, so a repository's committed prompts are wanted, and they are repository content. Each `<repo>/` folder has two sources, as directives do:
    - **Shared** (`.insetu-data/prompts/`, committed): labelled repository content. It can always be opened and run by hand. Anywhere else (overriding a template, being included by another prompt, being run by a routine or the agent) it is used only after a person accepts its exact text: an attestation of kind `repo_prompt` on its digest. A change drops the acceptance until it is accepted again.
    - **Local** (git-ignored, beside `settings.local/`): yours, no acceptance.
  Prompts and directives therefore share one layered, protected, accept-before-use structure. The rule is frozen with 1.0 and enforced when the tree adds overrides; today no repository prompt can override or be included.
- **b) Reach of a template override.** One workspace or all workspaces? Proposal: the workspace by default, with a "use in all my workspaces" option.
- **c) Name collisions.** `.templates/git/audit.md` and `.templates/tracker/audit.md` both materialize as `<repo>/audit.md`. Refuse and show the collision, or keep the provider in the materialized name.
- **d) Drift.** An override records the digest of the template it replaced. When a release changes that template, an `info` notice (N1) says the original changed since you overrode it and shows the diff.
- **e) Disabled extensions.** Their templates and materialized views disappear; overrides of them are kept, hidden, and come back when the extension is enabled.
- **f) Directives inside cross-repository includes.** An included prompt gets its own repository's `sys.*` facts, but directives are assembled once per run from the outermost scope, so the block never appears twice. Prompts that span several repositories may need a workspace scope (question h).
- **g) Wrapper retirement.** The existing per-repository wrappers are deleted once their materialized views exist; any that differ from the template become overrides.
- **h) Workspace scope.** Top-level custom folders and a top-level `agent.md` could be the workspace scope: prompts not tied to one repository, and the home of workspace directives.

## Ordering

- Language guidelines into directives: small, any time.
- The tree itself needs N1 (drift and acceptance notices) and should follow P13 Phase 2 (field policy) so overrides use the same resolver.
- Prompts that bring their own context follow six-bucket Sprint 3, which defines the declaration for routines.
- Coordinate with `2026-11-03-routine-expression-compiler-and-parser-unification.md`, which also changes prompt templating (`{{ a | b }}` fallbacks, includes).
