# Custom CSS para Termix

Plugin que aplica CSS escrito por você à interface do Termix. O CSS fica salvo
por usuário nas configurações nativas do plugin e é aplicado ao salvar, sem
recarregar a página. Elementos que aparecem depois também recebem os estilos.

## Instalação e uso

1. Ative o modo de desenvolvedor de plugins no Termix.
2. Em Plugins, use **Install from file** e selecione `custom-css-0.1.0.tmxplug`.
3. Ative o plugin e abra suas configurações de usuário.
4. Cole seu CSS no campo **CSS personalizado**, deixe **Aplicar CSS personalizado**
   ativado e salve.

Para conferir a aplicação, este exemplo cria um contorno na área principal:

```css
body {
  outline: 3px solid orange;
  outline-offset: -3px;
}
```

Use o inspetor do navegador para encontrar os seletores reais dos cartões e do
menu. Não é necessário executar JavaScript depois da renderização. O plugin não
avalia JavaScript nem modifica os registros de hosts, credenciais ou sessões.

## Recuperar a interface

Se um estilo esconder os controles, abra o mesmo endereço adicionando
`?custom-css=off`, por exemplo `https://SEU-TERMIX/?custom-css=off`.
Se já houver parâmetros, acrescente `&custom-css=off` antes de qualquer `#`.

Essa opção impede a aplicação do CSS desde a primeira renderização e não apaga
o que foi salvo. Corrija o CSS ou desative **Aplicar CSS personalizado** e salve.
Depois remova o parâmetro e recarregue a página. Desativar o plugin também remove
os estilos.

## Limites

- O CSS pode ocultar controles e afeta toda a interface autenticada do usuário.
- A estrutura e os seletores do Classic Layout podem mudar em atualizações.
- `order` depende de flex/grid e não muda a ordem de foco do teclado. CSS não
  transporta elementos livremente entre áreas diferentes da interface.
- O navegador ignora CSS inválido conforme suas próprias regras. Não há editor
  visual nem validador de sintaxe neste plugin.
- CSS pode carregar imagens, fontes e outros recursos com `url()` ou `@import`.
  Use apenas estilos de fontes em que confia; isto não é um ambiente isolado.
- O CSS é carregado depois das configurações de usuário; pode haver uma breve
  exibição do layout original ao abrir o Termix.

## Desenvolvimento

Pacote npm independente, com Node 22 ou mais recente:

```sh
npm ci --legacy-peer-deps
npm test
npm run typecheck
npm run build
npm run validate
npm run pack
```

Os testes usam a fronteira de configurações do SDK e verificam os efeitos reais
no DOM: aplicação, atualização, elementos posteriores, remoção e recuperação.

Veja também o [guia rápido](./docs/index.md) e o [histórico](./CHANGELOG.md).
