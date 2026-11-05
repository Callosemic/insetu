"""OpenAPI 3.0 specification builder for mounted Akasa and inSetu extension routes."""
import re
from typing import Any, Dict

from insetu.core.utils_core import typeddict_to_openapi


def build_system_openapi_spec(app) -> Dict[str, Any]:
    """Generates a real-time OpenAPI 3.0 specification dictionary from mounted SDK routes on `app`."""
    paths: Dict[str, Any] = {}
    # 1. Manually inject the bootstrap route since it lives outside the standard extension SDK
    paths["/auth/bootstrap"] = {
        "post": {
            "summary": "Authenticate and retrieve runtime token",
            "description": "Exchanges a Tailscale identity or static config token for an active execution token.",
            "security": [],
            "requestBody": {
                "content": {
                    "application/json": {
                        "schema": {
                            "type": "object",
                            "properties": {"token": {"type": "string", "description": "Optional static auth token from config.json"}}
                        }
                    }
                }
            },
            "responses": {
                "200": {
                    "description": "Returns the active token.",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "status": {"type": "string"},
                                    "token": {"type": "string", "description": "The X-InSetu-Token to use in subsequent requests."}
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    paths["/api/system/stream"] = {
        "get": {
            "summary": "Server-Sent Events (SSE) Telemetry",
            "description": "Zero-latency UI updates for job progress and VFS mutations.",
            "parameters": [
                {"name": "token", "in": "query", "required": True, "schema": {"type": "string"}}
            ],
            "responses": {
                "200": {
                    "description": "Returns a text/event-stream.",
                    "content": {"text/event-stream": {"schema": {"type": "string"}}}
                }
            }
        }
    }

    paths["/api/system/panic"] = {
        "post": {
            "summary": "Simulate Kernel Panic",
            "description": "Hard reboot of the OS process, setting the simulated panic flag.",
            "responses": {
                "200": {
                    "description": "Initiating kernel panic.",
                    "content": {"application/json": {"schema": {"type": "object", "properties": {"status": {"type": "string"}, "message": {"type": "string"}}}}}
                }
            }
        }
    }
    # 2. Iterate through all registered Blueprints looking for our Akasa SDK 'route_schemas'
    for bp_name, bp in app.blueprints.items():
        if not hasattr(bp, 'route_schemas'):
            continue
        for url_rule, method_schemas in bp.route_schemas.items():
            path_item = {}
            # Extract path parameters from Werkzeug rule string (e.g. /api/<workspace_id>/...)
            path_vars = re.findall(r'<([^>:]+:)?([^>]+)>', url_rule)
            openapi_url = re.sub(r'<([^>:]+:)?([^>]+)>', r'{\2}', url_rule)
            for method, meta in method_schemas.items():
                method_lower = method.lower()
                if method_lower == "options":
                    continue
                raw_doc = meta.get("docstring") or f"Endpoint for {bp_name}"
                is_async_mutation = "[sync]" not in raw_doc
                clean_doc = raw_doc.replace("[sync]", "").strip()

                url_base_name = url_rule.rsplit('/', 1)[1] if '/' in url_rule else url_rule
                op_data: Dict[str, Any] = {
                    "summary": f"{bp_name} {url_base_name.replace('<', '').replace('>', '').replace(':', '_')}",
                    "description": clean_doc,
                    "responses": {}
                }

                # Hydrate 200 OK Response
                if meta.get("response_schema"):
                    op_data["responses"]["200"] = {
                        "description": "Successful operation.",
                        "content": {
                            "application/json": {
                                "schema": typeddict_to_openapi(meta["response_schema"])
                            }
                        }
                    }
                elif method_lower == "get" and url_base_name in ["fetch", "resolve"]:
                    # Prevent JSON parse crashes for raw text endpoints
                    op_data["responses"]["200"] = {
                        "description": "Returns raw text/markdown content.",
                        "content": {
                            "text/plain": {"schema": {"type": "string"}}
                        }
                    }
                else:
                    op_data["responses"]["200"] = {
                        "description": "Successful operation.",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "additionalProperties": True,
                                    "properties": {
                                        "status": {"type": "string"},
                                        "message": {"type": "string"},
                                        "error": {"type": "string"}
                                    }
                                }
                            }
                        }
                    }

                # Only attach 202 Background Job schemas to POST/PUT/DELETE mutations if not explicitly disabled
                if method_lower in ["post", "put", "delete"] and is_async_mutation:
                    op_data["responses"]["202"] = {
                        "description": "Asynchronous job accepted. You MUST poll /api/{workspace_id}/system/jobs/{job_id} until the 'status' is 'completed' or 'failed'.",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "status": {"type": "string"},
                                        "job_id": {"type": "string"}
                                    },
                                    "required": ["status", "job_id"]
                                }
                            }
                        }
                    }

                parameters = []
                # Inject Path Parameters automatically
                for _, var_name in path_vars:
                    parameters.append({
                        "name": var_name,
                        "in": "path",
                        "required": True,
                        "schema": {"type": "string"}
                    })
                # Hydrate Request Schema if bound
                if meta.get("request_schema"):
                    schema_dict = typeddict_to_openapi(meta["request_schema"])
                    if method_lower == "get":
                        for prop_name, prop_details in schema_dict.get("properties", {}).items():
                            parameters.append({
                                "name": prop_name,
                                "in": "query",
                                "required": prop_name in schema_dict.get("required", []),
                                "schema": prop_details
                            })
                    else:
                        content_type = "application/json"

                        def has_binary(schema):
                            if schema.get("format") == "binary":
                                return True
                            for prop in schema.get("properties", {}).values():
                                if prop.get("format") == "binary":
                                    return True
                                if prop.get("type") == "array" and prop.get("items", {}).get("format") == "binary":
                                    return True
                            return False

                        if has_binary(schema_dict):
                            content_type = "multipart/form-data"

                        op_data["requestBody"] = {
                            "content": {
                                content_type: {
                                    "schema": schema_dict
                                }
                            }
                        }

                if parameters:
                    op_data["parameters"] = parameters

                path_item[method_lower] = op_data

            paths[openapi_url] = path_item
    return {
        "openapi": "3.0.0",
        "info": {
            "title": "inSetu Workbench API",
            "version": "1.0.0",
            "description": "Automated LLM Tool Calling Specification"
        },
        "paths": paths,
        "components": {
            "securitySchemes": {
                "InSetuToken": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-InSetu-Token",
                    "description": "Execution credential required for API access."
                }
            }
        },
        "security": [
            {
                "InSetuToken": []
            }
        ]
    }
