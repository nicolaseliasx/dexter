# Browser recovery

Sessions 0.2.0 requires Termix's recovery SDK build (SDK 1.0.23 / plugin API 1.14)
and SSH Terminal 1.2.1-ncls.1. Installing Sessions alone on the original shell is
insufficient. Production installation is a separate, explicitly authorized step.
The modified SSH Terminal is bundled by the application build. The installer
continues to refuse unsigned replacements of bundled plugin IDs; do not upload
the SSH Terminal fork over the bundled plugin to bypass that protection.

## Architecture

The [approved SDK exception](../../../AGENTS.md) supplies generic pre-mount
recovery, filtered snapshots, non-destructive merge, tab data updates and
disposable per-tab unload exemptions. Sessions owns lifecycle, identity and
browser cache. SSH Terminal owns transport, reconnect and clipboard handling.

Each window keeps its layout in sessionStorage; a new window starts from the
last successful localStorage snapshot. Keys include the signed-in user's ID
and are scoped to the origin. A per-instance metadata index identifies known
managed views returned by core's user-wide open-tab records. Another window's
views are dropped locally before mounting, without deleting its saved records.
New windows create independent transport identities; reloading the same window
reuses its own views. Split and standalone tab order are preserved together.
No terminal output, scrollback, images, credentials or tokens are cached.

Slots contain stable Sessions IDs, host IDs and capture-time instance IDs.
Recovery checks current records, reuses restored views and splits, then mounts
terminals. Ended/missing sessions are removed. Network errors preserve a retryable
identity; they never authorize attachment using an old name. A legacy view with
no trustworthy identity must be attached through Sessions to enroll in recovery.

`GET /plugin-api/sessions/:id/attachment` checks ownership, host access and the
remote marker and returns the current name and immutable tmux target. The
`sessions.resolveAttachment` action exposes structured identity before each
connection. SSH Terminal checks the marker again inside tmux and attaches by ID.
It never creates a new session or falls back to an ordinary shell.

Confirmed rename updates all matching views and reconnect metadata without
reconnecting live terminals. Confirmed termination closes all matching views;
the tab X only disconnects one view. Successful cache saves exempt those views
from the connection unload warning. Unsaved changes, storage failure and plugin
disposal revoke the exemption. Other tabs retain their warnings and guards.
Corrupt or unreadable cache triggers a warning and preserves the last copy.
Known managed views still go through the identity resolver. Enabling the plugin
after the shell is ready initializes recovery once as well.

## Validation

Use Node >=22.22.2. Build the SDK at the root, then install each standalone plugin
with `npm ci --install-links`; rebuild better-sqlite3 for that runtime if needed.
Local SDK dependencies are installed as copies to keep one React instance.

- Root: `npm run build:sdk`, relevant shell/plugin-host tests,
  `npm run type-check`, `npm run lint`, `npm run build`.
- Each plugin: `npm test`, `npm run typecheck`, `npm run build`,
  `npm run validate`, then `termix-plugin pack`.
- Browser: internal Docker network, disposable copied fixture volume and SSH/tmux
  container; never production hosts or credentials. Cover reload/reopen, order,
  active view, splits, independent windows, rename then reconnect, termination,
  cancellation/failure, unavailable hosts and invalid/unwritable cache.

The real-browser fixture runner creates and removes only its own containers,
network and volumes. Build the application and disposable SSH fixture first:

```sh
docker build -f docker/Dockerfile -t termix:sessions-recovery-20261102 .
docker build -f scripts/fixtures/sessions-sshd.Dockerfile -t termix-sessions-e2e-sshd:local .
node scripts/verify-sessions-e2e.mjs /absolute/path/to/playwright-core/index.mjs /absolute/path/to/artifacts
```

The artifacts directory must contain the packed `sessions-0.2.0.tmxplug`.
The application image supplies the modified bundled SSH Terminal. The runner
records its assertions in `sessions-e2e.json` and takes a screenshot.

## Performance

Run the synthetic Chromium/Sharp comparison from the repository root:

```sh
node scripts/benchmark-terminal-images.mjs /absolute/path/to/playwright-core/index.mjs
```

It reports p50/p95 and bytes for clipboard preparation, loopback HTTP and Sharp
normalization, excluding SFTP and application ingestion. It accesses neither the
real clipboard nor Termix data. PNG keeps native bytes. JPEG avoids the redundant
canvas conversion and uses the existing validated file-upload decoder. Other
formats retain their browser conversion fallback. JPEG decoding can differ
slightly between browser and server, so compare decoded dimensions/content,
not encoded PNG hashes alone.

Uploads expose `settings`, `queue`, `decode` and `storage` in Server-Timing and
the existing backend log. The browser retains the latest `termix:image-upload`
measure. Metrics include no image/terminal contents. Separate these stages from
SFTP and Codex/Claude rendering before attributing production delays; do not add
input debounce or change host/network configuration without evidence.
