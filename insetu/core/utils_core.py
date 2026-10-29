import os
import io

os.environ.setdefault("AKASA_CONTROL_DIR", ".insetu")
import re
import sys
import time
import json
import shutil
import socket
import threading
import subprocess
from collections import OrderedDict
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple, Union
from insetu.core.sdk import (
    CORE_MODULES_TUPLE,
    AkasaURI,
    CycleError,
    DefaultVFSDriver,
    SettingsManager,
    VFSTransaction,
    allocate_ephemeral_port,
    atomic_write_bytes,
    atomic_write_text,
    build_tree_dict,
    can_bind_port,
    compute_vfs_sha256,
    decrypt_secret,
    encrypt_secret,
    ensure_master_key_on_disk,
    evict_vfs_cache,
    execute_binary,
    execute_vfs_bulk,
    execute_vfs_delete,
    execute_vfs_move,
    execute_vfs_save,
    extract_template_variables,
    fold_vfs_events,
    generate_ascii_tree,
    get_active_modules,
    get_all_workspace_ids,
    get_connection,
    get_core_modules,
    get_daemon_cwd,
    get_daemon_host_config_path,
    get_kernel_memory_telemetry,
    get_system_index_path,
    get_tenant_control_dir,
    get_workspace_physics,
    has_pending_vfs_write,
    heal_daemon_config_files,
    hooks,
    interpolate_template_variables,
    is_core_module,
    is_extension_enabled,
    is_port_listening,
    is_subpath,
    load_config,
    load_json_config,
    lookup_vfs_ancestor,
    mount_volume,
    parse_uri,
    reclaim_process_memory,
    record_vfs_ancestor,
    register_driver,
    resolve_active_tenant,
    resolve_dag_wavefronts,
    resolve_physical_path as _vfs_resolve_physical_path,
    resolve_physical_path,
    resolve_system_artifact_path,
    rotate_master_key,
    save_json_config,
    set_daemon_cwd,
    set_mount_authorizer,
    set_tenant_resolver,
    slugify,
    sniff_tenant_id,
    sync_vfs_barrier,
    three_way_merge_text,
    typeddict_to_openapi,
)


@hooks.on('vfs_resolve_path')
def hook_vfs_resolve_path(filename=None, workspace_id=None, **kwargs):
    if not filename:
        return None
    return resolve_logical_path(filename, workspace_id=workspace_id)
class InSetuURI(AkasaURI):
    """
    Host application URI class enforcing strict canonical scheme:// prefixes
    for all internal operations, with explicit boundary parsing for external user/LLM inputs.
    """
    __slots__ = ()

    def __init__(self, raw: Any = ""):
        if isinstance(raw, (InSetuURI, AkasaURI)):
            raw_str = str(raw)
        elif isinstance(raw, dict):
            raw_str = str(raw.get('folderpath') or raw.get('filepath') or '').replace('\\', '/').strip()
        else:
            raw_str = str(raw or "").replace('\\', '/').strip()
        if raw_str and "://" not in raw_str and not raw_str.startswith('/'):
            raise ValueError(f"Non-canonical URI rejected (missing scheme:// prefix): '{raw_str}'")
        super().__init__(raw_str)

    @classmethod
    def canonicalize(cls, raw: Any, default_prefix: str = "vfs://") -> str:
        """SSOT migration normalizer for upgrading legacy storage strings into canonical scheme:// URIs."""
        if not raw:
            return ""
        if isinstance(raw, (cls, AkasaURI)):
            return str(raw)
        clean = str(raw).replace('\\', '/').strip()
        if not clean:
            return ""
        has_trailing_slash = clean.endswith('/') and not clean.endswith('://')
        clean = re.sub(r'^(vfs|ctx|ws|virtual|yomama):/(?!/)', r'\1://', clean)
        if "://" in clean:
            uri_obj = cls(clean)
            if uri_obj.scheme == 'ctx' and uri_obj.volume == 'contexts' and (
                (uri_obj.basename.startswith('workflow_') and ('_context' in uri_obj.basename))
                or uri_obj.basename.endswith('_workflow_context.txt')
            ):
                return f"ctx://workflows/{uri_obj.basename}"
            base_canon = str(uri_obj).rstrip('/')
            return f"{base_canon}/" if has_trailing_slash else base_canon
        clean_stripped = clean.lstrip('/')
        if clean_stripped.endswith('_diffs.txt') or clean_stripped.startswith('diffs/'):
            return f"ctx://diffs/{Path(clean_stripped).name}"
        if (clean_stripped.startswith('workflow_') and clean_stripped.endswith('_context.txt')) or clean_stripped.startswith('workflows/'):
            return f"ctx://workflows/{Path(clean_stripped).name}"
        if clean_stripped.endswith(('_context.txt', '_vault.json')) or re.search(r'_context_part\d+\.txt$', clean_stripped) or clean_stripped.startswith('contexts/'):
            return f"ctx://contexts/{Path(clean_stripped).name}"
        if clean_stripped.startswith('prompts/'):
            return f"ctx://prompts/{clean_stripped[len('prompts/'):].lstrip('/')}"
        prefix = default_prefix if default_prefix.endswith('://') else f"{default_prefix.rstrip('/')}/"
        return f"{prefix}{clean_stripped}"

    @classmethod
    def from_external_input(cls, raw: Any, default_scheme: str = "vfs") -> 'InSetuURI':
        """Explicit boundary normalizer strictly for raw LLM, HTTP route, or human text inputs."""
        if isinstance(raw, cls):
            return raw
        if isinstance(raw, dict):
            raw = raw.get('folderpath') or raw.get('filepath') or ''
        raw_str = str(raw or "").replace('\\', '/').strip()
        if not raw_str:
            return cls("")
        raw_str = re.sub(r'^(vfs|ctx|ws|virtual|yomama):/(?!/)', r'\1://', raw_str)
        if "://" not in raw_str and not raw_str.startswith('/'):
            raw_str = f"{default_scheme}://{raw_str.lstrip('/')}"
        return cls(raw_str)
    @property
    def repo(self) -> str:
        return self.volume

    @property
    def is_diff(self) -> bool:
        return self.scheme == 'ctx' and self.volume == 'diffs'

    @property
    def parent_uri(self) -> 'InSetuURI':
        scheme = self.scheme or 'vfs'
        clean_path = (self.path or '').strip('/')
        if not clean_path:
            return InSetuURI(f"{scheme}://{self.volume}" if self.volume else f"{scheme}://")
        parent_rel = clean_path.rpartition('/')[0]
        if self.volume:
            return InSetuURI(f"{scheme}://{self.volume}/{parent_rel}" if parent_rel else f"{scheme}://{self.volume}")
        return InSetuURI(f"{scheme}://{parent_rel}" if parent_rel else f"{scheme}://")

    def join(self, *segments: str) -> 'InSetuURI':
        clean_segs = [str(s or '').replace('\\', '/').strip('/') for s in segments if str(s or '').strip('/')]
        base = str(self).rstrip('/')
        if not clean_segs:
            return InSetuURI(base)
        if not base or base.endswith('://'):
            return InSetuURI(f"{self.scheme or 'vfs'}://{'/'.join(clean_segs)}")
        return InSetuURI(f"{base}/{'/'.join(clean_segs)}")

    def with_name(self, new_name: str) -> 'InSetuURI':
        clean_name = str(new_name or '').replace('\\', '/').strip('/')
        if not clean_name:
            return self
        return self.parent_uri.join(clean_name)

    def resolve_sibling_uri(self, raw_target: str) -> 'InSetuURI':
        """Resolves a relative or scheme-prefixed path within the same repository volume as this URI."""
        clean = str(raw_target or '').replace('\\', '/').strip().rstrip('/')
        scheme = self.scheme or 'vfs'
        if "://" in clean:
            cand = InSetuURI(clean)
            if self.repo and cand.scheme == scheme and cand.repo != self.repo:
                joined_rel = f"{cand.repo}/{cand.path}".strip('/')
                return InSetuURI(f"{scheme}://{self.repo}/{joined_rel}".rstrip('/'))
            return cand
        clean_rel = clean.lstrip('/')
        if self.repo and not clean_rel.startswith(f"{self.repo}/"):
            return InSetuURI(f"{scheme}://{self.repo}/{clean_rel}".rstrip('/'))
        return InSetuURI(f"{scheme}://{clean_rel}".rstrip('/'))

    def resolve(self, workspace_id: Optional[str] = None, is_absolute_artifact: bool = False) -> Optional[str]:
        return _vfs_resolve_physical_path(str(self), workspace_id, is_absolute_artifact=is_absolute_artifact)

    def resolve_physical(self, workspace_id: Optional[str] = None) -> Optional[str]:
        # Backward compatibility alias
        return self.resolve(workspace_id)
    def exists(self, workspace_id: Optional[str] = None) -> bool:
        phys = self.resolve(workspace_id)
        return bool(phys and os.path.exists(phys))
    def resolve_if_exists(self, workspace_id: Optional[str] = None, allow_heal: bool = True) -> Optional[str]:
        phys = self.resolve(workspace_id)
        if phys and os.path.exists(phys):
            return phys
        if allow_heal and self.scheme == 'ctx' and self.volume in ('contexts', 'diffs', 'workflows'):
            healed = hooks.emit_first('vfs_resolve_file', filename=str(self), workspace_id=workspace_id or 'default')
            if isinstance(healed, tuple) and healed[0] and os.path.exists(healed[0]):
                return healed[0]
            if isinstance(healed, str) and os.path.exists(healed):
                return healed
        return None

    def is_dir_physical(self, workspace_id: Optional[str] = None) -> bool:
        if self.is_dir or self.path.endswith('/'):
            return True
        phys = self.resolve(workspace_id)
        return bool(phys and os.path.exists(phys) and os.path.isdir(phys))
    def is_file_physical(self, workspace_id: Optional[str] = None) -> bool:
        if self.is_dir or self.path.endswith('/'):
            return False
        phys = self.resolve(workspace_id)
        return bool(phys and os.path.exists(phys) and os.path.isfile(phys))

    def mtime(self, workspace_id: Optional[str] = None) -> Optional[float]:
        phys = self.resolve(workspace_id)
        if phys and os.path.exists(phys):
            try:
                return Path(phys).stat().st_mtime
            except OSError:
                return None
        return None
    def read(self, workspace_id: Optional[str] = None, is_absolute_artifact: bool = False) -> Optional[str]:
        with VFSTransaction(workspace_id) as vfs:
            content = vfs.read(str(self), is_absolute_artifact=is_absolute_artifact)
            if content is not None:
                return content
            if not is_absolute_artifact and self.scheme == 'ctx' and self.volume in ('contexts', 'diffs', 'workflows'):
                resolved = self.resolve_if_exists(workspace_id, allow_heal=True)
                if resolved and os.path.exists(resolved):
                    return vfs.read(resolved, is_absolute_artifact=True)
            return None
    def bucket(self, workspace_id=None):
        from insetu.core.topology.engine_topology import resolve_file_bucket as _resolve_file_bucket

        cfg = load_config(workspace_id)
        for repo_cfg in cfg.get("target_repos", []):
            if repo_cfg.get("repo_dir") == self.repo:
                sub_buckets = repo_cfg.get("sub_buckets", [])
                b, module = _resolve_file_bucket(self.path, sub_buckets, repo_dir=self.repo)
                return module if b and module else (b.get("id") if b else "main")
        return "main"


