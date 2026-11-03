Act as a Principal UI/UX Engineer auditing the codebase for the **inSetu Developer OS**. I am going to provide you with HTML and JavaScript files from our system.

I need you to audit the provided code and refactor the UI components to strictly adhere to the following **Four Core Design Principles**:

# **1. Centralize Construction through `UIFactory**`
Eradicate all hard-coded `<div class="fullscreen-modal">` blocks from the HTML or DOM generation logic. Every modal must be constructed dynamically by passing a configuration object (id, title, body HTML, and actions array) through `window.UIFactory.createModal(config)`.
# **2. Strict CSS Variable Binding (The Theme Token Rule)**
Remove all hardcoded hex colors (e.g., `#fff`, `#1e1e1e`, `#000`) for structural elements like backgrounds, text, and borders. They must be replaced with the systemic CSS variables: `var(--bg)`, `var(--input-bg)`, `var(--border)`, and `var(--text)` to ensure native compatibility with Dark Mode, Light Mode, and E-Ink modes. (Semantic colors like `#ef4444` for delete buttons or `#10b981` for save buttons are still allowed).
# **3. Flatten the "Box-in-Box" Anti-Pattern**
Remove unnecessary wrapping `div` elements that apply nested background colors and borders (e.g., `background: var(--input-bg); border: 1px solid var(--border)`) inside of modals or primary views. Let the content flow edge-to-edge. Use bold headers, typography, and logical flex spacing (`gap: 15px`, `margin-bottom: 10px`) to establish visual hierarchy instead of drawing boxes inside of boxes.
# **4. Enforce Unidirectional Data Flow (UDF)**
Ensure the UI logic does not query the DOM (e.g., `document.getElementById('xyz').value` or `.classList.contains()`) to determine business logic or application state. The DOM is purely a presentation layer.

### Output Constraints: The Patch Protocol

Provide all code modifications exclusively using the Yomama Sync Bridge SEARCH/REPLACE block format. Do not use JSON patches. Do not rewrite entire files if a targeted block will suffice.
* Use exactly this syntax inside a standard text block (make sure it is properly escaped):

```text
<<<<<<< FILE: path/to/file.ext
<<<<<<< SEARCH
[exact lines to match, including 1-2 lines of context]
[new lines to insert]
[exact lines to match, including 1-2 lines of context]
>>>>>>> REPLACE
```

* **Patch Sandwich:** Always include 1-2 unchanged lines of code at the top AND bottom of the SEARCH block to anchor the spatial match and prevent duplicate patching.
* **Indentation:** Ensure relative indentation inside your REPLACE block is perfectly aligned.
* **Strict Block Escaping:** You must wrap every individual file patch in its own ```text ... ``` code block. Do not combine multiple files into one block. Do not use `json` or `diff` tags.

If you understand these instructions, acknowledge them and provide the audit.