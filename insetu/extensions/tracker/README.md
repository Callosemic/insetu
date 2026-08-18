# 🎫 Issue Tracker

The **Issue Tracker** is a local, offline-first Kanban board built directly into your repositories. Instead of relying on external SaaS platforms, tickets are stored as plain Markdown files with YAML frontmatter. This ensures your project management stays version-controlled, portable, and tightly coupled to your actual codebase.

## ✨ Core Mechanics

### 1. Markdown-as-Code (MaC)
Tickets are the Single Source of Truth (SSOT). The engine runs a background enforcer that keeps the physical file path and the YAML frontmatter in perfect sync:
* If you manually move a file into a `closed/` directory via the terminal, the engine automatically updates the YAML to `status: closed`.
* If you edit the YAML frontmatter to `status: active`, the engine physically moves the file into the `active/` directory.

### 2. Tiers & Schemas
The tracker enforces a hierarchical 3-Tier schema to keep your work organized (e.g., *Epics* → *Sprints* → *Tasks*). 
* You can assign different schemas to different repositories via the **Kanban Configuration** UI in the Settings Hub.
* Default profiles include **Agile Basic (Coding)** and **Publish and Promote Funnel**, but you can define custom schemas mapping specific ticket types to specific tiers.

### 3. Automated Housekeeping
To prevent your LLM context payloads from bloating over time, the tracker employs an automated background metronome:
* **Grace Period:** Closed tickets remain in their original folders for a configured grace period (default 7 days) before being swept to the `.tracker/log/` folder.
* **Archiving:** Logged tickets are eventually swept into `.tracker/log/archived/` (default 30 days) where they are permanently preserved but excluded from the active virtual file system (VFS) context payload.

## 🚀 Features

* **Shadow Boards (Templates):** Create reusable ticket trees with the `template` status. You can embed variables using `{{varName}}` or `{{varName|defaultValue}}` syntax. When you "Spawn" an instance of the template, the engine duplicates the entire parent/child tree and prompts you to fill in the variables.
* **Global vs. Explicit Views:** Create custom UI tabs that either aggregate tickets across your entire workspace, or isolate them to specific repositories and schemas.
* **Smart Dependencies:** Link tickets using `Parent ID` and `Dependencies`. The UI automatically alerts you when all child sub-tasks of an Epic or Sprint are complete.
* **Historical Changelogs:** Generate markdown changelogs of recently closed and logged work directly from the UI to feed into your Git commits or sprint reviews.

## 📂 File Structure

The tracker manages an isolated `.tracker/` directory within each repository. It uses smart pluralization and semantic folder structures:

```text
[repo_dir]/
└── .tracker/
    ├── epics/
    │   ├── open/
    │   ├── active/
    │   └── closed/
    ├── tasks/
    │   ├── open/
    │   └── active/
    └── log/
        └── archived/

```