@hooks.on('vfs_mount_missing')
def _lazy_mount_missing_volume(workspace_id=None, scheme=None, volume=None, **kwargs):
    """
    Inversion of Control Lazy Volume Mounter:
    If a request arrives before workspace_boot completes, queries declared extension paths
    via 'request_paths' and mounts the corresponding volume dynamically without hardcoding extension names.
    """
    wid = workspace_id or "default"
    if scheme == 'ctx' and volume:
        register_driver('ctx', DefaultVFSDriver())
        path_key = f"{volume}_dir"
        paths_dict = hooks.emit_merge_dict('request_paths', workspace_id=wid)
        if path_key in paths_dict:
            mount_volume(wid, 'ctx', volume, paths_dict[path_key])
            return
    elif scheme == 'vfs':
        from insetu.core.topology.engine_topology import mount_topology_volumes_dynamically as _mount_topology
        _mount_topology(load_config(wid), workspace_id=wid)


class BucketAddress:
    """
    Immutable value object representing a canonical structural bucket address.
    Format: <repo>::<bucket_id> (e.g., 'axoneme::main' or 'axoneme::docs')
    """
    def __init__(self, repo: str, bucket_id: str = "main"):
        self.repo = repo.strip().lower() if repo else "global"
        self.bucket_id = bucket_id.strip() if bucket_id else "main"

    @property
    def key(self) -> str:
        """Canonical storage key used in dirty sets and state stores."""
        return f"{self.repo}::{self.bucket_id}"
    @property
    def context_uri(self) -> str:
        """Canonical URI for the context payload."""
        safe_repo = get_safe_repo_id(self.repo)
        if self.bucket_id == "main":
            return f"ctx://contexts/{safe_repo}_context.txt"
        return f"ctx://contexts/{safe_repo}_{self.bucket_id}_context.txt"

    @property
    def diff_uri(self) -> str:
        """Canonical URI for the git diff payload."""
        safe_repo = get_safe_repo_id(self.repo)
        if self.bucket_id == "main":
            return f"ctx://diffs/{safe_repo}_diffs.txt"
        return f"ctx://diffs/{safe_repo}_{self.bucket_id}_diffs.txt"

    @classmethod
    def from_key(cls, key: str) -> 'BucketAddress':
        if "::" in key:
            repo, bucket_id = key.split("::", 1)
            return cls(repo, bucket_id)
        return cls(key, "main")
    @classmethod
    def from_uri(cls, uri_str: str, meta: dict = None, workspace_id: str = None) -> 'BucketAddress':
        meta = meta or {}
        repo = meta.get("repo")
        bucket_id = meta.get("bucket_id")
        # Explicit None check allows the root repository (repo="") to bypass guessing
        if repo is None:
            uri = InSetuURI(uri_str)
            repo = uri.repo
            if not repo and uri.scheme == 'ctx':
                repo = "global"
                if not bucket_id:
                    bucket_id = uri.basename.replace('.txt', '')

        return cls(repo if repo is not None else "global", bucket_id or "main")

    @classmethod
    def from_vfs_path(cls, filepath: str, workspace_id: str = None) -> 'BucketAddress':
        uri = InSetuURI(filepath)
        repo = uri.repo
        bucket_id = uri.bucket(workspace_id)
        return cls(repo, bucket_id)

    def __repr__(self) -> str:
        return f"<BucketAddress {self.key}>"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, BucketAddress):
            return False
        return self.key == other.key

    def __hash__(self) -> int:
        return hash(self.key)
def _get_yaml_engine():
    from ruamel.yaml import YAML as _YAML
    yaml = _YAML(typ='rt')
    yaml.preserve_quotes = True
    yaml.indent(mapping=2, sequence=4, offset=2)
    yaml.width = 4096  # Prevent premature multi-line string wrapping
    return yaml


def _fallback_parse_simple_yaml(raw_yaml: str) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    for line in raw_yaml.splitlines():
        s = line.strip()
        if not s or s.startswith('#') or ':' not in s:
            continue
        k, v = s.split(':', 1)
        k = k.strip()
        v = v.strip()
        if v.startswith(('[', '{')):
            try:
                data[k] = json.loads(v)
                continue
            except Exception:
                pass
        if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
            v = v[1:-1]
        elif v.lower() == 'true':
            v = True
        elif v.lower() == 'false':
            v = False
        elif v.isdigit():
            v = int(v)
        data[k] = v
    return data


def _fallback_dump_simple_yaml(yaml_data: Dict[str, Any]) -> str:
    lines = []
    for k, v in yaml_data.items():
        if isinstance(v, bool):
            lines.append(f"{k}: {'true' if v else 'false'}")
        elif isinstance(v, (int, float)):
            lines.append(f"{k}: {v}")
        elif isinstance(v, (list, dict)):
            lines.append(f"{k}: {json.dumps(v)}")
        else:
            s_val = str(v if v is not None else "")
            if any(ch in s_val for ch in (':', '#', '\n', '"', "'")) or s_val != s_val.strip():
                lines.append(f"{k}: {json.dumps(s_val)}")
            else:
                lines.append(f"{k}: {s_val}")
    return "\n".join(lines)
def load_yaml_string(raw_yaml: str) -> Any:
    """Centralized YAML string parser using the round-trip ruamel.yaml engine with safe fallback."""
    if not raw_yaml or not raw_yaml.strip():
        return {}
    try:
        engine = _get_yaml_engine()
        return engine.load(io.StringIO(raw_yaml))
    except ImportError:
        return _fallback_parse_simple_yaml(raw_yaml)


def dump_yaml_string(yaml_data: Dict[str, Any]) -> str:
    """Centralized YAML string serializer using the round-trip ruamel.yaml engine with safe fallback."""
    if not yaml_data:
        return ""
    try:
        engine = _get_yaml_engine()
        stream = io.StringIO()
        engine.dump(yaml_data, stream)
        return stream.getvalue().strip() + "\n"
    except ImportError:
        return _fallback_dump_simple_yaml(yaml_data) + "\n"


def parse_frontmatter(content):
    if not content:
        return {}, "", None

    yaml_match = re.search(r'^\s*---\n([\s\S]*?)\n\s*---', content)
    yaml_data = {}
    body = content

    if yaml_match:
        raw_yaml = yaml_match.group(1)
        body = content[yaml_match.end():].strip()

        if raw_yaml.strip():
            try:
                engine = _get_yaml_engine()
                parsed = engine.load(io.StringIO(raw_yaml))
                if isinstance(parsed, dict):
                    yaml_data = parsed
            except ImportError:
                yaml_data = _fallback_parse_simple_yaml(raw_yaml)
            except Exception as e:
                print(f"⚠️ [YAML Error] Frontmatter parse failure: {e}")

    return yaml_data, body, yaml_match


def update_frontmatter(content, new_data):
    yaml_data, body, _ = parse_frontmatter(content)

    if isinstance(yaml_data, dict):
        yaml_data.update(new_data)
    else:
        yaml_data = dict(new_data)

    try:
        engine = _get_yaml_engine()
        stream = io.StringIO()
        engine.dump(yaml_data, stream)
        formatted_yaml = stream.getvalue().strip()
    except ImportError:
        formatted_yaml = _fallback_dump_simple_yaml(yaml_data)

    return f"---\n{formatted_yaml}\n---\n\n{body}"
