# Sessions

See [browser recovery and verification](./recovery.md) for persistence behavior,
compatible SDK/SSH Terminal versions and isolated validation steps.

Create named tmux sessions on a host, list them, rename them, terminate them and reattach later. Attach opens an SSH Terminal tab running `tmux attach` for the session.

## Using the panel (0.2.6)

- **Attach:** click the row. **Open in split** and **Rename** are in the three-dot menu.
- **Terminate:** the trash button opens a confirmation directly under the card. If the host does not answer or the remote session belongs to another record, a second question offers **Force remove**, which clears only the card.
- **Open on Sessions:** the plugin calls `openRailView("sessions")` on `onReady`, so the sidebar starts on Sessions instead of Hosts. The core default (`hosts`) is unchanged.
- **Status colors** are fixed (green online, red offline); the accent color of the theme is not used.
- **Codex repaint:** `lifecycle.attachment` enables tmux `terminal-features sync` before attaching (tmux 3.4+, idempotent, best effort).
