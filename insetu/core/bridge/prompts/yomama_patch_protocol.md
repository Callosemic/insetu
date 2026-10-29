[new lines to insert]
>>>>>>> REPLACE
```

* **Patch Sandwich:** Always include 1–2 unchanged lines of code at the top AND bottom of your `SEARCH` block to anchor the modification unambiguously.
* **Indentation:** Ensure relative indentation inside your `REPLACE` block matches the target file; the Bridge calculates baseline indent from the first valid line of the `SEARCH` block.
* **Strict Block Escaping:** Wrap every individual file patch in its own `text` code block. Combine multiple patches for the same file into a single code block, but never combine multiple files in one block.
* **Genesis Patches:** To create a brand-new file or overwrite an entire file, leave the `SEARCH` block empty.
* **Repository Pathing:** Always prefix filenames with the target repository directory (e.g., `repo_name/src/index.js`).
## Yomama Patch Protocol

Provide all workspace file modifications exclusively using Yomama Bridge directives inside standard `text` code blocks. Always use canonical `vfs://<repo>/<path>` or `ctx://<volume>/<path>` URIs in `<<<<<<< FILE:` headers.

### 1. Standard Code Blocks (`SEARCH` / `REPLACE`)
```text
<<<<<<< FILE: vfs://repo_name/path/to/file.py
<<<<<<< COMMENT
[Brief architectural reasoning or intent for this specific patch. Saved in the Bridge Ledger.]
<<<<<<< SEARCH
[exact lines to match, including 1-2 unchanged lines of top and bottom context]
[new lines to insert]
>>>>>>> REPLACE
```
* **Patch Sandwich:** Always include 1–2 unchanged lines of code at the top AND bottom of your `SEARCH` block to anchor the modification unambiguously.
* **Indentation:** Ensure relative indentation inside your `REPLACE` block matches the target file; the Bridge calculates baseline indent from the first valid line of the `SEARCH` block.
* **Strict Block Escaping:** Wrap every individual file patch in its own `text` code block. Combine multiple patches for the same file into a single code block, but never combine multiple files in one block.
* **Transport Escaping (`{{ymm:...}}`):** Whenever a `SEARCH` or `REPLACE` block itself contains triple backticks or literal Yomama 7-chevron markers (for example, when patching markdown documentation, prompt templates, or parser tests), escape them using the `{{ymm:<char>x<N>}}` macro so they never break the outer code block or chunk splitter:
    * Triple backticks: `{{ymm:{{ymm:`x1}}x3}}`
    * Literal 7-chevron markers: `{{ymm:<x7}}`, `{{ymm:=x7}}`, `{{ymm:>x7}}`
* **Genesis Patches:** To create a brand-new file, leave the `SEARCH` block empty (`<<<<<<< SEARCH\n=======`).

### 2. Inline Prose & Comment Edits (`TEXTEDIT`)
When updating Markdown prose, `CODE_INDEX.md` comments (`# [comment required]` or `# [stale?]`), or single-line text without repeating large multi-line blocks, use `<<<<<<< TEXTEDIT` with inline `{{-delete}}` and `{{+insert}}` markers:
```text
<<<<<<< FILE: vfs://repo_name/CODE_INDEX.md
<<<<<<< COMMENT
Document newly added helper in CODE_INDEX.md.
<<<<<<< TEXTEDIT
│   ├── def my_helper(ctx) # {{-[comment required]}}{{+Validates incoming payloads against the active schema.}}
>>>>>>> REPLACE
```

### 3. Structured Object & Frontmatter Mutations (`JSON_PATCH`)
When updating `.json`, `.yaml`/`.yml`, or YAML frontmatter inside `.md` files (such as `ctx://routines/*.md`), use `<<<<<<< JSON_PATCH` with dotted key-paths, `[field=value]` array selectors, or `null` to delete keys:
```text
<<<<<<< FILE: ctx://routines/my_routine.md
<<<<<<< COMMENT
Promote synthesize_step to the thinking tier.
<<<<<<< JSON_PATCH
{"nodes[id=synthesize_step].tier": "thinking", "obsolete_key": null}
>>>>>>> REPLACE
```
=======
[new lines to insert]
>>>>>>> REPLACE
```

* **Patch Sandwich:** Always include 1–2 unchanged lines of code at the top AND bottom of your `SEARCH` block to anchor the modification unambiguously.
* **Indentation:** Ensure relative indentation inside your `REPLACE` block matches the target file; the Bridge calculates baseline indent from the first valid line of the `SEARCH` block.
* **Strict Block Escaping:** Wrap every individual file patch in its own `text` code block. Combine multiple patches for the same file into a single code block, but never combine multiple files in one block.
* **Genesis Patches:** To create a brand-new file or overwrite an entire file, leave the `SEARCH` block empty.
* **Repository Pathing:** Always prefix filenames with the target repository directory (e.g., `repo_name/src/index.js`).

### Declarative AST Operations (`RELOCATE` & `RENAME`)

When moving complete functions/classes between files or renaming identifiers across a codebase, prefer declarative AST blocks over manual `SEARCH/REPLACE` blocks to prevent transcription errors and save output tokens:

* **AST Symbol Relocation (`RELOCATE`):** Performs a deterministic, byte-exact cut-and-paste of a class, method (`ClassName.method_name`), or function (including its decorators and leading docstring/JSDoc) from one file to another. Pair with a small `SEARCH/REPLACE` block if `import` headers need updating:

```text
<<<<<<< COMMENT
[Optional: Brief architectural reasoning for moving this symbol.]
<<<<<<< RELOCATE
SYMBOL: function_or_class_name
FROM: vfs://repo_name/path/to/source.py
TO: vfs://repo_name/path/to/target.py
>>>>>>> EXECUTE

```
* **Token-Aware Symbol Rename (`RENAME`):** Renames an identifier or dotted property across all matching files in `SCOPE` while automatically ignoring occurrences inside comments and string literals:

```text
<<<<<<< COMMENT
[Optional: Brief architectural reasoning for renaming this symbol.]
<<<<<<< RENAME
TARGET: old_symbol_name
REPLACE_WITH: new_symbol_name
SCOPE: vfs://repo_name/path/to/scope/**/*.py
>>>>>>> EXECUTE
```

### 5. File Lifecycle Directives (`MOVE_FILE`, `ARCHIVE_FILE`, `DELETE_FILE`)
```text
<<<<<<< FILE: vfs://repo_name/path/to/old_file.py
<<<<<<< COMMENT
Relocate module to new package directory.
<<<<<<< MOVE_FILE
FROM: vfs://repo_name/path/to/old_file.py
TO: vfs://repo_name/path/to/new_file.py
>>>>>>> EXECUTE

<<<<<<< FILE: vfs://repo_name/path/to/obsolete.py
<<<<<<< COMMENT
Remove deprecated module (snapshot is automatically saved in bridge_ledger for /undo).
<<<<<<< DELETE_FILE
FILE: vfs://repo_name/path/to/obsolete.py
>>>>>>> EXECUTE
```
