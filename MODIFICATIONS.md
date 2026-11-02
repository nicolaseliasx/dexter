# Modifications

D.EX.T.E.R. is a derivative work of [Termix](https://github.com/Termix-SSH/Termix) **v26.10.6** (commit `f90621a5`), distributed under the Apache License 2.0. This file states the changes made to the original files, as required by section 4(b) of the license.

## Summary of changes

1. **Rebranding of user-visible text.** The product name "Termix" was replaced by "D.EX.T.E.R." in the UI strings (`src/ui/locales/en.json`), server messages and log lines meant for people, the default branding name, the page title and PWA manifest, and installer display labels.
2. **English only.** The upstream translations (`src/ui/locales/translated/`) and `translations-lock.json` were removed, `languages.json` is now an empty list, and the language alias table in `src/ui/i18n/i18n.ts` only returns languages that ship. The language pickers show English only. The upstream translation workflow in `.github/workflows` is left untouched and has nothing to translate.
3. **Documentation.** New `README.md`, `NOTICE`, this file and `AGENTS.md`. The original README was moved, unmodified apart from a note at the top, to `docs/TERMIX_README.md`.
4. **Package description** in `package.json`.
5. **Branding resolution.** `src/backend/database/routes/branding-settings.ts` shows the D.EX.T.E.R. name when the bundled default-look plugin reports the upstream default name "Termix"; any name chosen by an admin is kept.
6. **New `plugins/` directory.** `plugins/sessions` is the Sessions plugin (merged from its former repository with history) and `plugins/dexter-ops` is the control panel for the Dexter Ops bot. Both are own code, Apache-2.0, standalone npm packages, and do not touch the Termix core.
7. **No functional change** to the core, apart from the language and branding handling above. Product behavior is otherwise the same as Termix v26.10.6.

## Kept as in the original (compatibility)

Package and SDK names (`@termix-ssh/*`), `TERMIX_*` environment variables, browser storage keys, HTTP headers and user agents, API paths, database tables and migrations, plugin ids, Electron `appId`/`productName`/`executableName`, container, volume and network names in the docker example, and the upstream repository used by the update check. The `LICENSE` file is unchanged.

## Known limitations

- Plugins signed and published by the Termix project (SSH Terminal, Proxmox and others) keep their own text and authorship; their strings may still say "Termix".
- References to upstream releases ("Termix 2.8", "Termix 2.9.1") and to the Termix registry are intentional.

## Files changed

85 files outside `plugins/` differ from the original at the time this file was generated (deleted files included), plus the new `plugins/` directory (`sessions`, `dexter-ops`). Regenerate with `git diff --name-only f90621a5 -- . ':!plugins'` (`f90621a5` is the upstream v26.10.6 commit). Full patch: `git diff f90621a5`.

```
AGENTS.md
MODIFICATIONS.md
NOTICE
README.md
docker/entrypoint.sh
docker/nginx-https.conf
docker/nginx.conf
docs/TERMIX_README.md
electron-builder.json
electron/main.cjs
eslint.config.mjs
index.html
package.json
public/manifest.json
scripts/electron-backend-ready.test.ts
src/backend/auth/provisioning.ts
src/backend/database/routes/branding-settings.ts
src/backend/database/routes/users.ts
src/backend/plugins/ctx-desktop-local.ts
src/backend/plugins/loader.ts
src/backend/plugins/manage.ts
src/backend/starter.ts
src/backend/sync/client/device.ts
src/backend/sync/client/http.ts
src/backend/sync/host.ts
src/backend/tests/database/routes/branding-routes.test.ts
src/backend/tests/database/routes/branding-settings.test.ts
src/backend/tests/plugins/loader.test.ts
src/backend/tests/updates/desktop-update-check.test.ts
src/backend/tests/utils/user-agent-parser.test.ts
src/backend/tls/nginx-reload.ts
src/backend/tls/tls-service.ts
src/backend/updates/desktop-update-check.ts
src/backend/utils/auth-manager.ts
src/backend/utils/user-agent-parser.ts
src/ui/contexts/BrandingContext.tsx
src/ui/i18n/i18n.ts
src/ui/locales/README.md
src/ui/locales/en.json
src/ui/locales/languages.json
src/ui/locales/translated/af_ZA.json
src/ui/locales/translated/ar_SA.json
src/ui/locales/translated/bg_BG.json
src/ui/locales/translated/bn_BD.json
src/ui/locales/translated/ca_ES.json
src/ui/locales/translated/cs_CZ.json
src/ui/locales/translated/da_DK.json
src/ui/locales/translated/de_DE.json
src/ui/locales/translated/el_GR.json
src/ui/locales/translated/es_ES.json
src/ui/locales/translated/et_EE.json
src/ui/locales/translated/fi_FI.json
src/ui/locales/translated/fr_FR.json
src/ui/locales/translated/he_IL.json
src/ui/locales/translated/hi_IN.json
src/ui/locales/translated/hr_HR.json
src/ui/locales/translated/hu_HU.json
src/ui/locales/translated/id_ID.json
src/ui/locales/translated/it_IT.json
src/ui/locales/translated/ja_JP.json
src/ui/locales/translated/ko_KR.json
src/ui/locales/translated/lt_LT.json
src/ui/locales/translated/lv_LV.json
src/ui/locales/translated/ms_MY.json
src/ui/locales/translated/nl_NL.json
src/ui/locales/translated/no_NO.json
src/ui/locales/translated/pl_PL.json
src/ui/locales/translated/pt_BR.json
src/ui/locales/translated/pt_PT.json
src/ui/locales/translated/ro_RO.json
src/ui/locales/translated/ru_RU.json
src/ui/locales/translated/sk_SK.json
src/ui/locales/translated/sl_SI.json
src/ui/locales/translated/sr_SP.json
src/ui/locales/translated/sv_SE.json
src/ui/locales/translated/th_TH.json
src/ui/locales/translated/tr_TR.json
src/ui/locales/translated/uk_UA.json
src/ui/locales/translated/vi_VN.json
src/ui/locales/translated/zh_CN.json
src/ui/locales/translated/zh_TW.json
src/ui/locales/translations-lock.json
src/ui/main-axios.ts
src/ui/tests/i18n/i18n.test.ts
src/ui/tests/plugins/PluginsTab.test.tsx
plugins/ (new: plugins/sessions)
```
