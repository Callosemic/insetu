from pathlib import Path
import os
import io
import tempfile
import subprocess
import shutil
from flask import jsonify
from insetu.core.sdk import InSetuExtension
from insetu.kernel.workers import register_ephemeral_artifact

publish_bp = InSetuExtension(
    'publish',
    __name__,
    title="Document Publishing",
    description="Document compilation via Pandoc (PDF, DOCX, HTML)."
)
__depends__ = []

@publish_bp.worker("compile_task")
def _background_compile(ctx, filepath, target_format, job_id=None):
    ctx.jobs.update_progress(f"Compiling document to {target_format.upper()}...")
    mem_file, download_name = compile_document_payload(ctx.workspace_id, filepath, target_format)

    paths = ctx.paths
    safe_name = f"{job_id}_{download_name}" if job_id else download_name
    out_path = Path(paths["artifacts_base"]).joinpath(safe_name).as_posix()
    Path(out_path).write_bytes(mem_file.read())

    register_ephemeral_artifact(out_path, "publish", 3600, workspace_id=ctx.workspace_id)

    return {
        "message": "Compilation successful.",
        "artifact": {
            "download_url": f"/download/{safe_name}",
            "filename": download_name
        }
    }

@publish_bp.route('compile-document', methods=['POST'])
def api_publish_compile_document(ctx):
    data = ctx.req.json or {}
    filepath = data.get('filepath')

    if not filepath:
        return jsonify({"error": "Filepath required"}), 400

    job_id = ctx.jobs.submit("compile_task", filepath=filepath, target_format=data.get('format', 'pdf'))
    return jsonify({"status": "accepted", "job_id": job_id}), 202

def compile_document_payload(workspace_id, filepath, target_format):
    import re
    ctx = publish_bp.get_context(workspace_id)

    responses = ctx.emit('resolve_payload_chunks', uri=filepath)
    chunks = next((r for r in responses if r), [filepath])
    content = ""
    for c in chunks:
        is_sys = c.startswith("ctx://")
        c_text = ctx.vfs.read(c, is_absolute_artifact=is_sys)
        if c_text:
            content += c_text + "\n\n"

    if not content.strip():
        raise FileNotFoundError("File not found or empty.")

    resolved_path = ctx.resolve_path(chunks[0] if chunks else filepath)

    temp_files = {}
    compiler_flags = []

    try:
        results = ctx.emit('pre_compile_document', filepath=filepath, text=content)
        for res in results:
            if res and isinstance(res, dict):
                temp_files.update(res.get('temp_files', {}))
                compiler_flags.extend(res.get('compiler_flags', []))
    except Exception as e:
        print(f"Warning: Extension middleware failed during document compilation: {e}")

    temp_dir = tempfile.mkdtemp()
    try:
        for filename, file_content in temp_files.items():
            Path(temp_dir).joinpath(filename).write_text(file_content, encoding='utf-8')

        out_filename = f"compiled_output.{target_format}"
        out_path = Path(temp_dir).joinpath(out_filename).as_posix()

        cmd = ['pandoc', resolved_path, '-o', out_path]
        cmd.extend(compiler_flags)

        try:
            res = subprocess.run(cmd, capture_output=True, text=True)
        except FileNotFoundError:
            raise RuntimeError("Pandoc is not installed or not in PATH.")

        if res.returncode != 0:
            err_msg = res.stderr.strip()
            if "pdflatex not found" in err_msg.lower():
                err_msg += " (Please install a LaTeX engine like MacTeX, MiKTeX, or TeX Live to generate PDFs)."
            raise RuntimeError(f"Pandoc failed: {err_msg}")
        file_data = Path(out_path).read_bytes()

        mem_file = io.BytesIO(file_data)
        mem_file.seek(0)
        safe_basename = Path(resolved_path).name.rsplit('.', 1)[0]

        return mem_file, f"{safe_basename}.{target_format}"

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)