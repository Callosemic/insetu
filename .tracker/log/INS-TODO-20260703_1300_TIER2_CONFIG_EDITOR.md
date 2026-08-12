---
repo: "insetu"
type: "todo"
status: "logged"
id: INS-TODO-20260703_1300_TIER2_CONFIG_EDITOR
title: "Feature: Upgrade Config Editor for Tier 2 Global Settings and Secure Credential Vaulting"
created_at: 2026-07-03T13:00:00
closed_at: 2026-08-04T15:26:51
sub_bucket: "None"
tags: ["Frontend", "Config-Editor", "Security", "Feature"]
---

## Description
To safeguard early adopters against credential exposure, we must implement a visual control management screen for Tier 2 global settings inside the Configuration Editor extension (`ext_config.js`). Currently, the system lacks a secure, front-end mechanism to register sensitive API keys (e.g., `serper_api_key`, OpenAI keys, Zotero auth tokens). 

By isolating credential management to a hidden global user footprint (`~/.insetu/global_settings.json`), we prevent local workspace files from accidentally staging and pushing private tokens to public repositories during automated Git operations or Selective Sweeps.

## Implementation Details

### 1. Backend API Routing Substrate (utils_core.py & routes_system.py)
- Establish an independent REST endpoint path: `/api/system/global-config` supporting strict `GET` and `POST` actions.
- `GET` requests read and decode `~/.insetu/global_settings.json` natively, returning a sanitized JSON data dictionary.
- `POST` requests accept incoming credentials, validate string schemas against corruption, and write mutations atomically back to the global file layer.
- Refactor `engine_research.py` and downstream scrapers to uniformly fetch runtime keys via the centralized global settings data mapping layer.

### 2. Frontend Interface Upgrades (ext_config.js)
- Append a specialized visual card pane: `#### 🔐 Global Credentials Vault` right beside the target repository tracking fields.
- Map distinct credential fields for active integrations:
  - Serper.dev API Token (`serper_api_key`)
  - OpenAI / Alternate Model Providers Credentials
  - Zotero Academic Auth Tokens
- **Enforce UI Masking Safeguards:** Set credential input types strictly to `type="password"`, incorporating a toggle icon to temporarily mask or reveal raw layout keys during shared coding or stream capture sessions.

### 3. Save Controller Layer Separation
- Refactor the click handler for the master `💾 Save & Reload` button. 
- Bifurcate outbound save transactions: Standard project environments pass data straight down to the tenant endpoint (`/api/system/config`), while sensitive cryptographic strings are compiled separately and securely routed to the new Tier 2 global configuration workspace controller.

## Resolution

**Goal Achieved via Alternative Architecture**

The core security objective of this ticket was fulfilled, but the literal implementation roadmap outlined above was abandoned in favor of a more scalable, decentralized approach:

1. **Backend Substrate:** A centralized `/api/system/global-config` REST endpoint was ultimately unnecessary. Credential vaulting was instead integrated natively into the `InSetuExtension` micro-kernel framework. Extensions now manage their own configurations using a modular `SettingsManager` class that securely encrypts sensitive API keys into an isolated `secrets.json` file.
2. **Frontend UI Upgrades:** Consequently, `ext_config.js` was not modified to include a hardcoded "Global Credentials Vault" panel. Instead, extensions declare a `settings_schema`, which is parsed dynamically by a global `sutram-generic-settings` modal to render configuration inputs automatically across the entire OS.