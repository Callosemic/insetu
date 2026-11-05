import os
import io

os.environ.setdefault("AKASA_CONTROL_DIR", ".insetu")
import re
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from insetu.core.sdk import (
    CORE_MODULES_TUPLE, AkasaURI, CycleError, DefaultVFSDriver, SettingsManager, VFSTransaction,
    allocate_ephemeral_port, atomic_write_bytes, atomic_write_text, build_tree_dict, can_bind_port,
    compute_vfs_sha256, decrypt_secret, encrypt_secret, ensure_master_key_on_disk, evict_vfs_cache,
    execute_binary, execute_vfs_bulk, execute_vfs_delete, execute_vfs_move, execute_vfs_save,
    extract_template_variables, fold_vfs_events, generate_ascii_tree, get_active_modules,
    get_all_workspace_ids, get_connection, get_core_modules, get_daemon_cwd,
    get_daemon_host_config_path, get_kernel_memory_telemetry, get_system_index_path,
    get_tenant_control_dir, get_workspace_physics, has_pending_vfs_write, heal_daemon_config_files,
    hooks, interpolate_template_variables, is_core_module, is_extension_enabled, is_port_listening,
    is_subpath, load_config, load_json_config, lookup_vfs_ancestor, mount_volume, parse_uri,
    reclaim_process_memory, record_vfs_ancestor, register_driver, resolve_active_tenant,
    resolve_dag_wavefronts, resolve_physical_path as _vfs_resolve_physical_path,
    resolve_physical_path, resolve_system_artifact_path, rotate_master_key, save_json_config,
    set_daemon_cwd, set_mount_authorizer, set_tenant_resolver, slugify, sniff_tenant_id,
    sync_vfs_barrier, three_way_merge_text, typeddict_to_openapi,
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
        if clean_stripped.startswith('settings/'):
            return f"ctx://settings/{clean_stripped[len('settings/'):].lstrip('/')}"
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
    def is_user_template(self) -> bool:
        norm = str(self).replace('\\', '/')
        return '/.templates/user/' in norm or norm.endswith('/.templates/user')

    @property
    def is_readonly_template(self) -> bool:
        if self.is_user_template:
            return False
        norm = str(self).replace('\\', '/')
        return '/.templates/' in norm or norm.endswith('/.templates')

    @property
    def is_template(self) -> bool:
        return self.is_user_template or self.is_readonly_template

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
    yaml.width = 4096
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

    yaml_match = re.search(r'^\s*---[ \t]*\n(?:([\s\S]*?)\n)?[ \t]*---(?=\s*\n|\s*$)', content)
    yaml_data = {}
    body = content

    if yaml_match:
        raw_yaml = yaml_match.group(1) or ""
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
    Finds all {{include_prompt: ...}} and {{include_prompt?: ...}} blocks using balanced
    brace/quote scanning so nested directives or braces inside parameter strings never truncate the match.
    Yields (start_idx, end_idx, include_path, params_str, is_optional).
    """
    header_re = re.compile(r'\{\{\s*include_prompt(\?)?\s*:\s*')
    pos = 0
    n = len(text)
    while pos < n:
        m = header_re.search(text, pos)
        if not m:
            break
        is_optional = bool(m.group(1))
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
        yield start_idx, end_idx, include_path, raw_params, is_optional
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


_EXT_TEMPLATE_URI_RE = re.compile(r'^ctx://prompts/\.templates/([a-zA-Z0-9_-]+)/.+$')
_OPTIONAL_OMITTED_SENTINEL = "\x00__INSETU_OPTIONAL_INCLUDE_OMITTED__\x00"


def _evaluate_optional_include_target(target_path: str, raw_include_path: str, workspace_id: Optional[str] = None) -> Tuple[str, str]:
    m = _EXT_TEMPLATE_URI_RE.match(str(target_path or "").strip())
    if not m or m.group(1).lower() == "user":
        return (
            "error",
            f"[!] OPTIONAL INCLUDE ERROR: '?' is only valid on extension templates (ctx://prompts/.templates/<ext>/...): {raw_include_path}",
        )
    wid = workspace_id or sniff_tenant_id() or "default"
    if not is_extension_enabled(m.group(1), wid):
        return ("omit", "")
    return ("expand", "")


def _collapse_omitted_optional_includes(rendered: str) -> str:
    if _OPTIONAL_OMITTED_SENTINEL not in rendered:
        return rendered
    cleaned = re.sub(r'(?:\n[ \t]*){0,1}\n[ \t]*' + re.escape(_OPTIONAL_OMITTED_SENTINEL) + r'[ \t]*(?=\n|$)', '', rendered)
    return cleaned.replace(_OPTIONAL_OMITTED_SENTINEL, '')


_DEFAULT_INCLUDE_PROMPT_RE = r'\{\{\s*include_prompt\??\s*:\s*([^\s{}]+)\s*(?:\{([\s\S]*?)\})?\s*\}\}'


def resolve_macro_includes(text, current_filepath, pattern=_DEFAULT_INCLUDE_PROMPT_RE, read_callback=None, depth=0, workspace_id=None):
    """Expands {{include_prompt: ...}} and optional {{include_prompt?: ...}} macros recursively (depth 5), with macro parameters."""
    if callable(pattern) and read_callback is None:
        read_callback = pattern
        pattern = _DEFAULT_INCLUDE_PROMPT_RE
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
        if (cur_uri.scheme == "ctx" and cur_uri.volume == "prompts") or "/.insetu-data/prompts/" in str(cur_uri):
            clean_rel = include_path.lstrip("/")
            for strip_p in (".insetu-data/prompts/", ".insetu/data/prompts/", "prompts/"):
                if clean_rel.startswith(strip_p):
                    clean_rel = clean_rel[len(strip_p):].lstrip("/")
            if cur_uri.scheme == "vfs" and cur_uri.repo:
                first_seg, _, _ = clean_rel.partition("/")
                if first_seg != cur_uri.repo and not clean_rel.startswith(".templates/"):
                    return f"ctx://prompts/{cur_uri.repo}/{clean_rel}"
            return f"ctx://prompts/{clean_rel}"
        return include_path

    def _apply_params_and_recurse(inc_content: str, target_path: str, params_str: str) -> str:
        if params_str:
            resolved_params_str = resolve_macro_includes(params_str, current_filepath, pattern, read_callback, depth + 1, workspace_id=workspace_id)
            parsed_params = _parse_macro_params(resolved_params_str)
            for raw_key, val in parsed_params.items():
                clean_key = raw_key[len('macro_'):] if raw_key.startswith('macro_') else raw_key
                macro_pattern = r'\{\{\s*(?:macro_)?' + re.escape(clean_key) + r'(?:\s*\|[^{}]*)?\s*\}\}'
                inc_content = re.sub(macro_pattern, lambda _, v=val: v, inc_content)

        def _resolve_static_default(m: re.Match) -> str:
            fallback_expr = m.group(1).strip()
            if "|" in fallback_expr or any(
                fallback_expr.startswith(ns) for ns in ("sys.", "global.", "inputs.", "nodes.")
            ):
                return m.group(0)
            return fallback_expr

        inc_content = re.sub(
            r'\{\{\s*(?:macro_)?[a-zA-Z0-9_]+\s*\|\s*([^{}]*?)\s*\}\}',
            _resolve_static_default,
            inc_content,
        )
        return resolve_macro_includes(inc_content, target_path, pattern, read_callback, depth + 1, workspace_id=workspace_id)

    if "include_prompt" in text:
        spans = list(_extract_balanced_include_macros(text))
        if spans:
            out_parts = []
            last_idx = 0
            for start_idx, end_idx, include_path, params_str, is_optional in spans:
                out_parts.append(text[last_idx:start_idx])
                target_path = _resolve_target_uri(include_path)
                last_idx = end_idx
                if is_optional:
                    opt_action, opt_err = _evaluate_optional_include_target(target_path, include_path, workspace_id=workspace_id)
                    if opt_action == "error":
                        out_parts.append(opt_err)
                        continue
                    if opt_action == "omit":
                        out_parts.append(_OPTIONAL_OMITTED_SENTINEL)
                        continue
                try:
                    inc_content = read_callback(target_path)
                except Exception:
                    inc_content = None
                if inc_content is not None:
                    out_parts.append(_apply_params_and_recurse(inc_content, target_path, params_str))
                else:
                    out_parts.append(f"[!] MACRO TARGET NOT FOUND: {include_path}")
            out_parts.append(text[last_idx:])
            return _collapse_omitted_optional_includes("".join(out_parts))

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


_CHAINED_MUSTACHE_RE = re.compile(r'\{\{\s*([^{}]+?)\s*\}\}')


def resolve_context_var_path(path_expr: str, context: Dict[str, Any], ctx=None) -> Any:
    """
    Resolves a dotted variable reference ('sys.repo_title', 'global.mode', 'nodes.step.text', 'inputs.scope')
    against a routine or prompt context dictionary, hydrating vaulted scratch `_uri` entries when needed.
    """
    if not isinstance(context, dict):
        return None
    clean_expr = str(path_expr or "").strip()
    if clean_expr.startswith("{{") and clean_expr.endswith("}}"):
        clean_expr = clean_expr[2:-2].strip()
    if clean_expr.startswith("nodes."):
        clean_expr = clean_expr[len("nodes."):]
    elif clean_expr.startswith("inputs.") and "inputs" not in context and "global" in context:
        clean_expr = "global." + clean_expr[len("inputs."):]

    parts = [p for p in clean_expr.split(".") if p]
    if not parts:
        return None

    def _walk(start_obj: Any, segs: List[str]) -> Any:
        cur = start_obj
        for p in segs:
            if isinstance(cur, dict):
                if p in ("text", "content") and p not in cur and cur.get("_uri"):
                    scratch_uri = str(cur["_uri"])
                    is_abs = not ("://" in scratch_uri)
                    active_ctx = ctx or context.get("_ctx")
                    try:
                        if active_ctx is not None:
                            hydrated = active_ctx.vfs.read(scratch_uri, is_absolute_artifact=is_abs)
                        else:
                            with VFSTransaction(sniff_tenant_id() or "default") as vfs:
                                hydrated = vfs.read(scratch_uri, is_absolute_artifact=is_abs)
                        if hydrated is not None:
                            cur[p] = hydrated
                            return hydrated
                    except Exception:
                        pass
                cur = cur.get(p)
            else:
                return None
        return cur

    val = _walk(context, parts)
    if val is None and len(parts) == 1:
        for ns in ("inputs", "global", "sys"):
            ns_dict = context.get(ns)
            if isinstance(ns_dict, dict) and parts[0] in ns_dict:
                val = ns_dict.get(parts[0])
                if val is not None:
                    break
    if isinstance(val, dict) and "text" in val and not clean_expr.endswith((".text", ".parsed", ".items", ".result", ".status")):
        val = val.get("text")
    if isinstance(val, list):
        return ", ".join(str(x) for x in val if x) if val else None
    return val


def interpolate_mustache_chain(template_str: str, context: Dict[str, Any], ctx=None) -> str:
    """
    Single Source of Truth evaluator for `{{ var | sys.fallback | literal }}` placeholders across
    both standalone Prompt resolution (`prompts/resolve`) and Agent DAG routines (`orchestrator.py`).
    """
    if not template_str:
        return ""
    text = str(template_str)
    inputs_map = (context.get("inputs") if isinstance(context, dict) else None) or {}

    def _replace_tag(m: re.Match) -> str:
        inner = m.group(1).strip()
        if any(inner.startswith(p) for p in ("include_prompt", "ymm:", "triple", "UNTIL", "+", "-")):
            return m.group(0)
        segments = [seg.strip() for seg in inner.split("|") if seg.strip()]
        if not segments:
            return m.group(0)
        for idx, seg in enumerate(segments):
            clean_seg = seg[6:].strip() if seg.startswith("macro_") else seg
            if clean_seg in inputs_map and inputs_map[clean_seg] not in (None, "", []):
                return str(inputs_map[clean_seg]).replace("\\n", "\n")
            looked_up = resolve_context_var_path(clean_seg, context, ctx=ctx)
            if looked_up not in (None, "", []):
                return str(looked_up).replace("\\n", "\n")
            if idx == len(segments) - 1 and idx > 0 and not clean_seg.startswith(("sys.", "global.", "inputs.", "nodes.")):
                return seg.strip('\'"').replace("\\n", "\n")
        if len(segments) == 1 and segments[0].startswith("sys."):
            return ""
        return m.group(0) if len(segments) == 1 else ""

    for _ in range(2):
        next_text = _CHAINED_MUSTACHE_RE.sub(_replace_tag, text)
        if next_text == text:
            break
        text = next_text

    protected_tokens: List[str] = []

    def _shield_literal_macros(m: re.Match) -> str:
        inner = m.group(1).strip()
        if inner.startswith(("ymm:", "+", "-")) or "ymm:" in inner:
            idx = len(protected_tokens)
            protected_tokens.append(m.group(0))
            return f"\x00__YMM_LIT_{idx}__\x00"
        return m.group(0)

    shielded = _CHAINED_MUSTACHE_RE.sub(_shield_literal_macros, text)
    interpolated = interpolate_template_variables(
        shielded,
        values=inputs_map,
        resolver=lambda expr: resolve_context_var_path(expr, context, ctx=ctx),
    )
    for idx, tok in enumerate(protected_tokens):
        interpolated = interpolated.replace(f"\x00__YMM_LIT_{idx}__\x00", tok)
    return interpolated


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
            if include_types:
                return []
            return data
        return []

    ctx_manifest = manifest_data.get("ctx", {}) if isinstance(manifest_data, dict) else {}
    vfs_manifest = manifest_data.get("vfs", {}) if isinstance(manifest_data, dict) else {}

    if target_key:
        entry = (
            ctx_manifest.get(target_key)
            if domain == 'ctx'
            else (
                vfs_manifest.get(target_key)
                if domain == 'vfs'
                else (ctx_manifest.get(target_key) or vfs_manifest.get(target_key) or manifest_data.get(target_key))
            )
        )
        if entry is None and ("/" in target_key or "\\" in target_key):
            base_name = Path(target_key).name
            entry = (
                ctx_manifest.get(base_name)
                if domain == 'ctx'
                else (
                    vfs_manifest.get(base_name)
                    if domain == 'vfs'
                    else (ctx_manifest.get(base_name) or vfs_manifest.get(base_name) or manifest_data.get(base_name))
                )
            )
        return _extract(entry or {})

    all_files = set()
    target_partition = (
        ctx_manifest
        if domain == 'ctx'
        else (
            vfs_manifest
            if domain == 'vfs'
            else (vfs_manifest if (manifest_data.get('vfs') or manifest_data.get('ctx')) else manifest_data)
        )
    )
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
    ctx.sync_vfs_barrier()

    current_manifest = ctx.manifest.get("ctx", {})
    active_keys = {filename for filename, entry in manifest_deltas.items() if entry}

    target_repos_set = set(target_repos) if target_repos else None
    for k, v in list(current_manifest.items()):
        if domain_uri_prefix in k and k.endswith(filename_suffix):
            if k in active_keys:
                continue
            if target_repos_set is not None:
                meta = v.get("meta", {}) if isinstance(v, dict) else {}
                entry_repos = set(meta.get("repos") or ([meta["repo"]] if meta.get("repo") else []))
                if not entry_repos or not (entry_repos & target_repos_set):
                    continue
            manifest_deltas[k] = None

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
    clean_fallback = f"{uri.volume}/{uri.path}".strip('/') if uri.volume else uri.path

    best_repo = None
    best_rel_path = ""
    for repo in target_repos:
        r_dir = repo.get("repo_dir")
        if not r_dir:
            continue
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

    return ws_root_path.joinpath(clean_fallback).resolve().as_posix()


@hooks.on('expand_selection')
def hook_expand_selection(items=None, workspace_id=None, gather_only=False, **kwargs):
    if not items:
        return []

    files = []
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
                    is_folder = False
                else:
                    is_folder = uri.is_dir_physical(workspace_id)
            if is_folder:
                if not uri.scheme or uri.scheme == 'vfs':
                    from insetu.core.topology.engine_topology import clamp_uris_to_topology as _clamp_uris_to_topology
                    folder_uri = f"{str(uri).rstrip('/')}/"
                    files.extend(_clamp_uris_to_topology(workspace_id, [folder_uri], expand_dirs=True, gather_only=bool(gather_only)))
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
                elif not uri.scheme or uri.scheme == 'vfs':
                    from insetu.core.topology.engine_topology import clamp_uris_to_topology as _clamp_uris_to_topology
                    files.extend(_clamp_uris_to_topology(workspace_id, [str(uri)], expand_dirs=False, gather_only=bool(gather_only)))
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


def get_repeater_secret(
    ext_name: str,
    workspace_id: str,
    repeater_id: str,
    item_id: str,
    subfield_id: str = "api_key",
    *,
    scope: str,
) -> str:
    """
    SSOT reader for encrypted repeater item secrets stored in .insetu/secrets.json.
    Checks the canonical '{repeater_id}__{item_id}__{subfield_id}' key (and legacy 'endpoint_key__{item_id}' for llm).
    Reads only where set_repeater_secret writes for the same scope: daemon secrets from the default workspace,
    workspace secrets from that workspace alone, so one workspace never reads another's secrets.
    """
    if not ext_name or not item_id:
        return ""
    canonical_key = f"{repeater_id}__{item_id}__{subfield_id}"
    candidate_keys = [canonical_key]
    if ext_name == "llm" and subfield_id == "api_key":
        candidate_keys.append(f"endpoint_key__{item_id}")

    target_wid = "default" if scope == "daemon" else (workspace_id or "default")
    # load_json_config reads through the VFS write cache, so a secret saved moments ago is found before it is flushed.
    sec_path = Path(get_tenant_control_dir(target_wid)) / "secrets.json"
    ext_sec = load_json_config(sec_path.as_posix(), {}).get(ext_name) or {}
    for k in candidate_keys:
        enc_val = ext_sec.get(k, "")
        if enc_val:
            dec = decrypt_secret(enc_val)
            if dec:
                return dec
    return ""


def set_repeater_secret(
    ext_name: str,
    workspace_id: str,
    repeater_id: str,
    item_id: str,
    subfield_id: str,
    plain_secret: str,
    *,
    scope: str,
) -> None:
    """
    SSOT writer for encrypted repeater item secrets in .insetu/secrets.json.
    Stores under the canonical '{repeater_id}__{item_id}__{subfield_id}' key and cleans up legacy keys when cleared.
    """
    if not ext_name or not item_id:
        return
    target_wid = "default" if scope == "daemon" else (workspace_id or "default")
    canonical_key = f"{repeater_id}__{item_id}__{subfield_id}"
    legacy_key = f"endpoint_key__{item_id}" if (ext_name == "llm" and subfield_id == "api_key") else None

    sec_path = Path(get_tenant_control_dir(target_wid)) / "secrets.json"
    raw = load_json_config(sec_path.as_posix(), {})
    ext_sec = raw.setdefault(ext_name, {})
    clean_val = (plain_secret or "").strip()
    if clean_val:
        enc = encrypt_secret(clean_val)
        ext_sec[canonical_key] = enc
        if legacy_key:
            ext_sec[legacy_key] = enc
    else:
        ext_sec.pop(canonical_key, None)
        if legacy_key:
            ext_sec.pop(legacy_key, None)
    save_json_config(sec_path.as_posix(), raw, workspace_id=target_wid)



