# Plugin Sessions

Sessões tmux persistentes para o Termix 26.10.6+. Attach abre o SSH Terminal oficial dentro da sessão (`openTab(host, "terminal", { data: { tmuxSession } })`).

- Backend: `repository` (tabela própria, sem índice parcial), `lifecycle` (create/rename/kill/force), `reconciler` (observa tmux, hiberna), `gateway` (`ctx.ssh.exec`), `routes` (`/plugin-api/sessions/`).
- Frontend: rail item + painel; Split usa `planSplit` e `useShell().split.handleAction`.
- Migração do Sessions antigo: `POST /plugin-api/sessions/import` com o JSON de `GET /api/v1/persistent-sessions` da instância antiga (as linhas viram do usuário que importa).
- Comandos: `npm test`, `npm run typecheck`, `npm run build`, `npm run validate`, `npm run pack` (instale com o developer mode ligado).
- Versão em `manifest.json`, `package.json` e `CHANGELOG.md` sempre iguais.
- Regras do fork: ver o `AGENTS.md` da raiz do repositório (`../../AGENTS.md`).
