# 🌉 inSetu: AI Workbench
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**inSetu** (from *in situ*, meaning "in position" or "on site", and *Setu* [सेतु], Sanskrit for "bridge") is a local-first AI Workbench, Context Gatherer, and Kanban Tracker.  
It bridges the gap between Large Language Models (LLMs) and your local file system by treating your codebase as the ultimate source of truth. Instead of pasting code snippets back and forth, inSetu compiles massive, repository-wide context payloads for your LLM, and uses a deterministic "Sync Bridge" to apply the LLM's structural patches directly to your disk.

DEMO: https://youtu.be/FDgL6jveMHo?si=h35FuW_WC0VO1Wox
*(Watch the 3-minute demo: Using inSetu to edit code on an inSetu extension - Yomama patcher, Gather context compilation, Virtual File System, Prompt templates, and more)*
## ✨ Core Substrate Engines & Extensions
### ⚙️ Core Substrate Modules (Tier 2)
* **The Yomama Sync Bridge:** A strict patching engine utilizing an in-memory Virtual File System. It parses `SEARCH`/`REPLACE`, inline `TEXTEDIT`, `JSON_PATCH`, and file lifecycle blocks, anchors them with two-tier fuzzy matching, runs native pre-flight syntax validation (Python/JS/JSON), and commits to disk atomically with an undo ledger. See [the patch specification](#-yomama-patch-specification).
* **Context Gatherer:** Scrapes mapped repositories to compile massive `.txt` context payloads (RAG) for Large Language Models.
* **Virtual File System (VFS):** Asynchronous commit pipeline, POSIX path sandbox resolution, and event ledger logging for zero-lock writes.
* **Cartographer:** Automatically maps repository topologies and generates a deterministic `CODE_INDEX.md` architectural blueprint to prevent logic drift.
* **LLM Gateway:** One streaming interface over Anthropic, Gemini, OpenRouter, any OpenAI-compatible server (Ollama, LM Studio, llama.cpp), and the Claude CLI. Compute endpoint pools and profiles map the semantic tiers (`fast`, `standard`, `thinking`, `frontier`) to concrete models.
* **Agent Harness & Routines:** A ReAct agent with chat sessions, cancel and undo, plus declarative Markdown-as-Code routines (`ctx://routines/`) that chain prompts, tiers, and test runs.
* **MCP Server:** Exposes workspace capabilities, resources, and prompts over the Model Context Protocol (2025-03-26), both over HTTP (`/api/<workspace_id>/mcp`) and over stdio (`insetu mcp`). *New and still settling.*
* **Prompt Library:** Global prompt templates with macro inclusions and variable interpolation.
* **Offline Engine & Outbox Sync:** Stale-While-Revalidate GET request mirroring, IndexedDB VFS blob storage, and asynchronous mutation outbox queueing for offline execution.
* **Remote Access:** Tailscale identity verification (`tailscale whois`), Tailscale Serve binding, and trusted-hostname registration for reaching the Workbench from phones, tablets, and e-ink devices. See [Remote Access & Security](#-remote-access--security).

### 🔌 Domain Extensions (Tier 3)
Opt-in per workspace:

| Extension | What it does |
| :--- | :--- |
| `tracker` | Local offline Kanban board using Markdown-as-Code tickets. |
| `notes` | Markdown note-taking with frontmatter management. |
| `git` | Version control, branch management, and workspace sweeping. |
| `term` | Embedded terminal multiplexer over a PTY WebSocket stream. |
| `hooks` | IFTTT-style automation hooks on VFS and topology events. |
| `cronic` | Scheduled cron task management. |
| `preview` | Managed dev server supervisor and live web application previewer. |
| `ingest` | URL to Markdown extraction via Jina or BeautifulSoup. |
| `research` | Map-reduce web scraping, SERP indexing, and AI triage. |
| `citations` | CSL-JSON academic reference library. |
| `publish` | Pandoc/LaTeX document publishing. |
| `format` | Code formatting (jsbeautifier, autopep8). |
| `skills` | Spaced-repetition tracking for discrete musical/technical skills. |
| `favorites` | Pinned file and folder quick-access tray. |
| `freshdesk` | Helpdesk integration for threaded B2B support tickets. |
| `update` | Automated semantic versioning and PyPI distribution. |
| `dev` | Developer dashboard for bridge telemetry and thrashing. |

## 🏗️ System Architecture
`inSetu` is built on a modular tiered architecture spread across three repositories:

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

* **[akasa](https://github.com/Callosemic/akasa)** is the domain-agnostic Python micro-kernel. inSetu reaches it only through `insetu/core/sdk`, a boundary enforced by the fitness suite.
* **[sutram](https://github.com/Callosemic/sutram)** is the zero-bundler Web Component chassis, vendored into `insetu/static/vendor/`.

## 📋 Prerequisites

### Core System Requirements

* **Python 3.10+**
* **Git** (*Required* for repository topology mapping, code indexing, diff generation, and release management)
### Optional System Binaries

* **Node.js** (Optional: Fallback pre-flight JavaScript syntax validation in the Yomama Sync Bridge when the `syntax` extra is not installed)
* **Pandoc & LaTeX** (Optional: Enables document compilation to PDF/DOCX via the `publish` extension)
* **Tailscale** (Optional: Enables zero-trust HTTPS network binding over private Tailnets)
## 🚀 Installation

The inSetu Workbench is distributed officially via PyPI. Because inSetu runs as a system CLI tool and daemon, installing via **`pipx`** is recommended to isolate dependencies and prevent OS environment conflicts:

```bash
# Recommended: Install isolated global application with all extension extras
pipx install "insetu[all]"

# Standard pip install (inside an active virtual environment)
pip install "insetu[all]"
```

### Granular Extension Extras

You can install targeted dependencies for specific domain extensions:

| Extra | Feature Domain | Dependencies |
| :--- | :--- | :--- |
| `pip install insetu[syntax]` | Bridge AST Validation | `tree-sitter`, `tree-sitter-python`, `tree-sitter-javascript` |
| `pip install insetu[term]` | Embedded Terminal | `flask-sock` (WebSocket PTY streaming) |
| `pip install insetu[research]` | Web Scraping & AI Triage | `beautifulsoup4`, `markdownify`, `playwright` |
| `pip install insetu[format]` | Source Code Formatting | `jsbeautifier`, `autopep8` |
| `pip install insetu[update]` | Semantic Versioning & PyPI | `python-semantic-release`, `build`, `twine` |
| `pip install insetu[freshdesk]` | B2B Helpdesk Integration | `mistune` |
| `pip install insetu[preview]` | Dev Server Previews | `uvicorn` |
| `pip install insetu[gui]` | Desktop Window (`insetu gui`) | `pywebview` (not included in `all`) |
| `pip install insetu[all]` | Full Extension Suite | All optional dependencies except `gui` |

```bash
# If using the Research/Scraping extension, install required headless browsers:
playwright install
```
### Installing from Source & Local Development

#### Option 1: The Sibling 3-Repo Setup (Full-Stack `akasa` + `insetu` + `sutram`)
If you are hacking across the full stack (Python micro-kernel, Python OS server, and Sutram/yenVUI presentation chassis), clone the three repos as siblings:

```text
projects/
├── akasa/    # Tier 1 Python Kernel
├── insetu/   # Tier 2 Developer OS Workbench
└── sutram/   # Tier 0 Web Component Chassis & Presentation Micro-Kernel

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
# 3. Link Python packages in editable mode
pip install -e ./akasa
pip install -e "./insetu[all]"

# 4. Vendorize & minify Sutram/yenVUI UI changes into insetu
# (Can also be bound to a `repo_update` rule on `sutram` in the Automation Hooks extension)
bash ./insetu/scripts/vendor_sutram.sh

```

#### Option 2: `pipx` Injection (Global `insetu` + Local `akasa`)

If you run `insetu` globally via `pipx` but want it to consume your local development copy of `akasa`:

```bash
pipx install "insetu[all]"
pipx inject insetu -e ~/projects/akasa

```


## 💻 Usage & CLI Reference

Once installed, the `insetu` command is available anywhere on your system.

| Command | What it does |
| :--- | :--- |
| `insetu init [dir] [-y] [-f]` | Interactive (or headless with `-y`) workspace setup: title, port, and repositories to track. |
| `insetu serve` | Boots the Workbench daemon in the current directory. |
| `insetu gui` | Opens the Workbench in a native desktop window (requires the `gui` extra). |
| `insetu shortcut` | Creates a desktop application shortcut. |
| `insetu service <action>` | Manages a `systemd` user service (Linux). |
| `insetu create-extension <name>` | Scaffolds a new Tier 3 extension. |
| `insetu mcp [--workspace <id>]` | Runs the MCP stdio bridge for MCP clients. |

### 1. Boot the Workbench (`serve`)

```bash
insetu serve

```

Executing `insetu serve` treats your current working directory (`cwd`) as the active workspace root, reading configuration from `cwd/.insetu/config.json` (and automatically scaffolding local `.insetu/` configuration files if initialized in a fresh directory for the first time). The web daemon boots on `http://127.0.0.1:5005`. If the kernel fails to boot, inSetu falls back to the [Lifeboat recovery console](#-resiliency--recovery-lifeboat-fs).

### 2. Background Daemon Management (`service`)

On Linux systems, you can install and manage inSetu as an unprivileged `systemd` user service anchored to your workspace directory:

```bash
# Install, enable, and start the systemd user service anchored to cwd
insetu service install

# Inspect background daemon telemetry and systemd status
insetu service status

# Control background service execution
insetu service start
insetu service stop
insetu service restart

# Disable and uninstall the systemd user unit
insetu service uninstall
```
### 3. Scaffold Custom Extensions (`create-extension`)

Scaffold a new Tier 3 extension template directly inside `insetu/extensions/`:

```bash
insetu create-extension <extension_name>
```

This automatically generates the extension directory, Python engine (`engine_<name>.py`), Lit Web Component (`ext_<name>.js`), and vendor manifest (`vendor.json`).

### 4. Connect an MCP Client (`mcp`)

Point any MCP client that speaks stdio at the `insetu mcp` command. It proxies to the running daemon, or runs headlessly in-process when the daemon is offline:

```json
{
    "mcpServers": {
        "insetu": { "command": "insetu", "args": ["mcp", "--workspace", "default"] }
    }
}
```

### 🧩 Yomama Patch Specification

The Yomama Sync Bridge applies LLM patch outputs formatted as structured text blocks. Each block targets a canonical URI (`vfs://<repo>/<path>` or `ctx://<volume>/<path>`) and can carry a `COMMENT` that is saved in the bridge ledger:

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
| `JSON_PATCH` | `.json`, `.yaml`, and Markdown frontmatter, by dotted key path, `[field=value]` selector, or RFC 6902. |
| `RELOCATE` / `RENAME` | AST-aware moves of functions and classes, and token-aware renames that skip comments and strings. |
| `MOVE_FILE` / `ARCHIVE_FILE` / `DELETE_FILE` | File lifecycle. Deleted files are snapshotted in the ledger for undo. |

Blocks that themselves contain triple backticks or seven-character markers use the bridge's transport-escape macros, so patches to Markdown and to the parser's own tests stay unambiguous.
## ⚙️ Configuration & Ports

Upon first boot in a workspace, inSetu silently scaffolds your local configuration into `.insetu/` inside your current working directory. 

By default, the daemon binds to port `5005`. You can change this in two ways:

**1. Environment Variable (Temporary)**
```bash
INSETU_PORT=8080 insetu serve
```
**2. Config File (Persistent)**
Edit the scaffolded config file (`.insetu/config.json` inside your working directory) and update the `"port"` key:
```json
{
    "instance_title": "inSetu Developer OS",
    "port": 8080
}
```
*(Note: If you are running inSetu as a `systemd` service, restart it via `insetu service restart` after modifying the config).*

### System Configuration & Multi-Workspace Isolation

In addition to `.insetu/config.json`, the daemon keeps two daemon-wide files in `.insetu/` (older installs with a single `system.json` are split into these automatically):
* **`host.json` (Global Options):** `port`, `enable_watchdog`, `preload_all_extensions`.
* **`workspaces.json` (Multi-Workspace Isolation):** Maps workspace IDs to distinct `config_path` locations, enabling isolated multi-tenant environments. Every API route is scoped by workspace (`/api/<workspace_id>/...`).

### Environment Variable Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `INSETU_PORT` | `5005` | Overrides the web daemon HTTP port. |
| `AKASA_BOOT_TOKEN` | *Generated* | Fixes the per-process session token instead of generating one at boot. |
| `INSETU_DEBUG` | `0` | Enables Flask debug mode and verbose topology logging. |
| `INSETU_RELOADER` | `0` | Enables the auto-reloader (implies debug mode) for development. |
| `INSETU_SIMULATE_PANIC` | `0` | Triggers a simulated kernel panic to boot Lifeboat FS. |

---

## 🆘 Resiliency & Recovery (Lifeboat FS)

In the event of a fatal kernel panic or syntax corruption in core modules, inSetu automatically falls back to an immutable, zero-dependency **Lifeboat FS** (`fallback_bridge.py`).

* **Manual Recovery Console:** Access `http://127.0.0.1:5005/recovery` at any time to inspect system health or force boot the Lifeboat OS.
* **Emergency Patcher:** Apply Yomama patches directly to corrupted core files even when the main Flask application cannot boot.
* **Core Context Dump:** Generates an emergency single-file context payload of the inSetu kernel for AI debugging.

---
## 🌍 Remote Access & Security

inSetu is a local-first tool. The daemon binds to `127.0.0.1:5005` and is never reachable from another machine unless you put a proxy or tunnel in front of it. Use a tunnel rather than opening router ports.

### Security model (read this before exposing the Workbench)

An authenticated session can read and write your files, run shell commands, and push to your Git remotes. **Treat the session token like a shell login.** inSetu is built for a single user, and remote access is only as safe as the way you authenticate it.

A browser gets its session token from `/auth/bootstrap` in one of three ways:

| Route | Who it serves | How it is verified |
| :--- | :--- | :--- |
| Localhost | A browser or CLI on this machine | The connection comes from loopback, carries **no** proxy headers (`Forwarded`, `X-Forwarded-*`, `X-Real-IP`, `Tailscale-*`), and names `localhost`, `127.0.0.1`, or `[::1]` as its Host. Anything arriving through a proxy never qualifies, whatever its headers claim. |
| Tailscale identity | Your phone, tablet, or laptop on your tailnet | inSetu asks the local `tailscaled` (`tailscale whois`) who owns the connecting tailnet address. The machine's own Tailscale login is always allowed; other logins must be listed in `allowed_dev_emails` in your workspace `config.json`. Tagged (non-human) devices are always rejected. |
| Static token | Anything else (ngrok, nginx, Caddy) | You enter the `auth_token` from your workspace `config.json`. |

Every request is also checked against an allowed Host list (loopback, `*.ts.net`, and anything you add) to block DNS-rebinding attacks. Requests for other hostnames get `421 Misdirected Request`.

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

* **Tailscale Identity Verification:** `whois` (default, recommended), `header` (trusts the identity headers Tailscale Serve adds, accepted only from a local proxy), or `off` (static token only).
* Do **not** use `tailscale funnel` for inSetu. Funnel publishes the port to the public internet.
* Use Tailscale ACLs to limit which devices can reach this machine's Serve port.

### Using ngrok or a reverse proxy

Proxied requests never receive localhost trust, so these setups authenticate with your `auth_token`. Add the public hostname under **Remote Access → Additional Allowed Hostnames** (comma-separated, restart required), or requests will be rejected by Host validation.

```bash
ngrok http 5005
```

For any internet-reachable tunnel, also enable the tunnel's own authentication (for example ngrok's basic auth or OAuth), and prefer a private network such as Tailscale whenever possible.

---
## 🧪 Development & Testing

inSetu holds itself to the same architectural rules it enforces on extensions. From the repository root (with `akasa` and `sutram` cloned as siblings, see above):

```bash
python tests/run_unit_tests.py      # unit suite
python tests/fitness_functions.py   # AST fitness rules (membranes, scopes, canonical routes, Lit templates, ...)
```

The fitness suite statically rejects architectural drift: direct `akasa` imports outside the SDK membrane, settings without a declared scope, workspace writes that bypass the Yomama bridge, reads of forwarding headers outside akasa's peer classifier, and more. CI runs the akasa, sutram, and inSetu suites together on every push to any of the three repositories, against both their latest `main` branches and their latest releases.

---
## 📚 Architectural Essays & Articles

Read the long-form essays exploring the philosophy, sociology, and zero-bundler architecture behind inSetu:
* **[The Habitus of the Machine](https://draftpunked.substack.com/p/the-habitus-of-the-machine-coding):** Why modern web frameworks are hostile to LLMs, and how to build a cognitive substrate that works.
* **[Holding the Opinion](https://draftpunked.substack.com/p/holding-the-opinion):** Maintaining human architectural intent and decision-making in the age of AI-generated syntax.

---
## 💬 Fractional Consulting & Advisory

Building deterministic AI pipelines, local developer environments, or custom Pydantic guardrails for hardware/software products?

* **Book a 15-minute discovery call:** [Cal.com / Booking Link](https://cal.com/jrnguyen)
* **Direct Contact:** `hello@insetu.dev`

---

## 📄 License

Licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) and [NOTICE](NOTICE) files for details.
