# BRAM Estoque — app offline com sincronização

App para controle de estoque (entrada/saída) e requisições, ligado à sua
planilha Google. Funciona **sem internet**: os dados ficam guardados no
próprio celular/computador e são enviados para a planilha quando a conexão
volta.

## O que já está pronto

- **Estoque**: registrar entrada e saída, com histórico de movimentos.
- **Requisições**: criar requisição (Operação ou Manutenção), adicionar
  itens, receber total ou parcialmente. Ao concluir um item de Operação,
  ele entra automaticamente no estoque (pedindo o Local se ainda não tiver
  um definido). Itens de Manutenção já saem reservados do estoque na hora
  do pedido.
- **Sincronizar**: mostra quantas alterações estão pendentes de envio e
  sincroniza sozinho assim que a internet volta.

## Este app usa a SUA planilha, do jeito que ela já é

Diferente da primeira versão, este app não cria uma planilha nova — ele lê e
escreve direto nas suas abas existentes:

- **Estoque**: usa as colunas `IDFluig`, `Item`, `Qtd`, `Local`,
  `Prateleira`, `Coluna`, `Linha`, `P/N`, `Marca` e `OBS`. Só `Cod. Barra`
  e `Item Crítico` continuam do jeito que você preenche manualmente — o
  app nunca mexe nelas.
- **requisição**: usa `idMaterial`, `REQ`, `SOLICITANTE`,
  `OPERAÇÕES / MANUTEÇÃO`, `TIPO DE REQ.`, `DATA`, `PEDIDO STATUS`,
  `DATA FINALIZADA`, `Fluig` e `HELM`. As colunas `Link`, `OBS`, `P/N`, `cod
  barra` continuam manuais.
- **itens status**: usa `Material`, `Fluig`, `Item`, `Status`, `Qtde`,
  `Data Recebimento` e a coluna nova `Qtde Recebida` (veja abaixo).

### Antes de configurar: adicione 1 coluna

Na aba **"itens status"**, adicione uma coluna nova chamada exatamente
**`Qtde Recebida`** (em qualquer posição). É nela que o app guarda quanto
já foi recebido de cada item, permitindo recebimento parcial.

### Exclusão de itens e requisições

Agora dá pra excluir um item do estoque (no detalhe do item, botão
"Excluir item do estoque") ou uma requisição inteira com todos os seus
itens (botão "Excluir requisição" no card). Isso também apaga a linha
correspondente na sua planilha na próxima sincronização — **é permanente**,
não tem como desfazer pelo app.

Se você já tinha implantado o `apps-script.gs` antes dessa atualização,
precisa **colar o código novo** e reimplantar (Implantar > Gerenciar
implantações > editar a implantação existente > Nova versão > Implantar),
porque a exclusão só funciona com a versão mais recente do script.

### Tipo de requisição e nº HELM

Toda requisição agora começa escolhendo um **Tipo de requisição**: Pedido,
Desembarque ou Cadastro. Só quando é **Pedido** aparece a escolha extra de
Operação/Manutenção (que controla se o item mexe no estoque). Desembarque
e Cadastro nunca mexem no estoque automaticamente.

Ao adicionar um item numa requisição do tipo Pedido + Manutenção, aparece
um campo **Nº HELM** — fica salvo na coluna HELM da aba "requisição".

### Local e Prateleira são listas fixas

Pra evitar erro de digitação, **Local** agora é uma lista suspensa (as
mesmas 11 opções do seu AppSheet: Paiol de Proa, Switch board, VFD Vante,
Área de Carga BB, Área de Carga BE, Alar's, Maq. Leme, Escada, HVAC, Sala
de Bombas, Void) e **Prateleira** é um seletor de bolinhas coloridas
(Green, Yellow, Orange, Red, Purple, Blue, White, Black).

Se um dia precisar adicionar, remover ou renomear uma opção de Local, ou
mudar as cores de Prateleira, é só editar as listas dentro do
`index.html` — procure por `<select id="movLocal">` (aparece duas vezes:
no formulário de movimento e no modal que pede local) e pelos blocos
`<div class="seletor-cores">`.