def _extract_balanced_include_macros(text: str):
    """
    Finds all {{include_prompt: ...}} blocks using balanced brace/quote scanning so nested
    {{include_prompt: ...}} directives or braces inside parameter strings never truncate the match.
    Yields (start_idx, end_idx, include_path, params_str).
    """
    header_re = re.compile(r'\{\{\s*include_prompt\s*:\s*')
    pos = 0
    n = len(text)
    while pos < n:
        m = header_re.search(text, pos)
        if not m:
            break
        start_idx = m.start()
        cursor = m.end()
        path_start = cursor
        in_quote = None
        while cursor < n:
            ch = text[cursor]
            if in_quote:
                if ch == in_quote and text[cursor - 1] != '\\':
                    in_quote = None
                cursor += 1
                continue
            if ch in ('"', "'"):
                in_quote = ch
                cursor += 1
                continue
            if ch.isspace() or ch in ('{', ';') or text[cursor:cursor + 2] == '}}':
                break
            cursor += 1
        include_path = text[path_start:cursor].strip().rstrip(';,').strip('\'"')
        params_start = cursor
        brace_depth = 2
        in_quote = None
        end_idx = -1
        while cursor < n:
            ch = text[cursor]
            if in_quote:
                if ch == in_quote and text[cursor - 1] != '\\':
                    in_quote = None
                cursor += 1
                continue
            if ch in ('"', "'"):
                in_quote = ch
                cursor += 1
                continue
            if ch == '{':
                brace_depth += 1
                cursor += 1
            elif ch == '}':
                brace_depth -= 1
                cursor += 1
                if brace_depth == 0:
                    end_idx = cursor
                    break
            else:
                cursor += 1
        if end_idx == -1:
            break
        raw_params = text[params_start:end_idx - 2].strip()
        if raw_params.startswith(';'):
            raw_params = raw_params[1:].strip()
        if raw_params.startswith('{') and raw_params.endswith('}'):
            raw_params = raw_params[1:-1].strip()
        yield start_idx, end_idx, include_path, raw_params
        pos = end_idx


def _parse_macro_params(params_str: str) -> Dict[str, str]:
    """Parses key: value pairs from an include_prompt parameter block, supporting quotes and nested braces."""
    params: Dict[str, str] = {}
    if not params_str or not params_str.strip():
        return params
    i = 0
    n = len(params_str)
    while i < n:
        while i < n and (params_str[i].isspace() or params_str[i] in (';', ',')):
            i += 1
        if i >= n:
            break
        key_match = re.match(r'[\'"]?([a-zA-Z0-9_]+)[\'"]?\s*[:=]\s*', params_str[i:])
        if not key_match:
            i += 1
            continue
        key = key_match.group(1)
        i += key_match.end()
        if i >= n:
            params[key] = ""
            break
        if params_str[i] in ('"', "'", '`'):
            quote_ch = params_str[i]
            i += 1
            val_chars = []
            while i < n:
                if params_str[i] == '\\' and i + 1 < n:
                    nxt = params_str[i + 1]
                    if nxt == 'n':
                        val_chars.append('\n')
                    elif nxt == 't':
                        val_chars.append('\t')
                    else:
                        val_chars.append(nxt)
                    i += 2
                    continue
                if params_str[i] == quote_ch:
                    i += 1
                    break
                val_chars.append(params_str[i])
                i += 1
            params[key] = "".join(val_chars)
        else:
            val_start = i
            b_depth = 0
            while i < n:
                ch = params_str[i]
                if ch == '{':
                    b_depth += 1
                elif ch == '}':
                    if b_depth > 0:
                        b_depth -= 1
                    else:
                        break
                elif ch == ';' and b_depth == 0:
                    break
                i += 1
            params[key] = params_str[val_start:i].strip()
    return params


def resolve_macro_includes(text, current_filepath, pattern, read_callback, depth=0):
    if depth > 5:
        return text + "\n[!] INCLUSION DEPTH LIMIT EXCEEDED"
    if not text:
        return text

    def _resolve_target_uri(include_path: str) -> str:
        cur_uri = InSetuURI(current_filepath)
        if "://" in include_path:
            return str(InSetuURI(include_path))
        if include_path.startswith('./') or include_path.startswith('../'):
            base_prefix = f"{cur_uri.scheme}://{cur_uri.volume}" if cur_uri.volume else f"{cur_uri.scheme}://"
            rel_parts = [p for p in cur_uri.path.split('/')[:-1] if p]
            for p in include_path.split('/'):
                if p == '.' or not p:
                    continue
                elif p == '..':
                    if rel_parts:
                        rel_parts.pop()
                else:
                    rel_parts.append(p)
            joined_rel = '/'.join(rel_parts)
            return f"{base_prefix}/{joined_rel}".rstrip('/') if joined_rel else base_prefix
        return include_path
    def _apply_params_and_recurse(inc_content: str, target_path: str, params_str: str) -> str:
        if params_str:
            resolved_params_str = resolve_macro_includes(params_str, current_filepath, pattern, read_callback, depth + 1)
            parsed_params = _parse_macro_params(resolved_params_str)
            for raw_key, val in parsed_params.items():
                clean_key = raw_key[len('macro_'):] if raw_key.startswith('macro_') else raw_key
                macro_pattern = r'\{\{\s*(?:macro_)?' + re.escape(clean_key) + r'(?:\s*\|[^{}]*)?\s*\}\}'
                inc_content = re.sub(macro_pattern, lambda _, v=val: v, inc_content)
        # Resolve any remaining {{ macro_name | default_value }} placeholders to their default_value
        inc_content = re.sub(
            r'\{\{\s*(?:macro_)?[a-zA-Z0-9_]+\s*\|\s*([^{}]*?)\s*\}\}',
            lambda m: m.group(1).strip(),
            inc_content
        )
        return resolve_macro_includes(inc_content, target_path, pattern, read_callback, depth + 1)

    if "include_prompt" in text:
        spans = list(_extract_balanced_include_macros(text))
        if spans:
            out_parts = []
            last_idx = 0
            for start_idx, end_idx, include_path, params_str in spans:
                out_parts.append(text[last_idx:start_idx])
                target_path = _resolve_target_uri(include_path)
                try:
                    inc_content = read_callback(target_path)
                except Exception:
                    inc_content = None
                if inc_content is not None:
                    out_parts.append(_apply_params_and_recurse(inc_content, target_path, params_str))
                else:
                    out_parts.append(f"[!] MACRO TARGET NOT FOUND: {include_path}")
                last_idx = end_idx
            out_parts.append(text[last_idx:])
            return "".join(out_parts)

    def replacer(match):
        include_path = match.group(1).strip().rstrip(';,').strip('\'"')
        params_str = match.group(2) if len(match.groups()) > 1 and match.group(2) else ""
        target_path = _resolve_target_uri(include_path)
        try:
            inc_content = read_callback(target_path)
        except Exception:
            inc_content = None
        if inc_content is not None:
            return _apply_params_and_recurse(inc_content, target_path, params_str)
        return f"[!] MACRO TARGET NOT FOUND: {include_path}"

    return re.sub(pattern, replacer, text)
def _get_base_step_and_diffs(lines):
    """Analyzes a block of code to find its true structural base indentation unit (LCD > 1)."""
    indents = sorted(list(set(len(line) - len(line.lstrip()) for line in lines if line.strip())))
    if len(indents) > 1:
        diffs = [indents[k+1] - indents[k] for k in range(len(indents)-1)]
        valid_diffs = [d for d in diffs if d > 1]

        if valid_diffs:
            best_step = 4
            min_error = float('inf')

            for S in [4, 2, 3, 8]:
                error = 0
                has_base_jump = False

                for d in valid_diffs:
                    k = max(1, int(round(d / S)))
                    if k == 1:
                        has_base_jump = True
                    error += abs(d - (k * S))

                if not has_base_jump:
                    error += 1000 

                if error < min_error:
                    min_error = error
                    best_step = S

            return best_step, diffs
    return 4, []
def _parse_kv_directive_lines(lines: List[str]) -> Dict[str, str]:
    directives: Dict[str, str] = {}
    for raw_line in lines:
        s = raw_line.strip()
        if not s or ":" not in s:
            continue
        k, v = s.split(":", 1)
        directives[k.strip().upper()] = v.strip()
    return directives
def _project_textedit_search_replace(raw_textedit: str) -> Tuple[str, str]:
    """
    Projects a <<<<<<< TEXTEDIT body containing inline {{-delete}} and {{+insert}} spans
    into (search_str, replace_str) for 100% compatibility with bridge_ledger, /undo, and diff viewers.
    """
    search_projected = re.sub(r'\{\{\+([\s\S]*?)\}\}', '', raw_textedit)
    search_projected = re.sub(r'\{\{-([\s\S]*?)\}\}', lambda m: m.group(1), search_projected)
    replace_projected = re.sub(r'\{\{-([\s\S]*?)\}\}', '', raw_textedit)
    replace_projected = re.sub(r'\{\{\+([\s\S]*?)\}\}', lambda m: m.group(1), replace_projected)
    return search_projected, replace_projected


