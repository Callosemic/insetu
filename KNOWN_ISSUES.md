# Known issues

What we know is wrong or unfinished, as of insetu 0.39.0 (akasa 0.11, sutram 2.9). Security gaps come first. When an item is fixed it leaves this page, and the release notes say so. To report something new, see [SECURITY.md](SECURITY.md) for security problems or open an issue for anything else.

## Security

| Gap | Risk | Planned fix |
| :--- | :--- | :--- |
| The browser keeps the session token in `localStorage`, and the event stream, terminal websocket and the Lifeboat's download fallback pass it in the URL (`?token=`). | A token in a URL can end up in proxy logs or browser history; anything that runs script on the page can read `localStorage`. | Paired, revocable per-device tokens, with single-use 30-second tickets for streams, so long-lived tokens never appear in URLs. |
| The terminal websocket does not yet check `Origin`, use a ticket, time out idle sessions or cap the number of sessions. | A terminal is a shell; it should have the strictest checks, not the same ones as other routes. | Follows the device tokens. |
| `/auth/bootstrap` is not rate-limited, and the permissions of `master_key.txt` are not checked at startup. | Unlimited guessing of the static token; a key file left world-readable goes unnoticed. | A per-client failure limit with a global cap (`429` with `Retry-After`); a startup check of the key file's mode. |
| Responses do not yet send `X-Content-Type-Options`, `Referrer-Policy` or a `frame-ancestors` policy, and localhost trust cannot be switched off on a shared machine. | Weaker defence in depth against content sniffing and framing; any local user of the machine gets localhost trust. | Security headers on every response, and a setting plus `AKASA_DISABLE_LOCALHOST_AUTH=1` to turn localhost trust off. |
| The host directory browser used when adding a workspace (`system/fs/list_local`) can list any directory the daemon's account can read. | An authenticated session can see directory names outside the workspace (not file contents). | An optional root it is confined to. |
| Routes without a risk label stay visible to MCP clients. Routes labelled `ui_only` or `exec`, and those marked `mcp_expose=False`, are hidden from MCP and banned in routines; an unlabelled route that changes something, such as `remote/tailscale/bind`, is not. | A new or unlabelled capability is exposed more widely than intended. | Risk classes on every capability (read, write, exec, admin), unclassified ones treated as exec, and a fitness rule that requires the class. |
| The page loads its fonts from Google Fonts. | A network request on every cold load, outside the "nothing from the network" rule for code. | Vendor the two font families. |

## Correctness

| Issue | Effect | Planned fix |
| :--- | :--- | :--- |
| When a routine's patch fails, the bridge's repair step writes the repaired patch without anyone reviewing it. | Unattended routines can commit model-repaired edits. Confirm & Commit in chat never repairs. | Agent runs stage edits and write nothing until a person approves (the agent sandbox). |
| Mounting a folder that is not a git repository runs `git init` in it without asking. | A `.git` directory appears that nobody requested. | Ask first, or post a notice. |
| Two workspaces mounting the same clone with different index settings each want to rewrite its `CODE_INDEX.md`. | Index churn. A claim file now lets only one workspace write; the root fix is index rules owned by the repository. | Repository-owned index settings. |
| The Lifeboat applies only `SEARCH`/`REPLACE` blocks and silently skips other Yomama block types. | A patch can look applied in the Lifeboat when part of it was not. | Report every unsupported block and do not report the patch as applied. |
| akasa's `submit_immediate_job(coalesce=True)` matches jobs by name only, ignoring their arguments. | A job asked for one input can return another input's running job. insetu's callers that depend on arguments use `coalesce="args"`. | Make name-only coalescing explicit and add a fitness rule. |
| akasa's database recovery calls `conn.changes()`, which does not exist, inside a bare `except`. | Recovery never reports success, even when it restored rows. | Use `total_changes`, log failures, and test with a corrupt database. |
| yenVUI's window dispatches `yenvui-window-focus` while sutram listens for `yenvui-window-focused`. | Clicking a floating window does not raise it through sutram's handler. | Pick one name and add a test. |
| The first release of a repository leaves the tree dirty (the new `CHANGELOG.md` adds a line to `CODE_INDEX.md`), and the release configuration assumes the index is at the repository root. | The first release needs a manual commit; repositories that keep the index in `docs/` release without it. | Remap before the release commit and write the real index path. |
| On iOS, the installed app can wait a long time at 100% on the boot screen, and reopening it from the background can leave it unresponsive. | A slow or frozen first screen on the phone. The boot-time causes are fixed in this release; the resume case is being traced. | In progress. |

## Code health

* **Large modules.** A few files still do too much; they are being split in planned waves, with a size ratchet that only lets them shrink. The extension SDK is labelled experimental until those waves finish.
* **Two fitness-rule paths.** Some JavaScript fitness rules run only on the regex fallback used when tree-sitter is missing, so the two paths disagree. CI installs tree-sitter; the fix is one path.
* **Indentation.** A handful of function bodies are indented eight spaces instead of four. A fitness rule for body indentation will close it.
