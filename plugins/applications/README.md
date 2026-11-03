# Applications

Catálogo compartilhado de links no Termix, no lugar do antigo Homepage.

## Onde aparece

- No Dashboard, como segunda visão ao lado de "Dashboard" (o mesmo encaixe `dashboard.secondaryView` do Homepage). A faixa de cima tem "Copy link" (copia `/apps`) e "Open full view".
- Como card opcional do Dashboard ("Applications"), adicionado pelo modo de edição.
- Como aba única (paleta de comandos, "Open full view" ou o endereço `/apps`). Quem abre `/apps` recebe o Termix normal com a aba aberta, como se tivesse clicado.
- Não há ícone na barra lateral.

A aba usa o título vazio (`tab.title` em `locales/en.json`) para mostrar só o ícone. O Termix não tem opção de aba só com ícone para plugins; se o título vazio aparecer estranho, troque o valor por "Applications".

## Permissões

`applications.view` permite ver os cards; alterações e descoberta exigem `applications.manage` e `admin.plugins.manage`. O botão de importação copia os seis destinos externos do antigo devhub sem duplicar URLs já cadastradas; o próprio Termix não é importado.

## Desenvolvimento

Execute `npm ci`, `npm rebuild better-sqlite3`, `npm test`, `npm run typecheck`, `npm run build`, `npm run validate` e `npm run pack`. Testes do coletor: `cd collector && python3 -m unittest discover -s tests`. Instale o `.tmxplug` pela opção de instalação de arquivo do Termix.

## Descoberta

O coletor de `collector/` executa apenas consultas fixas de Cloudflare, systemd e Docker. Uma rota publicada ou serviço ativo não comprova saúde. Serviços sem URL exigem preenchimento manual; os resultados precisam ser revisados antes de criar um card.

O coletor expõe HTTPS em `192.168.15.40:18443`, aceita somente o IP configurado do LXC e exige bearer token. Execute-o como usuário sem privilégios adicionais, com arquivos privados de chave e token e um certificado cujo SAN inclua `192.168.15.40`. A conta precisa poder executar o helper Cloudflare e consultar as fontes; falhas aparecem como fontes indisponíveis. O acesso ao Docker é privilegiado e deve ser avaliado antes de conceder acesso ao socket. Informe o token e a CA nas configurações administrativas do plugin. O token é armazenado pelo Termix como segredo e nunca deve entrar no repositório.

O inventário é atualizado a cada minuto, sem modificar cards. Quando o coletor falha, o catálogo existente continua disponível. Uma indicação de inventário antigo aparece depois de cinco minutos. Desativar o plugin ou parar o coletor interrompe suas respectivas funções; não apague os dados para reverter uma implantação.
