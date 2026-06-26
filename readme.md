# 🌉 inSetu: AI Developer OS
**inSetu** (from *in situ*, meaning "in position" or "on site", and *Setu* [सेतु], Sanskrit for "bridge") is a local-first AI Developer OS, Context Gatherer, and Kanban Tracker. 

It bridges the gap between Large Language Models (LLMs) and your local file system by treating your codebase as the ultimate source of truth. Instead of pasting code snippets back and forth, inSetu compiles massive, repository-wide context payloads for your LLM, and uses a deterministic "Sync Bridge" to apply the LLM's structural patches directly to your disk.

## ✨ Core Features

* **Context Gatherer:** Scrapes mapped repositories to compile massive `.txt` context payloads (RAG) for Large Language Models, split logically by domain.
* **The Sync Bridge:** A strict, AST-aware patching engine that parses LLM-generated `<<<<<<< SEARCH` and `>>>>>>> REPLACE` blocks, safely applying diffs in-memory, handling indentation, and committing them to disk idempotently.
* **Markdown Kanban Tracker:** A built-in project management board that reads and writes purely to local `.tracker/` markdown files. Your tickets live with your code.
* **Chassis Agnostic:** Drop it into any project. It reads a simple `config.json` to understand your workspace topology.

## 🚀 Installation

Ensure you have Python 3.10+ installed.

```bash
# Clone the repository
git clone [https://github.com/yourusername/insetu.git](https://github.com/yourusername/insetu.git)
cd insetu

# Install the package globally (or within a virtual environment)
pip install -e .

```

## 💻 Usage

Once installed, the `insetu` command is available anywhere on your system.

### Boot the Developer OS

```bash
insetu serve

```

This automatically scaffolds your workspace profiles in `~/.insetu/profiles/` and boots the web daemon on `http://127.0.0.1:5005`.
### Daemon Management (Linux)

You can install inSetu as a background `systemd` service so it boots with your machine:

```bash
insetu service install
insetu service status

```

## ⚙️ Configuration & Ports

Upon first boot, inSetu silently scaffolds your global configuration into `~/.insetu/profiles/`. 

By default, the daemon binds to port `5005`. You can change this in two ways:

**1. Environment Variable (Temporary)**
```bash
INSETU_PORT=8080 insetu serve
```

**2. Config File (Persistent)**
Edit the scaffolded config file (typically `~/.insetu/profiles/config.json`) and update the `"port"` key:
```json
{
    "instance_title": "inSetu Developer OS",
    "port": 8080
}
```
*(Note: If you are running inSetu as a `systemd` service, restart it via `insetu service restart` after modifying the config).*

---

## 🌍 Remote Access & Proxies

inSetu is designed to be a local-first tool, natively binding to `127.0.0.1:5005` to protect your filesystem. If you want to access your Developer OS remotely (e.g., from an iPad or a different workstation), we recommend using a secure tunneling service rather than opening router ports.

**Using Tailscale (Recommended):**
Tailscale provides a zero-config VPN. You can securely serve the inSetu port over your private Tailnet using Tailscale Serve:

```bash
# Expose inSetu securely over your Tailnet
sudo tailscale serve --bg --https=443 [http://127.0.0.1:5005](http://127.0.0.1:5005)

```

**Using Ngrok:**
If you need temporary public access, you can use Ngrok to forward the port:

```bash
ngrok http 5005

```

*(Note: If using Ngrok, ensure you trust the network or use Ngrok's basic auth features, as inSetu has direct write access to your local filesystem).*