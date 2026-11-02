<div align="center">

<img src="./public/icon.svg" width="120" height="120" alt="D.EX.T.E.R. logo (original Termix icon)" />

# D.EX.T.E.R.

**Distributed EXtensible Terminal, Environment & Resource Manager**

Gerenciador self-hosted de terminais, hosts e recursos, com núcleo enxuto e todo o resto em plugins.

</div>

> **D.EX.T.E.R. é um fork do [Termix](https://github.com/Termix-SSH/Termix)**, projeto original de Luke Gustafson ("Karmaa") e contribuidores, licenciado sob Apache 2.0. Este projeto é independente e **não é afiliado, patrocinado ou endossado** pelo Termix ou por seus autores. Todo o crédito pela base de código é deles. Veja [NOTICE](NOTICE) e [MODIFICATIONS.md](MODIFICATIONS.md).

## Proposta

O D.EX.T.E.R. é uma instalação pessoal e enxuta do Termix, pensada para quem administra poucos servidores e quer **só o que usa**:

- **Núcleo mínimo:** hosts, credenciais, contas e permissões, abas e split de tela. O Termix já entrega quase todo o resto como plugins, e aqui eles ficam desligados até serem necessários.
- **Terminal SSH oficial do Termix** como base de trabalho, incluindo colar imagem no terminal (útil para agentes de linha de comando rodando no host).
- **Sessões tmux persistentes** como plugin próprio ([`termix-plugin-sessions`](https://github.com/nicolaseliasx/termix-plugin-sessions)): criar, renomear, encerrar e reanexar sessões, sozinhas ou em split.
- **Evolução por plugin:** nenhuma funcionalidade nova entra no núcleo; cada módulo é um plugin em repositório próprio, instalável por arquivo. A regra está em [AGENTS.md](AGENTS.md).
- **Marca própria:** a interface, mensagens e traduções exibem "D.EX.T.E.R.".

Base atual: **Termix v26.10.6**.

## O que mudou em relação ao Termix

Resumo (lista completa em [MODIFICATIONS.md](MODIFICATIONS.md)):

- Rebranding visível: nome do produto na interface, mensagens do servidor, traduções, título da página, manifest PWA e rótulos de instaladores.
- Documentação: este README, `NOTICE`, `MODIFICATIONS.md` e `AGENTS.md`. O README original do Termix foi preservado em [`docs/TERMIX_README.md`](docs/TERMIX_README.md).
- Nenhuma alteração de funcionalidade no núcleo.

### Compatibilidade preservada

Para não quebrar plugins, dados e integrações do Termix, os identificadores internos **continuam como no original**: pacotes `@termix-ssh/*` e o SDK de plugins, variáveis `TERMIX_*`, chaves de armazenamento do navegador, cabeçalhos HTTP e user agents, caminhos de API (`/plugin-api`, `/plugin-ws`), nomes de tabelas e migrações, ids de plugins, e os nomes técnicos de contêiner, volume e rede do exemplo `docker/docker-compose.yml`. A verificação de atualizações ainda consulta o repositório do Termix.

## Como rodar

O fluxo de build e deploy é o do Termix. Resumo com Docker:

```bash
docker build -f docker/Dockerfile -t dexter:local .
docker run -d --name dexter -p 8080:8080 -v dexter-data:/app/data dexter:local
```

Veja [`docker/docker-compose.yml`](docker/docker-compose.yml) para um exemplo completo e a [documentação do Termix](https://docs.termix.site) para configuração, que continua valendo. Plugins próprios entram por **Plugins → Install from file**, com o *Plugin developer mode* ligado.

## Créditos e licença

- **Projeto original:** [Termix](https://github.com/Termix-SSH/Termix), © 2026 Luke Gustafson e contribuidores, Apache License 2.0. O nome "Termix" e seu logotipo pertencem aos seus titulares e aparecem aqui só para atribuição.
- **Modificações do D.EX.T.E.R.:** © 2026 nicolaseliasx, publicadas sob a mesma licença.
- **Licença:** [Apache License 2.0](LICENSE), mantida integralmente. O arquivo [NOTICE](NOTICE) preserva as atribuições exigidas.
