# Modifications

Termix (ncls) is a derivative work of [Termix](https://github.com/Termix-SSH/Termix) **v26.10.6** (commit `f90621a5`), distributed under the Apache License 2.0. This file states the changes made to the original files, as required by section 4(b) of the license.

## Changes

1. **New `plugins/sessions` directory.** The Sessions plugin (persistent tmux sessions) is own code, Apache-2.0, a standalone npm package that does not touch the Termix core.
2. **`eslint.config.mjs`:** `plugins/**` added to the ignore list.
3. **Documentation:** `AGENTS.md`, this file, `docs/modernizacao/` and a fork note at the top of `README.md`.

4. **Recovery SDK extension (explicitly authorized 2026-11-02).** SDK 1.0.23 / API 1.14 adds scoped snapshots and merge restoration, a pre-mount recovery lifecycle, live tab data updates, and disposable per-tab unload exemptions. The shell preserves unrelated tabs and existing close guards. `src/types/ui-types.ts`, `src/ui/plugin-host/{app,frame-host,shell-bridge,testing-host}.ts*`, `src/ui/shell/{tab-registry,shell-layout}.ts`, `src/ui/shell/controller/{use-tabs,use-workspace-layout,ShellControllerProvider}.ts*`, `src/ui/shell/stage/TabPortals.tsx` and their tests implement these generic contracts. SDK source, metadata, guide and changelog document the extension.
5. **New `plugins/ssh-terminal` directory.** Source from the official Plugin-SSH-Terminal v1.2.0, Apache-2.0, extended as v1.2.1-ncls.1 for managed-session validation, clipboard handoff and stage timing. Its `MODIFICATIONS.md` lists the changed upstream files.

Branding, upstream translations, identifiers and the update check are retained. `LICENSE` is unchanged.

The application Docker build bundles the local SSH Terminal fork (`docker/Dockerfile`,
`.dockerignore`) while retaining the installer's bundled-ID protection. The test
location checker accepts standalone plugin test trees (`scripts/check-test-locations.cjs`
and its regression test). Browser/benchmark verification scripts are new additions.
