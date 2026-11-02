# Fork do Termix (uso pessoal)

Este fork é o upstream Termix **v26.10.6** sem patch no núcleo, mais só configuração de deploy e documentação. Instruções globais do usuário ficam em `~/.claude/CLAUDE.md`; estas regras são do projeto e prevalecem.

## Diretriz principal: evolução de módulo = plugin

- Qualquer funcionalidade nova ou mudança de comportamento de módulo (terminal, sessões, colar imagem, painéis, abas, integrações) **vira plugin**, em repositório próprio, no formato de `termix-plugin-sessions` (`/home/admin/termix-plugin-sessions`). Não editar `src/` do núcleo para isso.
- Plugin em TypeScript com `@termix-ssh/plugin-sdk` (backend `activate(ctx)`, frontend `activate(app)`). Rust só via WebAssembly em worker, e só se houver trabalho pesado; hoje não há.
- Reaproveite o que o Termix já tem antes de escrever código: o `ssh-terminal` oficial já cola imagem (Ctrl+V, SFTP) e abre `terminal` anexado a tmux com `openTab(host, "terminal", { data: { tmuxSession } })`. Colar imagem dentro do Claude/Codex roda sobre isso.
- Instalar por **Install from file** do `.tmxplug`, com o Plugin developer mode ligado. Não assinar nem submeter ao registry. Mudou o plugin: suba a versão em `manifest.json`, `package.json` e `CHANGELOG.md` (seção com `### Fixed/Added`).
- Alterar o núcleo só se o SDK não permitir de jeito nenhum, com decisão explícita do usuário, registrada aqui.

## Plugins e estado

- Quais plugins estão ligados é estado do **banco** de cada instância, não da imagem. Instância nova: repetir o onboarding. Política atual: **Off**, nunca Remove, até o período de uso; ver `docs/modernizacao/04-remocao-futura-plugins-off.md`.
- Ligados hoje: SSH Terminal, Proxmox (sem configuração), Host Status, TOTP, Workspaces, Classic Layout, Classic Themes, mais `sessions` (plugin próprio).
- O `ssh-terminal` já vem na imagem. Não instale outra cópia em `data/plugins` (gera "update ... not newer than the bundled").

## Testar sem tocar na produção

- Subir a imagem numa rede Docker `--internal`, com **cópia** do volume (`PUID=0 PGID=0`), e um sshd/tmux descartável (`ListenAddress` fora do loopback ou mesmo namespace de rede). Nunca apontar para `termix.ncls.cc` nem para os hosts reais.
- Browser: `playwright-core` com `/usr/bin/chromium` em diretório fora do repositório. Seletores: itens da barra lateral por `button:has(span:text-is("Sessions"))`.
- Produção atual é `termix:ncls-mobile` com o volume `termix-data`; promover só com autorização, backup com o serviço parado e rollback documentado em `docs/modernizacao/STATUS.md`.

## Armadilhas

- O núcleo não deixa plugin ler tabela legada do core (`ctx.db` só vê tabelas próprias): migre dados por rota de importação (`POST /plugin-api/sessions/import`), não por SQL.
- `ctx.db` não tem índice parcial: unicidade condicional vai no código.
- Trabalho em timer precisa de `ctx.asUser(userId, fn)`; dentro de rota o ator já é o chamador.
- Testes do plugin precisam do binário nativo do `better-sqlite3` (`npm rebuild better-sqlite3`); `termix-plugin validate` rejeita `$schema` e `CHANGELOG` sem seção de tipo.
- `useShell().split.handleAction` age sobre a aba pelo id no estado interno do shell: depois de `openTab`, espere um instante antes de dividir.
