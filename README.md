<div align="center">

<img src="./public/icon.svg" width="120" height="120" alt="D.EX.T.E.R. logo (the original Termix icon)" />

# D.EX.T.E.R.

**Distributed EXtensible Terminal, Environment & Resource Manager**

A lean, self-hosted manager for terminals, hosts and VMs. Small core, everything else is a plugin.

</div>

> **D.EX.T.E.R. is a fork of [Termix](https://github.com/Termix-SSH/Termix)**, created by Luke Gustafson ("Karmaa") and contributors and licensed under Apache 2.0. This project is independent and **not affiliated with, sponsored by or endorsed by** Termix or its authors. All credit for the code base goes to them. See [NOTICE](NOTICE) and [MODIFICATIONS.md](MODIFICATIONS.md).

## What is different from Termix

Termix is the engine. D.EX.T.E.R. is Termix **v26.10.6** with a new name, English only, and a focus on two things:

| Focus | What it is | Status |
| --- | --- | --- |
| **Sessions** | Persistent tmux sessions per host: create, rename, terminate, reattach, open side by side in a split, optional hibernation of idle sessions. Implemented as its own plugin, [`plugins/sessions`](plugins/sessions), that opens the official SSH Terminal inside the tmux session. | Available |
| **Dexter Ops** | Control panel for the Dexter Ops Telegram bot (a separate Rust service): status, hosts and alerts, turn its registered operations off or on, mute notifications, request an operation (destructive ones still wait for the Telegram confirmation). Implemented as the plugin [`plugins/dexter-ops`](plugins/dexter-ops). | Available, needs the bot v0.6.0+ API |
| **VMs and resources** | Managing virtual machines and infrastructure (Proxmox first) from the same place as your terminals. The official Termix Proxmox plugin is part of the stack, installed but **not configured** by default. | Planned, not built yet |

Everything else (hosts, credentials, SSH terminal, split screen, pasting images into the terminal, users and permissions) is **unchanged Termix**.

### Principles

- **Lean core.** No functional patch to the Termix core. Features that D.EX.T.E.R. adds ship as plugins in [`plugins/`](plugins), installable from a file. The rules are in [AGENTS.md](AGENTS.md).
- **Only what you use.** Most Termix plugins are available but left **off** on this installation; you turn on what you need.
- **English only.** The interface and docs are in English. The upstream translations were removed.
- **Branded.** The interface, server messages and metadata say "D.EX.T.E.R.".

### What changed in this repository

- Product name in the UI, messages, page title and metadata (full list in [MODIFICATIONS.md](MODIFICATIONS.md)).
- The translations were removed; only `en.json` remains.
- New documents: this README, `NOTICE`, `MODIFICATIONS.md`, `AGENTS.md`. The original Termix README is kept in [`docs/TERMIX_README.md`](docs/TERMIX_README.md).

### Compatibility kept on purpose

So that plugins, data and integrations keep working, the internal identifiers stay as in Termix: `@termix-ssh/*` packages and the plugin SDK, `TERMIX_*` environment variables, browser storage keys, HTTP headers and user agents, API paths (`/plugin-api`, `/plugin-ws`), database tables and migrations, plugin ids, and the container, volume and network names in the example compose file. The update check still queries the Termix repository.

## Run it

Build and deploy work as in Termix. With Docker:

```bash
docker build -f docker/Dockerfile -t dexter:local .
docker run -d --name dexter -p 8080:8080 -v dexter-data:/app/data dexter:local
```

See [`docker/docker-compose.yml`](docker/docker-compose.yml) for a full example and the [Termix documentation](https://docs.termix.site) for configuration, which still applies. Install your own plugins from **Plugins → Install from file**, with *Plugin developer mode* turned on.

## Credits and license

- **Original project:** [Termix](https://github.com/Termix-SSH/Termix), © 2026 Luke Gustafson and contributors, Apache License 2.0. The name "Termix" and its logo belong to their owners and appear here only to credit the origin.
- **D.EX.T.E.R. modifications:** © 2026 nicolaseliasx, released under the same license.
- **License:** [Apache License 2.0](LICENSE), kept in full. [NOTICE](NOTICE) preserves the required attributions.
