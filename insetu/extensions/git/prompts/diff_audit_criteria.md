## Pre-Commit Diff Audit Criteria

When auditing `ctx://diffs/*_diffs.txt` payloads before committing:
1. **Correctness & Edge Cases:** Verify all modified functions preserve existing return contracts and handle null/empty inputs safely.
2. **Security & Hygiene:** Flag any hardcoded credentials, debug print statements, or unintended file deletions.
3. **Architectural Alignment:** Confirm imports respect tier boundaries and `CODE_INDEX.md` comments remain accurate.