from pathlib import Path
import os
import re
import io
import tempfile
import subprocess
import shutil
from typing import TypedDict, Optional
from insetu.core.sdk import InSetuExtension
from insetu.core.utils_core import InSetuURI, parse_frontmatter
publish_bp = InSetuExtension(
    'publish',
    __name__,
    title="Document Publishing",
    description="Document compilation via Pandoc (PDF, DOCX, HTML).",
    external_binaries=["pandoc", "pdflatex"],
)
__depends__ = []
@publish_bp.on('vfs_resolve_file')
def resolve_publish_artifacts(ctx, filename=None, workspace_id=None, **kwargs):
    if not filename: return None
    # Strict deterministic boundary: only claim direct basename matches to prevent path hijacking
    if '/' in filename.replace('\\', '/'): return None
    cand = Path(ctx.paths["artifacts_base"]).joinpath(filename)
    if cand.exists():
        return cand.as_posix(), True
    return None
@publish_bp.worker("compile_task")
def _background_compile(ctx, filepath: str, target_format: str = "pdf", job_id: Optional[str] = None):
    label = "HTML Snippet" if target_format == "html_snippet" else target_format.upper()
    ctx.jobs.update_progress(f"Compiling document to {label}...")
    mem_file, download_name = compile_document_payload(ctx.workspace_id, filepath, target_format)
    raw_bytes = mem_file.read()

    paths = ctx.paths
    safe_name = f"{job_id}_{download_name}" if job_id else download_name
    out_path = Path(paths["artifacts_base"]).joinpath(safe_name).as_posix()
    Path(out_path).write_bytes(raw_bytes)

    ctx.jobs.register_ephemeral(out_path, ttl_seconds=3600, owner="publish")
    artifact = {
        "download_url": f"/api/{ctx.workspace_id}/fs/fetch?file={safe_name}&download=1",
        "filename": download_name,
        "format": target_format
    }
    if target_format in ("html_snippet", "html"):
        artifact["snippet_html"] = raw_bytes.decode("utf-8", errors="replace").strip()

    return {
        "message": "Compilation successful.",
        "artifact": artifact
    }
class CompileDocumentPayload(TypedDict, total=False):
    filepath: str
    format: Optional[str]
@publish_bp.route('compile-document', methods=['POST'], request_schema=CompileDocumentPayload, docstring="Compiles a Markdown document into a target format (PDF, DOCX, HTML) using Pandoc.")
def api_publish_compile_document(ctx):
    """Compiles a Markdown document into a target format (PDF, DOCX, HTML) using Pandoc."""
    data = ctx.payload or {}
    filepath = data.get('filepath')
    if not filepath:
        return {"error": "Filepath required"}, 400

    job_id = ctx.jobs.submit("compile_task", filepath=filepath, target_format=data.get('format', 'pdf'), job_category="ui_blocking")
    return {"status": "accepted", "job_id": job_id}, 202
def compile_document_payload(workspace_id, filepath, target_format):
    ctx = publish_bp.get_context(workspace_id)
    chunks = ctx.emit_first('resolve_payload_chunks', uri=filepath, default=[filepath])
    content = ctx.read_compiled_context(filepath)
    if not content.strip():
        raise FileNotFoundError("File not found or empty.")

    resolved_path = ctx.resolve_path(chunks[0] if chunks else filepath)
    if not resolved_path:
        raise FileNotFoundError("Target file path could not be resolved.")
    temp_files = {}
    compiler_flags = []
    strip_macros = []

    try:
        results = ctx.emit('pre_compile_document', filepath=filepath, text=content, target_format=target_format)
        for res in results:
            if res and isinstance(res, dict):
                temp_files.update(res.get('temp_files', {}))
                compiler_flags.extend(res.get('compiler_flags', []))
                if isinstance(res.get('strip_macros'), list):
                    for pat in res['strip_macros']:
                        if pat and pat not in strip_macros:
                            strip_macros.append(pat)
                if isinstance(res.get('text'), str):
                    content = res['text']
    except Exception as e:
        print(f"Warning: Extension middleware failed during document compilation: {e}")

    is_snippet = (target_format == "html_snippet")
    effective_ext = "html" if is_snippet else target_format

    if is_snippet:
        _, body_only, _ = parse_frontmatter(content)
        content = body_only if body_only.strip() else content

    for macro_pat in strip_macros:
        # 1. If macro(s) occupy an entire line by themselves, remove the whole line cleanly
        content = re.sub(rf'^[ \t]*(?:{macro_pat}[ \t]*)+(?:\r?\n|$)', '', content, flags=re.MULTILINE)
        # 2. If macro is inline with prose, replace the macro token itself with blank
        content = re.sub(rf'{macro_pat}[ \t]*', '', content)

    if is_snippet:
        content = content.strip() + "\n"

    temp_dir = tempfile.mkdtemp()
    try:
        in_filename = "input.md"
        in_path = Path(temp_dir).joinpath(in_filename).as_posix()
        Path(in_path).write_text(content, encoding='utf-8')

        for filename, file_content in temp_files.items():
            Path(temp_dir).joinpath(filename).write_text(file_content, encoding='utf-8')
        out_filename = f"compiled_output.{effective_ext}"
        out_path = Path(temp_dir).joinpath(out_filename).as_posix()

        if is_snippet:
            cmd = ['pandoc', in_path, '-f', 'markdown', '-t', 'html', '--wrap=none', '--no-highlight', '-o', out_path]
        else:
            cmd = ['pandoc', in_path, '-o', out_path]
            cmd.extend(compiler_flags)

        try:
            res = ctx.exec.run(cmd, cwd=str(temp_dir))
        except FileNotFoundError:
            raise RuntimeError("Pandoc is not installed or not in PATH.")

        if res.returncode != 0:
            err_msg = res.stderr.strip()
            if "pdflatex not found" in err_msg.lower():
                err_msg += " (Please install a LaTeX engine like MacTeX, MiKTeX, or TeX Live to generate PDFs)."
            raise RuntimeError(f"Pandoc failed: {err_msg}")
        file_data = Path(out_path).read_bytes()

        if is_snippet:
            html_str = file_data.decode('utf-8', errors='replace')
            # Strip Pandoc auto-generated heading IDs so Substack/Medium editors ingest clean semantic tags
            html_str = re.sub(r'(<h[1-6])\s+id="[^"]*"([^>]*>)', r'\1\2', html_str)
            file_data = html_str.strip().encode('utf-8')

        mem_file = io.BytesIO(file_data)
        mem_file.seek(0)
        safe_basename = Path(resolved_path).name.rsplit('.', 1)[0]

        return mem_file, f"{safe_basename}.{effective_ext}"

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)