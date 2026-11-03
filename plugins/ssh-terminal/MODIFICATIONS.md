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

See [recovery and verification](../sessions/docs/recovery.md).
