import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict, Union
from insetu.core.sdk import (
    InSetuExtension,
    get_registered_capabilities,
    extract_template_variables,
    interpolate_template_variables,
)
from insetu.core.utils_core import (
    InSetuURI,
    is_extension_enabled,
    parse_frontmatter,
    resolve_macro_includes,
    typeddict_to_openapi,
)
from insetu.core.prompts.engine_prompts import provide_available_prompts
from insetu.core.agent.orchestrator import list_available_routines, execute_declarative_routine

MCP_PROTOCOL_VERSION = "2025-03-26"

mcp_bp = InSetuExtension(
    'mcp',
    __name__,
    title="MCP Server Substrate",
    description="Model Context Protocol (MCP 2025-03-26) JSON-RPC 2.0 gateway exposing tools, resources, and prompts.",
    core=True,
)
__depends__ = ['system', 'fs', 'gather', 'prompts', 'cartographer', 'bridge']


class McpJsonRpcPayload(TypedDict, total=False):
    jsonrpc: str
    id: Optional[Union[str, int]]
    method: str
    params: Optional[Dict[str, Any]]


def _tool_name_from_cap(cap_id: str) -> str:
    """Normalizes '<ext>.<action>' into an MCP-safe tool identifier '<ext>__<action>' while accepting both."""
    return cap_id.replace(".", "__").replace("/", "_")


def _resolve_capability_id(tool_name: str, capabilities: Dict[str, Dict[str, Any]]) -> Optional[str]:
    clean = str(tool_name or "").strip()
    if clean in capabilities:
        return clean
    dotted = clean.replace("__", ".")
    if dotted in capabilities:
        return dotted
    for cap_id in capabilities:
        if _tool_name_from_cap(cap_id) == clean:
            return cap_id
    return None


def _build_mcp_tools_list(ctx) -> List[Dict[str, Any]]:
    capabilities = get_registered_capabilities()
    tools: List[Dict[str, Any]] = []
    for cap_id, spec in sorted(capabilities.items()):
        ext_name = spec.get("ext_name", "")
        if not spec.get("core", False) and not is_extension_enabled(ext_name, ctx.workspace_id):
            continue
        if ext_name == "mcp" or cap_id.endswith((".settings", ".settings.schema")):
            continue
        if spec.get("mcp_expose") is False:
            continue  # Routes declared with mcp_expose=False (for example human-only approvals) are not MCP tools.

        req_schema = spec.get("request_schema")
        if isinstance(req_schema, dict):
            req_schema = req_schema.get("POST") or req_schema.get("GET") or next(iter(req_schema.values()), None)
        if req_schema and hasattr(req_schema, "__annotations__"):
            input_schema = typeddict_to_openapi(req_schema)
        else:
            input_schema = {"type": "object", "properties": {}, "additionalProperties": True}
        for p_var in (spec.get("path_params") or []):
            props = input_schema.setdefault("properties", {})
            if p_var not in props:
                props[p_var] = {"type": "string", "description": f"Path parameter '{p_var}'"}
            req_list = input_schema.setdefault("required", [])
            if p_var not in req_list:
                req_list.append(p_var)

        raw_doc = (spec.get("docstring") or f"Capability {cap_id}").replace("[sync]", "").strip()
        tools.append({
            "name": cap_id,
            "description": raw_doc,
            "inputSchema": input_schema,
        })

    # Expose declarative routines with mcp_expose: true as routine.<id> MCP tools
    try:
        for r in list_available_routines(ctx):
            if not isinstance(r, dict) or not r.get("id"):
                continue
            if not r.get("mcp_expose", False):
                continue
            props: Dict[str, Any] = {
                "user_message": {"type": "string", "description": "Primary instruction or prompt for the routine."}
            }
            req_vars: List[str] = []
            for v in (r.get("variables") or []):
                v_name = v.get("name")
                if not v_name:
                    continue
                props[v_name] = {
                    "type": "string",
                    "description": v.get("description") or f"Template variable '{v_name}'",
                }
                if v.get("default") is not None:
                    props[v_name]["default"] = v["default"]
                elif v.get("required"):
                    req_vars.append(v_name)
            tools.append({
                "name": f"routine.{r['id']}",
                "description": r.get("description") or f"Declarative DAG routine '{r.get('title') or r['id']}'",
                "inputSchema": {
                    "type": "object",
                    "properties": props,
                    "required": req_vars,
                },
            })
    except Exception:
        pass
    return tools


