# Plugin Dexter Ops

UI do bot `dexter-ops` (repositório separado). Fala só com a API local do bot (`/v1`, token Bearer).

- Backend: `client.ts` (único ponto que usa `ctx.fetch`; `allowPrivateHosts` = só o host configurado, sem vazar o token), `routes.ts` (allowlist explícita, validação estrita, auditoria de toda escrita), `index.ts`.
- Frontend: rail item + `DexterOpsPanel`. Operação destrutiva: confirmação inline e aviso de que a confirmação real é no Telegram.
- Invariantes: nenhuma rota edita a política ou executa comando livre; o plugin só restringe. Capabilities mínimas (`network:outbound`, `network:serve`, `ui:surface`).
- Versão do contrato: `/v1/status.api_version` precisa ser 1; senão o painel mostra "incompatível" e não oferece controles.
- Testes do painel usam o SDK instalado (ver `vitest.config.ts`); versão em `manifest.json`, `package.json` e `CHANGELOG.md` sempre iguais.
- Regras do fork: `../../AGENTS.md`.
