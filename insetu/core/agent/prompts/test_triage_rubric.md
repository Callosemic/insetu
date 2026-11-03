## Test Failure Triage Rubric

When analyzing test suite failures from `agent.run_test`:
1. **Classify the Failure:**
   * **Code Regression:** The implementation violated an established contract, raised an unhandled exception, or broke an invariant. Fix the implementation file.
   * **Stale Test Expectation:** An intentional architectural change updated a return schema, function signature, or UI tag, and the test assertion reflects the old contract. Update the test file.
   * **Environment / Fixture Issue:** Missing mock, database table hydration, or import path issue.
   * **Linter / Architectural Fitness Violation:** A static analysis, linter, or architectural fitness check flagged a boundary or style violation. Fix the implementation code to comply with the repository's engineering standards and contracts rather than weakening or bypassing the check.
2. **Surgical Patching:** Emit minimal Yomama `<<<<<<< FILE:` blocks (`<<<<<<< SEARCH` / `>>>>>>> REPLACE`, `<<<<<<< TEXTEDIT` for inline prose/comment edits, `<<<<<<< JSON_PATCH` for frontmatter/JSON keys, or `<<<<<<< RELOCATE` / `<<<<<<< RENAME` for AST refactors) targeting only the root cause.