## Passo 1 — Preparar o backend

1. Abra a planilha que você já usa para o estoque/requisições.
2. Nela, vá em **Extensões > Apps Script**.
3. Apague o conteúdo do editor e cole o conteúdo do arquivo `apps-script.gs`.
4. Clique em **Implantar > Nova implantação**.
5. Em "Tipo", escolha **Aplicativo da Web**.
6. Em "Quem pode acessar", escolha **Qualquer pessoa** (necessário para o
   app conseguir enviar dados sem você precisar logar toda vez).
7. Clique em **Implantar**, autorize as permissões pedidas, e copie o
   **endereço do aplicativo da Web** (termina em `/exec`).

## Passo 2 — Hospedar o app

O app é só um site (HTML/CSS/JS), então precisa estar hospedado em algum
lugar para você poder instalá-lo no celular. A forma mais simples e
gratuita é o **GitHub Pages**:

1. Crie uma conta gratuita em github.com (se ainda não tiver).
2. Crie um repositório novo (pode ser privado).
3. Envie todos os arquivos desta pasta para o repositório, **exceto**
   `apps-script.gs` e este `README.md` (esses dois não precisam ir para o
   site).
4. Nas configurações do repositório, ative **Pages**, apontando para a
   branch principal.
5. Em alguns minutos, o GitHub te dá um endereço tipo
   `https://seu-usuario.github.io/nome-do-repo/`.

Se preferir, qualquer outra hospedagem de arquivos estáticos funciona
(Netlify, Vercel, ou até um servidor da própria empresa).

## Passo 3 — Instalar no celular e configurar

1. Abra o endereço do app no navegador do celular (Chrome/Safari).
2. No menu do navegador, use "Adicionar à tela inicial" ou "Instalar app" —
   isso transforma o site num ícone de app normal.
3. Abra o app, vá na aba **Sincronizar** e cole o endereço do backend
   (o que termina em `/exec`, do Passo 1).
4. Pronto — a partir daqui, tudo que você registrar fica salvo no aparelho
   e é enviado para a planilha sempre que houver internet.

## Como funciona por baixo dos panos

- **db.js**: guarda tudo localmente (IndexedDB) — estoque, movimentos,
  requisições, itens, e uma fila de alterações pendentes.
- **sync.js**: quando há conexão, esvazia essa fila mandando cada
  alteração para o Apps Script, que escreve na planilha.
- **sw.js**: guarda os arquivos do próprio app em cache, para ele continuar
  abrindo mesmo sem internet.
- **apps-script.gs**: o "servidor" — na verdade roda dentro da sua própria
  planilha Google, sem custo nenhum.

## Leitura de código de barras pela câmera

Toca no ícone 📷 (ao lado do campo "Código", ou dentro da própria barra de
busca do Estoque) para abrir a câmera e ler o código de barras.

- No Chrome/Android, usa a leitura nativa do navegador — funciona 100%
  offline, sem depender de nada externo.
- Em navegadores sem essa leitura nativa (Safari/iPhone, por exemplo), o
  app carrega automaticamente uma biblioteca externa (ZXing) pra continuar
  funcionando. **Isso precisa de internet só na primeira vez** que a
  câmera for usada nesse aparelho — depois disso, o navegador costuma
  guardar em cache sozinho.
- Isso só funciona em conexão segura (HTTPS), então funciona normalmente
  no endereço do GitHub Pages.

## Funciona no celular e no computador

É o mesmo app, sem precisar de dois projetos separados. No celular, fica
com menu hambúrguer e navegação embaixo, do jeito que já era. No
computador (telas a partir de ~860px de largura), o menu vira uma barra
lateral fixa com os 3 itens (Estoque, Requisições, Sincronizar) sempre
visíveis, e as listas usam 2 colunas pra aproveitar melhor o espaço.

## Próximos passos (ainda não incluídos)

- Módulo de amostra de óleo com semáforo de coleta.
- Tela de "Atividade do usuário" / relatórios.
- Edição/exclusão de itens já lançados (hoje só permite lançar e cancelar).

Me chama quando quiser seguir para essas partes.
