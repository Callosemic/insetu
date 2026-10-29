## Test Failure Triage Rubric

When analyzing test suite failures from `agent.run_test`:
1. **Classify the Failure:**
   * **Code Regression:** The implementation violated an established contract, raised an unhandled exception, or broke an invariant. Fix the implementation file.
   * **Stale Test Expectation:** An intentional architectural change updated a return schema, function signature, or UI tag, and the test assertion reflects the old contract. Update the test file.
   * **Environment / Fixture Issue:** Missing mock, database table hydration, or import path issue.
   * **Architectural Fitness Violation (`tests/fitness/`):** A static AST or regex rule flagged a violation (e.g., `DIRECT_ROUTE_FUNCTION_CALL_BAN` when calling a `@bp.route` function directly instead of `ctx.call("<ext>.<action>", ...)`, `AKASA_MEMBRANE_ISOLATION`, `FLASK_TRANSPORT_LEAK_BAN`, or `VFS_CONSTRAINT_BYPASS`). Fix the violating code to comply with the architectural contract rather than weakening the fitness rule.
2. **Surgical Patching:** Emit minimal Yomama `<<<<<<< FILE:` blocks (`<<<<<<< SEARCH` / `>>>>>>> REPLACE`, `<<<<<<< TEXTEDIT` for inline prose/comment edits, `<<<<<<< JSON_PATCH` for frontmatter/JSON keys, or `<<<<<<< RELOCATE` / `<<<<<<< RENAME` for AST refactors) targeting only the root cause.