# Modifications

This package starts from official
[Plugin-SSH-Terminal v1.2.0](https://github.com/Termix-SSH/Plugin-SSH-Terminal/tree/v1.2.0),
under Apache-2.0. LICENSE and upstream credits are retained.

Version 1.2.1-ncls.1 changes these upstream files:

- `src/frontend/terminal/Terminal.tsx` and `TerminalTabContent.tsx`: managed-session
  resolution before each connection, marker-guarded attachment by tmux ID,
  clipboard handoff and the latest upload duration.
- `src/backend/routes.ts`: image-upload stage timing in Server-Timing and existing
  logs, without contents. New helpers implement identity guards and timing.
- `vitest.config.ts`: installed SDK aliases avoid duplicate React when the
  standalone package lives inside Termix. Added focused regression tests.
- `manifest.json`, package metadata/lock and CHANGELOG: identify the local fork
  and SDK compatibility.

Version 1.2.1-ncls.2, 1.2.1-ncls.3 and 1.2.1-ncls.4 change:

- `src/frontend/terminal/Terminal.tsx`: autosuggestion refreshes are coalesced to one
  pending animation frame (ncls.2); a link provider for URLs that a TUI table wrapped
  onto the next row is registered before the web-links addon (ncls.3).
- `src/frontend/look/terminal-theme.ts`: the `oled` UI theme maps to a pure black terminal background (ncls.4).
- `src/frontend/terminal/split-url-links.ts` (new): the heuristic. The URL must end its
  cell, another cell must follow on the row, and the next row must continue at the
  cell's start column. Prose that ends in a URL is left alone; wide characters are not
  handled. Tests in `tests/frontend/terminal/split-url-links.test.ts`.

See [recovery and verification](../sessions/docs/recovery.md).
