# Security

inSetu is a single-user developer workbench. An authenticated session can read and write your files, run commands you have approved, and push to your Git remotes, so **treat the session token like a shell login**. This page says what the security model covers, what it does not, and how to report a problem. The full set of guards, each with the test or fitness rule that enforces it, is section 9 of [docs/01_engineering_standards.md](docs/01_engineering_standards.md). Gaps we already know about are listed in [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

## Reporting a vulnerability

Please report security problems privately through GitHub: on this repository, open **Security → Report a vulnerability**. Do not open a public issue for anything that lets someone in without the token, run a command nobody approved, or read files outside a mounted workspace.

Include the version (`pip show insetu`), how inSetu was reached (localhost, Tailscale, a reverse proxy) and the steps to reproduce. You should get a reply within a week. inSetu is maintained by one person, so a fix may take longer than that; you will hear what is planned and when.

The same applies to [akasa](https://github.com/Callosemic/akasa) and [sutram](https://github.com/Callosemic/sutram); a report against any of the three is fine, and it will be moved to the right repository.

## Supported versions

inSetu is pre-1.0. Only the latest release gets security fixes. Fixes are not backported.

## What the model covers

* **Everything needs the token.** akasa's gate runs in front of every HTTP route, websocket and event stream. The few public routes are listed with a reason in `tests/unit/test_route_auth_inventory.py`, which boots the real app and probes every route with and without the token. Public routes are read-only, and requests to them run under a `public` origin that the file system layer refuses to write under.
* **Three ways to get the token.** A browser on the same machine (loopback only, never through a proxy), a device on your tailnet that `tailscale whois` names as an allowed login, or the static `auth_token`. The README's [Security model](README.md#security-model) section explains each and how to set up remote access.
* **People approve; automation proposes.** Agents, routines and MCP clients can propose commands, patches to the recovery path, workspace extensions and repository directives. Each takes effect only after a person approves exactly that content through a route that MCP and routines cannot reach. Approvals are records in one attestation store, tied to a hash of what was approved, so they lapse when it changes. Each record is also sealed with a key kept beside the master key in your home control directory (`~/.insetu/install.key`), outside every workspace, so an approval store that arrives with a clone or is copied from another machine grants nothing. Deleting that key withdraws every standing approval at once.
* **Repository content is untrusted.** Files inside a repository can describe the repository but cannot grant permissions, widen network exposure or run commands. Repository code (test runners, preview servers) runs with credential-like environment variables stripped.
* **Loopback by default.** Servers inSetu starts bind `127.0.0.1`. LAN exposure is a timed lease a person grants and that expires on its own.
* **Nothing from the network runs.** Outbound requests go through one fetch policy that refuses private addresses. Code is never downloaded and executed at runtime; vendored front-end files are pinned by content hash.
* **A way back in.** If the app cannot boot, a standard-library recovery server (the Lifeboat) starts on the same port behind the same token and Host checks. Changes to the recovery files wait for a person, run a smoke test before they are written, and keep a last-good copy.
* **Secrets stay out of model context.** Context sent to an LLM provider is scrubbed of the session token, stored secret values and encrypted secrets.

## What it does not cover

* **It is not a sandbox.** A command you approve runs with your account's permissions. Repository code you run (tests, previews) can do anything your account can, apart from reading the stripped credentials.
* **One user.** There are no per-user permissions. Anyone with the token, or with an allowed tailnet login, has your access.
* **Origins are labels, not authentication.** inSetu's dispatchers mark who started a call (`ui`, `mcp`, `routine`, `agent`, `public`), and the approval and write guards check that mark. Code already running inside the process, such as an approved workspace extension, can set any mark. Approve extensions as you would install software.
* **Do not publish it.** Do not put inSetu on the public internet (for example with `tailscale funnel`). For a tunnel or reverse proxy, turn on the tunnel's own authentication as well; see the README's [Remote access](README.md#-remote-access) section.
* **The machine is trusted.** Anyone who can read your home directory can read the session token, the encryption key and the workspace secrets.

## Changing a guard

A guard changes in the same commit as its test, with the reason in the commit message. Tests and fitness rules that encode guards are not weakened to make other work pass (standards section 9.7).
