def test_selection_expansion_mandate():
    """
    Ensure no backend worker or API route manually parses frontend selection items.
    They must use ctx.expand_selection(items) to prevent polymorphic chunking bugs.
    """
    import re
    import glob
    # Strictly matches 'item['filepath']' or 'item.get('filepath')' to prevent 
    # false positives on VFS event bus payloads which use mutation['filepath']
    manual_parse_pattern = re.compile(r"item\[\s*['\"](?:filepath|folderpath)['\"]\s*\]|item\.get\(\s*['\"](?:filepath|folderpath)['\"]\s*\)")
    violations = []

    # We exclude the SDK itself since it must contain the actual parsing logic
    for filepath in glob.glob('insetu/**/*.py', recursive=True):
        if 'sdk/extension.py' in filepath.replace('\\', '/') or 'engine_hooks.py' in filepath:
            continue

        with open(filepath, 'r', encoding='utf-8') as f:
            for idx, line in enumerate(f, start=1):
                if manual_parse_pattern.search(line):
                    violations.append(f"{filepath}:{idx} -> {line.strip()}")

    assert not violations, "Manual selection parsing detected. You must use ctx.expand_selection(items) instead to prevent polymorphic chunking bugs:\n" + "\n".join(violations)


def test_backend_extension_event_emit_mandate():
    """
    Enforce that extension engine modules (insetu/extensions/*) use ctx.emit()
    instead of importing global hooks and calling hooks.emit().
    """
    import re
    import glob
    banned_pattern = re.compile(r'hooks\.emit\s*\(')
    violations = []
    for filepath in glob.glob('insetu/extensions/**/*.py', recursive=True):
        with open(filepath, 'r', encoding='utf-8') as f:
            for idx, line in enumerate(f, start=1):
                if banned_pattern.search(line):
                    violations.append(f"{filepath}:{idx} -> {line.strip()}")
    assert not violations, "Global hooks.emit() call detected in extension module. Use ctx.emit() instead:\n" + "\n".join(violations)