def parse_blocks(text):
    files = {}
    current_file = None
    current_id = None
    state = "OUTSIDE"
    current_type = "exact"
    comment_lines, search_lines, replace_lines, ast_lines = [], [], [], []
    first_markers = [
        idx for idx in (
            text.find("<<<<<<< FILE:"),
            text.find("<<<<<<< COMMENT"),
            text.find("<<<<<<< RELOCATE"),
            text.find("<<<<<<< RENAME"),
            text.find("<<<<<<< TEXTEDIT"),
            text.find("<<<<<<< JSON_PATCH"),
            text.find("<<<<<<< MOVE_FILE"),
            text.find("<<<<<<< ARCHIVE_FILE"),
            text.find("<<<<<<< DELETE_FILE"),
        ) if idx != -1
    ]
    if first_markers:
        text = text[min(first_markers):]

    text = re.sub(
        r'^[ \t\xa0]*(?:>[ \t\xa0]*)+REPLACE[ \t\xa0]*(?:\n[ \t\xa0]*(?:>[ \t\xa0]*)+$)*',
        '>>>>>>> REPLACE',
        text,
        flags=re.MULTILINE
    )
    text = re.sub(
        r'^[ \t\xa0]*(?:>[ \t\xa0]*)+EXECUTE[ \t\xa0]*(?:\n[ \t\xa0]*(?:>[ \t\xa0]*)+$)*',
        '>>>>>>> EXECUTE',
        text,
        flags=re.MULTILINE
    )

    def _flush_directive_block():
        nonlocal comment_lines, ast_lines, current_id, state
        if state in ("RELOCATE", "RENAME", "MOVE_FILE", "ARCHIVE_FILE", "DELETE_FILE"):
            kv = _parse_kv_directive_lines(ast_lines)
            if state == "RELOCATE":
                raw_src = kv.get("FROM") or current_file or ""
                raw_dst = kv.get("TO") or ""
                src_file = str(InSetuURI.from_external_input(raw_src)) if raw_src else ""
                dst_file = str(InSetuURI.from_external_input(raw_dst)) if raw_dst else ""
                sym_name = kv.get("SYMBOL") or ""
                if src_file:
                    files.setdefault(src_file, []).append({
                        "id": current_id,
                        "type": "relocate",
                        "comment": "\n".join(comment_lines).strip(),
                        "symbol": sym_name,
                        "source_uri": src_file,
                        "target_uri": dst_file,
                        "raw_directive": "\n".join(ast_lines),
                        "search": "",
                        "replace": "",
                    })
            elif state == "RENAME":
                scope_val = kv.get("SCOPE") or current_file or "vfs://"
                target_sym = kv.get("TARGET") or ""
                replace_sym = kv.get("REPLACE_WITH") or ""
                files.setdefault(scope_val, []).append({
                    "id": current_id,
                    "type": "rename",
                    "comment": "\n".join(comment_lines).strip(),
                    "target_symbol": target_sym,
                    "new_symbol": replace_sym,
                    "scope_prefix": scope_val,
                    "raw_directive": "\n".join(ast_lines),
                    "search": "",
                    "replace": "",
                })
            elif state == "MOVE_FILE":
                raw_src = kv.get("FROM") or kv.get("FILE") or current_file or ""
                raw_dst = kv.get("TO") or kv.get("DEST") or ""
                src_file = str(InSetuURI.from_external_input(raw_src)) if raw_src else ""
                dst_file = str(InSetuURI.from_external_input(raw_dst)) if raw_dst else ""
                if src_file:
                    files.setdefault(src_file, []).append({
                        "id": current_id,
                        "type": "move_file",
                        "comment": "\n".join(comment_lines).strip(),
                        "source_uri": src_file,
                        "target_uri": dst_file,
                        "raw_directive": "\n".join(ast_lines),
                        "search": "",
                        "replace": "",
                    })
            elif state == "ARCHIVE_FILE":
                raw_target = kv.get("FILE") or kv.get("FROM") or current_file or ""
                target_uri = str(InSetuURI.from_external_input(raw_target)) if raw_target else ""
                if target_uri:
                    files.setdefault(target_uri, []).append({
                        "id": current_id,
                        "type": "archive_file",
                        "comment": "\n".join(comment_lines).strip(),
                        "source_uri": target_uri,
                        "raw_directive": "\n".join(ast_lines),
                        "search": "",
                        "replace": "",
                    })
            elif state == "DELETE_FILE":
                raw_target = kv.get("FILE") or kv.get("FROM") or current_file or ""
                target_uri = str(InSetuURI.from_external_input(raw_target)) if raw_target else ""
                if target_uri:
                    files.setdefault(target_uri, []).append({
                        "id": current_id,
                        "type": "delete_file",
                        "comment": "\n".join(comment_lines).strip(),
                        "source_uri": target_uri,
                        "raw_directive": "\n".join(ast_lines),
                        "search": "",
                        "replace": "",
                    })
        elif state == "JSON_PATCH" and current_file:
            raw_json_body = "\n".join(ast_lines).strip()
            files.setdefault(current_file, []).append({
                "id": current_id,
                "type": "json_patch",
                "comment": "\n".join(comment_lines).strip(),
                "patch_body": raw_json_body,
                "raw_directive": raw_json_body,
                "search": "",
                "replace": raw_json_body,
            })
        elif state == "TEXTEDIT" and current_file:
            raw_te = "\n".join(ast_lines)
            s_proj, r_proj = _project_textedit_search_replace(raw_te)
            files.setdefault(current_file, []).append({
                "id": current_id,
                "type": "textedit",
                "comment": "\n".join(comment_lines).strip(),
                "raw_textedit": raw_te,
                "search": s_proj,
                "replace": r_proj,
            })
        comment_lines = []
        ast_lines = []
        current_id = None
        state = "OUTSIDE"

    lines = text.replace('\r\n', '\n').replace('\xa0', ' ').split('\n')
    for line in lines:
        stripped = line.strip()
        if line.startswith("<<<<<<< FILE:"):
            raw_file_target = line.replace("<<<<<<< FILE:", "").strip()
            current_file = str(InSetuURI.from_external_input(raw_file_target)) if raw_file_target else ""
            if current_file not in files:
                files[current_file] = []
            current_id = None
            state = "OUTSIDE"
        elif line.startswith("<<<<<<< ID:"):
            current_id = line.replace("<<<<<<< ID:", "").strip()
        elif stripped.startswith("<<<<<<< COMMENT"):
            state = "COMMENT"
            comment_lines = []
        elif stripped.startswith("<<<<<<< RELOCATE"):
            state = "RELOCATE"
            ast_lines = []
        elif stripped.startswith("<<<<<<< RENAME"):
            state = "RENAME"
            ast_lines = []
        elif stripped.startswith("<<<<<<< MOVE_FILE"):
            state = "MOVE_FILE"
            ast_lines = []
        elif stripped.startswith("<<<<<<< ARCHIVE_FILE"):
            state = "ARCHIVE_FILE"
            ast_lines = []
        elif stripped.startswith("<<<<<<< DELETE_FILE"):
            state = "DELETE_FILE"
            ast_lines = []
        elif stripped.startswith("<<<<<<< TEXTEDIT"):
            state = "TEXTEDIT"
            ast_lines = []
        elif stripped.startswith("<<<<<<< JSON_PATCH"):
            state = "JSON_PATCH"
            ast_lines = []
        elif line.startswith("<<<<<<< SEARCH"):
            state = "SEARCH"
            search_lines = []
            current_type = "regex" if "REGEX" in line else "exact"
        elif line.startswith("======="):
            if state == "SEARCH":
                state = "REPLACE"
                replace_lines = []
            elif state in ("OUTSIDE", "COMMENT") and current_file:
                print(f"  [~] Warning: Missing '<<<<<<< SEARCH' tag detected for {current_file}. Auto-healing as a genesis patch.")
                state = "REPLACE"
                search_lines = []
                replace_lines = []
        elif stripped == ">>>>>>> EXECUTE":
            _flush_directive_block()
        elif line.startswith(">>>>>>> REPLACE"):
            if state in ("TEXTEDIT", "JSON_PATCH", "RELOCATE", "RENAME", "MOVE_FILE", "ARCHIVE_FILE", "DELETE_FILE"):
                _flush_directive_block()
            elif state == "REPLACE" and current_file:
                files[current_file].append({
                    "id": current_id,
                    "type": current_type,
                    "comment": "\n".join(comment_lines).strip(),
                    "search": "\n".join(search_lines),
                    "replace": "\n".join(replace_lines)
                })
                comment_lines = []
                current_id = None
                state = "OUTSIDE"
            else:
                state = "OUTSIDE"
        else:
            if state == "COMMENT":
                comment_lines.append(line)
            elif state in ("RELOCATE", "RENAME", "MOVE_FILE", "ARCHIVE_FILE", "DELETE_FILE", "TEXTEDIT", "JSON_PATCH"):
                ast_lines.append(line)
            elif state == "SEARCH":
                search_lines.append(line)
            elif state == "REPLACE":
                replace_lines.append(line)
    return files
