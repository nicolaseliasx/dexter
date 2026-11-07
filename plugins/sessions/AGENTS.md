# Plugin Sessions

Sessões tmux persistentes para o Termix 26.10.6+. Attach abre o SSH Terminal oficial dentro da sessão (`openTab(host, "terminal", { data: { tmuxSession } })`).

- Backend: `repository` (tabela própria, sem índice parcial), `lifecycle` (create/rename/kill/force), `reconciler` (observa tmux, hiberna), `gateway` (`ctx.ssh.exec`), `routes` (`/plugin-api/sessions/`).
- Frontend: rail item + painel; Split usa `planSplit` e `useShell().split.handleAction`.
- Migração do Sessions antigo: `POST /plugin-api/sessions/import` com o JSON de `GET /api/v1/persistent-sessions` da instância antiga (as linhas viram do usuário que importa).
- Comandos: `npm test`, `npm run typecheck`, `npm run build`, `npm run validate`, `npm run pack` (instale com o developer mode ligado).
- Versão em `manifest.json`, `package.json` e `CHANGELOG.md` sempre iguais.
- Regras do fork: ver o `AGENTS.md` da raiz do repositório (`../../AGENTS.md`).
- UI do painel (0.2.6): `ListRow.actions` do Termix só aparece no hover e a linha cresce; use `trailing` para botões sempre visíveis. `useConfirm` centraliza o cartão na altura do painel (cai no meio de um painel alto); a confirmação de Terminate é um bloco irmão logo abaixo da linha. Cores de status são fixas (`host-status.ts`), não o accent do tema. A abertura em Sessions é `app.tabs.onReady(() => app.tabs.openRailView("sessions"))`.
- Empacotar: `npm run pack` empacota o `dist/` que já existe e **não recompila**; rode `npm run build` antes (um pacote sem build leva o JS antigo com os textos novos). Confira o `.tmxplug` (`tar -tzf`/`tar -xzf` num diretório vazio) antes de instalar. Dois `pack` do mesmo código dão hashes diferentes (metadados do arquivo): publique e instale o mesmo arquivo.
- Testes e build exigem Node 24 (`.nvmrc`); no Node 20 o vitest nem sobe e o `better-sqlite3` fica com o ABI errado. Sem mudar o ambiente: `npx -y node@24 node_modules/vitest/vitest.mjs run`.
- Instalação em produção e rollback: ver [PRODUCTION.md](../../docs/modernizacao/PRODUCTION.md#plugin-only-updates-no-new-image).
- `manifest.json` fixa as versões exatas do `ssh-terminal` aceitas (`dependencies`). Ao subir uma imagem com outro `ssh-terminal` embutido, inclua a versão **antes** de promover: senão o Sessions fica `blocked` e some da UI (aconteceu com a ncls.4). `tests/backend/manifest-dependency.test.ts` cobre isso.
