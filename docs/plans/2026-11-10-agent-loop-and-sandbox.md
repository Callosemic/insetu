---
title: "Plan: Agent Loop and Sandbox"
description: "One plan for what 'the agent works' means: a run takes a task and returns a staged Yomama stack, a transcript and a result; edits stage in a sandbox and are tested in a scratch worktree; nothing is written until a person approves. Brings together roadmap P1, P18 and P19."
status: "draft"
created: "2026-11-10"
models:
  - "vfs://insetu/docs/models/agent_orchestrator_and_rag.md"
  - "vfs://insetu/docs/models/yomama_bridge.md"
---

# Plan: Agent Loop and Sandbox

Draft by Claude, 2026-11-10. Questions marked **OPEN** are yours to answer; dictate the answers and delete the markers.

## Roadmap placement (2026-11-10)

- **b) Demo ready (minimum):** Sprints 0 to 3. Stage and approve only; no unattended mode.
- **c) 1.0:** Sprint 4 (unattended runs to a run branch, merge on a yes, after S5; tests needing the terminal after S7) and Sprint 5 (golden tasks in CI).
- **Prerequisites:** Sprint 0 (git in core) before Sprint 1; the merge fix (issue #18) before Sprint 2's rebase; Wave 3.2 (splitting `orchestrator.py`) lands with Sprint 1.
- **Replaces:** the separate P18 design note asked for in Gemini's Nov 9 brief, and issue #19.

## Principle and layers

inSetu's sophistication lives in its data shapes, routines and orchestration. The agent is nothing fancier than a person in the loop who is not in the loop as often. (Decisions, 2026-11-09.)

| Layer | Owns | Who picks the next step |
| --- | --- | --- |
| Yomama | The write path: apply, dry run, repair, protected changes, undo. Knows nothing about models. | Nobody; it executes. |
| Chat | A conversation; each turn is a one-step run ending in a staged stack. | The person. |
| Agent | A run that continues across steps until its contract says stop. | The model, inside the contract. |

Every writer (a person, chat, an agent, Gemini through the web) goes through Yomama. An agent can write nothing a person could not review, approve and undo through the same path.

**Routines and agents are one thing.** A routine is steps a person declared. An agent is a routine with one loop step whose next action the model picks, ending at the routine's `until:`, which is the done test. This builds on the routine grammar (Vector A of the routine compiler stub) rather than adding a second system. Chat is the same machinery with a loop of one.

### The run contract

Approved by the person before the run edits anything:

1. **Goal:** what to change, in words. The only field the person must write.
2. **Done test:** what proves it is finished: named tests that should pass, or a short checklist the run reports against. This defines success; budgets only bound the attempt.
3. **Scope:** the repositories and paths it may touch, and the capabilities it may use (S5's risk classes).
4. **Budgets:** steps, tokens, wall time, test runs, all with defaults. Running out stops the run with a request for more, which is a checkpoint the person answers; a run never extends itself.
5. **Checkpoints:** where it must stop for the person: always before commit, and on any protected file or banned capability.

The run proposes the done test and scope in its plan step; the person approves or edits the contract, then editing starts. The person approves intent before code.

### Standing contracts (decided 2026-11-09)

A routine may carry a standing contract, approved once, so a scheduled or hook-started run needs no approval at start. A standing contract can never include anything executable:

- **Allowed:** reading, gathering and searching; writing non-code outputs through Yomama (reports, `ctx://` contexts, tracker records, sorting or moving documents and data files); reviewing the code base periodically for a stated reason; **staging** code changes for later approval.
- **Never:** committing a change to code; running commands, tests, hooks or previews; any capability outside S5's read-only and non-code classes.
- **Code means** anything the topology classifies as source, configuration, scripts or hook rules (the languages registry decides), plus every protected file. Everything else is non-code.

Staged code from a standing run waits in the run manager for a person's yes, like any other stack.

**OPEN:** sorting non-code files still writes to disk unattended. Should each standing run's non-code writes also wait for approval the first time a routine runs, until you trust it, or commit straight away (undoable through Yomama)?

### The run manager

Where runs live, like a CI runs page rather than a separate product: runs that are running, staged, stopped or failed, each with its contract, budget used, transcript and stack, and the actions approve, resume, extend and cancel. Unattended runs started by a schedule or a hook appear here too. It grows out of Routine Studio and the chat's Staged Patch Stacks.

## 1. What a run is

A **run** takes a task and returns three things:

1. **A staged stack:** every edit the run wants, as Yomama cells grouped by file, shown in the chat's Staged Patch Stacks. Nothing is on disk until a person approves.
2. **A transcript:** one file per run with each step's prompt (scrubbed), the reply, the tool calls, test output and repairs. It's enough to understand or resume the run.
3. **A result:** `staged` (ready for approval), `stopped` (a budget or stop condition, with the reason) or `failed` (with the error).

A chat turn that proposes patches is a run of one step. A routine is a run whose steps are declared. An agent task is a run whose steps the model chooses. All three share this one mechanism.

**OPEN:** does a run belong to a chat session (one run per turn) or can it span turns ("keep going")?

## 2. The loop

Steps, each recorded in the transcript:

1. **Plan:** restate the task, list the files to read and the files likely to change, and name the tests that should prove it.
2. **Gather:** the six-bucket envelope and retrieval units (six-bucket plan Sprints 2 and 3). Requests for more files ("I need these files too") are clamped to the topology, as today.
3. **Edit:** the model emits Yomama cells; they apply to the sandbox, not the disk (section 3).
4. **Test:** run the named tests in the scratch worktree.
5. **Triage and fix:** on failure, feed back the failure, then edit again. Repairs (section 4) happen here.
6. **Stop:** when tests pass, a budget runs out, or a stop condition hits.

**Budgets** (per run; defaults in agent settings, overridable per routine): steps, tokens, wall time, test runs. Six-bucket Sprint 5's loop circuit breakers are the mechanism: one set of limits, not two.

**Stop conditions:**
- the same failure twice after a fix;
- an edit to a protected file (it stages as a protected change, and the run stops for the person);
- a request for a capability the run may not use (S5 risk classes, `ROUTINE_BANNED_CAPABILITIES`);
- the person cancels.

**OPEN:** default budgets. Suggestion: 25 steps, 120k tokens, 15 minutes, 5 test runs, matching today's `DEFAULT_STEP_BUDGET` and `DEFAULT_TOKEN_BUDGET`.

**OPEN:** does Plan always run, or only for tasks above a size? A one-file fix doesn't need a plan step.

## 3. The sandbox

- **Staged buffers.** Each applied cell updates an in-memory buffer per file, the same post-valid buffers the bridge dry run already keeps. Later steps read the staged version of a file, not the disk version.
- **Scratch worktree for tests.** Before a test step, materialise the stack in a `git worktree` of the repository at the run's base commit plus uncommitted disk state, write the staged buffers into it, and run the tests there. Real files and real runners; deleted when the run ends. Decided 2026-11-09 (not a VFS overlay).
- **Stale stacks.** If the disk changes under a staged file before approval, rebase that file's cells onto the new disk with the three-way merge. A conflict shows on the cell and needs the person. This waits for issue #18.
- **Approval.** Per stack, per file or per patch, from the Staged Patch Stacks. Approval commits through the normal bridge path (protected changes, attestations, undo). The commit applies exactly what was staged, using only deterministic repair (as Confirm & Commit does since the Nov 9 audit).
- **Surviving a reboot.** The stack, buffers and transcript are saved under the session (`.insetu/data/agent/runs/<run_id>/`), so a run reloads as `staged` after a restart. The worktree is rebuilt on demand.

**OPEN:** should the worktree also hold the repository's untracked files (for example a local `.env`), or only tracked files plus staged edits? Suggestion: tracked files plus staged edits only; a test that needs local config says so in the stop reason.

**OPEN:** with several repositories in one run, is it one worktree per repository, run together?

## 4. Repair inside the sandbox

- Deterministic repair (anchoring, re-indenting, the sandwich fuzzy anchor) and AI repair run as micro-steps when a cell fails to apply. Their output replaces the cell in the stack, and the cell is marked "repaired" with the original kept, so the person sees what changed.
- AI repair is never applied at commit time, only inside the run.
- Each repair is recorded in `bridge_heal_audit` and the transcript.

## 5. Helper modes (P19)

`helper_mode` is `ai_assisted` (default), `deterministic` or `custom`. Custom sets each helper on its own:

| Helper | Where it plugs in | Deterministic | AI-assisted |
| --- | --- | --- | --- |
| Context scout | Gather (step 2) | blast radius | LLM scout |
| History compaction | Between runs in a session | micro-receipts | LLM compactor |
| Patch repair | Edit and fix (steps 3 and 5) | algorithmic | AI repair |

- One server function returns the effective three. With no API key, or when the key hits its quota or rate limit, it returns deterministic for that turn and posts a notice.
- The Yomama (Bridge) page's repair mode is separate and never reads `helper_mode`.

## 6. Modes, the standard way, and unattended runs

An agent has to work the way people expect agents to work; security is how inSetu does it, not a reason to do less (Decisions, 2026-11-09). The common modes, and inSetu's version of each:

| Mode | What people expect | inSetu |
| --- | --- | --- |
| Ask | Each change shown for approval | The default: the run stages; the person approves per stack, file or patch. |
| Accept edits | Edits land in the working tree; commands still ask; git undoes | **OPEN:** offer it? It would apply staged code to the working tree without a yes (undoable through Yomama and git), which goes past "no code without a yes". Suggestion: offer it only for a run the person started and is watching, never for standing contracts. |
| Background | The agent works on its own branch and hands back a reviewable result | Unattended runs: commits go to the run's own branch; merging into your branch needs a yes. |

### Unattended runs (1.0, after S5)

"Unattended" means the work happens without the person; it never means code reaches the person's branch without them. Five layers:

1. **Commit is not merge.** An unattended run commits to its own branch (`insetu/run/<id>`), never the branch being worked on. The person gets a notice and the diff; merging needs a yes. Merging without a yes, for very narrow classes, is a later option, not a default.
2. **Contained execution** (Sprint 2; applies to attended runs too, since tests run staged code before approval): the strictest `child_env` class with no secrets; no network by default; timeouts and process-tree kills; later, its own user or a container so it cannot read the home directory.
3. **The run cannot grade itself.** It may not edit the tests that make up its done test, and any test change it makes is flagged. Beyond the named tests, the full unit and fitness suites and a secret scan must pass. An independent review pass (a fresh context without the run's reasoning) reads the diff against the contract and must agree.
4. **Narrow scope.** Paths from the contract's allowlist only; never protected files, dependency manifests, CI, hooks, build scripts or anything that runs at install or build time; no new dependencies; a cap on diff size (files and lines).
5. **Trust per routine.** A routine starts attended. After N runs approved without changes it may run unattended within the same scope; any rejection or revert resets the count. Trust belongs to "this routine on this repository", never to "the agent".

Standing contracts stay as decided: they run nothing executable, including tests, so they only stage code and never reach a run branch on their own (section above).

**OPEN:** N, the number of clean approvals before a routine may run unattended. Suggestion: 5.

**OPEN:** the diff size cap. Suggestion: 10 files and 400 changed lines.

## 7. Sprints

### Sprint 0: Git in core, and the extension renamed Bonsai (before Sprint 1)
Decided 2026-11-09: runs need base commits, worktrees, run branches, merge and revert, so git plumbing moves into core and the extension keeps the workflow.
- [ ] `insetu/core/git/`: one `run_git` on `child_env` and `execute_binary`, plus typed operations. What core uses today: status, `HEAD:` blob, `ls-files`, `check-ignore`, repository root. What runs need: worktree add and remove, base commit, commit to a run branch, merge, revert.
- [ ] Move the six direct `git` calls in core (the cartographer, `engine_fs.py`, topology) onto it; a fitness rule bans the `git` binary anywhere else.
- [ ] Git becomes a stated requirement: `insetu serve` checks for it at startup; runs refuse a workspace that is not a git repository, with a clear message.
- [ ] Topology no longer runs `git init` silently on a mounted folder (issue #20): it offers to, or posts a notice.
- [ ] Rename the git extension to Bonsai (the panel, sweep, push, pull, remotes, checkout, diff compilation, session routines and prompts) and rebuild it on the core module.
- [ ] The rename carries a migration, with the old names kept as aliases for one release: the extension id in `config.json`, its settings scope, the `git.*` capability ids (including the orchestrator's allowlists and MCP tool names), and prompt URIs under `ctx://prompts/.templates/git/` (25 routines point at `close_session_protocol.md` there).
- Done when: no core module calls `git` directly, Bonsai works from an existing workspace with no manual edits, and Claude has reviewed the core module's interface (the agent's safety rests on it).

**Name (decided 2026-11-09):** the extension becomes **Bonsai** (id `bonsai`; shaping branches). Its UI label is "Bonsai · Source Control", and the README and REVIEWING.md introduce it once as "Bonsai, the source-control extension", so the front door stays plain (R6). If it ever ships as its own package, check PyPI and npm for the name first.

### Sprint 1: Runs and the staged stack (with Wave 3.2)
- [ ] A `Run` record (id, contract, status, budgets used, base commit) and its folder under `.insetu/data/agent/runs/`.
- [ ] The run contract: proposed in the plan step, approved or edited by the person before any edit; a chat turn gets an implicit one-step contract.
- [ ] Agent and routine `bridge.sync` steps apply to staged buffers; nothing reaches disk before approval.
- [ ] The Staged Patch Stacks show the run's stack; approval commits through the bridge.
- [ ] The transcript file.
- [ ] Undo follows the run: a stack committed with Confirm & Commit records its transaction on the run and session, so `/undo` reverts it (today `agent.undo` only knows turns that committed themselves).
- [ ] Wave 3.2: split `orchestrator.py` along the run's seams (planning, gathering, editing, testing, stopping).
- Done when: a chat turn and a routine both end as a staged stack that commits on approval, and the transcript explains each step.

### Sprint 2: The scratch worktree and stale stacks
- [ ] Materialise the stack in a `git worktree`; run named tests there; clean up.
- [ ] Contained test runs: the strictest `child_env` class (no secrets), no network by default, timeouts and process-tree kills.
- [ ] Rebase stale files with the three-way merge (after #18); conflicts shown on the cell.
- [ ] Reload `staged` runs after a restart.
- Done when: a test that fails on disk and passes with the staged edits is reported as passing, the disk is unchanged until approval, and a disk edit during the wait rebases or shows a conflict.

### Sprint 3: The loop
- [ ] Plan, test, triage and fix steps; budgets and stop conditions (six-bucket Sprint 5's breakers).
- [ ] Repairs as marked micro-steps (section 4); P19's helper resolution.
- [ ] The agent as a routine: a loop step whose next action the model picks, ending at `until:` (the done test), on the Vector A grammar.
- [ ] The run manager: runs by status with contract, budget used, transcript and stack; approve, resume, extend, cancel.
- Done when: the golden tasks (Sprint 5) pass locally against a live model.

### Sprint 4: Unattended runs (1.0, after S5)
- [ ] Run branches (`insetu/run/<id>`), a notice with the diff, and merge on a yes.
- [ ] The self-grading guards: protected done-test files, the full suites and a secret scan, and the independent review pass.
- [ ] Scope checks (path allowlist, no manifests, CI, hooks or build scripts, no new dependencies, diff cap) and the per-routine trust count.
- Done when: a golden task runs unattended to a branch, passes every guard, and merges only on a yes; a task that edits its own done test is refused.

### Sprint 5: Golden tasks in CI
- [ ] A fixture repository with five or so fixed tasks: a one-line fix, a two-file change, a fix whose first attempt fails a test, a patch that needs repair, a protected-file edit that must stop.
- [ ] Each task replayed in CI with a recorded model (saved replies), so it checks the plumbing deterministically, not the model's quality.
- Done when: all golden tasks pass in CI, and the same tasks make the agent demo repeatable.

**OPEN:** which five tasks? Real ones from your history make the best fixtures.

## 8. What this plan does not do

- No new agent powers: terminal commands, web fetch and preview launch stay where S5, S7 and S9 put them.
- No multi-agent or best-of-N runs (see the 11-09 agentic frontiers brainstorm, after 1.0).
- No changes to the Yomama protocol itself.
