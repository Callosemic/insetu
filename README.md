# 🌉 inSetu: a local-first workbench for coding with LLMs
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![PyPI](https://img.shields.io/pypi/v/insetu.svg)](https://pypi.org/project/insetu/)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](pyproject.toml)

**inSetu turns a set of local repositories into context any LLM can use, applies the model's patches to disk safely, and enforces the architecture with executable rules, so a person stays in charge of every change.**

You run it on your own machine as a small Python daemon with a browser UI. Instead of pasting code back and forth, you:

1. compile the relevant parts of your repositories into one context file;
2. hand that context to any model, through inSetu's own gateway or a chat window you already use;
3. paste the model's reply back. inSetu's patch engine applies it, but only if every edit anchors unambiguously and the result still parses. It commits atomically and records an undo entry.

The name joins *in situ* ("in place") with *setu* (सेतु, Sanskrit for "bridge").

**Demo:** [3-minute video](https://youtu.be/FDgL6jveMHo?si=h35FuW_WC0VO1Wox) of inSetu editing one of its own extensions: context gathering, the Yomama patcher, the virtual file system and prompt templates.

| | |
| :--- | :--- |
| **Status** | Beta (`0.x`), in daily use by its author. Single-user by design. |
| **Stack** | Python 3.10+, Flask, SQLite (WAL), Lit Web Components through browser import maps (no bundler), CodeMirror 6 |
| **Repositories** | inSetu (this application), [akasa](https://github.com/Callosemic/akasa) (the Python kernel underneath), [sutram](https://github.com/Callosemic/sutram) (the UI component chassis) |
| **Install** | `pipx install "insetu[all]"`, then `insetu serve` |

## Engineering highlights

Where to look if you are reviewing the code:

* **A patch engine that refuses to guess.** The Yomama bridge anchors each `SEARCH` block with two-tier fuzzy matching, rejects any anchor that matches more than one place, heals common model output artifacts, and validates Python, JavaScript and JSON before it writes. A batch commits atomically, and an undo ledger keeps every change. See `insetu/core/bridge/` and `tests/unit/test_bridge_anchor_invariants.py`.
* **Saves that survive concurrent editors.** Every save carries the hash of the version it started from. Disjoint edits merge three-way against that ancestor; a true collision returns `409` and writes a conflict file instead of losing work.
* **Architecture as executable rules.** An AST fitness suite of more than a hundred named rules rejects drift statically. It checks import membranes between tiers, a declared scope on every setting, workspace writes outside the bridge, raw environment copies for child processes, unvetted outbound requests, and ratchets that only allow some patterns to shrink. CI runs all three repositories together on Python 3.10 to 3.12, against both their `main` branches and their latest releases.
* **A security model that is tested, not assumed.** One test boots the real app and probes every route (over 270), with and without the session token. Agents, routines and MCP clients can propose shell commands, but a command runs only after a person approves that exact command through a route they cannot reach. Repository code runs with credential-like variables stripped from its environment, and outbound requests go through one fetch policy that blocks private addresses. Nothing is downloaded and executed at runtime. See [Security model](#security-model).
* **Declarative agents.** Routines are Markdown files compiled to DAGs. A restricted AST evaluator (no `eval`) decides branch conditions, and oversized node output is vaulted rather than pushed into the next prompt. The same capabilities are exposed over HTTP and the Model Context Protocol, each with its own exposure flag.
* **Context that knows the repository.** A topology ledger tracks every file and honors `.gitignore`. The Cartographer keeps a generated `CODE_INDEX.md` architectural map up to date. A repository can declare where its standards, contracts, ADRs and tests live in `.insetu-data/settings/topology.md`, so context and routines find them without per-repository wrappers.
* **A way back in when it breaks.** If the main app cannot boot, a standard-library-only recovery server ("Lifeboat") starts on the same port. It accepts the same session token, so a phone that was signed in still works, and it can apply patches to the broken files.

## How the pieces fit

```text
┌─────────────────────────────────────────────────────────┐
│              Tier 3: Domain Extensions                  │
│      (Tracker, Notes, Git, Terminal, Hooks, etc.)       │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│          Tier 2: Core Substrate Engines (insetu)        │
│  (Yomama Bridge, Gather, Cartographer, LLM, Agent, MCP) │
└──────────────┬──────────────────────────────┬───────────┘
               │                              │
┌──────────────▼──────────────┐ ┌─────────────▼───────────┐
│  Tier 1: Python Kernel      │ │  Tier 0: Presentation   │
│  (akasa: Event Bus, VFS,    │ │  (sutram / yenVUI: Web  │
│   Workers, Auth, Settings)  │ │   Component chassis)    │
└─────────────────────────────┘ └─────────────────────────┘
```

* **[akasa](https://github.com/Callosemic/akasa)** is the domain-agnostic Python kernel: VFS, event bus, background jobs, SQLite, settings and authentication. inSetu reaches it only through `insetu/core/sdk`, a boundary the fitness suite enforces.
* **[sutram](https://github.com/Callosemic/sutram)** is the Web Component chassis, vendored into `insetu/static/vendor/` and locked by content hash.

## Quick start

```bash
pipx install "insetu[all]"
cd ~/projects            # the folder that holds the repositories you want to work on
insetu init              # choose a title, a port and the repositories to track
insetu serve             # then open http://127.0.0.1:5005
```

## Features

### Core engines (Tier 2)
* **Yomama Sync Bridge:** the patch engine described above. It parses `SEARCH`/`REPLACE`, inline `TEXTEDIT`, `JSON_PATCH` and file lifecycle blocks over an in-memory virtual file system. See the [patch specification](#-yomama-patch-specification).
* **Context Gatherer:** compiles mapped repositories into text context payloads for LLMs, with per-bucket caching and staleness tracking.
* **Virtual File System (VFS):** an asynchronous commit pipeline, workspace-confined path resolution, protected recovery files, and an event ledger.
* **Topology & Cartographer:** a file ledger that follows `.gitignore` and configuration changes, a generated `CODE_INDEX.md`, and repository landmarks (standards, contracts, ADRs, tests, fitness suites).
* **Editor:** CodeMirror 6 with about 30 bundled languages (official packs plus legacy modes), loaded on demand. Every text file opens in the editor; unknown types open as plain text. You can add a language by placing a built pack in the workspace's local vendor folder (`.insetu/vendor/codemirror/`); nothing is downloaded at runtime.
* **LLM Gateway:** one streaming interface over Anthropic, Gemini, OpenRouter, any OpenAI-compatible server (Ollama, LM Studio, llama.cpp) and the Claude CLI. Endpoint pools and profiles map the semantic tiers (`fast`, `standard`, `thinking`, `frontier`) to concrete models.
* **Agent Harness & Routines:** a ReAct agent with chat sessions, cancel and undo, plus Markdown-as-Code routines (`ctx://routines/`) that chain prompts, tiers and test runs. Routine prompts can use repository facts as `{{sys.*}}` variables and include optional prompts with `{{include_prompt?: …}}`, which drops out when the extension behind it is disabled.
* **MCP Server:** exposes workspace capabilities, resources and prompts over the Model Context Protocol (2025-03-26), over HTTP (`/api/<workspace_id>/mcp`) and stdio (`insetu mcp`). Shell execution (`dev.exec`) is not exposed to MCP. *New and still settling.*
* **Prompt Library:** global prompt templates with macro inclusion and variable interpolation.
* **Offline Engine & Outbox Sync:** stale-while-revalidate GET mirroring, IndexedDB blob storage, and a mutation outbox that replays when the connection returns.
* **Remote Access:** Tailscale identity verification (`tailscale whois`), Tailscale Serve binding and trusted-hostname registration for phones, tablets and e-ink devices. See [Remote access](#-remote-access).

### Domain extensions (Tier 3)
Opt-in per workspace:

| Extension | What it does |
| :--- | :--- |
| `tracker` | Local offline Kanban board using Markdown-as-Code tickets. |
| `notes` | Markdown note-taking with frontmatter management. |
| `git` | Version control, branch management and workspace sweeping. |
| `term` | Embedded terminal over a PTY WebSocket stream. |
| `hooks` | IFTTT-style automation hooks on VFS and topology events; rules from repository files run only after you approve them. |
| `cronic` | Scheduled cron task management. |
| `preview` | Dev server supervisor and live previewer. Servers bind to loopback; opening one to your LAN is a timed lease you grant from the Preview tab, and custom start commands need your approval. |
| `ingest` | URL to Markdown. Parses locally by default; the Jina reader is an explicit option that sends the URL to r.jina.ai. URLs that resolve to private addresses are refused unless you allow the host. |
| `research` | Map-reduce web scraping, SERP indexing and AI triage. |
| `citations` | CSL-JSON academic reference library. |
| `publish` | Pandoc/LaTeX document publishing. |
| `format` | Code formatting (jsbeautifier, autopep8). |
| `skills` | Spaced-repetition tracking for discrete musical and technical skills. |
| `favorites` | Pinned file and folder quick-access tray. |
| `freshdesk` | Helpdesk integration for threaded B2B support tickets. |
| `update` | Semantic versioning and PyPI distribution, from a clean working tree only. |
| `dev` | Developer dashboard for bridge telemetry and thrashing. |

## 📋 Prerequisites

* **Python 3.10+**
* **Git** (*required* for topology mapping, code indexing, diffs and releases)

Optional:

* **Node.js** for pre-flight JavaScript validation in the bridge when the `syntax` extra is not installed, and for the Node-based tests. **npm** is needed only to rebuild the vendored CodeMirror bundle (`scripts/vendor_codemirror.sh`).
* **Pandoc & LaTeX** for PDF and DOCX output from the `publish` extension.
* **Tailscale** for private HTTPS access from your other devices.

## 🚀 Installation

inSetu is distributed on PyPI. It runs as a CLI tool and daemon, so **`pipx`** is recommended to keep its dependencies isolated:

```bash
# Recommended: isolated global install with all extension extras
pipx install "insetu[all]"

# Or with pip, inside an active virtual environment
pip install "insetu[all]"
```

### Extension extras

| Extra | Feature | Dependencies |
| :--- | :--- | :--- |
| `pip install insetu[syntax]` | Bridge AST validation | `tree-sitter`, `tree-sitter-python`, `tree-sitter-javascript` |
| `pip install insetu[term]` | Embedded terminal | `flask-sock` (WebSocket PTY streaming) |
| `pip install insetu[research]` | Web scraping & AI triage | `beautifulsoup4`, `markdownify`, `playwright` |
| `pip install insetu[format]` | Source code formatting | `jsbeautifier`, `autopep8` |
| `pip install insetu[update]` | Semantic versioning & PyPI | `python-semantic-release`, `build`, `twine` |
| `pip install insetu[freshdesk]` | Helpdesk integration | `mistune` |
| `pip install insetu[preview]` | Dev server previews | `uvicorn` |
| `pip install insetu[gui]` | Desktop window (`insetu gui`) | `pywebview` (not included in `all`) |
| `pip install insetu[all]` | Full extension suite | All optional dependencies except `gui` |

```bash
# If you use the research extension, install its headless browsers:
playwright install
```

### Installing from source

#### Option 1: the three repositories side by side (full-stack development)

```text
projects/
├── akasa/    # Tier 1 Python kernel
├── insetu/   # Tier 2 application
└── sutram/   # Tier 0 Web Component chassis
```

```bash
cd ~/projects

# 1. Clone the three sibling repositories
git clone https://github.com/Callosemic/akasa.git
git clone https://github.com/Callosemic/insetu.git
git clone https://github.com/Callosemic/sutram.git

# 2. Create and activate a shared virtual environment
python3 -m venv venv
source venv/bin/activate

# 3. Install akasa and insetu in editable mode (installing both together keeps pip
#    from replacing your akasa checkout with a PyPI copy)
pip install -e ./akasa -e "./insetu[all]"

# 4. Vendor sutram/yenVUI changes into insetu (also writes sutram.lock.json)
#    (Can also be bound to a `repo_update` rule on `sutram` in the Automation Hooks extension)
bash ./insetu/scripts/vendor_sutram.sh
```

insetu pins a compatible akasa range in `pyproject.toml`. If your akasa checkout falls outside it, `pip` will say so; that is the cue to bump the pin.

#### Option 2: global `pipx` install with a local akasa

```bash
pipx install "insetu[all]"
pipx inject insetu -e ~/projects/akasa
```

## 💻 Usage & CLI reference

| Command | What it does |
| :--- | :--- |
| `insetu init [dir] [-y] [-f]` | Interactive (or headless with `-y`) workspace setup: title, port and repositories to track. |
| `insetu serve` | Boots the Workbench daemon in the current directory. |
| `insetu gui` | Opens the Workbench in a native desktop window (requires the `gui` extra). |
| `insetu shortcut` | Creates a desktop application shortcut. |
| `insetu service <action>` | Manages a `systemd` user service (Linux). |
| `insetu create-extension <name>` | Scaffolds a new Tier 3 extension. |
| `insetu mcp [--workspace <id>]` | Runs the MCP stdio bridge for MCP clients. |
| `insetu auth rotate` | Replaces the session token and prints the new one once. Every device signs in again; restart a running server. |

### Boot the Workbench (`serve`)

```bash
insetu serve
```

`insetu serve` treats the current directory as the workspace root and reads its configuration from `.insetu/config.json`, creating `.insetu/` on first run. The daemon listens on `http://127.0.0.1:5005`. If the kernel fails to boot, inSetu falls back to the [Lifeboat recovery console](#-resiliency--recovery-lifeboat).

### Run as a background service (`service`)

On Linux you can run inSetu as an unprivileged `systemd` user service anchored to your workspace directory:

```bash
insetu service install     # install, enable and start, anchored to the current directory
insetu service status
insetu service start
insetu service stop
insetu service restart
insetu service uninstall
```

### Scaffold an extension (`create-extension`)

```bash
insetu create-extension <extension_name>
```

This creates `.insetu/extensions/<name>/` in your workspace, outside the installed package, with a Python engine (`engine_<name>.py`), a Lit Web Component (`ext_<name>.js`) and a vendor manifest (`vendor.json`). You or an agent can edit it in insetu, but insetu runs it only after you approve its exact files: restart, choose **Review Files** in the banner, then **Approve & Restart**, and enable it for the workspace in Settings. Any later edit needs a new approval. Add `--bundled` to scaffold into the package's own `insetu/extensions/` instead, when working on insetu from a source checkout.

### Connect an MCP client (`mcp`)

Point any MCP client that speaks stdio at `insetu mcp`. It proxies to the running daemon, or runs headlessly in-process when the daemon is offline:

```json
{
    "mcpServers": {
        "insetu": { "command": "insetu", "args": ["mcp", "--workspace", "default"] }
    }
}
```

### Describe a repository to inSetu (optional)

inSetu finds standards, contracts, ADRs, tests and fitness suites by convention (for example `docs/adrs/` and `tests/unit/`). A repository can state them explicitly in `.insetu-data/settings/topology.md`; a git-ignored `.insetu-data/settings.local/topology.md` overrides it for you alone:

```markdown
---
landmarks:
    standards: [docs/01_engineering_standards.md]
    adrs: docs/adrs
    tests: [tests/unit]
    fitness: [tests/fitness]
---
```

Repository files may only describe the repository. They cannot grant permissions, widen network exposure or run commands, and paths that leave the repository are refused.

### 🧩 Yomama patch specification

The bridge applies model output written as structured text blocks. Each block targets a canonical URI (`vfs://<repo>/<path>` or `ctx://<volume>/<path>`) and can carry a `COMMENT` that is saved in the bridge ledger:

```text
<<<<<<< FILE: vfs://my_repo/path/to/file.py
<<<<<<< COMMENT
Why this change is being made.
<<<<<<< SEARCH
[exact lines from target file, with 1-2 unchanged lines of context]
=======
[replacement lines]
>>>>>>> REPLACE
```

| Directive | Use it for |
| :--- | :--- |
| `SEARCH` / `REPLACE` | Code changes. An empty `SEARCH` creates a new file. |
| `TEXTEDIT` | Inline prose edits with `{{-delete}}` and `{{+insert}}` markers, without repeating whole paragraphs. |
| `JSON_PATCH` | `.json`, `.yaml` and Markdown frontmatter, by dotted key path, `[field=value]` selector or RFC 6902. |
| `RELOCATE` / `RENAME` | AST-aware moves of functions and classes, and token-aware renames that skip comments and strings. |
| `MOVE_FILE` / `ARCHIVE_FILE` / `DELETE_FILE` | File lifecycle. Deleted files are snapshotted in the ledger for undo. |

Blocks that themselves contain triple backticks or seven-character markers use the bridge's transport-escape macros, so patches to Markdown and to the parser's own tests stay unambiguous.

## ⚙️ Configuration & ports

On first boot in a workspace, inSetu creates its configuration in `.insetu/` inside the current directory. The daemon listens on port `5005` by default. To change it:

**Temporarily, with an environment variable:**
```bash
INSETU_PORT=8080 insetu serve
```

**Persistently, in `.insetu/config.json`:**
```json
{
    "instance_title": "inSetu Developer OS",
    "port": 8080
}
```
*(If inSetu runs as a `systemd` service, restart it with `insetu service restart` after changing the config.)*

### Daemon files and multiple workspaces

Besides each workspace's `config.json`, the daemon keeps these in `.insetu/` (older installs with a single `system.json` are split automatically):
* **`host.json`:** daemon-wide options (`port`, `enable_watchdog`, `preload_all_extensions`).
* **`workspaces.json`:** maps workspace IDs to their `config_path`, for isolated multi-workspace setups. Every API route is scoped by workspace (`/api/<workspace_id>/...`).
* **`auth/`:** the durable session token (`session_token`), with owner-only permissions.
* **`attestations.json`:** every standing approval a person made (commands, hooks, workspace extensions, LAN leases).
* **`pending_changes/`, `audit/`, `recovery/last_good/`:** changes to protected recovery files waiting for your confirmation (Review Changes in the banner), their audit log, and the last version of the lifeboat and credential store that passed its smoke test.

### Environment variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `INSETU_PORT` | `5005` | Overrides the HTTP port. |
| `AKASA_BOOT_TOKEN` | *Durable token* | Overrides the session token stored in `.insetu/auth/session_token`. |
| `INSETU_DEBUG` | `0` | Enables Flask debug mode and verbose topology logging. |
| `INSETU_RELOADER` | `0` | Enables the auto-reloader (implies debug mode) for development. |
| `INSETU_SIMULATE_PANIC` | `0` | Simulates a kernel panic to boot the Lifeboat. |

---

## 🆘 Resiliency & recovery (Lifeboat)

If a fatal kernel panic or a broken core file stops the main app from booting, inSetu falls back to the **Lifeboat** (`fallback_bridge.py`): a recovery server that depends only on the Python standard library.

* **Same way in:** the Lifeboat accepts the app's durable session token and checks the Host header, so devices that were signed in stay signed in, including over Tailscale.
* **Recovery console:** `http://127.0.0.1:5005/recovery` shows system health and lets you force-boot the Lifeboat.
* **Emergency patcher:** applies Yomama patches to broken core files while the main app is down. File access is confined to the workspace, and the credential folder is never served.
* **Core context dump:** builds a single-file context payload of the inSetu kernel for debugging with an LLM.

---

## 🌍 Remote access

inSetu is local-first. The daemon binds to `127.0.0.1:5005` and is not reachable from another machine unless you put a tunnel or proxy in front of it. Use a tunnel rather than opening router ports.

### Security model

An authenticated session can read and write your files, run commands you approve, and push to your Git remotes. **Treat the session token like a shell login.** inSetu is built for a single user, and remote access is only as safe as the way you authenticate it.

A browser gets the session token from `/auth/bootstrap` in one of three ways:

| Route | Who it serves | How it is verified |
| :--- | :--- | :--- |
| Localhost | A browser or CLI on this machine | The connection comes from loopback, carries **no** proxy headers (`Forwarded`, `X-Forwarded-*`, `X-Real-IP`, `Tailscale-*`), and names `localhost`, `127.0.0.1` or `[::1]` as its Host. Anything arriving through a proxy never qualifies, whatever its headers claim. |
| Tailscale identity | Your phone, tablet or laptop on your tailnet | inSetu asks the local `tailscaled` (`tailscale whois`) who owns the connecting tailnet address. The machine's own Tailscale login is always allowed; other logins must be listed in `allowed_dev_emails` in your workspace `config.json`. Tagged (non-human) devices are always rejected. |
| Static token | Anything else (ngrok, nginx, Caddy) | You enter the `auth_token` from your workspace `config.json`. |

Every request is also checked against an allowed Host list (loopback, `*.ts.net` and anything you add) to block DNS-rebinding attacks. Requests for other hostnames get `421 Misdirected Request`.

What an authenticated session does not get automatically:

* **Command approval stays with you.** Test commands, custom preview commands and repository hook rules run only after a person approves that exact command (identified by its hash) through a route that agents, routines and MCP clients cannot call.
* **Child processes get a clean environment.** Preview servers and test runners never see the session token or credential-like environment variables, unless you allow a variable for one repository.
* **Outbound requests are checked.** URLs that a caller supplies must resolve to public addresses, checked again at connect time and after every redirect.

Before enabling remote access, set an `auth_token` in `.insetu/config.json` so you always have a fallback way in:

```json
{
    "auth_token": "a-long-random-string"
}
```

### Using Tailscale (recommended)

Tailscale gives each of your devices a private, authenticated address. Enable **Remote Access → Auto-Bind Tailscale Serve on Boot** in Settings, or bind manually:

```bash
# Expose inSetu over HTTPS on your tailnet only
sudo tailscale serve --bg --https=443 http://127.0.0.1:5005
```

Open `https://<machine>.<tailnet>.ts.net` from any device logged in to your tailnet as the same Tailscale user and it authenticates automatically. Related settings under **Remote Access**:

* **Tailscale Identity Verification:** `whois` (default, recommended), `header` (trusts the identity headers Tailscale Serve adds, accepted only from a local proxy) or `off` (static token only).
* Do **not** use `tailscale funnel` for inSetu. Funnel publishes the port to the public internet.
* Use Tailscale ACLs to limit which devices can reach this machine's Serve port.

### Using ngrok or a reverse proxy

Proxied requests never receive localhost trust, so these setups authenticate with your `auth_token`. Add the public hostname under **Remote Access → Additional Allowed Hostnames** (comma-separated, restart required), or Host validation will reject the requests.

```bash
ngrok http 5005
```

For any internet-reachable tunnel, also turn on the tunnel's own authentication (for example ngrok's basic auth or OAuth), and prefer a private network such as Tailscale whenever possible.

---

## 🧪 Development & testing

inSetu holds itself to the rules it enforces on extensions. From the repository root, with `akasa` and `sutram` cloned as siblings (see above):

```bash
python tests/run_unit_tests.py      # unit suite (some tests run real JavaScript in Node when it is installed)
python tests/fitness_functions.py   # AST fitness rules
```

The fitness suite rejects architectural drift before review: direct `akasa` imports outside the SDK membrane, settings without a declared scope, workspace writes that bypass the Yomama bridge, reads of forwarding headers outside akasa's peer classifier, child processes started without `child_env()`, outbound requests that bypass `fetch_url()`, code loaded from a CDN, and more. Vendored front-end code is pinned and locked by content hash, so a hand edit or a stale file fails the tests. CI runs the akasa, sutram and inSetu suites together on every push to any of the three repositories, against both their `main` branches and their latest releases.

The [`docs/`](docs/) folder holds the engineering standards, the extension API contract and about 90 architecture decision records.

---

## 📚 Essays

Long-form essays on the ideas behind inSetu:
* **[The Habitus of the Machine](https://draftpunked.substack.com/p/the-habitus-of-the-machine-coding):** why modern web frameworks are hostile to LLMs, and how to build a substrate that works with them.
* **[Holding the Opinion](https://draftpunked.substack.com/p/holding-the-opinion):** keeping human architectural intent and decision-making in the age of AI-generated syntax.

---

## 💬 Consulting & advisory

Building deterministic AI pipelines, local developer environments, or custom Pydantic guardrails for hardware/software products?

* **Book a 15-minute discovery call:** [Cal.com / Booking Link](https://cal.com/jrnguyen)
* **Direct Contact:** `hello@insetu.dev`

---

## 📄 License

Licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) and [NOTICE](NOTICE) files for details.
