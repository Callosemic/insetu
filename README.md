# 🌉 inSetu: AI Developer OS
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**inSetu** (from *in situ*, meaning "in position" or "on site", and *Setu* [सेतु], Sanskrit for "bridge") is a local-first AI Developer OS, Context Gatherer, and Kanban Tracker.  
It bridges the gap between Large Language Models (LLMs) and your local file system by treating your codebase as the ultimate source of truth. Instead of pasting code snippets back and forth, inSetu compiles massive, repository-wide context payloads for your LLM, and uses a deterministic "Sync Bridge" to apply the LLM's structural patches directly to your disk.

DEMO: https://youtu.be/FDgL6jveMHo?si=h35FuW_WC0VO1Wox
*(Watch the 3-minute demo: Using inSetu to edit code on an inSetu extension - Yomama patcher, Gather context compilation, Virtual File System, Prompt templates, and more)*
## ✨ Core Substrate Engines & Extensions
### ⚙️ Core Substrate Modules (Tier 2)
* **The Yomama Sync Bridge:** A strict patching engine utilizing an in-memory Virtual File System. It parses `<<<<<<< SEARCH` and `>>>>>>> REPLACE` blocks, safely applies diffs, runs native pre-flight syntax validation (Python/JS/JSON), and commits to disk atomically.
* **Context Gatherer:** Scrapes mapped repositories to compile massive `.txt` context payloads (RAG) for Large Language Models.
* **Virtual File System (VFS):** Asynchronous commit pipeline, POSIX path sandbox resolution, and event ledger logging for zero-lock writes.
* **Cartographer:** Automatically maps repository topologies and generates a deterministic `CODE_INDEX.md` architectural blueprint to prevent logic drift.
* **Offline Engine & Outbox Sync:** Stale-While-Revalidate GET request mirroring, IndexedDB VFS blob storage, and asynchronous mutation outbox queueing for offline execution.

### 🔌 Domain Extensions (Tier 3)
* **Modular Extensions & Integrations:** Pluggable tools including Markdown Kanban Tracker, Integrated Git Operations, Embedded Terminal, Workflows (Flow), Prompt Library, Notes, CSL-JSON Reference Library & Research Inbox, Skills Spaced-Repetition Tracker, Freshdesk Helpdesk Integration, Tailscale Zero-Trust Networking, and Semantic Release Automation.

## 🏗️ System Architecture
`inSetu` is built on a modular three-tier architecture:

```text
┌─────────────────────────────────────────────────────────┐
│              Tier 3: Domain Extensions                  │
│   (Kanban Tracker, Citations, Git, Flow, Prompts, etc.) │
└────────────────────────────┬────────────────────────────┘
                            │
┌────────────────────────────▼────────────────────────────┐
│            Tier 2: Core Substrate Engines               │
│   (Gather Compiler, Yomama Bridge, Cartographer, VFS)   │
└────────────────────────────┬────────────────────────────┘
                            │
┌────────────────────────────▼────────────────────────────┐
│             Tier 1: Kernel & Micro-Kernel               │
│   (inSetu Event Bus / VFS Queue + Sutram / yenVUI UI)   │
└─────────────────────────────────────────────────────────┘

```

## 📋 Prerequisites

### Core System Requirements

* **Python 3.10+**
* **Git** (*Required* for repository topology mapping, code indexing, diff generation, and release management)
### Optional System Binaries

* **Node.js** (Optional: Enables pre-flight JavaScript/TypeScript AST syntax validation in the Yomama Sync Bridge)
* **Pandoc & LaTeX** (Optional: Enables document compilation to PDF/DOCX via the `publish` extension)
* **Tailscale** (Optional: Enables zero-trust HTTPS network binding over private Tailnets)

## 🚀 Installation

The inSetu Developer OS (v0.17.0+) is distributed officially via PyPI. You can install it directly into your environment using standard Python packaging tools:

```bash
pip install insetu
```

### Granular Extension Extras

You can install targeted dependencies for specific domain extensions:

