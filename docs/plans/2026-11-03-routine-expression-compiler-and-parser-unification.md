---
tier: "sprint"
title: "Blueprint Stub: Greenfield Routine & Prompt Compiler, Web-Chat Transport & Parser Unification"
repo: insetu
created_at: 2026-11-02T22:10:00
tags: [plan, rfc, routines, prompts, web-chat, parser, dsl, bridge, discussion-needed]
---

# Blueprint Stub: Greenfield Routine & Prompt Compiler, Web-Chat Transport & Parser Unification

> **STATUS — DISCUSSION REQUIRED BEFORE EXECUTION:**
> This document is an architectural stub capturing candidate designs for (1) replacing regex/AST condition pre-processing and ad-hoc mustache pipe fallbacks with a formal expression/template grammar, (2) unifying the Yomama patch parsers across backend and frontend, and (3) consolidating Routines, Prompts, and `web_chat` transport into a single greenfield pipeline. **We need to talk through the exact grammar boundaries and migration trade-offs together before writing code.**

---

## 1. Problem Statement & Open Design Questions

### Vector A: Declarative Routine Expression DSL (`when:`, `condition:`, `until:`)
Currently, `orchestrator.py` evaluates `when:` and `until:` clauses by regex-substituting `{{ var | default }}` into synthetic Python identifiers (`__var_N__`), rewriting `contains` via regex, and calling `ast.parse(..., mode="eval")`.
* **Questions to Discuss:**
  1. **Grammar Scope:** What is the exact set of operators and built-ins we want in the routine DSL? (e.g., `==`, `!=`, `<`, `<=`, `>`, `>=`, `in`, `not in`, `contains`, `and`, `or`, `not`, plus safe predicates like `empty(...)`, `len(...)`, `starts_with(...)`?)
  2. **Isomorphic Parity (`akasa` + `sutram`):** Should this expression lexer/evaluator live in Ring 0 (`akasa.utils` in Python and `sutram` in JS, alongside `compileDagWavefronts` and `extractTemplateVariables`) so Routine Studio in the browser can validate `when:` expressions live as the user types?

### Vector B: Yomama Patch Parser Unification (`parser.py` vs. `bridge.js` vs. `fallback_bridge.py`)
Currently, three separate line scanners parse Yomama `<<<<<<<` blocks:
1. `insetu/core/bridge/parser.py` (Compiler-grade two-phase lexer + lookahead separator disambiguator).
2. `insetu/core/bridge/bridge.js` (`BridgeStore.parseAndAppendCells`, a client-side line scanner that splits pasted text into staging cells).
3. `insetu/fallback_bridge.py` (Zero-dependency lifeboat parser).
* **Questions to Discuss:**
  1. Should `bridge.js` delegate complex/ambiguous block splitting or shared marker regexes to a single shared specification, or keep a lightweight synchronous splitter on the client while relying on `parser.py` as the authoritative AST compiler?

### Vector C: Greenfield Routine & Prompt Compilation + `web_chat` as a First-Class Citizen
Historically, Context Batches (`flow`), Prompt Templates (`prompts`), and DAG Routines (`agent`) evolved separately and were later merged. During live testing of External LLM Handoff (`web_chat` / `transport: manual`) and built-in `.templates` migration, we uncovered five structural failure modes caused by those seams:
1. **Premature Fallback Clobbering Across Two-Pass Expansion (`resolve_macro_includes` vs. `_interpolate_all_syntax`):**
    - Expanding `{{include_prompt:...}}` via `prompts.resolve` or `resolve_macro_includes` ran `interpolate_template_variables` *before* `orchestrator.py` bound `chain_context["sys"]`, `chain_context["nodes"]`, or `chain_context["inputs"]`.
    - Any chained fallback like `{{ adr_dir | sys.adr_dir }}` saw `adr_dir` missing from the macro `{...}` args, treated `sys.adr_dir` as a literal default string, and stripped the `{{ }}` delimiters—leaving literal `sys.adr_dir` in the final prompt.
2. **Variable Reference vs. String Literal Ambiguity in Mustache Pipe Chains (`|`):**
    - Ring 0's `interpolate_template_variables` regex (`[^{}]+`) cannot parse nested `{{ a | {{ b }} }}` tags, and treats the right-hand side of `|` strictly as a raw string literal rather than distinguishing variable paths (`sys.repo_title`, `nodes.step.text`) from quoted string literals (`"Workspace"`).
3. **Split Routine Document Shapes & `---\n---` Frontmatter Leaks:**
    - Having two competing routine shapes—legacy "batch-style" (`includes:` + top-level `include_prompt:`, no `## <node_id>` sections) vs. "DAG-style" (`nodes:` + `## <node_id>` sections)—caused `serialize_routine_to_markdown` to pass `"---\n---\n\n"` into `update_frontmatter`, leaking literal `---\n---` into the body of 28 migrated routines and overriding `prompt_uri` with `"---\n---"`.
4. **Multi-Repo Target Inference & Landmark Formatting (`sys.*`):**
    - Routines targeting a specific repository via `includes:` (e.g., `ctx://diffs/sutram_kernel_diffs.txt` or `vfs://insetu/tests/`) defaulted `sys.*` landmarks to `target_repos[0]` whenever `inputs.repo` was not explicitly passed, and raw list landmarks (`sys.standards_files`, `sys.contract_files`) rendered as Python list reprs unless pre-formatted for Markdown consumption.
