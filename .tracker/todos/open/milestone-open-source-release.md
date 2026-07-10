---
repo: "insetu"
type: "todo"
status: "open"
id: milestone-open-source-release
title: "Milestone: Open Source Release Prep"
created_at: 2026-07-02T09:18:30
closed_at: null
sub_bucket: "None"
delivery_date: "2026-10-04"
tags: ["Epic"]
---
# Open Source Release Prep

Prepare the inSetu Developer OS for a public launch under the Callosemic GitHub organization. The repository must not be made public until it is robust enough to survive the "First Impression Fragility" of external developers.

### Pre-Launch Checklist
- [ ] **Tech Debt Cleared:** Complete `Phase 1.5` to ensure hardcoded physics are removed and the OS can boot cleanly in any environment.
- [ ] **Kernel Panic Protection:** Ensure the two-file Immutable Recovery Bootloader and Lifeboat FS are active so external users don't instantly brick their workspace on their first LLM hallucination.
- [ ] **The Magic Bridge:** Complete the `Phase 5` Accordion Fuzzy Engine. The bridge must absorb whitespace and line-wrapping errors natively to provide a "magical" DX (Developer Experience).
- [ ] **Onboarding DX (`insetu init`):** Build a basic CLI command or setup script that automatically scaffolds a `.insetu/profiles/default/config.json` file for first-time users.
- [ ] **Documentation:** Write a comprehensive `README.md` detailing the Unidirectional Data Flow, the Yomama Patch Protocol syntax, and how to define target configurations.
- [ ] **Sanitization:** Audit the codebase one final time to ensure no proprietary Callosemic/Axoneme magic strings, tokens, or local paths are hardcoded.