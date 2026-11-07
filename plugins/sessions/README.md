# Sessions

Persistent tmux sessions for [Termix](https://github.com/Termix-SSH/Termix) 26.10.6+. Attach opens the official SSH Terminal inside the tmux session.

Install: turn on Plugin developer mode, then Plugins -> Install from file.

## Panel

- Click a session row to attach it. The three-dot menu has **Open in split** and **Rename**; the trash button ends the session and asks right under that card (a second question offers force removal when the host does not answer).
- Host status reads green (online) or red (offline) whatever the theme accent is.
- The sidebar opens on Sessions when the shell is ready.
- Before each attach, the plugin enables tmux `terminal-features sync` (DECSET 2026) so Codex menus do not repaint half-drawn. It needs tmux 3.4 or newer and is a no-op otherwise.

Releases are published with the other plugin packages, for example
[`sessions-v0.2.6`](https://github.com/nicolaseliasx/termix/releases/tag/sessions-v0.2.6).
See [CHANGELOG.md](./CHANGELOG.md).

Version 0.2.0 restores browser-window tabs and splits and synchronizes session
rename/termination with open views. See [recovery and verification](./docs/recovery.md)
for the required SDK/SSH Terminal versions and isolated testing.
