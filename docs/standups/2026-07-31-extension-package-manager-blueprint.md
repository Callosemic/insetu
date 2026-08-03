---
title: "Blueprint: Extension Package Manager & Graceful Degradation"
date: 2026-07-31
author: Architect
status: proposed
tags: ["Architecture", "DX", "SDK", "Dependencies"]
---

# Blueprint: Extension Package Manager & Graceful Degradation

## 1. Context & Problem Statement
Currently, extension-specific dependencies (like `mistune`, `beautifulsoup4`, or `playwright`) are managed either by bloating the core `pyproject.toml` or by throwing raw `ImportError`s that can crash background workers or the ASGI event loop. 

While our current `__external_depends__` reflection provides a basic UI warning, it lacks structural enforcement. To achieve a true "Pit of Success," the OS must treat extensions as modular packages that self-declare their needs, degrading gracefully if dependencies are missing, and providing developers with a 1-click remediation path.

## 2. Execution Plan

### Phase 1: Formalize the SDK Contract
Upgrade the `InSetuExtension` constructor to natively accept dependency arrays:
```python
my_ext = InSetuExtension(
    'research', __name__,
    dependencies=["beautifulsoup4", "markdownify"], 
    optional_dependencies={"playwright": "Required for bypassing Cloudflare/Google SERP bots."}
)

```

### Phase 2: Tier 1 Substrate Auto-Detection

During the `@hooks.on('system_boot')` phase, the kernel evaluates these lists.

* **Hard Dependencies:** If `beautifulsoup4` is missing, the OS purposefully *skips* mounting the extension's backend REST routes to protect the event loop. The frontend tab is still registered to allow UI-based remediation.
* **Soft Dependencies:** If `playwright` is missing, the extension boots normally, but the OS passes a status flag to the frontend state (e.g., `playwright_enabled: false`).

### Phase 3: Graceful Degradation UI

When the user mounts the extension tab, the frontend checks its Zustand store.

* **Missing Hard Dependencies:** The entire tab renders a "Dead State" canvas: *"Extension Disabled: Missing core libraries. Click here to install."*
* **Missing Soft Dependencies:** The UI renders normally, but specific triggers (e.g., the "Google (Playwright)" dropdown option) are disabled with a lock icon and tooltip: *"Requires playwright. Click to install."*

### Phase 4: The 1-Click Installer (Local-First Magic)

Because inSetu operates with full local execution privileges, we eliminate terminal context-switching.

* The UI provides an `<insetu-async-btn>` that dispatches an immediate background job.
* The worker executes `subprocess.run([sys.executable, "-m", "pip", "install", package_name])`.
* The UI streams the installation output directly to a toast notification. Upon success, the OS triggers a soft-refresh, instantly bringing the extension online.

## 3. Desired Outcome

This pipeline transforms inSetu from a static boilerplate into a true Operating System package manager, lowering the barrier to entry for third-party cartridge developers and completely insulating the core micro-kernel from dependency fragmentation.
