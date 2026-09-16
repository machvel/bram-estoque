/**
 * apps-script.gs
 * -----------------------------------------------------------------
 * Cole este código no editor de Apps Script da SUA planilha Google
 * (Extensões > Apps Script), publique como "Aplicativo da Web" e
 * cole o endereço gerado dentro do app, na aba "Sincronizar".
 *
 * CONFIGURAÇÃO: se você criou este script separado (em script.google.com,
 * não pelo menu Extensões da própria planilha), preencha o ID da planilha
 * abaixo. Se você colou este código PELO MENU Extensões > Apps Script de
 * dentro da planilha, pode deixar ID_PLANILHA em branco ('').
 *
 * ESTRUTURA REAL (cabeçalho + itens, cada um na sua aba):
 *
 *   Estoque       (já existe) — 1 linha por item de estoque
 *     Item, Marca, P/N, IDFluig, Cod. Barra, Item Crítico, OBS, Local,
 *     Prateleira, Coluna, Linha, Qtd
 *     chave: IDFluig
 *
 *   requisiçao    (já existe — nome da aba SEM til no "ã") — 1 linha por
 *   REQUISIÇÃO INTEIRA (cabeçalho)
 *     idMaterial, REQ, SOLICITANTE, TIPO DE REQ., DATA,
 *     OPERAÇÕES / MANUTEÇÃO, HELM, PEDIDO STATUS, DATA FINALIZADA, Link, OBS
 *     chave: idMaterial
 *
 *   itens status  (já existe) — 1 linha por ITEM da requisição (pode ter
 *   vários itens pra uma mesma requisição, todos com o mesmo Material)
 *     Material, Fluig, P/N, Item, Status, Data Recebimento, Qtde,
 *     cod bar, Adicionado ao Estoque, Qtde Recebida (nova), ID Item (nova)
 *     chave: ID Item
 *     Material = idMaterial da aba "requisiçao" (é o elo entre as duas abas)
 *
 * IMPORTANTE: adicione 2 colunas novas na aba "itens status", se ainda não
 * tiver: "Qtde Recebida" e "ID Item" (em qualquer posição, ficam em branco
 * que o app preenche sozinho).
 *
 * O app só escreve nas colunas listadas em "campos" abaixo — todas as
 * outras (Marca, P/N, OBS, Prateleira, HELM não gerenciado, Link, TIPO DE
 * REQ. não listado, etc.) continuam do jeito que você preencher manualmente.
 * -----------------------------------------------------------------
 */

const ID_PLANILHA = '1dJd4YHwKdbhysI5yp2FYVNb28hJX_ahYx9NEN2PPGp0'; // já preenchido com o ID da sua planilha

function pegarPlanilha_() {
  return ID_PLANILHA ? SpreadsheetApp.openById(ID_PLANILHA) : SpreadsheetApp.getActiveSpreadsheet();
}

// Campos que devem continuar como número (o resto sempre vira texto, pra
// evitar que um código sem ponto, tipo 10603901, vire número na planilha
// e quebre comparações de texto no app).
const CAMPOS_NAO_TEXTO = ['quantidade', 'quantidadeSolicitada', 'qtdeRecebida', 'itemCritico'];

const TABELAS = {
  estoque: {
    aba: 'Estoque',
    chaveApp: 'idFluig',
    chaveColuna: 'IDFluig',
    campos: { idFluig: 'IDFluig', nome: 'Item', quantidade: 'Qtd', local: 'Local', prateleira: 'Prateleira', coluna: 'Coluna', linha: 'Linha', pn: 'P/N', marca: 'Marca', obs: 'OBS', itemCritico: 'Item Crítico', foto: 'Foto' },
  },
  movimentos: {
    aba: 'Movimentos',
    chaveApp: 'id',
    chaveColuna: 'ID',
    campos: {
      id: 'ID', data: 'Data', idFluig: 'IDFluig', nome: 'Item', tipo: 'Tipo',
      quantidade: 'Qtde', local: 'Local', responsavel: 'Responsável', observacao: 'OBS',
    },
    colunasNaOrdem: ['Data', 'IDFluig', 'Item', 'Tipo', 'Qtde', 'Local', 'Responsável', 'OBS', 'ID'],
  },
  // Cabeçalho da requisição inteira — 1 linha por requisição.
  requisicoes: {
    aba: 'requisiçao',
    chaveApp: 'id',
    chaveColuna: 'idMaterial',
    campos: {
      id: 'idMaterial', reqNumero: 'REQ', solicitante: 'SOLICITANTE', tipoReq: 'TIPO DE REQ.',
      data: 'DATA', tipo: 'OPERAÇÕES / MANUTEÇÃO', helm: 'HELM',
      status: 'PEDIDO STATUS', dataFinalizada: 'DATA FINALIZADA', obs: 'OBS',
    },
  },
  // Itens da requisição — várias linhas podem apontar pro mesmo idMaterial
  // (mesma requisição), ligadas pelo campo Material.
  itensStatus: {
    aba: 'itens status',
    chaveApp: 'id',
    chaveColuna: 'ID Item',
    campos: {
      id: 'ID Item', requisicaoId: 'Material', idFluig: 'Fluig', nomeItem: 'Item',
      status: 'Status', dataFinalizada: 'Data Recebimento',
      quantidadeSolicitada: 'Qtde', qtdeRecebida: 'Qtde Recebida',
    },
  },
};

