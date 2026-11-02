# Modifications

Termix (ncls) is a derivative work of [Termix](https://github.com/Termix-SSH/Termix) **v26.10.6** (commit `f90621a5`), distributed under the Apache License 2.0. This file states the changes made to the original files, as required by section 4(b) of the license.

## Changes

1. **New `plugins/` directory.** `plugins/sessions` (persistent tmux sessions) and `plugins/dexter-ops` (control panel for the Dexter Ops bot) are own code, Apache-2.0, standalone npm packages that do not touch the Termix core.
2. **`eslint.config.mjs`:** `plugins/**` added to the ignore list.
3. **Documentation:** `AGENTS.md`, this file, `docs/modernizacao/` and a fork note at the top of `README.md`.

There is no functional change to the Termix core. Branding, translations, identifiers and the update check are as in the original. The `LICENSE` file is unchanged.