def clean_date_str(val):
    """Safely normalizes varied date inputs into a standard ISO format."""
    if val is None:
        return None
    if isinstance(val, (datetime, timedelta)):
        return val.isoformat()
    s = str(val).strip().strip('\'"')
    if not s or s.lower() in ('null', 'none', '0000-00-00t00:00:00', '0000-00-00'):
        return None
    return s
def get_earlier_date(d1, d2):
    """Safely compares and returns the earlier of two ISO timestamp strings."""
    d1_clean = clean_date_str(d1)
    d2_clean = clean_date_str(d2)
    if not d1_clean: return d2_clean
    if not d2_clean: return d1_clean
    try:
        dt1 = datetime.fromisoformat(d1_clean.replace('Z', '+00:00'))
        dt2 = datetime.fromisoformat(d2_clean.replace('Z', '+00:00'))
        return d1_clean if dt1 <= dt2 else d2_clean
    except Exception:
        return d1_clean if d1_clean <= d2_clean else d2_clean

def parse_list_field(raw_val):
    """Safely parses comma-separated strings or JSON arrays into a standardized JSON string."""
    try:
        if isinstance(raw_val, list):
            return json.dumps([str(d).strip() for d in raw_val if str(d).strip()])
        elif isinstance(raw_val, str) and raw_val.startswith('['):
            return json.dumps(json.loads(raw_val))
        elif isinstance(raw_val, str):
            return json.dumps([d.strip() for d in raw_val.split(',') if d.strip()])
    except Exception:
        pass
    return '[]'

def parse_string_enum(raw_val):
    """Safely parses and normalizes string enumerations (e.g., priority, sizes)."""
    return str(raw_val).upper() if raw_val and str(raw_val).lower() not in ('null', 'none', '') else ''
_NATIVE_VFS_WRITES = {}
_NATIVE_VFS_HASHES = OrderedDict()
_WATCHDOG_PENDING = {}
_WATCHDOG_LOCK = threading.Lock()
_WATCHDOG_DEBOUNCE_WINDOW = 2.0
_WATCHDOG_THREAD = None


def _is_watchdog_vfs_echo(abs_key: str, src_path: str, op: str) -> Tuple[bool, Optional[str]]:
    """
    Deterministic Content-Addressed Echo Filter:
    Verifies whether an OS filesystem event matches an in-flight or already-committed internal VFS mutation.
    Returns (is_echo, disk_sha256).
    """
    if has_pending_vfs_write(src_path):
        return True, None

    with _WATCHDOG_LOCK:
        expected_hash = _NATIVE_VFS_HASHES.get(abs_key)

    if op == 'delete':
        if expected_hash == "__DELETED__" and not os.path.exists(src_path):
            return True, None
        return False, None

    if not os.path.exists(src_path) or os.path.isdir(src_path):
        return False, None

    try:
        st = os.stat(src_path)
        if st.st_size > 2 * 1024 * 1024:
            return False, None
        with open(src_path, 'r', encoding='utf-8') as f:
            disk_text = f.read()
        disk_hash = compute_vfs_sha256(disk_text)
        if expected_hash and disk_hash == expected_hash:
            return True, disk_hash
        return False, disk_hash
    except Exception:
        return False, None
def _watchdog_debouncer_loop():
    while True:
        time.sleep(2.0)
        now = time.time()
        to_emit = {}
        with _WATCHDOG_LOCK:
            for cache_key, data in list(_WATCHDOG_PENDING.items()):
                if now - data['ts'] >= _WATCHDOG_DEBOUNCE_WINDOW:
                    to_emit[cache_key] = data
                    del _WATCHDOG_PENDING[cache_key]
        if to_emit:
            ws_groups = {}
            for cache_key, data in to_emit.items():
                abs_key = data['abs_key']
                src_path = data.get('src_path', abs_key)
                is_echo, disk_hash = _is_watchdog_vfs_echo(abs_key, src_path, data['op'])
                if is_echo:
                    continue
                logical_path = data.get('logical_path', abs_key)
                print(f"👀 [Watchdog] Caught '{data['op']}' on: {logical_path} (after {_WATCHDOG_DEBOUNCE_WINDOW}s quiet)")
                ws_id = data['workspace_id']
                if ws_id not in ws_groups: ws_groups[ws_id] = []
                mut_entry = {"filepath": logical_path, "operation": data['op'], "ignore_ledger": False, "is_watchdog": True}
                if disk_hash:
                    mut_entry["base_hash"] = disk_hash
                ws_groups[ws_id].append(mut_entry)
                try:
                    w_conn = get_connection("workers", workspace_id=ws_id)
                    w_conn.execute("INSERT OR REPLACE INTO vfs_event_log (filepath, mutation_type, timestamp) VALUES (?, ?, ?)", (logical_path, data['op'], now))
                    w_conn.commit()
                except Exception: pass

            for ws_id, mutations in ws_groups.items():
                hooks.emit_background('vfs_mutated', workspace_id=ws_id, mutations=mutations)


@hooks.on('pre_file_save')
def _track_intent_vfs_writes(workspace_id=None, filepath=None, resolved_path=None, content=None, data=None, **kwargs):
    """Records deterministic VFS content hashes BEFORE disk I/O to eliminate Watchdog self-echoes."""
    if not filepath or not resolved_path:
        return
    abs_key = os.path.abspath(resolved_path).lower()
    action = (data or {}).get("action", "save") if isinstance(data, dict) else "save"
    target_hash = "__DELETED__" if action in ("delete", "move") else compute_vfs_sha256(content or "")

    with _WATCHDOG_LOCK:
        _NATIVE_VFS_WRITES[abs_key] = time.time()
        _NATIVE_VFS_HASHES[abs_key] = target_hash
        _NATIVE_VFS_HASHES.move_to_end(abs_key)
        while len(_NATIVE_VFS_HASHES) > 2048:
            _NATIVE_VFS_HASHES.popitem(last=False)
        keys_to_remove = [k for k in _WATCHDOG_PENDING.keys() if k[1] == abs_key]
        for k in keys_to_remove:
            del _WATCHDOG_PENDING[k]
