import os
import re
import json
from pathlib import Path
from .core import FRONTEND_DIR, BACKEND_DIR, SUTRAM_DIR, report_violation, collect_unique_files

def check_vendor_manifest_paths():
    print("🔍 Sweeping Vendor Manifest Paths (Existence Analysis)...")
    for vendor_file in collect_unique_files([BACKEND_DIR], ["vendor.json"]):
        try:
            with open(vendor_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            for domain in ("imports", "python"):
                entries = data.get(domain, {})
                if not isinstance(entries, dict):
                    continue
                for specifier, meta in entries.items():
                    if isinstance(meta, dict):
                        rel_path = meta.get("path")
                        if rel_path:
                            if rel_path.startswith(("http://", "https://")):
                                report_violation(
                                    "VENDOR_MANIFEST_CDN_BAN",
                                    vendor_file,
                                    1,
                                    f"Vendor specifier '{specifier}' in [{domain}] references banned external CDN URL: '{rel_path}'. Vendor assets locally (ADR 0032)."
                                )
                            else:
                                abs_path = (vendor_file.parent / rel_path).resolve()
                                if not abs_path.exists():
                                    report_violation(
                                        "VENDOR_MANIFEST_MISSING_ASSET",
                                        vendor_file,
                                        1,
                                        f"Vendor specifier '{specifier}' in [{domain}] references missing local asset: '{rel_path}'"
                                    )
        except json.JSONDecodeError:
            report_violation("VENDOR_MANIFEST_SYNTAX_ERROR", vendor_file, 1, "Malformed JSON syntax in vendor.json")
        except Exception as e:
            report_violation("VENDOR_MANIFEST_READ_ERROR", vendor_file, 1, f"Failed to parse vendor.json: {e}")
def check_tier0_domain_purity():
    print("🔍 Sweeping Tier 0 Sutram/yenVUI Substrate for Domain & Scheme Leaks...")
    leak_pattern = re.compile(r'\b(?:inSetu|insetu)\b|yomama://|vfs:(?:diff|pairdiff):')
    vendor_dirs = [
        BACKEND_DIR / "static" / "vendor" / "sutram",
        BACKEND_DIR / "static" / "vendor" / "yenvui",
    ]
    if SUTRAM_DIR.exists():
        vendor_dirs.extend([
            SUTRAM_DIR / "sutram",
            SUTRAM_DIR / "yenvui",
        ])
    for v_dir in vendor_dirs:
        if not v_dir.exists():
            continue
        for js_fp in sorted(v_dir.rglob("*.js")):
            try:
                content = js_fp.read_text(encoding="utf-8")
                if leak_pattern.search(content):
                    report_violation(
                        "TIER0_DOMAIN_LEAK_BAN",
                        js_fp,
                        1,
                        "Tier 0 Sutram/yenVUI source or bundle contains upward reference to Tier 2 ('inSetu', 'yomama://', or 'vfs:diff:'). Keep Tier 0 strictly domain-agnostic and run vendor_sutram.sh."
                    )
            except Exception:
                pass

def check_javascript_files():
    check_vendor_manifest_paths()
    check_tier0_domain_purity()
    print("🔍 Sweeping JavaScript Frontend (Hybrid AST + Regex Analysis)...")
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
    floating_collection_pattern = re.compile(r'^\s*const\s+_[a-zA-Z0-9_]+\s*=\s*new\s+(?:Set|Map)\s*\(')
    naive_xss_pattern = re.compile(r'\.replace\(/<script')
    create_modal_pattern = re.compile(r'\.createModal\s*\(')
    slug_dry_pattern = re.compile(r'\.normalize\([\'"]NFD[\'"]\)')
    context_scraping_pattern = re.compile(r'\.active\b.*\.sub-tab|\.sub-tab.*\.active\b')
    form_data_pattern = re.compile(r'new\s+FormData\b')
    local_fetch_wrapper_pattern = re.compile(r'(const|let|var)\s+apiFetch\s*=')
    imperative_dom_create_pattern = re.compile(r'document\.createElement\(')
    raw_fetch_pattern = re.compile(r'\bfetch\s*\(')
    legacy_insetu_fetch_pattern = re.compile(r'window\.inSetu\.fetch\s*\(')
    legacy_api_routing_pattern = re.compile(r'\bapi\.(?:workspace|system)\s*\(')
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
    banned_cdn_import_pattern = re.compile(r'(?:from\s+|import\(\s*)[\'"]https?://(esm\.sh|cdn\.jsdelivr\.net|unpkg\.com)')
    banned_yenvui_tag_pattern = re.compile(r'<\/?yenvui-')
    sutram_subdir_pattern = re.compile(r'from\s+[\'"][^\'"]*vendor/sutram/(?!js/)[^\'"]*[\'"]')
    raw_dialog_pattern = re.compile(r'<dialog\b')
    inline_date_formatting_pattern = re.compile(r'new\s+Date\([^)]*\)\.toLocale(?:Date|Time)?String\(\)')
    raw_poll_job_pattern = re.compile(r'\bthis\.api\.pollJob\s*\(')
    gather_repo_sub_pattern = re.compile(r'stores\.Gather\.getState\(\)\.(?:allRepos|pinnedRepos|targetConfigs)')
    sutram_settings_event_pattern = re.compile(r'addEventListener\s*\(\s*[\'"]sutram-settings-(?:action|save)[\'"]')
    legacy_system_uri_pattern = re.compile(r'system://')
    sutram_form_control_pattern = re.compile(r'<(?:input|select|textarea)\b(?!.*type=["\']file["\'])')
    cross_store_mutation_pattern = re.compile(r'(?:window\.inSetu\.stores\.([A-Za-z0-9_]+)|([A-Za-z0-9_]+Store))\.setState\s*\(')
    legacy_refresh_pattern = re.compile(r'\bon(?:Sub)?NavReselected\s*\(')
    unmanaged_document_input_listener_pattern = re.compile(r"document\.addEventListener\(\s*['\"](input|change)['\"]")
    open_virtual_file_pattern = re.compile(r'\b(?:this\.vfs|window\.inSetu\.vfs|vfs)\.openVirtualFile\s*\(')
    registry_debounce_pattern = re.compile(r'(?:window\.)?ExtensionRegistry\.utils\.debounce')
    parse_uri_deprecation_pattern = re.compile(r'\bparseURI\s*\(')
    banned_ui_zones_pattern = re.compile(r'\buiHooks\s*:|[\'"]zone:[a-zA-Z0-9_-]+[\'"]')
    banned_has_actions_pattern = re.compile(r'\bhas-actions\b')
    banned_sub_nav_actions_slot_pattern = re.compile(r'slot\s*:\s*[\'"]slots:sub-navigation-actions[\'"]')
    composed_path_pattern = re.compile(r'\be\.composedPath\s*\(\s*\)')
    unscoped_offline_storage_pattern = re.compile(r"localStorage\.(?:set|get)Item\(['\"]insetu_offline_(?:config|topology|workspaces)['\"]")
    domain_store_config_mirror_pattern = re.compile(r'(?:targetConfigs|allRepos)\s*:\s*AppStore\.getState\(\)\.(?:targetConfigs|allRepos)')
    singleton_modal_ban_pattern = re.compile(r'\b(?:FsStore\.getState\(\)\.fileModal|insetu-file-modal)\b')
    legacy_routing_ban_pattern = re.compile(r'\bAppStore\.getState\(\)\.(?:activeTab|activeSubTabs|setActiveRoute)\b')
    udf_editor_intent_mandate_pattern = re.compile(r'document\.querySelectorAll\([\'"]insetu-editor-projection[\'"]\)')
    legacy_sdk_import_ban_pattern = re.compile(r'from\s+[\'"][^\'"]*/static/extensions/system/sdk\.js[\'"]')
    coarse_store_sub_pattern = re.compile(r'this\.subscribe\(\s*([^,\n]+|\n\s*[^,\n]+)\s*,\s*(?:(?:(?:\(?\s*(?:state|s)\s*\)?)|(?:\(?\s*\{[^}]+\}\s*\)?))\s*=>\s*\{|function\s*\([^)]*\)\s*\{)', re.MULTILINE)
    direct_browse_path_setstate_pattern = re.compile(r'\b(?:globalBrowsePath|currentBrowsePath)\b')
    legacy_frontmatter_pubsub_pattern = re.compile(r'insetu:(?:request-frontmatter|editor:save-frontmatter)\b')
    detached_sync_watermark_pattern = re.compile(r'\.syncWatermarks\b')
    dirty_alert_triangle_pattern = re.compile(r'isDirty\s*\?\s*[\'"]alert-triangle[\'"]')
    n_plus_one_bulk_vfs_pattern = re.compile(r'export\s+async\s+function\s+executeBulk(?:Move|Archive|Delete)(?:(?!export\s+)[\s\S])*?for\s*\([^)]*\)\s*\{(?:(?!export\s+)[\s\S])*?await\s+_(?:relocate|archive|delete)VfsNode\b')
    duplicated_filter_pattern = re.compile(r'pinnedRepos\.has\([^\)]+\)[\s\S]*?fuzzyFilterObjects')
    uri_scheme_strip_ban_pattern = re.compile(r'\.replace\(\s*(?:/\^?(?:vfs|ctx|ws):\\\/\\\/[^/]*/g?|[\'"](?:vfs|ctx|ws):\/\/[^\'"]*[\'"])\s*,\s*[\'"][\'"]\s*\)')
    download_uri_path_ban_pattern = re.compile(r'/download/\$\{encodeURIComponent\(')
    legacy_build_file_tree_call_pattern = re.compile(r'\bbuildFileTree\s*\(')
    folder_entity_card_pattern = re.compile(r'\.entityType=\$\{[\'"]folder[\'"]\}[\s\S]{0,200}?\.entityData=\$\{\{([^\}]+)\}\}')
    component_execute_unload_ban_pattern = re.compile(r'\.executeUnload\s*\(')
    direct_manifest_slots_mutation_pattern = re.compile(r'\bmanifest\.layoutSlots\s*(?:=|\.push\b|\.splice\b)')
    store_persistence_schema_pattern = re.compile(
        r'create(?:Extension|Sutram)Store\s*\(\s*[\'"][^\'"]+[\'"]\s*,\s*\{([\s\S]*?)\}\s*,\s*\{([\s\S]*?)\}\s*\)',
        re.MULTILINE
    )
    legacy_array_persist_pattern = re.compile(
        r'create(?:Extension|Sutram)Store\s*\(\s*[\'"][^\'"]+[\'"]\s*,\s*\{[\s\S]*?\}\s*,\s*\[\s*[\'"]',
        re.MULTILINE
    )
    valid_sutram_ui_hooks = {
        "sutram:is-projection-dirty",
        "sutram:rekey-projection-id",
        "sutram:vendorize-language",
        "sutram:resolve-editor-component",
        "sutram:normalize-projection-id",
        "sutram:popout-fallback",
        "sutram:before-popout",
        "sutram:before-dock-in",
        "sutram:build-popout-url",
        "sutram:restore-docked-projection",
        "sutram:popout-projection",
        "sutram:is-swapping-scope",
        "sutram:is-swapping-workspace",
        "sutram:resolve-primary-tab-meta",
        "sutram:resolve-route-hash",
        "sutram:resolve-item-size",
    }
    ui_hooks_block_pattern = re.compile(r'\buiHooks\s*:\s*\{([\s\S]*?)\n\s*\}', re.MULTILINE)
    uri_raw_split_pattern = re.compile(
        r'\b[a-zA-Z0-9_$.]*(?:[pP]ath|[uU]ri|[fF]ile|Dir|target)\b[^;\n]*?\.split\(\s*[\'"]/[\'"]\s*\)\.(?:filter\(\s*Boolean\s*\)|pop\(\s*\)|slice\()'
    )
    generic_scheme_strip_pattern = re.compile(
        r'\.replace\(\s*/\^\(\?:\[a-zA-Z0-9_-\]\+\|(?:vfs|ctx|ws)[^/]*\):\\\/\\\/[^/]*/g?\s*,\s*[\'"][\'"]\s*\)'
    )
    bespoke_subtab_selection_menu_pattern = re.compile(
        r'getAggregatableActions\s*\([\s\S]{0,400}?<sutram-dropdown\b'
    )
    entity_action_obj_pattern = re.compile(r'\{\s*targetEntit(?:y|ies)\s*:[\s\S]*?\n\s*\}', re.MULTILINE)
    quickpack_share_allowed_files = {"gather.js", "fs.js", "agent.js", "ext_flow.js", "prompts.js"}
    fs_domain_coupling_pattern = re.compile(
        r'\b(?:GatherStore|FlowStore|GitStore|executeCompile|flow_workflows|git_diffs|gather_base)\b|stores\.(?:Gather|Flow|Git)\b'
    )
    speculative_on_reveal_pattern = re.compile(
        r'\bonReveal\s*:|addEventListener\(\s*[\'"]yenvui-overlay-opened[\'"]'
    )
    insetu_uri_class_pattern = re.compile(r'export\s+class\s+InSetuURI\b([\s\S]*?)^}', re.MULTILINE)
    insetu_uri_store_coupling_pattern = re.compile(r'\b(?:AppStore|derivedVfsFiles|stores\.App)\b')
    manual_entity_chunks_prop_pattern = re.compile(r'\.entityData=\$\{\{[\s\S]{0,400}?\bchunks\s*:')
    unprefixed_api_route_pattern = re.compile(
        r'\b(?:this\.api|window\.inSetu\.api(?:\.workspace)?)\.(?:get|post|delete|getJson|postJson|deleteJson|bindJobAction)\(\s*([\'`"])([^\'`"$?\s]+)(?:\?[^\'`"]*)?\1'
    )
    known_api_modules = {
        "bridge", "gather", "cartographer", "config", "editor", "fs", "system",
        "workers", "auth", "security", "topology", "offline", "llm", "agent", "prompts",
        "citations", "cronic", "dev", "favorites", "flow", "format", "freshdesk",
        "git", "hooks", "ingest", "notes", "preview", "publish", "research", "skills",
        "tailscale", "term", "tracker", "update"
    }

    # Initialize Tree-sitter for Hybrid Parsing
    ts_available = False
    parser = None
    JS_LANG = None
    try:
        from tree_sitter import Language, Parser, Query, QueryCursor
        import tree_sitter_javascript as ts_js
        JS_LANG = Language(ts_js.language())
        parser = Parser(JS_LANG)
        ts_available = True
    except ImportError:
        print("⚠️ [WARNING] Tree-sitter not installed. Falling back to legacy regex. (Run `pip install -e .[syntax]`)")
    ext_dir = BACKEND_DIR / "extensions"
    tier3_ext_names = sorted([
        d.name for d in ext_dir.iterdir()
        if d.is_dir() and not d.name.startswith("__")
    ]) if ext_dir.exists() else []
    tier3_store_names = [f"{name.capitalize()}" for name in tier3_ext_names] + ["Kanban"]
    tier2_ext_leak_pattern = re.compile(
        r'\bstores\.(?:' + '|'.join(re.escape(s) for s in tier3_store_names) + r')\b'
        r'|ctx://(?:' + '|'.join(re.escape(n) for n in tier3_ext_names) + r')/'
        r'|\.insetu-data/(?:' + '|'.join(re.escape(n) for n in tier3_ext_names) + r')/'
    ) if tier3_ext_names else None

    js_scan_roots = [FRONTEND_DIR, BACKEND_DIR / "core", BACKEND_DIR / "extensions"]
    for filepath in collect_unique_files(js_scan_roots, [".js"]):
        file = filepath.name
        is_tier0 = "sutram" in filepath.parts and "vendor" not in filepath.parts
        is_core_js = "core" in filepath.parts and not is_tier0
        is_extension = file.startswith("ext_") or "extensions" in filepath.parts
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
        is_lit_component = any(re.search(r'from\s+[\'"]lit[\'"]', l) for l in lines)
        full_content = "".join(lines)
        declared_stores = set(re.findall(r'createExtensionStore\(\s*[\'"]([A-Za-z0-9_]+)[\'"]', full_content))
        declared_store_vars = {f"{s}Store" for s in declared_stores} | set(re.findall(r'const\s+([A-Za-z0-9_]+Store)\s*=\s*createExtensionStore', full_content))
        # --- 1. TREE-SITTER AST STRUCTURAL PASS ---
        if ts_available:
            tree = parser.parse(bytes(full_content, "utf8"))
            # UDF State Bleed
            udf_query = Query(JS_LANG, '(program (lexical_declaration) @udf)')
            for match in QueryCursor(udf_query).matches(tree.root_node):
                for node in match[1].get("udf", []):
                    decl_text = full_content.encode('utf8')[node.start_byte:node.end_byte].decode('utf8').strip()
                    if is_extension and decl_text.startswith("let"):
                        report_violation("UDF_STATE_BLEED", filepath, node.start_point[0] + 1, "Floating module-level global state detected. Migrate variable into the centralized Zustand AppStore.")
                    elif (is_extension or "core" in filepath.parts or is_tier0) and floating_collection_pattern.match(decl_text):
                        report_violation("UDF_STATE_BLEED", filepath, node.start_point[0] + 1, "Floating module-level Set/Map singleton detected. Migrate mutable collection into the module's Zustand Store.")

            # Custom Event Dispatch
            dispatch_query = Query(JS_LANG, '(call_expression function: (member_expression object: (identifier) @obj (#eq? @obj "window") property: (property_identifier) @prop (#eq? @prop "dispatchEvent"))) @call')
            for match in QueryCursor(dispatch_query).matches(tree.root_node):
                for node in match[1].get("call", []):
                    if is_extension:
                        report_violation("CUSTOM_EVENT_DISPATCH_MANDATE", filepath, node.start_point[0] + 1, "Raw window.dispatchEvent detected. Route through this.dispatch(eventName, detail) for streamlined multi-tenant boundaries.")

            # Approved API Verbs & PollJob Warnings
            api_query = Query(JS_LANG, '''
                (call_expression
                    function: (member_expression
                        object: (member_expression object: (this) property: (property_identifier) @api_prop (#eq? @api_prop "api"))
                        property: (property_identifier) @verb
                    )
                ) @api_call
            ''')
            allowed_verbs = {"get", "post", "delete", "getJson", "postJson", "deleteJson", "fetchImmutableText", "bindJobAction", "pollJob", "request", "workspace", "system"}
            for match in QueryCursor(api_query).matches(tree.root_node):
                for node in match[1].get("verb", []):
                    verb_name = full_content.encode('utf8')[node.start_byte:node.end_byte].decode('utf8')
                    line_n = node.start_point[0] + 1
                    if verb_name not in allowed_verbs and file not in ["api.js", "sdk.js", "insetu_sdk.js"]:
                        report_violation("APPROVED_API_VERB_MANDATE", filepath, line_n, f"Unapproved method '.{verb_name}' called on this.api. Use canonical verbs (.get, .post, .delete, .getJson, .postJson, .deleteJson, .bindJobAction, .pollJob, .request, .workspace, .system).")
                    if verb_name == "pollJob" and is_extension and file not in ("ext_tracker.js", "ext_flow.js"):
                        print(f"⚠️ [WARNING: BIND_JOB_ACTION_PREFERENCE] {file}:{line_n}\n   ↳ Imperative this.api.pollJob detected. Prefer declarative this.api.bindJobAction when possible.")
            # Debounce Mandate (clearTimeout)
            debounce_query = Query(JS_LANG, '(call_expression function: (identifier) @func (#eq? @func "clearTimeout")) @call')
            for match in QueryCursor(debounce_query).matches(tree.root_node):
                for node in match[1].get("call", []):
                    line_idx = node.start_point[0]
                    line_text = lines[line_idx]
                    if file not in ("utils.js", "sutram_sdk.js") and "Timer" not in line_text and "panicTimeout" not in line_text:
                        report_violation("DEBOUNCE_MANDATE", filepath, line_idx + 1, "Raw clearTimeout detected. Use window.inSetu.extensions.Registry.utils.debounce() for input throttling. (Exemptions granted for explicit Timer variables).")

            # Coarse Store Subscription Mandate
            sub_query = Query(JS_LANG, '''
                (call_expression
                    function: (member_expression
                        object: (this)
                        property: (property_identifier) @sub_prop (#eq? @sub_prop "subscribe")
                    )
                    arguments: (arguments) @args
                ) @call
            ''')
            for match in QueryCursor(sub_query).matches(tree.root_node):
                for node in match[1].get("call", []):
                    args_node = node.child_by_field_name("arguments")
                    if args_node:
                        named_args = [c for c in args_node.children if c.is_named]
                        line_n = node.start_point[0] + 1
                        if len(named_args) < 3 and file not in ["store.js", "system.js", "insetu_sdk.js", "sutram_sdk.js"]:
                            report_violation(
                                "COARSE_STORE_SUBSCRIPTION_MANDATE",
                                filepath,
                                line_n,
                                "Coarse monolithic store subscription detected. Use selector-scoped subscriptions (this.subscribe(Store, state => slice, (slice) => ...)) with structural equality to prevent render thrashing."
                            )

        # --- 2. GLOBAL & STRING PATTERNS ---
        for folder_match in folder_entity_card_pattern.finditer(full_content):
            entity_data_body = folder_match.group(1)
            if "filepath:" not in entity_data_body or "titleText:" not in entity_data_body:
                line_num = full_content[:folder_match.start()].count('\n') + 1
                report_violation(
                    "FOLDER_ENTITY_DATA_MANDATE",
                    filepath,
                    line_num,
                    "Folder cards (.entityType=${'folder'}) must include both 'filepath' and 'titleText' in .entityData for SelectionStore and Quickpack parity."
                )
        if n_plus_one_bulk_vfs_pattern.search(full_content):
            report_violation(
                "BULK_VFS_LOOP_BAN",
                filepath,
                1,
                "Sequential N+1 VFS mutation loop detected inside executeBulk*. Dispatch a single atomic 'fs/bulk' mutation instead."
            )
        if is_core_js and tier2_ext_leak_pattern:
            for m in tier2_ext_leak_pattern.finditer(full_content):
                line_num = full_content[:m.start()].count('\n') + 1
                report_violation(
                    "TIER2_EXTENSION_NAME_LEAK_BAN",
                    filepath,
                    line_num,
                    f"Tier 2 core module '{file}' contains hardcoded Tier 3 extension reference '{m.group(0)}'. Use ExtensionRegistry or IoC hooks instead."
                )
        if "core" in filepath.parts and "fs" in filepath.parts:
            for m in fs_domain_coupling_pattern.finditer(full_content):
                line_num = full_content[:m.start()].count('\n') + 1
                report_violation(
                    "FS_DOMAIN_AGNOSTICISM_MANDATE",
                    filepath,
                    line_num,
                    f"core/fs/{file} references compilation/domain symbol '{m.group(0)}'. Delegate via IoC hooks (e.g. 'insetu:ensure-fresh-artifact')."
                )
        for m in speculative_on_reveal_pattern.finditer(full_content):
            line_num = full_content[:m.start()].count('\n') + 1
            report_violation(
                "SPECULATIVE_ON_REVEAL_BAN",
                filepath,
                line_num,
                f"Speculative pre-warming ('{m.group(0)}') on card reveal/drawer open is banned; fetch on explicit click and use keepDrawerOpen: true."
            )
        if file == "insetu_sdk.js":
            uri_cls_match = insetu_uri_class_pattern.search(full_content)
            if uri_cls_match:
                uri_body = uri_cls_match.group(1)
                for m in insetu_uri_store_coupling_pattern.finditer(uri_body):
                    line_num = full_content[:uri_cls_match.start(1) + m.start()].count('\n') + 1
                    report_violation(
                        "INSETU_URI_LEXICAL_PURITY_MANDATE",
                        filepath,
                        line_num,
                        f"InSetuURI couples to live store state ('{m.group(0)}'). Keep InSetuURI strictly lexical and stateless."
                    )
        if is_extension and duplicated_filter_pattern.search(full_content):
            report_violation(
                "DUPLICATED_FILTER_PIPELINE_BAN",
                filepath,
                1,
                "Manual two-tier pinned repo check and fuzzyFilterObjects detected. Use 'this.filterItems(items, options)' on InSetuElement instead."
            )
        if is_extension and component_execute_unload_ban_pattern.search(full_content):
            report_violation(
                "COMPONENT_EXECUTE_UNLOAD_BAN",
                filepath,
                1,
                "Extension components are forbidden from invoking ExtensionRegistry.executeUnload() directly. Extension unloading is managed exclusively by SessionOrchestrator."
            )
        if is_extension and direct_manifest_slots_mutation_pattern.search(full_content):
            report_violation(
                "DIRECT_MANIFEST_SLOTS_MUTATION_BAN",
                filepath,
                1,
                "Direct mutation of manifest.layoutSlots detected. Use ExtensionRegistry.setDynamicLayoutSlots(extName, slots) so baseline layout slots are restored on workspace swap."
            )
        if is_extension:
            for m in manual_entity_chunks_prop_pattern.finditer(full_content):
                line_num = full_content[:m.start()].count('\n') + 1
                report_violation(
                    "MANUAL_ENTITY_CHUNKS_PROP_BAN",
                    filepath,
                    line_num,
                    "Manual 'chunks:' property inside .entityData in extension template is banned. Pass 'filepath' and let core/fs/fs.js resolve chunks from the live manifest."
                )
        if file not in ("api.js", "insetu_sdk.js", "sutram_sdk.js"):
            for m in unprefixed_api_route_pattern.finditer(full_content):
                raw_route = m.group(2).strip().lstrip("/")
                if not raw_route:
                    continue
                segments = [s for s in raw_route.split("/") if s]
                first_seg = segments[0] if segments else ""
                if len(segments) < 2 or first_seg not in known_api_modules:
                    line_num = full_content[:m.start()].count('\n') + 1
                    report_violation(
                        "CANONICAL_API_ROUTE_PREFIX_MANDATE",
                        filepath,
                        line_num,
                        f"Non-canonical API route '{raw_route}' detected. Always specify the explicit '<module>/<endpoint>' prefix (e.g. 'flow/batches', 'prompts/resolve')."
                    )
        for legacy_arr_match in legacy_array_persist_pattern.finditer(full_content):
            line_num = full_content[:legacy_arr_match.start()].count('\n') + 1
            report_violation(
                "LEGACY_PERSIST_KEYS_ARRAY_BAN",
                filepath,
                line_num,
                "Legacy array persistKeys detected in store instantiation. Migrate to persistenceSchema object ({ localSync, sessionSync })."
            )
        if file not in ("insetu_sdk.js", "ui_file_tree.js", "utils.js"):
            for m in uri_raw_split_pattern.finditer(full_content):
                line_num = full_content[:m.start()].count('\n') + 1
                report_violation(
                    "JS_URI_BASENAME_AND_SPLIT_MANDATE",
                    filepath,
                    line_num,
                    f"Manual URI string splitting ({m.group(0).strip()}) detected. Use new InSetuURI(uri).basename, .parentUri, .withName(), or .pathSegments."
                )
            for m in generic_scheme_strip_pattern.finditer(full_content):
                line_num = full_content[:m.start()].count('\n') + 1
                report_violation(
                    "URI_SCHEME_STRIP_BAN",
                    filepath,
                    line_num,
                    "Stripping URI scheme via regex .replace() is banned. Use new InSetuURI(uri).pathSegments or this.utils.parseURI(uri)."
                )
        if bespoke_subtab_selection_menu_pattern.search(full_content) and file not in ("primitives.js", "sutram_sdk.js"):
            report_violation(
                "DECLARATIVE_SUBTAB_MENU_MANDATE",
                filepath,
                1,
                "Bespoke sub-tab bulk selection dropdown detected. Declare bulkActionGroup, bulkEntityTypes, and menuActions on the slots:sub-navigation slot instead."
            )
        if file not in quickpack_share_allowed_files:
            for act_match in entity_action_obj_pattern.finditer(full_content):
                act_block = act_match.group(0)
                if re.search(r'\bbulkable\s*:\s*true\b', act_block) and re.search(r'\bgroup\s*:\s*[\'"]share[\'"]', act_block):
                    line_num = full_content[:act_match.start()].count('\n') + 1
                    report_violation(
                        "QUICKPACK_SHARE_GROUP_ISOLATION",
                        filepath,
                        line_num,
                        "Domain extensions cannot register 'bulkable: true' actions in group 'share' (reserved for Quickpack export/staging). Use a domain group (e.g. 'vcs', 'file', 'tracker') and declare bulkActionGroup on the sub-navigation slot."
                    )
        for hooks_match in ui_hooks_block_pattern.finditer(full_content):
            hooks_body = hooks_match.group(1)
            for hook_key_match in re.finditer(r'[\'"](sutram:[^\'"]+|zone:[^\'"]+)[\'"]\s*:', hooks_body):
                hook_key = hook_key_match.group(1)
                if hook_key not in valid_sutram_ui_hooks:
                    line_num = full_content[:hooks_match.start() + hook_key_match.start()].count('\n') + 1
                    report_violation(
                        "INVALID_SUTRAM_UI_HOOK_KEY",
                        filepath,
                        line_num,
                        f"Unrecognized or deprecated UI hook '{hook_key}'. Must be an approved 'sutram:*' host contract hook."
                    )
        for schema_match in store_persistence_schema_pattern.finditer(full_content):
            init_body, schema_body = schema_match.group(1), schema_match.group(2)
            declared_init_keys = set(re.findall(r'(?:^|[,{\n])\s*([a-zA-Z0-9_]+)\s*:', init_body))
            for sync_type in ("localSync", "sessionSync"):
                sync_arr_match = re.search(rf'\b{sync_type}\s*:\s*\[([^\]]*)\]', schema_body)
                if sync_arr_match:
                    sync_keys = re.findall(r'[\'"]([a-zA-Z0-9_]+)[\'"]', sync_arr_match.group(1))
                    for sk in sync_keys:
                        if sk not in declared_init_keys:
                            line_num = full_content[:schema_match.start()].count('\n') + 1
                            report_violation(
                                "ORPHANED_PERSISTENCE_KEY_BAN",
                                filepath,
                                line_num,
                                f"Persistence key '{sk}' in {sync_type} is not declared in the store's initialState."
                            )
        if not ts_available and file not in ["store.js", "system.js", "insetu_sdk.js", "sutram_sdk.js"]:
            for m in coarse_store_sub_pattern.finditer(full_content):
                line_num = full_content[:m.start()].count('\n') + 1
                report_violation(
                    "COARSE_STORE_SUBSCRIPTION_MANDATE",
                    filepath,
                    line_num,
                    "Coarse monolithic store subscription detected. Use selector-scoped subscriptions (this.subscribe(Store, state => slice, (slice) => ...)) with structural equality to prevent render thrashing."
                )
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
        if "navigator.share(" in full_content and "navigator.canShare" not in full_content:
            report_violation("WEB_SHARE_GUARD_MANDATE", filepath, 1, "Invocation of navigator.share() detected without a defensive navigator.canShare check.")
        if file not in ["app.js", "system.js", "ui_dropdowns.js", "ui_file_tree.js"]:
            if "addEventListener('click'" in full_content or 'addEventListener("click"' in full_content:
                if "dropdown" in full_content.lower() or "filter" in full_content.lower():
                    if "insetu-filter-dropdown" not in full_content:
                        report_violation("DROPDOWN_CLICK_OUTSIDE_VIOLATION", filepath, 1, "Manual click listener detected for dropdown/filter management. Migrate to <insetu-filter-dropdown>.")
        if "localStorage.setItem('insetu_pinned_repos'" in full_content or 'localStorage.setItem("insetu_pinned_repos"' in full_content:
            report_violation("GLOBAL_LOCALSTORAGE_TENANT_LEAK", filepath, 1, "Un-suffixed localStorage write pattern detected. Force workspace-scoping (e.g., insetu_pinned_repos_${ws}).")

        # --- 3. LINE-BY-LINE REGEX SCANNER ---
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
            if composed_path_pattern.search(line) and file not in ["physics.js", "sutram_sdk.js", "insetu_sdk.js"]:
                report_violation("EVENT_PATH_RESOLVER_MANDATE", filepath, line_num, "Direct 'e.composedPath()' usage detected. Use 'getEventPath(e)' or 'this.getEventPath(e)' via the SDK for centralized event path resolution.")

            if not ts_available:
                if clear_timeout_pattern.search(line):
                    if "Timer" not in line and "panicTimeout" not in line:
                        report_violation("DEBOUNCE_MANDATE", filepath, line_num, "Raw clearTimeout detected. Use window.inSetu.extensions.Registry.utils.debounce() for input throttling. (Exemptions granted for explicit Timer variables).")

                if is_extension and floating_global_pattern.match(line.strip()):
                    report_violation("UDF_STATE_BLEED", filepath, line_num, "Floating global state detected. Migrate variable into the centralized Zustand AppStore.")
                if file not in ["api.js", "sdk.js"] and re.search(r'\bthis\.api\.(?!(?:get|post|delete|getJson|postJson|deleteJson|fetchImmutableText|bindJobAction|pollJob|request|workspace|system)\b)\w+', line):
                    report_violation("APPROVED_API_VERB_MANDATE", filepath, line_num, "Unapproved method called on this.api. Use canonical verbs (.get, .post, .delete, .getJson, .postJson, .deleteJson, .bindJobAction, .pollJob, .request, .workspace, .system).")

                if is_extension and raw_poll_job_pattern.search(line) and file not in ("ext_tracker.js", "ext_flow.js"):
                    print(f"⚠️ [WARNING: BIND_JOB_ACTION_PREFERENCE] {file}:{line_num}\n   ↳ Imperative this.api.pollJob detected. Prefer declarative this.api.bindJobAction when possible.")

                if is_extension and is_lit_component and global_dispatch_pattern.search(line):
                    report_violation("CUSTOM_EVENT_DISPATCH_MANDATE", filepath, line_num, "Raw window.dispatchEvent detected. Route through this.dispatch(eventName, detail) for streamlined multi-tenant boundaries.")
            if dom_annihilation_pattern.search(line):
                report_violation("SURGICAL_DOM_MANDATE", filepath, line_num, "DOM annihilation detected. Use surgical reconciliation instead of clearing .innerHTML.")

            if is_lit_component and re.search(r'\.innerHTML\s*=', line):
                report_violation("LIT_INNER_HTML_BAN", filepath, line_num, "Direct '.innerHTML=' assignment in Lit component detected. Render text nodes declaratively using Lit interpolation to prevent XSS.")

            if re.search(r'<sutram-card\b[^>]*\bintentColor=["\']var\(--intent-', line):
                report_violation("SUTRAM_CARD_INTENT_TOKEN_MANDATE", filepath, line_num, "Deprecated intentColor='var(--intent-*)' detected on <sutram-card>. Use declarative intent='primary|warning|danger|neutral|highlight' token property instead.")

            if raw_layout_ban_pattern.search(line):
                report_violation("RAW_LAYOUT_BAN", filepath, line_num, "Raw layout class '.file-card' detected. Migrate to <insetu-card> or <yenvui-card> primitives.")
            if legacy_modal_ban_pattern.search(line):
                report_violation("LEGACY_MODAL_BAN", filepath, line_num, "Legacy modal layout class detected. Migrate to <yenvui-modal> or <insetu-modal> primitives.")
            if legacy_modal_maxwidth_pattern.search(line):
                report_violation("MODAL_FULLSCREEN_PROPERTY_MANDATE", filepath, line_num, "Deprecated maxWidth viewport attribute on <insetu-modal>. Use declarative ?fullscreen=${true} property instead.")
            if legacy_insetu_modal_pattern.search(line):
                report_violation("LEGACY_INSETU_MODAL_BAN", filepath, line_num, "Deprecated <insetu-modal> tag or @modal-closed/@modal-closing event detected. Migrate to <yenvui-modal> and @yenvui-modal-closed / @yenvui-modal-closing.")

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
            if file not in ["api.js", "sdk.js"] and legacy_api_routing_pattern.search(line):
                report_violation("SEMANTIC_API_ROUTING_MANDATE", filepath, line_num, "Direct invocation of api.workspace() or api.system() detected. Route through the semantic .get() or .post() chains instead.")
            if direct_browse_path_setstate_pattern.search(line):
                report_violation("CANONICAL_BROWSE_PATH_MANDATE", filepath, line_num, "Deprecated globalBrowsePath or currentBrowsePath usage detected (RFC 0108). Use AppStore.getState().getBrowsePath(subId) / setBrowsePath(pathArray, subId) or FsStore.modals.browser.currentPath.")
            if legacy_frontmatter_pubsub_pattern.search(line):
                report_violation("LEGACY_FRONTMATTER_PUBSUB_BAN", filepath, line_num, "Deprecated frontmatter pub/sub event ('insetu:request-frontmatter' or 'insetu:editor:save-frontmatter') detected. Push metadata updates directly to the editor projection via editorEl.syncFrontmatter(yamlPatch) or FsStore.getState().updateBufferFrontmatter().")
            if file != "store.js" and detached_sync_watermark_pattern.search(line):
                report_violation("DETACHED_SYNC_WATERMARK_BAN", filepath, line_num, "Direct '.syncWatermarks' property access detected. Call AppStore.getState().getSyncWatermarks() to guarantee a live tenant-scoped reference.")

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
            if banned_yenvui_tag_pattern.search(line):
                report_violation("BANNED_YENVUI_TAG_BAN", filepath, line_num, "Deprecated '<yenvui-' custom element tag detected. Migrate entirely to vendorized 'sutram-' primitives.")

            if is_extension and lit_element_class_pattern.search(line):
                report_violation("SDK_ELEMENT_MANDATE", filepath, line_num, "Extension component extends native LitElement. Use InSetuElement instead to enable managed lifecycles.")

            if is_extension and raw_register_tick_pattern.search(line):
                report_violation("POLLING_MANDATE", filepath, line_num, "Raw registerTick detected. Use this.api.pollJob or central SDK polling mechanisms to coordinate worker jobs.")

            if zustand_reference_mutation_pattern.search(line):
                report_violation("ZUSTAND_REFERENCE_MUTATION", filepath, line_num, "Symmetric state assignment detected (e.g. {manifest: manifest}). Ensure complex objects are explicitly cloned using the spread operator before passing to setState.")
            if (is_extension or 'core' in filepath.parts) and file not in ["fs.js", "ui_editor.js", "insetu_sdk.js"] and banned_ui_zones_pattern.search(line):
                report_violation("BANNED_UI_ZONES", filepath, line_num, "The 'uiHooks' object and 'zone:*' string hooks are permanently deprecated (ADR 0041). Use declarative customEditors, expanded layoutSlots, native InSetuElement lifecycles, or the Typed Event Bus.")
            if dirty_alert_triangle_pattern.search(line):
                report_violation("DIRTY_CARD_CONSTRUCTION_ICON_MANDATE", filepath, line_num, "Dirty cards must use the 'construction' icon instead of 'alert-triangle' (e.g., isDirty ? 'construction' : 'package').")

            if re.search(r'\bbatchActions\s*:', line):
                report_violation("LEGACY_BATCH_ACTIONS_BAN", filepath, line_num, "The 'batchActions' schema array is deprecated. Migrate bulk actions directly into 'entityActions' using 'bulkable: true' (ADR 0061).")
            if banned_has_actions_pattern.search(line):
                report_violation("BANNED_HAS_ACTIONS_ATTRIBUTE", filepath, line_num, "The 'has-actions' attribute is deprecated. <insetu-card> and <sutram-card> now automatically query the ExtensionRegistry to mount the action tray.")
            if banned_sub_nav_actions_slot_pattern.search(line):
                report_violation("BANNED_SUB_NAV_ACTIONS_SLOT_BAN", filepath, line_num, "The 'slots:sub-navigation-actions' slot is deprecated. Declare 'menuActions' and 'menuStores' on the 'slots:sub-navigation' slot definition instead.")

            if unscoped_offline_storage_pattern.search(line):
                report_violation("UNSCOPED_PERSISTENT_STORAGE", filepath, line_num, "Un-scoped persistent storage call detected on offline state. Consume window.inSetu.utils.getScopedStorage/setScopedStorage instead.")
            if domain_store_config_mirror_pattern.search(line):
                report_violation("DOMAIN_STORE_TOPOLOGY_MIRROR_BAN", filepath, line_num, "Domain store mirrors AppStore topology properties (targetConfigs/allRepos). Read topology reactively from AppStore or this.ecosystem instead.")
            if singleton_modal_ban_pattern.search(line):
                report_violation("SINGLETON_MODAL_BAN", filepath, line_num, "References to FsStore.fileModal or <insetu-file-modal> are banned. Use activeBuffers maps and agnostic projections instead.")
            if is_extension:
                for store_match in cross_store_mutation_pattern.finditer(line):
                    ns_store, var_store = store_match.group(1), store_match.group(2)
                    if ns_store and ns_store not in declared_stores:
                        report_violation("CROSS_STORE_MUTATION_BAN", filepath, line_num, f"Cross-store state mutation on 'stores.{ns_store}.setState()' detected. Extensions may only call .setState() on their own store.")
                    elif var_store and var_store not in declared_store_vars:
                        report_violation("CROSS_STORE_MUTATION_BAN", filepath, line_num, f"Cross-store state mutation on '{var_store}.setState()' detected. Extensions may only call .setState() on their own store.")
            if is_extension and is_lit_component and re.search(r'<button\b', line):
                report_violation("SUTRAM_BUTTON_MANDATE", filepath, line_num, "Raw <button> detected in Lit extension template. Use <sutram-btn> or <sutram-async-btn> primitives instead.")

            if is_lit_component and re.search(r'<sutram-btn\b(?!.*label=)[^>]*>[^<]+\S', line) and 'slot=' not in line:
                report_violation("SUTRAM_BUTTON_DECLARATIVE_LABEL_MANDATE", filepath, line_num, "Raw text child node detected in <sutram-btn>. Use declarative label=\"...\" property attribute instead.")

            if legacy_routing_ban_pattern.search(line):
                report_violation("LEGACY_ROUTING_BAN", filepath, line_num, "References to AppStore activeTab, activeSubTabs, or setActiveRoute are banned. Rely on Sutram LayoutStore or URL hash routing.")
            if udf_editor_intent_mandate_pattern.search(line):
                report_violation("UDF_EDITOR_INTENT_MANDATE", filepath, line_num, "Direct DOM querying for <insetu-editor-projection> is banned. Dispatch the 'insetu:editor-insert-text' intent over the Event Bus instead.")

            if legacy_sdk_import_ban_pattern.search(line):
                report_violation("LEGACY_SDK_IMPORT_BAN", filepath, line_num, "Importing from deprecated '/static/extensions/system/sdk.js' detected. Import from '/static/extensions/system/insetu_sdk.js' instead.")

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
            if is_extension and imperative_action_dispatch_pattern.search(line):
                report_violation("DECLARATIVE_EMIT_EVENT_MANDATE", filepath, line_num, "Imperative CustomEvent dispatch in entityAction detected. Use declarative emitEvent: (data) => ({ name, detail }) instead.")
            if banned_localstorage_tab_pattern.search(line):
                report_violation("BANNED_LOCALSTORAGE_TAB_ROUTING", filepath, line_num, "Direct localStorage tab state reads/writes are banned. Use AppStore routing and window.location.hash.")
            if re.search(r'window\.(?:inSetu\.sys\.)?executeSystemCompile\b', line):
                report_violation("LEGACY_DOMAIN_ACCESSOR_VIOLATION", filepath, line_num, "Direct invocation of executeSystemCompile detected. Route through the Store (e.g. GatherStore.getState().executeCompile) or this.compileSystem() (ADR 0024).")
            if file not in ["store.js", "sdk.js"] and direct_execute_ui_hook_pattern.search(line):
                report_violation("BANNED_DIRECT_EXECUTE_UI_HOOK", filepath, line_num, "Direct ExtensionRegistry.executeUIHook calls are deprecated. Use window.inSetu.events.emitHook(zone, payload).")
            if shared_styles_pattern.search(line) and 'vendor/sutram/js/shared_styles.js' not in line:
                report_violation("VENDOR_SHARED_STYLES_MANDATE", filepath, line_num, "Legacy or un-vendorized sharedStyles import detected. Reference vendor/sutram/js/shared_styles.js instead.")
            if sutram_subdir_pattern.search(line):
                report_violation("VENDOR_SUTRAM_JS_SUBDIR_MANDATE", filepath, line_num, "Sutram vendor imports must explicitly target the 'vendor/sutram/js/' subfolder.")
            if raw_dialog_pattern.search(line) and '@cancel' not in line:
                report_violation("RAW_DIALOG_OVERLAY_BAN", filepath, line_num, "Unwrapped <dialog> element detected without an explicit @cancel handler. Wrap in <sutram-modal> or supply an @cancel listener to prevent unhandled backdrop escape loops.")
            if is_extension and inline_date_formatting_pattern.search(line):
                report_violation("DATE_FORMATTING_MANDATE", filepath, line_num, "Inline new Date().toLocaleString() detected in extension. Consume this.utils.formatDate() instead to ensure theme and locale consistency.")
            if is_extension and is_lit_component and sutram_form_control_pattern.search(line):
                report_violation("SUTRAM_FORM_CONTROL_MANDATE", filepath, line_num, "Native HTML input/select/textarea tag detected in Lit extension template. Use <sutram-input>, <sutram-select>, <sutram-toggle>, or <sutram-textarea> instead.")
            if is_extension and gather_repo_sub_pattern.search(line):
                report_violation("ECOSYSTEM_ACCESSOR_MANDATE", filepath, line_num, "Direct GatherStore repository topology subscription detected in extension. Consume 'this.ecosystem' on InSetuElement instead.")
            if "AppStore" in line and re.search(r'manifest:\s*\{\s*[^\}]+\}', line) and not ("vfs:" in line or "ctx:" in line or "{}" in line):
                report_violation("DUAL_ROOT_MANIFEST_MANDATE", filepath, line_num, "Monolithic or unpartitioned manifest initialization detected. Manifest must be initialized as { vfs: {}, ctx: {} } (ADR 0037).")
            if sutram_settings_event_pattern.search(line) and ("fetch(" in line or "window.fetch(" in line):
                report_violation("SETTINGS_ACTION_EXPLICIT_API_MANDATE", filepath, line_num, "Event handler for sutram-settings-action/save uses raw fetch(). Route through window.inSetu.api.workspace instead.")
            if legacy_system_uri_pattern.search(line):
                report_violation("LEGACY_SYSTEM_URI_BAN", filepath, line_num, "Legacy 'system://' URI scheme detected. Migrate to 'ctx://' URI scheme.")
            if uri_scheme_strip_ban_pattern.search(line):
                report_violation("URI_SCHEME_STRIP_BAN", filepath, line_num, "Stripping 'vfs://', 'ctx://', or 'ws://' scheme via .replace() is banned. Preserve canonical URIs or use this.utils.parseURI(uri).")
            if download_uri_path_ban_pattern.search(line):
                report_violation("DOWNLOAD_URI_PATH_BAN", filepath, line_num, "Embedding encoded URIs in '/download/${encodeURIComponent(...)}' path segments causes WSGI slash collapsing. Route through resolveFileFetchUrl(uri) ('/api/<ws>/fs/fetch?file=...&download=1') instead.")
            if legacy_build_file_tree_call_pattern.search(line):
                report_violation("URI_NATIVE_FILE_TREE_MANDATE", filepath, line_num, "Legacy flat buildFileTree() call detected. Use URI-native buildUriFileTree(uris, rootScope) from ui_file_tree.js to preserve node.canonicalUri.")
            if is_extension and legacy_refresh_pattern.search(line):
                report_violation("LIFECYCLE_CONSOLIDATION_MANDATE", filepath, line_num, "Legacy onNavReselected or onSubNavReselected detected. Migrate to unified onForceRefresh() lifecycle method.")
            if is_extension and "onWorkspaceChanged(" in line:
                report_violation("DEPRECATED_WORKSPACE_HOOK", filepath, line_num, "Deprecated onWorkspaceChanged() detected. Migrate to onWorkspaceLoad(workspaceId) lifecycle method.")
            if unmanaged_document_input_listener_pattern.search(line):
                report_violation("UNMANAGED_FORM_INPUT_LISTENER_BAN", filepath, line_num, "Direct DOM input/change listener on 'document' detected. Form input management must route through Sutram web component lifecycles (<sutram-input>, <sutram-textarea>).")
            if open_virtual_file_pattern.search(line):
                report_violation("VIEW_TEXT_BLOB_MANDATE", filepath, line_num, "Deprecated vfs.openVirtualFile detected. Migrate to this.ui.viewTextBlob(title, content, suggestedFilename) or window.inSetu.ui.viewTextBlob instead.")
            if is_extension and registry_debounce_pattern.search(line):
                report_violation("REGISTRY_DEBOUNCE_BAN", filepath, line_num, "Direct access to ExtensionRegistry.utils.debounce is banned. Use this.utils.debounce() via the SDK.")
            if parse_uri_deprecation_pattern.search(line) and file not in ["insetu_sdk.js", "utils.js", "run_fsm_test.mjs"]:
                report_violation("PARSE_URI_DEPRECATION_BAN", filepath, line_num, "parseURI() is deprecated. Instantiate `new InSetuURI(path)` directly.")

    # Validate defaults/ext_template_js.txt for SDK import and subscription compliance
    ext_tpl_path = BACKEND_DIR / "defaults" / "ext_template_js.txt"
    if ext_tpl_path.exists():
        tpl_js = ext_tpl_path.read_text(encoding="utf-8")
        if legacy_sdk_import_ban_pattern.search(tpl_js):
            report_violation("LEGACY_SDK_IMPORT_BAN", ext_tpl_path, 1, "defaults/ext_template_js.txt imports deprecated '/static/extensions/system/sdk.js'. Use '/static/extensions/system/insetu_sdk.js'.")
        if coarse_store_sub_pattern.search(tpl_js):
            report_violation("COARSE_STORE_SUBSCRIPTION_MANDATE", ext_tpl_path, 1, "defaults/ext_template_js.txt uses a 2-argument coarse store subscription. Use a 3-argument selector-scoped subscription.")