def _build_mcp_resources_list(ctx) -> List[Dict[str, Any]]:
    resources: List[Dict[str, Any]] = []
    seen_uris = set()

    # 1. Expose CODE_INDEX.md for each tracked repository
    for repo_cfg in (ctx.config.get("target_repos") or []):
        r_dir = repo_cfg.get("repo_dir")
        if not r_dir:
            continue
        idx_uri = f"vfs://{r_dir}/docs/CODE_INDEX.md" if repo_cfg.get("is_core_chassis") else f"vfs://{r_dir}/CODE_INDEX.md"
        if ctx.resolve_path(idx_uri, must_exist=True):
            seen_uris.add(idx_uri)
            resources.append({
                "uri": idx_uri,
                "name": f"{repo_cfg.get('title') or r_dir} — CODE_INDEX.md",
                "description": f"Authoritative architectural symbol and file index for {r_dir}.",
                "mimeType": "text/markdown",
            })

    # 2. Expose compiled ctx://contexts/*, ctx://diffs/*, and ctx://workflows/* from the manifest
    ctx_manifest = ctx.manifest.get("ctx", {}) or {}
    for uri_key, entry in sorted(ctx_manifest.items()):
        if not isinstance(entry, dict) or uri_key in seen_uris:
            continue
        meta = entry.get("meta") or {}
        seen_uris.add(uri_key)
        resources.append({
            "uri": uri_key,
            "name": meta.get("title") or InSetuURI(uri_key).basename,
            "description": meta.get("desc") or f"Compiled {meta.get('domain', 'context')} payload.",
            "mimeType": "text/plain",
        })

    return resources
def _build_mcp_prompts_list(ctx) -> List[Dict[str, Any]]:
    prompt_uris = provide_available_prompts(workspace_id=ctx.workspace_id)
    prompts_out: List[Dict[str, Any]] = []
    for p_uri in sorted(prompt_uris):
        if p_uri.endswith((".gitkeep", ".keep")):
            continue
        raw_text = ctx.vfs.read(p_uri) or ""
        yaml_meta, body, _ = parse_frontmatter(raw_text)
        title = (yaml_meta.get("title") if isinstance(yaml_meta, dict) else None) or InSetuURI(p_uri).basename
        desc = (yaml_meta.get("description") if isinstance(yaml_meta, dict) else None) or f"Prompt template at {p_uri}"
        prompts_out.append({
            "name": p_uri,
            "description": f"{title} — {desc}",
            "arguments": [
                {"name": v["name"], "description": v["description"], "required": v["required"]}
                for v in extract_template_variables(body)
            ],
        })
    return prompts_out


