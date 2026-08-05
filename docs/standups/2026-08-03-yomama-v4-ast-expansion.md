# **Standup: Yomama Bridge v4 - AST-Aware Structural Refactoring**

**Date:** 2026-08-03
**Context:** Post-Release Architectural Blueprint
**Status:** Incubating (Targeting v4 Expansion)

---

## **1. The Post-Release Vision**

The Yomama Sync Bridge (v3) provides a highly robust, string-matching pipeline for localized code patching. However, as the ecosystem scales, asking an LLM to output massive string-replacement arrays for large-scale structural refactoring (like moving a 500-line class across files) is highly token-expensive and prone to hallucinated whitespace drift.

To evolve Yomama from a "patch applier" into a true **Structural Refactoring Engine**, we need to shift the paradigm from *Execution* to *Intent*. Instead of the LLM generating exact text replacements, it should output declarative intent blocks, offloading the heavy extraction and injection logic to an Abstract Syntax Tree (AST) parser within the inSetu backend.

## **2. The "inSetu" Implementation Strategy**

To maintain our lightweight, zero-bundler philosophy, we must avoid introducing a massive Node.js AST toolchain to handle frontend languages. The solution is to leverage **Tree-sitter** directly inside our Python micro-kernel (`engine_bridge.py`).

1. **Vendor the Bindings:** Add `tree-sitter` and its language-specific grammars (e.g., `tree-sitter-python`, `tree-sitter-javascript`) to our `pyproject.toml`.
2. **Phase 2 Pipeline Interception:** Introduce an `ASTRelocationStrategy` into Phase 2 of the Yomama pipeline to handle the new declarative blocks.

## **3. New Declarative Patch Blocks**

### **A. The `RELOCATE` Block**

Allows the LLM to move functions, classes, or variables seamlessly across the workspace.

```text
<<<<<<< RELOCATE
SYMBOL: getEditorContent
FROM: insetu/static/js/fs.js
TO: insetu/static/js/components/ui_editor.js
>>>>>>> EXECUTE

```

**Execution Flow:**

1. **Extraction:** The engine parses the source file into a Tree-sitter AST, queries for the `FunctionDeclaration` or `ClassDeclaration` matching the symbol, and extracts the exact byte-range (preserving attached JSDoc comments and decorators).
2. **Injection:** The engine parses the target file and locates a safe structural coordinate (e.g., the module root or inside a designated class body) to cleanly graft the extracted code.
3. **Auto-Linking:** Leveraging the `Cartographer` topology, the engine sweeps the repository for `ImportSpecifier` nodes pointing to the old path and rewrites them atomically to point to the new destination.

### **B. The `RENAME` Block**

Allows for global, semantic symbol replacement without risky regex sweeps.

```text
<<<<<<< RENAME
TARGET: window.getEditorContent
REPLACE_WITH: this.editor.getContent
SCOPE: insetu/static/js/**/*.js
>>>>>>> EXECUTE

```

**Execution Flow:**
The engine uses Tree-sitter queries to identify exact symbolic usages of the `TARGET` within the defined scope, ignoring string literals or comments that happen to share the same text, ensuring a 100% safe semantic swap.

## **4. Market Comparison & Justification**

* **Aider:** Relies on the LLM to output accurate unified diffs or whole-file replacements. While effective for small patches, large refactors stretch the LLM's context window and precision.
* **ast-grep / GritQL:** These are excellent, fast structural search-and-replace CLI tools. However, they are designed for human operators writing manual queries.

By bridging the LLM's high-level reasoning with Tree-sitter's deterministic precision, inSetu will offer a hybrid approach: the LLM simply states *what* to move, and the local OS guarantees *how* it moves, saving thousands of tokens and eliminating syntax drift.
