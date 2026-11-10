---
title: "Alternate Engines: Cloud Workspaces, Offline Capability Handlers, Python in the Browser and a Frontend-Only Deployment"
doctype: plan
status: discussion
created: 2026-11-08
roadmap: [P15]
depends_on: [S6, "God objects Wave 2", "T9", "P13 Phase 2"]
---

# Alternate Engines: Cloud Workspaces, Offline Capability Handlers and Python in the Browser

A discussion stub, not a blueprint. It records the direction agreed on 2026-11-08 and the questions still open.

## Roadmap placement (2026-11-08)

- **Review-ready and 1.0:** nothing. The capability resolver is a new SDK contract, and the extension SDK is experimental at 1.0.
- **After 1.0:** parts 1 to 3 below, in the order given; part 4 is speculative and unscheduled. Part 1 needs S6 and akasa's driver API settled by God-objects Wave 2. Part 2 builds on T9's versioned cache and the outbox. Part 3 follows part 2.

## The question

Can a call the frontend makes be answered by something other than the local insetu server? Two cases prompted it:

1. **A cloud-only workspace** whose repositories live on GitHub or another online file store rather than on a local disk.
2. **Extensions that take over a capability offline**, beyond serving cached files: for example listing notes from the browser's own store while the server is unreachable.

## Direction

### 1. Cloud workspaces: a VFS driver on the server, not a backend in the browser

Almost everything the frontend calls is server code: the bridge, gather and context packs, the cartographer, topology, routines, hooks, git and the terminal. Rewriting that in JavaScript would create a second copy of most of insetu.

The existing seam is akasa's VFS driver, which already mounts drivers behind `vfs://` (the template overlay driver is one). A remote-store driver (GitHub contents and trees API for reads; commits or a working branch for writes) makes a cloud workspace an ordinary insetu instance whose repositories are remote. Run that instance in the cloud and the frontend does not change. This matches the decision that multi-tenant means one insetu per tenant.

- **Exposure:** an internet-facing instance needs S6's paired-device tokens or a login before it exists.
- **Capabilities that need a local machine** (hooks, the terminal, anything that runs a command) are declared unavailable for a remote workspace, not left half-working.

### 2. Offline capability handlers: one resolver in the page, declared per capability

- **One seam, keyed by capability ID.** Every frontend call names a route that maps to a capability ID (`hooks/list` is `hooks.list`). A resolver in `api.js`, in front of the network call, picks an engine for each call: the server, a declared client handler, or the outbox.
- **Declared in the extension manifest,** for example `offlineHandlers: { 'notes.list': fn }` in `registerExtension`, so every takeover is visible and reviewable. Nothing is intercepted silently.
- **Reads may be answered locally; writes go to the outbox.** A handler may answer a read from SutramDB. A write is queued and replayed through the server's normal save when the connection returns, so the server stays the authority and there is one write path.
- **The same response shape.** A handler's result is checked against the capability's `response_schema`, so a caller cannot tell the engines apart.
- **Never for human-only or protected capabilities:** approvals, protected files and credentials have no client handler.
- **Parity:** a handler that repeats server logic, rather than reading cached data, is a parallel pair and is registered in `tests/parity/`.
- **In the page, not the service worker.** The service worker sees only HTTP, lives on its own schedule and is the hardest place to debug; it stays a cache.

### 3. Python in the browser (Pyodide) as an engine behind the same resolver

Running insetu's own Python in the browser through Pyodide is acceptable (decided 2026-11-08). It is the same code, not a second implementation, so it is not a parallel pair and needs no parity entry. What stays ruled out is bespoke WebAssembly or a transpiled shared core: new code written to run in two places.

- **Which capabilities.** Pure-Python, stdlib-only code ports most easily: the bridge core (`parser.py`, `bridge_fuzzy.py`, the `FileTimeline` transaction), the three-way merge, template interpolation and routine graph ordering. Anything built on Flask, threads, subprocesses or the host's SQLite files stays on the server.
- **How it plugs in.** A Pyodide engine registers client handlers for the capabilities it can run, through the same resolver as part 2, with a VFS adapter onto SutramDB (offline) or a remote-store driver (cloud).
- **Cost.** The Pyodide runtime is several megabytes and takes seconds to start. It is downloaded once into the versioned cache (T9) and started only when a capability needs it, never on the boot path.
- **A side benefit.** Where the browser runs the server's own Python, the matching JavaScript twin can be deleted, which shrinks the parallel-logic registry.

### 4. Frontend-only deployment (very speculative)

Recorded 2026-11-08 as a possibility, not a commitment; its usefulness is not yet clear. Once parts 2 and 3 exist, the same frontend build could be served from static hosting (GitHub Pages, any CDN) with no insetu server at all: the resolver sends every call to the Pyodide engine, and files live in the browser (OPFS) or in a remote store reached directly from the page (the GitHub API).

- **What would carry over:** the editor, the bridge, the merge, templates and routine graph ordering; the SQLite-backed parts (Pyodide includes `sqlite3`, against a database kept in the browser); and web-chat routines (`transport: manual`), which need no API keys, so the paste-into-a-chatbot workflow is the natural fit.
- **What would not exist:** hooks, the terminal, the git command line (the GitHub API instead), and anything else that runs a command on a machine.
- **A JavaScript agent harness** is the interesting possibility here: an agent loop running in the page, calling a model API from the browser and using the capabilities the resolver can answer as its tools. Whether that loop is the existing Python orchestrator under Pyodide or something written for the browser is open; the second would be a parallel implementation of the orchestrator and falls under the parallel-logic rule.
- **To settle before it could exist:**
    - **Signing in to a remote store.** GitHub's OAuth flows need a server-side step (a client secret or a token-exchange proxy), because the token endpoints do not allow calls from a web page. A static deployment would take a pasted fine-grained token, or run one small token-exchange function as its only server-side piece.
    - **Model API keys in the browser.** A direct model call means the key lives on the device: in the device settings tier with care, or the deployment stays web-chat only.
    - **Trust in the hosted code.** People would run whatever the host serves, so the deployment needs a strict Content Security Policy and pinned, verifiable builds (T9's build IDs help).

## Open questions

1. **Writes from a cloud workspace.** Commit each save, or keep a working branch and commit on closeout? How do the bridge's undo ledger and a remote history relate?
2. **Credentials for a remote store.** Where does the GitHub token live for a cloud instance, and is it per workspace or per person? (S9 covers secrets on a local instance.)
3. **Which offline handlers first.** Notes and tracker reads are the likely first candidates; the bridge dry run through Pyodide would be the first part-3 capability.
4. **Pyodide packaging.** Which Python files are shipped to the browser, how they are versioned with the frontend build, and how the browser engine reports a capability it cannot run.
5. **Conflicts on replay.** Outbox writes replayed after a long offline period depend on the three-way merge, so this waits for issue #18.
