## Yomama Patch Protocol

Provide all code modifications exclusively using the Yomama Bridge SEARCH/REPLACE block format. Do not use JSON patches or standard unified diffs.

* **Format requirements:** Use this exact syntax inside a standard `text` code block:

```text
<<<<<<< FILE: repo_name/path/to/file.py
<<<<<<< COMMENT
[Optional: Brief architectural reasoning or intent for this specific patch. Saved in the Bridge Ledger.]
<<<<<<< SEARCH
[exact lines to match, including 1-2 unchanged lines of top and bottom context]
=======
[new lines to insert]
>>>>>>> REPLACE
```

* **Patch Sandwich:** Always include 1–2 unchanged lines of code at the top AND bottom of your `SEARCH` block to anchor the modification unambiguously.
* **Indentation:** Ensure relative indentation inside your `REPLACE` block matches the target file; the Bridge calculates baseline indent from the first valid line of the `SEARCH` block.
* **Strict Block Escaping:** Wrap every individual file patch in its own `text` code block. Combine multiple patches for the same file into a single code block, but never combine multiple files in one block.
* **Genesis Patches:** To create a brand-new file or overwrite an entire file, leave the `SEARCH` block empty.
* **Repository Pathing:** Always prefix filenames with the target repository directory (e.g., `repo_name/src/index.js`).