function pegarAba_(cfg) {
  const planilha = pegarPlanilha_();
  let aba = planilha.getSheetByName(cfg.aba);
  if (!aba) {
    aba = planilha.insertSheet(cfg.aba);
    const colunas = cfg.colunasNaOrdem || Object.values(cfg.campos);
    aba.appendRow(colunas);
  }
  return aba;
}

function lerAba_(cfg) {
  const aba = pegarAba_(cfg);
  const valores = aba.getDataRange().getValues();
  const cabecalho = valores[0] || [];
  return { aba, cabecalho, valores };
}

function lerTabelaComoObjetos_(nomeTabela) {
  const cfg = TABELAS[nomeTabela];
  const { cabecalho, valores } = lerAba_(cfg);
  if (valores.length < 2) return [];
  const camposInvertidos = Object.fromEntries(Object.entries(cfg.campos).map(([k, v]) => [v, k]));
  const objetos = valores.slice(1).map((linha) => {
    const obj = {};
    cabecalho.forEach((col, idx) => {
      const chaveApp = camposInvertidos[col];
      if (!chaveApp) return;
      let valor = linha[idx];
      if (valor !== '' && valor !== null && CAMPOS_NAO_TEXTO.indexOf(chaveApp) === -1) {
        valor = String(valor);
      }
      obj[chaveApp] = valor;
    });
    return obj;
  });

  // Itens antigos (de antes da coluna "ID Item" existir) não têm essa
  // coluna preenchida. Sem um código próprio, todos ficariam com o mesmo
  // id em branco e se sobreporiam no app. Gera um código a partir de
  // Material + Fluig, que juntos identificam o item de forma única.
  if (nomeTabela === 'itensStatus') {
    objetos.forEach((obj, idx) => {
      if (!obj.id) {
        obj.id = 'antigo-' + (obj.requisicaoId || '') + '-' + (obj.idFluig || '') + '-' + idx;
      }
    });
  }

  return objetos;
}

// Atualiza (ou cria) uma linha, escrevendo SÓ nas colunas mapeadas em
// cfg.campos — todas as outras colunas da linha existente são preservadas.
// Google Sheets recusa valores de célula acima de ~50.000 caracteres.
// Corta com segurança qualquer valor muito grande (ex: foto) em vez de
// travar a sincronização inteira.
const LIMITE_CELULA_SHEETS = 49000;
function valorSeguroParaCelula_(valor) {
  if (typeof valor === 'string' && valor.length > LIMITE_CELULA_SHEETS) {
    return valor.slice(0, LIMITE_CELULA_SHEETS);
  }
  return valor;
}