def _render_mcp_prompt(ctx, prompt_name: str, arguments: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    target_uri = str(InSetuURI.from_external_input(prompt_name, default_scheme="ctx"))
    if not target_uri.startswith(("ctx://", "vfs://", "ws://")):
        target_uri = f"ctx://prompts/{prompt_name.lstrip('/')}"
    raw_content = ctx.vfs.read(target_uri)
    if raw_content is None and not target_uri.startswith("ctx://prompts/"):
        alt_uri = f"ctx://prompts/{prompt_name.lstrip('/')}"
        raw_content = ctx.vfs.read(alt_uri)
        if raw_content is not None:
            target_uri = alt_uri
    if raw_content is None:
        raise KeyError(f"Prompt '{prompt_name}' not found.")

    yaml_meta, main_body, _ = parse_frontmatter(raw_content)

    def _read_prompt(target_req: str):
        raw_inc = ctx.vfs.read(str(InSetuURI(target_req)))
        if raw_inc is None:
            return None
        _, inc_body, _ = parse_frontmatter(raw_inc)
        return inc_body
    pattern = r'\{\{\s*include_prompt\??\s*:\s*([^\s{}]+)\s*(?:\{([\s\S]*?)\})?\s*\}\}'
    expanded = resolve_macro_includes(main_body, target_uri, pattern, _read_prompt, workspace_id=ctx.workspace_id)
    expanded = interpolate_template_variables(expanded, arguments or {})
    return {
        "description": (yaml_meta.get("description") if isinstance(yaml_meta, dict) else None) or f"Resolved prompt {target_uri}",
        "messages": [
            {
                "role": "user",
                "content": {"type": "text", "text": expanded},
            }
        ],
    }


def handle_mcp_jsonrpc(ctx, rpc_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Evaluates a single MCP 2025-03-26 JSON-RPC 2.0 request or notification dictionary."""
    if not isinstance(rpc_payload, dict):
        return {"jsonrpc": "2.0", "id": None, "error": {"code": -32600, "message": "Invalid Request"}}

    req_id = rpc_payload.get("id")
    method = str(rpc_payload.get("method") or "").strip()
    params = rpc_payload.get("params") or {}

    # Notifications (no id) return None
    if method.startswith("notifications/"):
        return None

    try:
        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {
                        "tools": {"listChanged": False},
                        "resources": {"subscribe": False, "listChanged": False},
                        "prompts": {"listChanged": False},
                    },
                    "serverInfo": {
                        "name": "insetu-developer-os",
                        "version": "0.27.0",
                    },
                },
            }

        if method == "ping":
            return {"jsonrpc": "2.0", "id": req_id, "result": {}}

        if method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"tools": _build_mcp_tools_list(ctx)},
            }
        if method == "tools/call":
            raw_name = str(params.get("name") or "").strip()
            tool_args = dict(params.get("arguments") or {})
            if raw_name.startswith(("routine.", "routine__")):
                r_id = raw_name.split(".", 1)[1] if "." in raw_name else raw_name.split("__", 1)[1]
                try:
                    user_msg = str(tool_args.pop("user_message", "") or tool_args.pop("prompt", "") or "")
                    r_out = execute_declarative_routine(
                        ctx,
                        session_id="mcp_session",
                        user_prompt=user_msg,
                        routine_id=r_id,
                        inputs=tool_args,
                    )
                    return {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {
                            "content": [{"type": "text", "text": json.dumps(r_out, indent=2)}],
                            "isError": False,
                        },
                    }
                except Exception as r_err:
                    return {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {
                            "content": [{"type": "text", "text": str(r_err)}],
                            "isError": True,
                        },
                    }
            capabilities = get_registered_capabilities()
            cap_id = _resolve_capability_id(raw_name, capabilities)
            if cap_id and capabilities[cap_id].get("mcp_expose") is False:
                cap_id = None  # Same answer as an unknown tool: hidden capabilities are not callable over MCP either.
            if not cap_id:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Unknown tool: '{raw_name}'"},
                }
            try:
                call_res = ctx.call(cap_id, wait=True, **tool_args)
                text_out = call_res if isinstance(call_res, str) else json.dumps(call_res, indent=2)
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": text_out}],
                        "isError": False,
                    },
                }
            except Exception as tool_err:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": str(tool_err)}],
                        "isError": True,
                    },
                }

        if method == "resources/list":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"resources": _build_mcp_resources_list(ctx)},
            }

        if method == "resources/templates/list":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "resourceTemplates": [
                        {
                            "uriTemplate": "vfs://{repo}/{path}",
                            "name": "Workspace VFS Source File",
                            "description": "Reads any tracked source or markdown file inside a workspace repository volume.",
                            "mimeType": "text/plain",
                        }
                    ]
                },
            }

        if method == "resources/read":
            raw_uri = str(params.get("uri") or "").strip()
            if not raw_uri:
                return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32602, "message": "Missing 'uri' parameter."}}
            uri_obj = InSetuURI.from_external_input(raw_uri)
            uri_str = str(uri_obj)
            if uri_obj.scheme == "ctx" and uri_obj.volume in ("contexts", "diffs", "workflows"):
                text = ctx.read_compiled_context(uri_str)
            else:
                text = ctx.vfs.read(uri_str)
            if text is None:
                return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32002, "message": f"Resource not found: {uri_str}"}}
            mime = "text/markdown" if uri_str.endswith(".md") else "text/plain"
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "contents": [
                        {
                            "uri": uri_str,
                            "mimeType": mime,
                            "text": text,
                        }
                    ]
                },
            }

        if method == "prompts/list":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"prompts": _build_mcp_prompts_list(ctx)},
            }

        if method == "prompts/get":
            p_name = str(params.get("name") or "").strip()
            p_args = params.get("arguments") or {}
            if not p_name:
                return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32602, "message": "Missing prompt 'name'."}}
            rendered = _render_mcp_prompt(ctx, p_name, p_args)
            return {"jsonrpc": "2.0", "id": req_id, "result": rendered}

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method not found: '{method}'"},
        }
    except KeyError as ke:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32002, "message": str(ke)}}
    except Exception as e:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": -32603, "message": f"Internal MCP error: {str(e)}"}}


@mcp_bp.route('rpc', methods=['POST'], request_schema=McpJsonRpcPayload, docstring="[sync] Executes an MCP 2025-03-26 JSON-RPC 2.0 request over HTTP or in-process ctx.call('mcp.rpc').")
def api_mcp_rpc(ctx):
    resp = handle_mcp_jsonrpc(ctx, ctx.payload or {})
    if resp is None:
        return {"status": "accepted"}, 202
    return resp


@mcp_bp.bp.route('/api/<workspace_id>/mcp', methods=['POST'])
def api_mcp_http_root(workspace_id):
    ctx = mcp_bp.get_context(workspace_id)
    resp = handle_mcp_jsonrpc(ctx, ctx.payload or {})
    if resp is None:
        return "", 202
    return resp