_WATCHDOG_OBSERVER = None
@hooks.on('system_boot')
def start_filesystem_observer(**kwargs):
    """Initializes a unified Watchdog observer for all active workspaces."""
    global _WATCHDOG_OBSERVER
    if _WATCHDOG_OBSERVER is not None:
        stop_filesystem_observer()
    workspace_ids = get_all_workspace_ids()
    if not SettingsManager('system', 'default').get("enable_watchdog", True):
        return None

    active_configs = []
    for ws_id in workspace_ids:
        cfg = load_config(ws_id)
        active_configs.append((ws_id, cfg))
    if not active_configs:
        return None
    try:
        from watchdog.observers import Observer as _Observer
        from watchdog.observers.polling import PollingObserver as _PollingObserver
        from watchdog.events import FileSystemEventHandler as _FileSystemEventHandler
    except ImportError:
        print("⚠️  Optional package 'watchdog' not found. External modifications require full sweeps.")
        return None
    except Exception as e:
        print(f"⚠️  Watcher initialization failed: {e}")
        return None
    class FileSystemObserver(_FileSystemEventHandler):
        def __init__(self, workspace_id, repo_dir, target_path, ignore_dirs, ignore_files, ignore_patterns, ignore_exceptions=None):
            super().__init__()
            self.workspace_id = workspace_id
            self.repo_dir = repo_dir
            self.target_path = target_path
            self.ignore_dirs = ignore_dirs
            self.ignore_files = ignore_files
            self.ignore_patterns = ignore_patterns
            self.ignore_exceptions = ignore_exceptions or []
        def process_event(self, event, filepath_override=None, op_override=None, is_dir_override=None):
            src_path = filepath_override or event.src_path
            is_dir = is_dir_override if is_dir_override is not None else getattr(event, 'is_directory', False)

            # 🚨 O(N^2) STORM PREVENTER 🚨
            # Watchdog fires 'modified' events for directories whenever a child file changes.
            # We explicitly drop these to prevent telemetry storms, but we MUST preserve 
            # directory creations, deletions, and moves to catch atomic folder operations.
            if is_dir and event.event_type == 'modified':
                return

            filename = Path(src_path).name
            if filename.startswith('.') or filename.endswith('~') or filename.upper() == 'CODE_INDEX.MD' or filename == 'manifest.json': return
            if filename.endswith(('.db', '.db-wal', '.db-shm', '.db-journal')): return

            op = op_override or ('delete' if event.event_type == 'deleted' else 'save')
            try:
                rel_to_target = os.path.relpath(src_path, self.target_path).replace('\\', '/')
                if rel_to_target == '.' or rel_to_target == '': return
                logical_path = f"vfs://{self.repo_dir}/{rel_to_target}"

                if is_dir:
                    logical_path += '/'
                # CPU Optimization: Drop events for ignored directories/patterns before waking the Event Bus
                parts = set(p.lower() for p in logical_path.strip('/').split('/'))
                norm_rel_lower = rel_to_target.lower()

                # Hardcoded OS Guardrails to prevent Watchdog infinite I/O loops on cache/db while allowing .insetu/data/
                if parts.intersection({'.git', 'node_modules', '__pycache__', 'venv'}): return
                if '.insetu' in parts and not (norm_rel_lower.startswith('.insetu/data/') or '/.insetu/data/' in norm_rel_lower):
                    return
                from insetu.core.topology.engine_topology import matches_gitignore_patterns as _matches_gitignore_patterns
                is_excepted = any(rel_to_target.startswith(exc.lstrip('/')) for exc in self.ignore_exceptions if exc) or _matches_gitignore_patterns(rel_to_target, self.ignore_exceptions)
                if not is_excepted:
                    if filename.lower() in self.ignore_files: return
                    if parts.intersection(self.ignore_dirs): return
                    if self.ignore_patterns and (
                        any(pattern in logical_path for pattern in self.ignore_patterns)
                        or _matches_gitignore_patterns(rel_to_target, self.ignore_patterns)
                    ):
                        return
                abs_key = os.path.abspath(src_path).lower()
                # Deduplication 1: Deterministic Content-Addressed VFS Echo Check
                if not is_dir:
                    is_echo, _ = _is_watchdog_vfs_echo(abs_key, src_path, op)
                    if is_echo:
                        return
                # Deduplication 2: Unified Trailing Slew Limiter (Batcher)
                global _WATCHDOG_THREAD
                with _WATCHDOG_LOCK:
                    cache_key = (self.workspace_id, abs_key)
                    _WATCHDOG_PENDING[cache_key] = {
                        'op': op,
                        'workspace_id': self.workspace_id,
                        'ts': time.time(),
                        'logical_path': logical_path,
                        'abs_key': abs_key,
                        'src_path': src_path
                    }
                    if _WATCHDOG_THREAD is None or not _WATCHDOG_THREAD.is_alive():
                        _WATCHDOG_THREAD = threading.Thread(target=_watchdog_debouncer_loop, daemon=True)
                        _WATCHDOG_THREAD.start()

            except Exception:
                pass

        def on_modified(self, event): self.process_event(event)
        def on_created(self, event): self.process_event(event)
        def on_deleted(self, event): self.process_event(event)
        def on_moved(self, event):
            is_dir = getattr(event, 'is_directory', False)
            self.process_event(event, filepath_override=event.src_path, op_override='delete', is_dir_override=is_dir)
            if hasattr(event, 'dest_path'):
                self.process_event(event, filepath_override=event.dest_path, op_override='save', is_dir_override=is_dir)
    try:
        observer = _Observer()
    except Exception:
        observer = _PollingObserver()
    has_watches = False
    scheduled_watches = set()
    for ws_id, cfg in active_configs:
        _, ws_root = get_workspace_physics(ws_id)
        global_ignore = set(d.lower() for d in cfg.get("ignore_dirs", []))
        global_ignore_files = set(f.lower() for f in cfg.get("ignore_files", []))
        global_patterns = cfg.get("ignore_patterns", [])
        for repo_cfg in cfg.get("target_repos", []):
            r_dir = repo_cfg.get("repo_dir")
            if not r_dir: continue
            p_path = repo_cfg.get("physical_path")
            target_path = os.path.abspath(os.path.expanduser(p_path)) if p_path else Path(ws_root).joinpath(r_dir).resolve().as_posix()
            watch_key = (ws_id, target_path)
            if watch_key in scheduled_watches:
                continue
            if os.path.exists(target_path):
                scheduled_watches.add(watch_key)
                if repo_cfg.get("repo_ignore_dirs") is not None:
                    ignore_dirs = set(d.lower() for d in repo_cfg.get("repo_ignore_dirs"))
                else:
                    ignore_dirs = set(global_ignore)

                if repo_cfg.get("repo_ignore_files") is not None:
                    ignore_files = set(f.lower() for f in repo_cfg.get("repo_ignore_files"))
                else:
                    ignore_files = set(global_ignore_files)

                if repo_cfg.get("repo_ignore_patterns") is not None:
                    ignore_patterns = repo_cfg.get("repo_ignore_patterns")
                else:
                    ignore_patterns = list(global_patterns)
                ignore_exceptions = repo_cfg.get("ignore_exceptions") or []
                handler = FileSystemObserver(
                    workspace_id=ws_id,
                    repo_dir=r_dir,
                    target_path=target_path,
                    ignore_dirs=ignore_dirs,
                    ignore_files=ignore_files,
                    ignore_patterns=ignore_patterns,
                    ignore_exceptions=ignore_exceptions
                )
                observer.schedule(handler, target_path, recursive=True)
                has_watches = True
    if has_watches:
        observer.start()
        _WATCHDOG_OBSERVER = observer
        print("👁️  Native Filesystem Watchers Engaged.")

@hooks.on('system_shutdown')
def stop_filesystem_observer(**kwargs):
    global _WATCHDOG_OBSERVER
    if _WATCHDOG_OBSERVER:
        try:
            _WATCHDOG_OBSERVER.stop()
            _WATCHDOG_OBSERVER.join(timeout=2.0)
        except Exception: pass
        _WATCHDOG_OBSERVER = None

def generate_text_chunks(blocks, chunk_limit=400000):
    current_chunk = []
    current_length = 0
    for block in blocks:
        block_len = len(block)
        if current_length + block_len > chunk_limit and current_length > 0:
            yield "".join(current_chunk)
            current_chunk = []
            current_length = 0
        current_chunk.append(block)
        current_length += block_len
    if current_chunk:
        yield "".join(current_chunk)


def evaluate_circuit_breaker(touched_count, total_count, threshold=0.5):
    if not total_count or total_count <= 0:
        return False
    return (touched_count / total_count) > threshold
def extract_manifest_files(manifest_data, target_key=None, domain='auto', exclude_types=None, include_types=None):
    def _extract(data):
        if isinstance(data, dict):
            item_type = data.get("meta", {}).get("type", "unknown")
            if exclude_types and item_type in exclude_types:
                return []
            if include_types and item_type not in include_types:
                return []
            return data.get("chunks", data.get("files", []))
        elif isinstance(data, list):
            if include_types: return []
            return data
        return []
    ctx_manifest = manifest_data.get("ctx", {}) if isinstance(manifest_data, dict) else {}
    vfs_manifest = manifest_data.get("vfs", {}) if isinstance(manifest_data, dict) else {}

    if target_key:
        entry = ctx_manifest.get(target_key) if domain == 'ctx' else (vfs_manifest.get(target_key) if domain == 'vfs' else (ctx_manifest.get(target_key) or vfs_manifest.get(target_key) or manifest_data.get(target_key)))
        if entry is None and ("/" in target_key or "\\" in target_key):
            base_name = Path(target_key).name
            entry = ctx_manifest.get(base_name) if domain == 'ctx' else (vfs_manifest.get(base_name) if domain == 'vfs' else (ctx_manifest.get(base_name) or vfs_manifest.get(base_name) or manifest_data.get(base_name)))
        return _extract(entry or {})

    all_files = set()
    target_partition = ctx_manifest if domain == 'ctx' else (vfs_manifest if domain == 'vfs' else (vfs_manifest if (manifest_data.get('vfs') or manifest_data.get('ctx')) else manifest_data))
    default_prefix = "ctx://contexts/" if domain == 'ctx' else "vfs://"
    for k, v in target_partition.items():
        extracted = _extract(v)
        if extracted:
            if isinstance(k, str) and k.endswith('.txt'):
                all_files.add(InSetuURI.canonicalize(k, default_prefix=default_prefix))
            for f in extracted:
                if isinstance(f, str) and f:
                    all_files.add(InSetuURI.canonicalize(f, default_prefix=default_prefix))
    return sorted(list(all_files))
def get_domain_cache_path(workspace_id, domain_name):
    """Resolves and ensures physical existence of .insetu/cache/<domain_name> for disposable compiled outputs."""
    try:
        cfg_path, _ = get_workspace_physics(workspace_id)
        domain_dir = Path(cfg_path).parent.joinpath("cache", domain_name).resolve().as_posix()
        os.makedirs(domain_dir, exist_ok=True)
        return domain_dir
    except Exception:
        return f".insetu/cache/{domain_name}"

def get_domain_data_path(workspace_id, domain_name):
    """Resolves and ensures physical existence of .insetu/data/<domain_name> for sovereign workspace data."""
    try:
        cfg_path, _ = get_workspace_physics(workspace_id)
        domain_dir = Path(cfg_path).parent.joinpath("data", domain_name).resolve().as_posix()
        os.makedirs(domain_dir, exist_ok=True)
        return domain_dir
    except Exception:
        return f".insetu/data/{domain_name}"

def get_domain_artifact_path(workspace_id, domain_name, ext_name=None):
    """Backward-compatible router directing compiled artifacts to .insetu/cache/<domain_name>."""
    return get_domain_cache_path(workspace_id, domain_name)
def get_safe_repo_id(repo_dir):
    if not repo_dir: return ""
    safe_dir = f"dot_{repo_dir[1:]}" if repo_dir.startswith('.') else repo_dir
    return safe_dir.replace('-', '_').lower()

def truncate_filename(filename: str, max_len: int = 24, ellipsis: str = "…") -> str:
    """
    Standardized filename truncation for compact UI chrome and CLI displays.
    Preserves the front of the basename and the file extension (e.g., 'this-is-part…md').
    """
    if not filename:
        return ""
    base = Path(filename).name
    if len(base) <= max_len:
        return base

    last_dot = base.rfind('.')
    if last_dot <= 0 or (len(base) - last_dot) + len(ellipsis) >= max_len:
        slice_len = max(1, max_len - len(ellipsis))
        return base[:slice_len] + ellipsis

    ext = base[last_dot:]
    front_len = max_len - len(ext) - len(ellipsis)
    return f"{base[:front_len]}{ellipsis}{ext}"