// Tira tudo que não for letra/número, pra comparar só os dígitos de
// verdade (ex: "10.508822" e "10508822" viram a mesma coisa aqui).
function normalizarParaComparar_(valor) {
  return String(valor || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function upsertLinha_(cfg, registro) {
  const { aba, cabecalho, valores } = lerAba_(cfg);
  const colChave = cabecalho.indexOf(cfg.chaveColuna);
  if (colChave === -1) {
    throw new Error('Coluna-chave "' + cfg.chaveColuna + '" não encontrada na aba "' + cfg.aba + '". Confira o cabeçalho.');
  }

  const valorChave = registro[cfg.chaveApp];
  let idxLinhaExistente = valores.findIndex((linha, idx) => idx > 0 && String(linha[colChave]) === String(valorChave));

  // Proteção extra, direto no servidor — funciona pra qualquer aparelho,
  // mesmo com uma versão antiga do app: se não achou por código EXATO,
  // procura por código "parecido" (só formatado diferente, com/sem ponto
  // etc) antes de criar uma linha nova. Assim a planilha nunca aceita um
  // item duplicado por causa só de formatação, não importa de onde veio o
  // pedido.
  if (idxLinhaExistente <= 0 && cfg.chaveColuna === 'IDFluig') {
    const normalizado = normalizarParaComparar_(valorChave);
    if (normalizado) {
      idxLinhaExistente = valores.findIndex((linha, idx) => idx > 0 && normalizarParaComparar_(linha[colChave]) === normalizado);
    }
  }

  if (idxLinhaExistente > 0) {
    Object.entries(cfg.campos).forEach(([chaveApp, nomeColuna]) => {
      if (registro[chaveApp] === undefined) return;
      const colIdx = cabecalho.indexOf(nomeColuna);
      if (colIdx === -1) return;
      const celula = aba.getRange(idxLinhaExistente + 1, colIdx + 1);
      // Força a célula do código (IDFluig) a ser sempre texto puro — não
      // depende mais de formatar a coluna manualmente na planilha. "@" é o
      // código do Google Sheets pra "formato de texto".
      if (nomeColuna === cfg.chaveColuna && cfg.chaveColuna === 'IDFluig') celula.setNumberFormat('@');
      celula.setValue(valorSeguroParaCelula_(registro[chaveApp]));
    });
  } else {
    const novaLinha = cabecalho.map((col) => {
      const chaveApp = Object.keys(cfg.campos).find((k) => cfg.campos[k] === col);
      return chaveApp && registro[chaveApp] !== undefined ? valorSeguroParaCelula_(registro[chaveApp]) : '';
    });
    aba.appendRow(novaLinha);
    if (cfg.chaveColuna === 'IDFluig') {
      // Garante que a célula do código, na linha recém-criada, fique como
      // texto puro — sem isso, o Google Sheets pode "entender" um valor
      // tipo "10.508822" como número (usando o ponto como separador de
      // milhar) e perder o ponto de verdade.
      const linhaNova = aba.getLastRow();
      const celula = aba.getRange(linhaNova, colChave + 1);
      celula.setNumberFormat('@');
      celula.setValue(String(valorChave));
    }
  }
}

// Apaga a linha (se existir) cuja coluna-chave bate com o valor do registro.
// Se não encontrar a linha, não faz nada (já pode ter sido apagada antes).
function excluirLinha_(cfg, registro) {
  const { aba, cabecalho, valores } = lerAba_(cfg);
  const colChave = cabecalho.indexOf(cfg.chaveColuna);
  if (colChave === -1) return;

  const valorChave = registro[cfg.chaveApp];
  const idxLinhaExistente = valores.findIndex((linha, idx) => idx > 0 && String(linha[colChave]) === String(valorChave));
  if (idxLinhaExistente > 0) {
    aba.deleteRow(idxLinhaExistente + 1);
  }
}

// ---------- Limpeza de duplicados do Estoque (roda direto na planilha) ----------
// Diferente da limpeza que existe no app (que só mescla localmente em cada
// aparelho), esta roda uma vez só, direto aqui na planilha — evita o risco
// de dois aparelhos decidirem coisas diferentes ao mesmo tempo e acabarem
// apagando dado de verdade. Use pelo menu "BRAM App" que aparece no topo
// da planilha.
function normalizarCodigoSheets_(codigo) {
  return String(codigo || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function limparDuplicadosEstoqueNaPlanilha() {
  const cfg = TABELAS.estoque;
  const { aba, cabecalho, valores } = lerAba_(cfg);
  const colIdFluig = cabecalho.indexOf(cfg.chaveColuna);
  if (colIdFluig === -1) {
    Logger.log('Não encontrei a coluna "' + cfg.chaveColuna + '" na aba Estoque.');
    return;
  }

  // Agrupa os números de linha (1-based, contando o cabeçalho) por código normalizado.
  const grupos = {};
  for (let i = 1; i < valores.length; i++) {
    const codigo = normalizarCodigoSheets_(valores[i][colIdFluig]);
    if (!codigo) continue;
    (grupos[codigo] = grupos[codigo] || []).push(i); // índice dentro de "valores"
  }

  const linhasParaApagar = []; // números de linha reais da planilha (1-based)
  let gruposComDuplicata = 0;

  Object.keys(grupos).forEach((codigo) => {
    const indices = grupos[codigo];
    if (indices.length < 2) return;
    gruposComDuplicata++;

    // Escolhe a linha "mais completa" (mais células preenchidas) como vencedora.
    const contarPreenchidas = (idx) => valores[idx].filter((v) => v !== '' && v !== null).length;
    indices.sort((a, b) => contarPreenchidas(b) - contarPreenchidas(a));
    const idxVencedor = indices[0];

    // Garante que o código da vencedora fique escrito por extenso (com pontos),
    // pegando o texto mais longo entre as variantes (geralmente o mais completo).
    let melhorTexto = String(valores[idxVencedor][colIdFluig]);
    indices.forEach((idx) => {
      const texto = String(valores[idx][colIdFluig]);
      if (texto.length > melhorTexto.length) melhorTexto = texto;
    });
    aba.getRange(idxVencedor + 1, colIdFluig + 1).setValue(melhorTexto);
    Logger.log('Item "' + melhorTexto + '": mantendo linha ' + (idxVencedor + 1) + ', apagando linha(s) ' + indices.slice(1).map((i) => i + 1).join(', '));

    // Marca as outras linhas do grupo (perdedoras) pra apagar depois.
    indices.slice(1).forEach((idx) => linhasParaApagar.push(idx + 1));
  });

  // Apaga de baixo pra cima, pra não bagunçar a numeração das linhas
  // enquanto ainda estamos apagando.
  linhasParaApagar.sort((a, b) => b - a).forEach((linha) => aba.deleteRow(linha));

  Logger.log(
    gruposComDuplicata === 0
      ? 'RESULTADO: Nenhum item duplicado encontrado. Tudo certo!'
      : `RESULTADO: Encontrei ${gruposComDuplicata} item(ns) duplicado(s) e apaguei ${linhasParaApagar.length} linha(s) extra(s), mantendo sempre a mais completa.`
  );
}

function doPost(e) {
  try {
    const corpo = JSON.parse(e.postData.contents);
    const tabela = corpo.tabela;
    const acao = corpo.acao;
    const registro = corpo.registro;

    if (!TABELAS[tabela]) throw new Error('Tabela desconhecida: ' + tabela);

    if (acao === 'upsert') {
      upsertLinha_(TABELAS[tabela], registro);
    } else if (acao === 'delete') {
      excluirLinha_(TABELAS[tabela], registro);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, aviso: 'ação ignorada' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (erro) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: String(erro) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const acao = e.parameter.acao;

  if (acao === 'ping') {
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (acao === 'exportar') {
    const dados = {
      estoque: lerTabelaComoObjetos_('estoque'),
      movimentos: lerTabelaComoObjetos_('movimentos'),
      requisicoes: lerTabelaComoObjetos_('requisicoes'),
      itensStatus: lerTabelaComoObjetos_('itensStatus'),
    };
    return ContentService.createTextOutput(JSON.stringify(dados))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (acao === 'validarAcesso') {
    const codigo = String(e.parameter.codigo || '').trim();
    const resultado = validarCodigoAcesso_(codigo);
    return ContentService.createTextOutput(JSON.stringify(resultado))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: 'ação desconhecida' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------- Controle de acesso individual por pessoa ----------
// Confere o código digitado contra a aba "Acessos" da planilha (colunas:
// Nome | Codigo). Pra tirar o acesso de alguém, é só apagar a linha dela
// nessa aba — não precisa mexer em nada do código do app.
function validarCodigoAcesso_(codigo) {
  if (!codigo) return { ok: false };
  try {
    const planilha = pegarPlanilha_();
    const aba = planilha.getSheetByName('Acessos');
    if (!aba) {
      // Aba ainda não existe — sem controle de acesso configurado, libera geral.
      return { ok: true, nome: '' };
    }
    const valores = aba.getDataRange().getValues();
    const cabecalho = valores[0].map((v) => String(v).trim());
    const colNome = cabecalho.indexOf('Nome');
    const colCodigo = cabecalho.indexOf('Codigo');
    if (colCodigo === -1) return { ok: true, nome: '' };

    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][colCodigo]).trim() === codigo) {
        return { ok: true, nome: colNome !== -1 ? String(valores[i][colNome]) : '' };
      }
    }
    return { ok: false };
  } catch (erro) {
    // Se der qualquer erro checando o acesso, não trava o app por causa disso.
    return { ok: true, nome: '' };
  }
}
