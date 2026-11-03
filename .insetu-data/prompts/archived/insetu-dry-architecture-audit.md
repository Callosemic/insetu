Act as a Principal Systems Architect auditing the codebase for the **inSetu Developer OS**. I am going to provide you with Python and JavaScript files from our system.

I need you to ruthlessly audit the provided code and refactor the components to strictly adhere to the following **Four Core Architectural Principles**:

**1. Centralize Utility Logic (The DRY Mandate)**
Eradicate all copy-pasted boilerplate. If you see identical loops, path-resolution math, regex extractions, or dictionary manipulations appearing in multiple route handlers or JS modules, extract them. In Python, route this logic to `insetu/utils_core.py`. In JavaScript, route it to shared utility exports in `app.js` or `fs.js`.

**2. Defat the Controllers (Thin Routing)**
Route handlers (e.g., in `routes_fs.py`, `routes_system.py`, etc.) must be completely stripped of heavy business logic, raw filesystem `os.walk` sweeps, or complex JSON tree mutations. Controllers should solely parse the `request`, validate inputs, pass payloads to the appropriate `engine_*.py` function, and return the `jsonify` response. 

**3. Enforce the Single Source of Truth (SSOT)**
Hunt down fragmented logic that violates the SSOT. For example:
* Do not allow secondary scripts to hardcode `os.listdir()` exclusions (like `.git` or `node_modules`). They must use centralized Cartographer or `utils_core` functions.
* In JavaScript, ensure components are not locally defining data that should be pulled from `AppStore` or `KanbanStore` via Zustand selectors. 

**4. Consolidate Frontend Render Loops**
Look for raw `document.createElement` boilerplate that recreates standard OS elements (like file cards, tags, or pills) from scratch. Force these disparate render loops to pipe their data through our unified factories (e.g., `createFileCard` in `fs.js`).

### Output Constraints: The Patch Protocol

Provide all code modifications exclusively using the Yomama Sync Bridge SEARCH/REPLACE block format. Do not use JSON patches. Do not rewrite entire files if a targeted block will suffice.

* Use exactly this syntax inside a standard text block (make sure it is properly escaped):

```text
<<<<<<< FILE: path/to/file.ext
<<<<<<< SEARCH
[exact lines to match, including 1-2 lines of context]
=======
[new lines to insert]
>>>>>>> REPLACE
```

* **Patch Sandwich:** Always include 1-2 unchanged lines of code at the top AND bottom of the SEARCH block to anchor the spatial match and prevent duplicate patching.
* **Indentation:** Ensure relative indentation inside your REPLACE block is perfectly aligned.
* **Strict Block Escaping:** You must wrap every individual file patch in its own ```text ... ``` code block. Do not combine multiple files into one block. Do not use `json` or `diff` tags.

If you understand these instructions, acknowledge them and provide the audit.