def vacuum_manifest_artifacts(ctx, domain_dir, expected_artifacts_set, exempt_abs_paths=None):
    """
    Centralized garbage collector for compiled context artifacts.
    Sweeps a specific VFS domain directory and deletes any .txt files
    that are not explicitly declared in the expected_artifacts_set.
    """
    resolved_dir = ctx.resolve_path(domain_dir, must_exist=True)
    if not resolved_dir:
        return
    exemptions = exempt_abs_paths or set()
    for ws_rel_path in ctx.vfs.walk(domain_dir, exts=['.txt']):
        f_path = ctx.resolve_path(ws_rel_path, must_exist=True)
        f_basename = InSetuURI(ws_rel_path).basename

        if f_path not in exemptions and f_basename not in expected_artifacts_set and f_basename != "manifest.json":
            try:
                ctx.vfs.delete(ws_rel_path, data={"ignore_ledger": True})
            except Exception:
                pass
def reconcile_and_vacuum_domain(ctx, domain_uri_prefix, manifest_deltas, domain_dir, filename_suffix="_context.txt", target_repos=None):
    """
    Make-Before-Break Domain Reconciler:
    1. Flushes any pending VFS writes for newly compiled chunks BEFORE publishing metadata.
    2. Tombstones obsolete manifest keys strictly within the evaluated repository scope
        (supporting both single 'repo' strings and multi-repo 'repos' lists).
    3. Commits manifest deltas to SQLite. Physical file garbage collection is deferred
        to the terminal 'compilation_sequence_complete' sink.
    """
    # 1. Ensure all newly written chunk files are physically on disk before updating SQLite
    ctx.sync_vfs_barrier()

    current_manifest = ctx.manifest.get("ctx", {})
    active_keys = {filename for filename, entry in manifest_deltas.items() if entry}

    # 2. Identify orphaned manifest keys in this domain that were in-scope for this run
    target_repos_set = set(target_repos) if target_repos else None
    for k, v in list(current_manifest.items()):
        if domain_uri_prefix in k and k.endswith(filename_suffix):
            if k in active_keys:
                continue
            if target_repos_set is not None:
                meta = v.get("meta", {}) if isinstance(v, dict) else {}
                entry_repos = set(meta.get("repos") or ([meta["repo"]] if meta.get("repo") else []))
                # Only tombstone during a targeted sweep if this entry belongs to the targeted repos
                if not entry_repos or not (entry_repos & target_repos_set):
                    continue
            manifest_deltas[k] = None

    # 3. Commit manifest changes to SQLite
    if manifest_deltas:
        ctx.save_manifest(manifest_deltas, is_full_compile=False)

def get_flattened_buckets(workspace_id=None, target_configs=None):
    """Backend SSOT helper for resolving flattened sub-buckets with defensive null-safety."""
    if target_configs is None:
        cfg = load_config(workspace_id)
        target_configs = cfg.get("target_repos", []) or []

    if not isinstance(target_configs, list):
        return []
    flattened = []
    for repo in target_configs:
        if not repo or not isinstance(repo, dict):
            continue
        repo_domain = (repo.get("domain") or "").strip() or "Workspaces"
        sub_buckets = repo.get("sub_buckets") or []
        if isinstance(sub_buckets, list):
            for b in sub_buckets:
                if b and isinstance(b, dict) and not b.get("is_system"):
                    b_copy = dict(b)
                    b_copy["domain"] = (b.get("domain") or "").strip() or repo_domain
                    b_copy["repo_dir"] = repo.get("repo_dir", "")
                    b_copy["repo_title"] = repo.get("title") or repo.get("repo_dir", "")
                    flattened.append(b_copy)
    return flattened
def get_available_contexts(workspace_id=None, exclusion_flags=None, exclude_types=None, include_types=None):
    cfg = load_config(workspace_id)
    flags = [exclusion_flags] if isinstance(exclusion_flags, str) else (exclusion_flags or [])

    excluded_repos = set()
    if flags:
        for c in cfg.get("target_repos", []):
            if any(c.get(flag) for flag in flags):
                excluded_repos.add(c.get("repo_dir"))

    declarations = hooks.emit_merge_list('gather_declare_topology', workspace_id=workspace_id)

    expected_contexts = set()
    for decl in declarations:
        meta = decl.get("meta", {})
        item_type = meta.get("type", "unknown")
        repo = meta.get("repo")

        if repo and repo in excluded_repos:
            continue
        if exclude_types and item_type in exclude_types:
            continue
        if include_types and item_type not in include_types:
            continue
        filename = decl.get("filename", "")
        if filename:
            expected_contexts.add(filename)

    return expected_contexts
def get_repo_path(repo_dir, workspace_id=None):
    """SSOT for resolving a repository's physical override or logical path."""
    cfg = load_config(workspace_id)
    for c in cfg.get("target_repos", []):
        if c.get("repo_dir") == repo_dir and c.get("physical_path"):
            return os.path.abspath(os.path.expanduser(c.get("physical_path")))

    # Fallback to standard sandbox resolution
    resolved = _vfs_resolve_physical_path(f"vfs://{repo_dir}", workspace_id)
    if not resolved:
        _, ws_root = get_workspace_physics(workspace_id)
        return Path(ws_root).joinpath(repo_dir).as_posix()
    return resolved

def get_sister_repos(workspace_id=None):
    cfg = load_config(workspace_id)
    return [repo.get("repo_dir") for repo in cfg.get("target_repos", []) if repo.get("repo_dir")]
def resolve_logical_path(path, workspace_id=None):
    if not path:
        return ""

    raw_str = str(path).replace('\\', '/').strip()
    if "://" not in raw_str and Path(raw_str).is_absolute():
        return Path(raw_str).resolve().as_posix()

    cfg = load_config(workspace_id)
    _, workspace_root = get_workspace_physics(workspace_id)
    ws_root_path = Path(workspace_root).resolve()

    uri = InSetuURI(raw_str)
    if Path(uri.path).is_absolute() and not uri.volume:
        return Path(uri.path).resolve().as_posix()

    target_repos = cfg.get("target_repos", [])

    # Reconstruct the full logical path
    clean_fallback = f"{uri.volume}/{uri.path}".strip('/') if uri.volume else uri.path

    # Map logical workspace bounds by matching the longest registered repo_dir prefix
    best_repo = None
    best_rel_path = ""
    for repo in target_repos:
        r_dir = repo.get("repo_dir")
        if not r_dir: continue
        if clean_fallback == r_dir or clean_fallback.startswith(r_dir + '/'):
            if not best_repo or len(r_dir) > len(best_repo.get("repo_dir")):
                best_repo = repo
                best_rel_path = clean_fallback[len(r_dir):].lstrip('/')

    if best_repo:
        p_path = best_repo.get("physical_path")
        if p_path:
            repo_base = Path(p_path).expanduser().resolve()
        elif ws_root_path.name == best_repo.get("repo_dir"):
            repo_base = ws_root_path
        else:
            repo_base = (ws_root_path / best_repo.get("repo_dir")).resolve()

        return repo_base.joinpath(best_rel_path).resolve().as_posix()

    # Fallback to standard sandbox resolution
    return ws_root_path.joinpath(clean_fallback).resolve().as_posix()
