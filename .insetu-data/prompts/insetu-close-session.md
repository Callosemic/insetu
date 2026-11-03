{{include_prompt: ctx://prompts/.templates/git/close_session_protocol.md
{
guardrail_rules:"- **Single Source of Truth (SSOT) & DRY Centralization:** Ensure shared logic, schemas, and configurations exist in one canonical place (`utils_core.py`, `insetu_sdk.js`) without duplicate helpers.\n- **Membrane & VFS Confinement:** Verify strict SDK membrane isolation, canonical URI usage (`vfs://`, `ctx://`, `ws://`), and VFS write-path boundaries.\n- **Unidirectional Data Flow (UDF):** Ensure UI components subscribe to Zustand stores via selector slices rather than reading state from the DOM.\n- **Non-Blocking I/O & Process Confinement:** Ensure heavy work runs off-thread in background workers and subprocesses use `child_env()` confinement."
}
}}
