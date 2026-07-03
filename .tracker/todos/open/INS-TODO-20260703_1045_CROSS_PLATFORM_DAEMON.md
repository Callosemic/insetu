---
repo: "insetu"
type: "todo"
status: "open"
id: INS-TODO-20260703_1045_CROSS_PLATFORM_DAEMON
title: "Cross-Platform Daemon Support: Implement macOS launchd in cli.py"
created_at: 2026-07-03T10:45:00
closed_at: null
sub_bucket: "None"
tags: ["CLI", "Infrastructure", "Maintainability"]
---

## Description
The current implementation of the daemon management engine in `cli.py` (`handle_service`) is hardcoded exclusively to target Linux environments. It dynamically generates a `systemd` configuration block and drops it into a standard Linux home directory profile, executing a series of subprocess invocations against `systemctl`. 

When a developer attempts to initialize local background persistence on a MacBook via `insetu service install`, the execution crashes ungracefully due to missing `systemctl` interfaces. To facilitate seamless same-device development across both remote Linux code servers and local Apple Silicon hardware, the CLI manager must switch to an OS-aware strategy. 

By querying `sys.platform`, the service manager can branching execution targets natively:
1. **Linux Targets:** Retain the working `systemd` infrastructure pipeline.
2. **Darwin (macOS) Targets:** Generate a native launchd XML Property List (`.plist`) payload, place it within the secure user directory space (`~/Library/LaunchAgents/`), and orchestrate lifecycle states via native `launchctl` routing matrices.

## Action Items
- [ ] Audit `handle_service` in `cli.py` to decouple the hardcoded `systemd_user_dir` and platform paths.
- [ ] Implement a platform check wrapper branching via `sys.platform` to capture `linux` and `darwin` environments.
- [ ] Develop the macOS configuration layout branch:
    - [ ] Map the destination path anchor securely to `~/Library/LaunchAgents/insetu.plist`.
    - [ ] Design the dynamic XML structural block matching the parameters required by `launchd` (Label, ProgramArguments, RunAtLoad, KeepAlive, WorkingDirectory, StandardOutPath/StandardErrorPath).
- [ ] Map service control actions (`start`, `stop`, `restart`, `status`) to their platform equivalents:
    - **Linux:** `systemctl --user [action] insetu.service` 
    - **macOS:** `launchctl bootout gui/$UID/ ~/Library/LaunchAgents/insetu.plist` and `launchctl bootstrap gui/$UID/ ~/Library/LaunchAgents/insetu.plist` (or legacy `launchctl load/unload` loops depending on target criteria).
- [ ] Inject strict error feedback boundaries to prevent silent tracking failures if write privileges on macOS folder structures are locked down.

## Notes / Execution Log