5. **External LLM Handoff (`web_chat`) Context Bleed & Bare Slug Echoes:**
    - Because `web_chat` was implemented as a 95-line special-case branch inside `orchestrator.py` rather than as a first-class transport driver consuming a compiled prompt object, empty prompt fallbacks either echoed the bare slash command slug (`"insetu_core_ai-bridge_wrap"`) or fell back to `sys_p` (which embedded the entire `<workspace_context_nonce>` payload into the **Copy Prompt + Directives** clipboard).

* **The 3-Pillar Greenfield Target Architecture:**
  1. **Pillar 1 — One Canonical Routine Document Shape (Markdown-as-Code DAG):**
    - Every routine is a DAG of 1 or more nodes (`nodes:` is always present; a 1-step context batch is simply a 1-node routine).
    - Retire top-level `include_prompt:` and `node.prompt_uri` pointers in favor of standard `{{include_prompt: ctx://prompts/...}}` macros written directly inside each node's `## <node_id>` Markdown section.
    - This makes Routine Studio's visual step builder and the raw `.md` file 100% isomorphic (every LLM node maps 1-to-1 to a `## <node_id>` section, and a single step can compose multiple `{{include_prompt:...}}` fragments).
  2. **Pillar 2 — Unified 4-Stage Prompt Compiler (`compile_node_request`) with Pure Structural Include Pass:**
    - Separate **structural macro inclusion** from **variable interpolation**:
        - **Stage 1 (Pure Structural Macro Expansion):** `resolve_macro_includes` splices included `ctx://prompts/*` bodies and substitutes *only* explicit `{ key: "val" }` overrides passed inside the `{{include_prompt: ... { ... } }}` call, **never** evaluating or stripping unresolved `{{ ... }}` tags or `|` fallbacks that belong to outer scopes (`sys.*`, `inputs.*`, `nodes.*`, `global.*`).
        - **Stage 2 (Unified Expression & Pipe-Chain Interpolation):** Evaluates `{{ inputs.x | sys.y | "literal" }}` in a single pass with full access to `chain_context` (`inputs`, `sys`, `nodes`, `global`), where unquoted dotted identifiers in pipe chains resolve against `chain_context` and quoted strings evaluate as literals.
        - **Stage 3 (Schema Contract Directive Injection):** Appends the formal response contract from `get_schema_directive(node.output_schema)` (`yomama_patch`, `conversational_with_patches`, `intent_classification`, `json`, etc.).
        - **Stage 4 (Secret Scrubbing & Context Binding):** Scrubs outbound secrets (`scrub_outbound_secrets`) and binds `context_uris` (`ctx://workflows/workflow_<id>_context.txt` or assembled working-set slice) as a separate field on `CompiledNodeRequest` so `prompt_text` never embeds raw `<workspace_context_...>` dumps.
  3. **Pillar 3 — `web_chat` as a First-Class Transport Driver in `engine_llm.py`:**
    - Elevate `web_chat` to a peer driver in `engine_llm.py` consuming `CompiledNodeRequest` and returning a structured `PausedForHandoff` envelope (`prompt_text`, `context_uris`, `output_schema`), eliminating duplicate prompt assembly in `orchestrator.py`.

* **Questions to Discuss:**
  1. **Pipe-Chain Grammar (`{{ a | b | 'default' }}`):** Should unquoted identifiers in a `|` chain always be looked up as variables first (falling back to literal only on the final segment if unquoted, or requiring quotes for literals in multi-hop chains)?
  2. **Auto-Migration of the 28 Workspace Routines:** Should we run a one-time normalization pass across `.insetu/data/agent/*.md` that strips trailing `---\n---` artifacts and migrates `include_prompt:` into `## execute_prompt\n{{include_prompt: ...}}`?

---

## 2. Placeholder Tasks (Pending Architecture Discussion)

- [ ] [S1.T1] Define formal EBNF grammar and operator table for routine `when`/`until` expressions and `{{ a | b | "literal" }}` pipe-chain interpolation <!-- targets: vfs://insetu/insetu/core/agent/orchestrator.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py::TestAgentOrchestratorAndMcp -->
- [ ] [S1.T2] Align client-side cell splitter (`bridge.js`) with `parser.py` lookahead separator disambiguation <!-- targets: vfs://insetu/insetu/core/bridge/bridge.js, test_contract: vfs://insetu/tests/unit/test_js_behavioral_units.py::TestJsBehavioralUnits -->
- [ ] [S1.T3] Decouple structural `resolve_macro_includes` from variable interpolation so `{{include_prompt:...}}` never clobbers `{{ var | sys.* }}` fallbacks, and extract the unified 4-stage `compile_node_request` pipeline <!-- targets: vfs://insetu/insetu/core/agent/orchestrator.py, vfs://insetu/insetu/core/prompts/engine_prompts.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py::TestAgentOrchestratorAndMcp -->
- [ ] [S1.T4] Elevate `web_chat` to a first-class transport driver in `engine_llm.py` consuming `CompiledNodeRequest` without `<workspace_context>` bleed or bare routine slug fallbacks <!-- targets: vfs://insetu/insetu/core/llm/engine_llm.py, vfs://insetu/insetu/core/agent/orchestrator.py, test_contract: vfs://insetu/tests/unit/test_agent_orchestrator_and_mcp.py::TestAgentOrchestratorAndMcp -->
