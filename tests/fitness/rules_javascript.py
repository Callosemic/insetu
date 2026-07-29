import os
import re
from pathlib import Path
from .core import FRONTEND_DIR, report_violation
def check_javascript_files():
    print("🔍 Sweeping JavaScript Frontend (Regex Analysis)...")
    shared_styles_pattern = re.compile(r'from\s+[\'"][^\'"]*shared_styles\.js[\'"]')
    dom_read_pattern = re.compile(r'document\.(?:getElementById|querySelector)\([^\)]+\)(?:\.(value|checked|classList)|\[[\'"](value|checked|classList)[\'"]\]|\.getAttribute\([\'"](value|checked|class)[\'"]\))')
    interval_pattern = re.compile(r'\bsetInterval\s*\(')
    hex_color_pattern = re.compile(r'#[0-9a-fA-F]{3,6}\b')
    clear_timeout_pattern = re.compile(r'\bclearTimeout\s*\(')
    raw_layout_ban_pattern = re.compile(r'class=[\'"].*\bfile-card\b.*[\'"]')
    legacy_modal_ban_pattern = re.compile(r'class=[\'"].*\b(modal-panel|modal-content|fullscreen-modal)\b.*[\'"]')
    legacy_modal_maxwidth_pattern = re.compile(r'<insetu-modal[^>]*\bmaxWidth=[\'"](?:100vw|95vw)[\'"]')
    legacy_insetu_modal_pattern = re.compile(r'<(?:insetu-modal)\b|@modal-closed|@modal-closing')
    dom_annihilation_pattern = re.compile(r'(?:\.innerHTML|\[[\'"]innerHTML[\'"]\])\s*=\s*([\'"`][\'"`])')
    bracket_bypass_pattern = re.compile(r'\[[\'"](value|checked|classList)[\'"]\]')
    floating_global_pattern = re.compile(r'^\s*let\s+[a-zA-Z0-9_,\s]+')
    naive_xss_pattern = re.compile(r'\.replace\(/<script')
    create_modal_pattern = re.compile(r'\.createModal\s*\(')
    slug_dry_pattern = re.compile(r'\.normalize\([\'"]NFD[\'"]\)')
    context_scraping_pattern = re.compile(r'\.active\b.*\.sub-tab|\.sub-tab.*\.active\b')
    form_data_pattern = re.compile(r'new\s+FormData\b')
    local_fetch_wrapper_pattern = re.compile(r'(const|let|var)\s+apiFetch\s*=')
    imperative_dom_create_pattern = re.compile(r'document\.createElement\(')
    raw_fetch_pattern = re.compile(r'\bfetch\s*\(')
    legacy_insetu_fetch_pattern = re.compile(r'window\.inSetu\.fetch\s*\(')
    manual_unsub_pattern = re.compile(r'this\._unsub[a-zA-Z0-9_]*\s*=')
    zustand_create_store_pattern = re.compile(r'\bcreateStore\s*\(')
    zustand_direct_import_pattern = re.compile(r'from\s+[\'"]https://esm\.sh/zustand(?:/[^\'"]*)?[\'"]')
    lit_element_class_pattern = re.compile(r'class\s+\w+\s+extends\s+LitElement\b')
    raw_register_tick_pattern = re.compile(r'\.registerTick\s*\(')
    zustand_reference_mutation_pattern = re.compile(r'\.setState\(\{\s*([a-zA-Z0-9_]+)\s*:\s*\1\s*\}\)')
    subtab_leak_pattern = re.compile(r"localStorage\.getItem\([\'\"]insetu_subtab_")
    sticky_header_pattern = re.compile(r'class=[\'"]sticky-header[\'"]')
    media_layout_pattern = re.compile(r'@media\s*\([^)]*(?:width|height)[^)]*\)')
    dom_action_query_pattern = re.compile(r'document\.querySelector\([\'"]#?(sub-|insetu-ext-)[^\'"]+[\'"]\)')
    global_listener_pattern = re.compile(r'window\.addEventListener\s*\(')
    global_dispatch_pattern = re.compile(r'window\.dispatchEvent\s*\(\s*new\s+CustomEvent')
    imperative_action_dispatch_pattern = re.compile(r'(?:onClick|asyncAction):\s*(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>\s*(?:window\.)?dispatchEvent\s*\(\s*new\s+CustomEvent')
    banned_localstorage_tab_pattern = re.compile(r"localStorage\.(?:set|get)Item\(['\"]insetu_(?:tab|subtab)")
    direct_execute_ui_hook_pattern = re.compile(r"(?:ExtensionRegistry|window\.ExtensionRegistry)\.executeUIHook\(")
    dom_content_loaded_registration_pattern = re.compile(r'DOMContentLoaded[\'"]\s*,\s*(?:\(\)\s*=>|function\s*\(\)\s*)\s*\{[\s\S]*?ExtensionRegistry\.registerExtension')
    banned_cdn_import_pattern = re.compile(r'from\s+[\'"]https?://(esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)')

    for root, _, files in os.walk(FRONTEND_DIR):
        for file in files:
            if file.endswith(".js"):
                filepath = Path(root) / file
                is_extension = file.startswith("ext_")
                with open(filepath, "r", encoding="utf-8") as f:
                    lines = f.readlines()

                is_lit_component = any(re.search(r'from\s+[\'"]lit[\'"]', l) for l in lines)
                full_content = "".join(lines)
                if file in ["ext_tracker.js", "ext_research.js", "ext_config.js"] and "document.getElementById" in full_content:
                    report_violation("GRADUATED_COMP_DOM_READ", filepath, 1, "Graduated components are forbidden from using document.getElementById (DOM Read Ban). Bind to reactive Lit properties instead.")
                if is_extension and "extends InSetuElement" in full_content and "static get extensionName()" not in full_content:
                    report_violation("EXTENSION_NAME_GETTER_MANDATE", filepath, 1, "Components extending InSetuElement must define 'static get extensionName()' to ensure deterministic API routing.")
                if is_extension:
                    classes_extending = re.findall(r'class\s+([A-Za-z0-9_]+)\s+extends\s+(?:InSetuElement|LitElement)\b', full_content)
                    for cls_name in classes_extending:
                        if not re.search(r'customElements\.define\s*\(\s*[\'"][^\'"]+[\'"]\s*,\s*' + re.escape(cls_name) + r'\b', full_content):
                            report_violation("CUSTOM_ELEMENT_DEFINE_MANDATE", filepath, 1, f"Class '{cls_name}' extends InSetuElement/LitElement but is missing a customElements.define registration.")
                if "innerHTML =" in full_content and file != "ext_citations.js" and is_extension:
                    report_violation("LIT_TEMPLATE_VIOLATION", filepath, 1, "Insetu extensions must utilize Lit templates rather than raw innerHTML string overwrites.")
                if dom_content_loaded_registration_pattern.search(full_content):
                    report_violation("DOMCONTENTLOADED_REGISTRATION_BAN", filepath, 1, "Extensions must invoke ExtensionRegistry.registerExtension at top-level module scope to guarantee deterministic registration during boot.")

                if file not in ["app.js", "ui_dropdowns.js", "ui_file_tree.js"]:
                    if "addEventListener('click'" in full_content or 'addEventListener("click"' in full_content:
                        if "dropdown" in full_content.lower() or "filter" in full_content.lower():
                            if "insetu-filter-dropdown" not in full_content:
                                report_violation("DROPDOWN_CLICK_OUTSIDE_VIOLATION", filepath, 1, "Manual click listener detected for dropdown/filter management. Migrate to <insetu-filter-dropdown>.")
                if "localStorage.setItem('insetu_pinned_repos'" in full_content or 'localStorage.setItem("insetu_pinned_repos"' in full_content:
                    report_violation("GLOBAL_LOCALSTORAGE_TENANT_LEAK", filepath, 1, "Un-suffixed localStorage write pattern detected. Force workspace-scoping (e.g., insetu_pinned_repos_${ws}).")

                for i, line in enumerate(lines):
                    line_num = i + 1
                    if line.strip().startswith("//"):
                        continue
                    
                    if is_extension or file in ["kanban.js", "bridge.js"]:
                        if dom_read_pattern.search(line):
                            report_violation("DOM_READ_BAN", filepath, line_num, "Direct DOM reading detected. Read from the Zustand Store instead.")
                        if bracket_bypass_pattern.search(line):
                            report_violation("DOM_READ_BAN_BYPASS", filepath, line_num, "Bracket notation bypass detected. Use pure UDF instead.")
                    
                    if is_extension:
                        if interval_pattern.search(line):
                            report_violation("METRONOME_MANDATE", filepath, line_num, "setInterval detected. Use ExtensionRegistry.registerTick() to prevent ghost polling.")
                        if hex_color_pattern.search(line):
                            if "style=" in line or "cssText" in line:
                                report_violation("THEME_TOKENS", filepath, line_num, f"Hardcoded HEX color found: {line.strip()}. Use CSS intent variables (e.g., var(--btn)).")
                    
                    if clear_timeout_pattern.search(line):
                        if "utils.debounce" not in line and "panicTimeout" not in line:
                            report_violation("DEBOUNCE_MANDATE", filepath, line_num, "Raw clearTimeout detected. Use window.inSetu.extensions.Registry.utils.debounce() for input throttling.")

                    if dom_annihilation_pattern.search(line):
                        report_violation("SURGICAL_DOM_MANDATE", filepath, line_num, "DOM annihilation detected. Use surgical reconciliation instead of clearing .innerHTML.")
                    
                    if raw_layout_ban_pattern.search(line):
                        report_violation("RAW_LAYOUT_BAN", filepath, line_num, "Raw layout class '.file-card' detected. Migrate to <insetu-card> or <yenvui-card> primitives.")
                    if legacy_modal_ban_pattern.search(line):
                        report_violation("LEGACY_MODAL_BAN", filepath, line_num, "Legacy modal layout class detected. Migrate to <yenvui-modal> or <insetu-modal> primitives.")
                    if legacy_modal_maxwidth_pattern.search(line):
                        report_violation("MODAL_FULLSCREEN_PROPERTY_MANDATE", filepath, line_num, "Deprecated maxWidth viewport attribute on <insetu-modal>. Use declarative ?fullscreen=${true} property instead.")
                    if legacy_insetu_modal_pattern.search(line):
                        report_violation("LEGACY_INSETU_MODAL_BAN", filepath, line_num, "Deprecated <insetu-modal> tag or @modal-closed/@modal-closing event detected. Migrate to <yenvui-modal> and @yenvui-modal-closed / @yenvui-modal-closing.")

                    if is_extension and floating_global_pattern.match(line.strip()):
                        report_violation("UDF_STATE_BLEED", filepath, line_num, "Floating global state detected. Migrate variable into the centralized Zustand AppStore.")
                    
                    if naive_xss_pattern.search(line):
                        report_violation("XSS_VULNERABILITY", filepath, line_num, "Naive regex script stripping detected. Use DOMPurify.sanitize().")
                    
                    if is_lit_component and create_modal_pattern.search(line):
                        report_violation("LIT_IMPERATIVE_MODAL_BAN", filepath, line_num, "Legacy UIFactory.createModal detected in a LitElement. Render <insetu-modal> declaratively instead.")

                    if is_lit_component and "insertAdjacentHTML" in line:
                        report_violation("LIT_TEMPLATE_VIOLATION", filepath, line_num, "Imperative HTML insertion detected. Utilize LitElement render() templates to surgically diff components safely.")

                    if is_extension and slug_dry_pattern.search(line):
                        report_violation("SLUG_DRY_VIOLATION", filepath, line_num, "Duplicate slug generation regex detected. Use the centralized generateSafeSlug() utility instead.")
                    
                    if is_extension and context_scraping_pattern.search(line):
                        report_violation("CONTEXT_SCRAPING_BAN", filepath, line_num, "DOM class context scraping detected. Actions must rely on localized dataset properties instead.")
                    
                    if is_lit_component and form_data_pattern.search(line) and file != "fs.js":
                        report_violation("UDF_FORM_DATA_BAN", filepath, line_num, "new FormData() detected in LitElement. Bind inputs to reactive properties via @input instead.")
                    
                    if is_extension and local_fetch_wrapper_pattern.search(line):
                        report_violation("GLOBAL_UTILITY_BYPASS", filepath, line_num, "Localized API fetch wrapper detected. Utilize the centralized window.inSetu.fetch utility to ensure global interceptor compliance.")
                    
                    if (is_extension or file == "store.js") and raw_fetch_pattern.search(line):
                        report_violation("EXPLICIT_API_MANDATE", filepath, line_num, "Raw fetch() detected. Route through the explicit window.inSetu.api SDK (ADR 0016).")

                    if is_extension and re.search(r'from\s+[\'"]\.\./(app|fs|store)\.js[\'"]', line):
                        report_violation("CHASSIS_IMPORT_BAN", filepath, line_num, "Direct import from core chassis file detected in extension. Use SDK domain getters (this.vfs, this.sys, this.ui) instead (ADR 0024).")

                    if is_extension and ("api.workspace('manifest" in line or "api.workspace(\"manifest" in line or 'api.workspace(`manifest' in line):
                        report_violation("MANIFEST_CQRS_BYPASS", filepath, line_num, "Blind manifest re-fetching detected. Rely on surgical backend delta payloads to mutate the AppStore.manifest instead of heavy N+1 polling.")
                    
                    if is_extension and ("navigator.clipboard" in line or "window.URL.createObjectURL" in line):
                        report_violation("DRY_UTILITY_VIOLATION", filepath, line_num, "Manual clipboard or blob download stream manipulation detected. Utilize centralized core utilities (fetchAndCopy, this.utils.copyToClipboard, this.utils.copyRawText, or fetchAndDownloadState) instead.")
                    if is_extension and legacy_insetu_fetch_pattern.search(line):
                        report_violation("EXPLICIT_API_MANDATE", filepath, line_num, "Legacy window.inSetu.fetch() detected. Route through the explicit window.inSetu.api SDK (ADR 0016).")

                    if is_extension and re.search(r'class\s+\w+\s+extends\s+LitElement\b', line):
                        report_violation("SDK_ELEMENT_MANDATE", filepath, line_num, "Extension component extends raw LitElement. Inherit from InSetuElement to protect multi-tenant lifecycles.")
                    
                    if is_extension and is_lit_component and imperative_dom_create_pattern.search(line):
                        report_violation("IMPERATIVE_DOM_CREATION", filepath, line_num, "document.createElement detected in a LitElement extension. Construct templates declaratively using lit-html.")
                    
                    if is_extension and is_lit_component and manual_unsub_pattern.search(line):
                        report_violation("SDK_SUBSCRIPTION_MANDATE", filepath, line_num, "Manual store un-subscription detected. Use this.subscribe() from the InSetuElement SDK.")
                    if is_extension and zustand_create_store_pattern.search(line):
                        report_violation("SDK_STORE_MANDATE", filepath, line_num, "Standard Zustand createStore detected. Use createExtensionStore() from the OS SDK instead.")
                    if is_extension and zustand_direct_import_pattern.search(line):
                        report_violation("BANNED_ZUSTAND_IMPORT", filepath, line_num, "Direct import from external Zustand distributions found. Extensions must use createExtensionStore() from the local SDK to preserve multi-tenant tracking.")

                    if banned_cdn_import_pattern.search(line):
                        report_violation("BANNED_CDN_IMPORT", filepath, line_num, "Hardcoded CDN import detected. Extensions must utilize vendor.json and local vendor subdirectories.")

                    if is_extension and lit_element_class_pattern.search(line):
                        report_violation("SDK_ELEMENT_MANDATE", filepath, line_num, "Extension component extends native LitElement. Use InSetuElement instead to enable managed lifecycles.")
                    
                    if is_extension and raw_register_tick_pattern.search(line):
                        report_violation("POLLING_MANDATE", filepath, line_num, "Raw registerTick detected. Use this.api.pollJob or central SDK polling mechanisms to coordinate worker jobs.")
                    
                    if zustand_reference_mutation_pattern.search(line):
                        report_violation("ZUSTAND_REFERENCE_MUTATION", filepath, line_num, "Symmetric state assignment detected (e.g. {manifest: manifest}). Ensure complex objects are explicitly cloned using the spread operator before passing to setState.")

                    if is_extension and "zone:file-card-actions" in line:
                        report_violation("DEPRECATED_UI_HOOK_VIOLATION", filepath, line_num, "Legacy 'zone:file-card-actions' hook detected. Migrate component buttons to the declarative polymorphic 'entityActions' registry.")
                    
                    if is_extension and subtab_leak_pattern.search(line):
                        report_violation("SHARED_STORAGE_SUBTAB_LEAK", filepath, line_num, "Hardcoded subtab 'localStorage' state tracking discovered. Validate active layouts statelessly using DOM tree boundary context metrics instead (e.g., this.closest('.sub-tab-content')?.classList.contains('active')).")

                    if is_extension and is_lit_component and (sticky_header_pattern.search(line) or 'insetu-standard-toolbar' in line):
                        report_violation("STANDARD_TOOLBAR_MANDATE", filepath, line_num, "Legacy 'sticky-header' or '<insetu-standard-toolbar>' detected. Migrate to <yenvui-toolbar> for standard UI layouts.")
                    
                    if file == "app.js" and ("insetu-ext-" in line or "ext_" in line) and (".remove()" in line or "document.querySelectorAll" in line):
                        if "tagName.startsWith" not in line:
                            report_violation("HARDCODED_EXTENSION_EVICTION", filepath, line_num, "Hardcoded extension element tags found in reload sequence. Utilize stateless prefix checks to preserve Inversion of Control.")
                    
                    if is_extension and media_layout_pattern.search(line):
                        report_violation("CONTAINER_QUERY_MANDATE", filepath, line_num, "Responsive layout via @media detected. Extensions must utilize @container queries to remain layout-agnostic and resilient within dynamic host slots.")
                    
                    if is_extension and dom_action_query_pattern.search(line):
                        report_violation("DOM_QUERY_IN_ACTION_BAN", filepath, line_num, "Imperative document.querySelector on extension elements detected. Use Custom Events or Store actions instead.")
                    
                    if is_extension and is_lit_component and global_listener_pattern.search(line):
                        report_violation("GLOBAL_LISTENER_MANDATE", filepath, line_num, "Raw window.addEventListener detected. Use this.registerGlobalListener() to prevent memory leaks on component unmount.")
                    if is_extension and is_lit_component and global_dispatch_pattern.search(line):
                        report_violation("CUSTOM_EVENT_DISPATCH_MANDATE", filepath, line_num, "Raw window.dispatchEvent detected. Route through this.dispatch(eventName, detail) for streamlined multi-tenant boundaries.")

                    if is_extension and imperative_action_dispatch_pattern.search(line):
                        report_violation("DECLARATIVE_EMIT_EVENT_MANDATE", filepath, line_num, "Imperative CustomEvent dispatch in entityAction detected. Use declarative emitEvent: (data) => ({ name, detail }) instead.")
                    if is_extension and ("zone:post-file-save" in line or "zone:post-file-delete" in line):
                        report_violation("LEGACY_UI_HOOK_BAN", filepath, line_num, "Deprecated UI hook (post-file-save/delete) detected. Use unified 'zone:vfs-mutated' instead.")
                    if banned_localstorage_tab_pattern.search(line):
                        report_violation("BANNED_LOCALSTORAGE_TAB_ROUTING", filepath, line_num, "Direct localStorage tab state reads/writes are banned. Use AppStore routing and window.location.hash.")
                    if re.search(r'window\.executeSystemCompile\b', line):
                        report_violation("LEGACY_DOMAIN_ACCESSOR_VIOLATION", filepath, line_num, "Direct invocation of window.executeSystemCompile detected. Use SDK domain accessor window.inSetu.sys.executeSystemCompile instead (ADR 0024).")
                    if file not in ["store.js", "sdk.js"] and direct_execute_ui_hook_pattern.search(line):
                        report_violation("BANNED_DIRECT_EXECUTE_UI_HOOK", filepath, line_num, "Direct ExtensionRegistry.executeUIHook calls are deprecated. Use window.inSetu.events.emitHook(zone, payload).")

                    if shared_styles_pattern.search(line) and 'vendor/sutram/shared_styles.js' not in line:
                        report_violation("VENDOR_SHARED_STYLES_MANDATE", filepath, line_num, "Legacy or un-vendorized sharedStyles import detected. Reference vendor/sutram/shared_styles.js instead.")