| Extra | Feature Domain | Dependencies |
| :--- | :--- | :--- |
| `pip install insetu[term]` | Embedded Terminal | `flask-sock` (WebSocket PTY streaming) |
| `pip install insetu[research]` | Web Scraping & AI Triage | `beautifulsoup4`, `markdownify`, `playwright` |
| `pip install insetu[format]` | Source Code Formatting | `jsbeautifier`, `autopep8` |
| `pip install insetu[update]` | Semantic Versioning & PyPI | `python-semantic-release`, `build`, `twine` |
| `pip install insetu[freshdesk]` | B2B Helpdesk Integration | `mistune` |
| `pip install insetu[all]` | Full Extension Suite | All optional dependencies |

```bash
# If using the Research/Scraping extension, install required headless browsers:
playwright install
```

### Installing from Source

```bash
# Clone the repository
git clone https://github.com/Callosemic/insetu.git
cd insetu

# Install base OS dependencies
pip install -e .
# (Optional) Install full extension suite
pip install -e .[all]

# If using the Research/Scraping extension, install the required headless browsers:
playwright install
```

## 💻 Usage & CLI Reference

Once installed, the `insetu` command is available anywhere on your system.
### 1. Boot the Developer OS (`serve`)

```bash
insetu serve
```

Executing `insetu serve` treats your current working directory (`cwd`) as the active workspace root, reading configuration from `cwd/.insetu/config.json` (and automatically scaffolding local `.insetu/` configuration files if initialized in a fresh directory for the first time). The web daemon boots on `http://127.0.0.1:5005`.

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

### 🧩 Yomama Patch Sandwich Specification

The Yomama Sync Bridge expects LLM patch outputs formatted as structured text blocks:

```text
<<<<<<< FILE: relative/path/to/file.ext
<<<<<<< SEARCH
[exact lines from target file]
=======
[replacement lines]
>>>>>>> REPLACE
```
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

In addition to `.insetu/config.json`, the daemon manages a global system topology manifest at `.insetu/system.json`:
* **Global Options:** `port`, `enable_watchdog`, `preload_all_extensions`.
* **Multi-Workspace Isolation:** Maps workspace IDs to distinct `config_path` locations, enabling isolated multi-tenant environments accessible via the UI or `X-Workspace-ID` header.

### Environment Variable Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `INSETU_PORT` | `5005` | Overrides the web daemon HTTP port. |
| `INSETU_CONFIG` | `.insetu/config.json` | Path override for workspace configuration JSON. |
| `INSETU_BOOT_TOKEN` | *Generated* | Custom static authentication token override. |
| `INSETU_SIMULATE_PANIC` | `0` | Triggers a simulated kernel panic to boot Lifeboat FS. |

---

## 🆘 Resiliency & Recovery (Lifeboat FS)

In the event of a fatal kernel panic or syntax corruption in core modules, inSetu automatically falls back to an immutable, zero-dependency **Lifeboat FS** (`fallback_bridge.py`).

* **Manual Recovery Console:** Access `http://127.0.0.1:5005/recovery` at any time to inspect system health or force boot the Lifeboat OS.
* **Emergency Patcher:** Apply Yomama patches directly to corrupted core files even when the main Flask application cannot boot.
* **Core Context Dump:** Generates an emergency single-file context payload of the inSetu kernel for AI debugging.

---

## 🌍 Remote Access & Proxies

inSetu is designed to be a local-first tool, natively binding to `127.0.0.1:5005` to protect your filesystem. If you want to access your Developer OS remotely (e.g., from an iPad or a different workstation), we recommend using a secure tunneling service rather than opening router ports.

**Using Tailscale (Recommended):**
Tailscale provides a zero-config VPN. You can securely serve the inSetu port over your private Tailnet using Tailscale Serve:
```bash
# Expose inSetu securely over your Tailnet
sudo tailscale serve --bg --https=443 http://127.0.0.1:5005

```
**Using Ngrok:**
If you need temporary public access, you can use Ngrok to forward the port:

```bash
ngrok http 5005

```
*(Note: If using Ngrok, ensure you trust the network or use Ngrok's basic auth features, as inSetu has direct write access to your local filesystem).*

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