@hooks.on('expand_selection')
def hook_expand_selection(items=None, workspace_id=None, gather_only=False, **kwargs):
    if not items:
        return []

    files = []
    repo_files_cache = {}
    all_ledger_files_cache = None
    with VFSTransaction(workspace_id) as vfs:
        for item in items:
            if isinstance(item, dict):
                raw_target = str(item.get("filepath") or item.get("folderpath") or item.get("id") or "").strip()
                if not raw_target:
                    continue
                uri = InSetuURI(raw_target)
                if item.get("isDir") is not None:
                    is_folder = bool(item.get("isDir"))
                elif item.get("folderpath") or uri.is_dir:
                    is_folder = True
                elif uri.scheme == 'ctx' and uri.volume in ('contexts', 'diffs', 'workflows'):
                    is_folder = False
                elif '.' in uri.basename and not uri.basename.startswith('.'):
                    is_folder = False
                else:
                    is_folder = uri.is_dir_physical(workspace_id)
            else:
                raw_item = str(item or "").strip()
                if not raw_item:
                    continue
                uri = InSetuURI(raw_item)
                if not uri.path and not uri.volume:
                    continue
                if uri.is_dir:
                    is_folder = True
                elif uri.scheme == 'ctx' and uri.volume in ('contexts', 'diffs', 'workflows'):
                    is_folder = False
                elif '.' in uri.basename and not uri.basename.startswith('.'):
                    # Fast-path: paths with standard file extensions avoid synchronous os.stat syscalls
                    is_folder = False
                else:
                    is_folder = uri.is_dir_physical(workspace_id)
            if is_folder:
                matched_folder_files = []
                if gather_only and (not uri.scheme or uri.scheme == 'vfs'):
                    repo_dir = uri.repo
                    folder_rel_path = uri.path.strip('/')
                    if repo_dir:
                        if repo_dir not in repo_files_cache:
                            from insetu.core.topology.engine_topology import get_topology_files_for_repo as _get_topology_files_for_repo
                            g_list = _get_topology_files_for_repo(workspace_id, repo_dir)
                            if not g_list:
                                repo_path = get_repo_path(repo_dir, workspace_id)
                                if os.path.exists(repo_path):
                                    cfg = load_config(workspace_id)
                                    target_configs = cfg.get("target_repos", [])
                                    repo_cfg = next((c for c in target_configs if c and c.get("repo_dir") == repo_dir), None)
                                    if repo_cfg:
                                        from insetu.core.topology.engine_topology import get_valid_workspace_files as _get_valid_workspace_files
                                        rel_valid = _get_valid_workspace_files(repo_path, repo_cfg, workspace_id)
                                        g_list = [f"vfs://{repo_dir}/{f}" for f in rel_valid]
                            repo_files_cache[repo_dir] = g_list
                        gather_files = repo_files_cache[repo_dir]
                    else:
                        if all_ledger_files_cache is None:
                            conn = get_connection("topology", workspace_id=workspace_id)
                            rows = conn.execute("SELECT filepath FROM topology_ledger").fetchall()
                            all_ledger_files_cache = [r['filepath'] for r in rows]
                        gather_files = all_ledger_files_cache

                    for g_file in gather_files:
                        g_uri = InSetuURI(g_file)
                        if g_uri.basename in ('.gitkeep', '.keep'):
                            continue
                        g_rel_path = g_uri.path
                        if not folder_rel_path or g_rel_path == folder_rel_path or g_rel_path.startswith(folder_rel_path + '/'):
                            matched_folder_files.append(str(g_uri))

                if matched_folder_files:
                    files.extend(matched_folder_files)
                else:
                    target_walk = str(uri).rstrip('/')
                    for f in vfs.walk(target_walk):
                        f_uri = InSetuURI(f)
                        if f_uri.basename not in ('.gitkeep', '.keep'):
                            files.append(str(f_uri))
            else:
                if uri.scheme == 'ctx':
                    chunks = hooks.emit_first('resolve_payload_chunks', uri=str(uri), workspace_id=workspace_id, default=[str(uri)])
                    files.extend(chunks)
                else:
                    files.append(str(uri))

    unique_files = []
    seen = set()
    for f in files:
        if f not in seen:
            seen.add(f)
            unique_files.append(f)
    return unique_files
@hooks.on('find_path_candidates')
def find_path_candidates(query_path=None, workspace_id=None, allowed_repos=None, **kwargs):
    """
    Explicit, opt-in candidate finder for path disambiguation.
    Principal consumer is the Yomama Sync Bridge.
    """
    if not query_path:
        return []
    from insetu.core.topology.engine_topology import get_omniscient_workspace_files as _get_omniscient_workspace_files
    q_uri = InSetuURI.from_external_input(query_path)
    clean_query = (f"{q_uri.repo}/{q_uri.path}".strip('/') if q_uri.repo else q_uri.path).replace('\\', '/').strip('/')
    query_basename = Path(clean_query).name.lower()

    omniscient = _get_omniscient_workspace_files(workspace_id, allowed_repos)
    candidates = []
    for cand_basename, cand_fp in omniscient:
        c_uri = InSetuURI(cand_fp)
        cand_canonical = str(c_uri)
        cand_rel = f"{c_uri.repo}/{c_uri.path}".strip('/') if c_uri.repo else c_uri.path
        cand_basename_lower = cand_basename.lower()
        cand_rel_lower = cand_rel.lower()
        if cand_rel_lower == clean_query.lower():
            candidates.append({"filepath": cand_canonical, "score": 1.0, "match_type": "exact_match"})
        elif cand_basename_lower == query_basename:
            score = 0.9 if clean_query.lower() in cand_rel_lower else 0.8
            candidates.append({"filepath": cand_canonical, "score": score, "match_type": "basename_match"})
        elif clean_query.lower() in cand_rel_lower or cand_rel_lower.endswith(clean_query.lower()):
            candidates.append({"filepath": cand_canonical, "score": 0.7, "match_type": "subpath_match"})

    candidates.sort(key=lambda x: x["score"], reverse=True)
    return candidates
def get_default_repo_template(repo_dir, title=None, domain=None, description=None, exts=None):
    tpl = {
        "repo_dir": repo_dir,
        "title": title or repo_dir.replace("-", " ").replace("_", " ").title(),
        "domain": domain or "Workspaces",
        "description": description or f"Auto-initialized repository: {repo_dir}",
        "apply_ignore": True,
        "sub_buckets": []
    }
    if exts is not None:
        tpl["exts"] = exts
    return tpl
def normalize_repo_domains(target_repos, strip_empty_overrides=False):
    """
    SSOT normalizer for repository, sub-bucket, and meta_map domain strings.
    When strip_empty_overrides=True (for disk persistence), blank child domains are removed so they inherit cleanly.
    When strip_empty_overrides=False (for runtime hydration), blank child domains are populated from their parent.
    """
    for repo in (target_repos or []):
        if not isinstance(repo, dict):
            continue
        parent_dom = (repo.get("domain") or "").strip() or "Workspaces"
        repo["domain"] = parent_dom
        for b in (repo.get("sub_buckets") or []):
            if not isinstance(b, dict):
                continue
            b_dom = (b.get("domain") or "").strip()
            if b_dom:
                b["domain"] = b_dom
            elif strip_empty_overrides:
                b.pop("domain", None)
            else:
                b["domain"] = parent_dom
            effective_b_dom = b.get("domain") or parent_dom
            if isinstance(b.get("meta_map"), dict):
                for m_val in b["meta_map"].values():
                    if isinstance(m_val, dict):
                        m_dom = (m_val.get("domain") or "").strip()
                        if m_dom:
                            m_val["domain"] = m_dom
                        elif strip_empty_overrides:
                            m_val.pop("domain", None)
                        else:
                            m_val["domain"] = effective_b_dom
    return target_repos


def heal_manifest_entry_domain(entry, target_repos=None, workspace_id=None) -> bool:
    """Ensures entry['meta']['domain'] is never blank, inheriting from the parent repository domain when empty."""
    if not isinstance(entry, dict) or not isinstance(entry.get("meta"), dict):
        return False
    meta = entry["meta"]
    if (meta.get("domain") or "").strip():
        return False
    repo_dir = meta.get("repo")
    parent_dom = "Workspaces"
    if repo_dir:
        if target_repos is None:
            target_repos = load_config(workspace_id).get("target_repos") or []
        for r_cfg in (target_repos or []):
            if isinstance(r_cfg, dict) and r_cfg.get("repo_dir") == repo_dir:
                parent_dom = (r_cfg.get("domain") or "").strip() or "Workspaces"
                break
    meta["domain"] = parent_dom
    return True
def heal_sqlite_uri_column(conn, table: str, column: str = "filepath", default_prefix: str = "vfs://") -> None:
    """Collision-safe SQLite URI column healer: removes duplicate unprefixed shadow rows before prepending default_prefix."""
    if not conn or not table or not column:
        return
    if not re.match(r'^[a-zA-Z0-9_]+$', table) or not re.match(r'^[a-zA-Z0-9_]+$', column):
        raise ValueError(f"Invalid SQLite identifier: {table}.{column}")
    prefix = default_prefix if default_prefix.endswith("://") or default_prefix.endswith("/") else f"{default_prefix}://"
    try:
        conn.execute(
            f"DELETE FROM {table} WHERE {column} NOT LIKE '%://%' "
            f"AND (? || LTRIM({column}, '/')) IN (SELECT {column} FROM {table})",
            (prefix,),
        )
        conn.execute(
            f"UPDATE {table} SET {column} = ? || LTRIM({column}, '/') WHERE {column} NOT LIKE '%://%'",
            (prefix,),
        )
        conn.commit()
    except Exception:
        pass


def sanitize_workspace_config(cfg):
    for non_topology_key in (
        "_settings_schemas",
        "bypassed_extensions",
        "extensions",
        "instance_title",
        "instance_emoji",
        "port",
        "enable_watchdog",
        "preload_all_extensions",
        "offline_cache_limit_mb"
    ):
        cfg.pop(non_topology_key, None)
    raw_targets = cfg.get("target_repos", [])
    valid_repos = []
    seen_dirs = set()
    for repo in (raw_targets or []):
        if not repo or not repo.get("repo_dir") or not repo.get("repo_dir").strip():
            continue

        r_dir = repo.get("repo_dir").strip()
        repo["repo_dir"] = r_dir

        if repo.get("physical_path"):
            repo["physical_path"] = repo["physical_path"].strip()

        if r_dir in seen_dirs:
            continue
        seen_dirs.add(r_dir)
        valid_buckets = []
        for b in (repo.get("sub_buckets") or []):
            if not b or b.get("is_system"):
                continue
            if not b.get("dynamic_split_prefix"):
                if not b.get("id"):
                    title = b.get("title", "").strip()
                    b["id"] = slugify(title) if title else "untitled_bucket"
            b.pop("is_catch_all", None)
            valid_buckets.append(b)
        repo["sub_buckets"] = valid_buckets
        valid_repos.append(repo)
    normalize_repo_domains(valid_repos, strip_empty_overrides=True)
    cfg["target_repos"] = valid_repos
    return cfg
