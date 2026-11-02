# Termix (ncls) (personal fork of Termix)

This fork is upstream Termix **v26.10.6** with no patch in the core, plus own plugins in `plugins/`, deploy configuration and documentation. The user's global instructions live in `~/.claude/CLAUDE.md`; these project rules take precedence.

## Main rule: module work ships as a plugin

- Any new feature or behavior change of a module (terminal, sessions, panels, tabs, integrations) **becomes a plugin**, living in `plugins/<id>/` of this repository as a standalone npm package (own `package.json` and lock, not a root workspace). `plugins/sessions` is the reference. Do not edit the core `src/` for that.
- Plugins are TypeScript on `@termix-ssh/plugin-sdk` (backend `activate(ctx)`, frontend `activate(app)`). Rust only as WebAssembly in a worker, and only for heavy work; there is none today.
- Reuse what Termix already has before writing code: the official `ssh-terminal` already pastes images (Ctrl+V, SFTP) and opens `terminal` attached to tmux with `openTab(host, "terminal", { data: { tmuxSession } })`. Pasting images into Claude/Codex running on a host builds on that.
- Install with **Install from file** of the `.tmxplug`, with Plugin developer mode on. No signing, no registry submission. When a plugin changes, bump the version in `manifest.json`, `package.json` and `CHANGELOG.md` (a section with `### Fixed/Added`).
- Change the core only if the SDK cannot do it at all, with an explicit decision from the user recorded here.

## Brand and license

- Product: **Termix** (this fork is called "Termix (ncls)"). Upstream branding, translations and identifiers are kept as shipped; do not rebrand or rename anything.
- Keep upstream translations (`src/ui/locales/`) untouched.
- **Apache 2.0:** keep `LICENSE` untouched and the original credits. Every change to an upstream file goes in `MODIFICATIONS.md` (list with `git diff --name-only v26.10.6 -- . ':!plugins'`).
- When bringing in a newer upstream version, merge it as is and run the suite.

## Plugins and state

- Which plugins are on is **database** state of each instance, not part of the image. On a new instance repeat the onboarding. Current policy: **Off**, never Remove, until a period of use; see `docs/modernizacao/04-remocao-futura-plugins-off.md`.
- On today: SSH Terminal, Proxmox (not configured), Host Status, TOTP, Workspaces, Classic Layout, Classic Themes, plus `sessions` (own plugin, in `plugins/sessions`).
- `ssh-terminal` ships in the image. Do not install another copy in `data/plugins` (it logs "update ... not newer than the bundled").

## Testing without touching production

- Run the image on an `--internal` Docker network with a **copy** of the volume (`PUID=0 PGID=0`) and a throwaway sshd/tmux (`ListenAddress` off loopback, or share the network namespace). Never point it at `termix.ncls.cc` or at real hosts.
- Browser: `playwright-core` with `/usr/bin/chromium`, in a directory outside the repository. Rail items: `button:has(span:text-is("Sessions"))`.
- Production today is the image `termix:26.10.6-ncls.1` (built from this repository's `docker/Dockerfile`) running in the Proxmox LXC 101 (192.168.15.41). The old devhub containers (`termix`, `termix-guacd`) are stopped and kept only as a rollback.

## Gotchas

- Plugins cannot read legacy core tables (`ctx.db` only sees its own tables): migrate data through an import route (`POST /plugin-api/sessions/import`), not SQL.
- `ctx.db` has no partial indexes: enforce conditional uniqueness in code.
- Timer work needs `ctx.asUser(userId, fn)`; inside a route the actor is already the caller.
- Plugin tests need the native `better-sqlite3` binary (`npm rebuild better-sqlite3`); `termix-plugin validate` rejects `$schema` and a `CHANGELOG` section without a type heading.
- `useShell().split.handleAction` acts on a tab by id in the shell's internal state: after `openTab`, wait a moment before splitting.
