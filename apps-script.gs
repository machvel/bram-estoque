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
    campos: { idFluig: 'IDFluig', nome: 'Item', quantidade: 'Qtd', local: 'Local', prateleira: 'Prateleira', coluna: 'Coluna', linha: 'Linha', pn: 'P/N', marca: 'Marca', obs: 'OBS', itemCritico: 'Item Crítico', foto: 'Foto', quantidadeMinima: 'Qtd Minima' },
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
  // Listas de escolhas editáveis pela tela de Administrador (locais, solicitantes, marcas).
  listas: {
    aba: 'Listas',
    chaveApp: 'id',
    chaveColuna: 'ID',
    campos: { id: 'ID', lista: 'Lista', valor: 'Valor', ordem: 'Ordem' },
    colunasNaOrdem: ['ID', 'Lista', 'Valor', 'Ordem'],
  },
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
  // Movimentos e itens da requisição guardam o código só como referência.
  // Se o Google Sheets já converteu um deles em número (perdendo o ponto),
  // recupera a versão COM ponto olhando o cadastro do Estoque.
  const mapaCodigos = nomeTabela === 'estoque' ? null : mapaCodigosComPonto_();
  const objetos = valores.slice(1).map((linha) => {
    const obj = {};
    cabecalho.forEach((col, idx) => {
      const chaveApp = camposInvertidos[col];
      if (!chaveApp) return;
      let valor = linha[idx];
      if (valor !== '' && valor !== null && CAMPOS_NAO_TEXTO.indexOf(chaveApp) === -1) {
        valor = String(valor);
      }
      if (chaveApp === 'idFluig' && mapaCodigos && valor !== '' && String(valor).indexOf('.') === -1) {
        valor = mapaCodigos[normalizarParaComparar_(valor)] || valor;
      }
      if (chaveApp === 'tipoReq') valor = normalizarTipoReq_(valor);
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

// "Desemb.", "desemb", "DESEMB." etc -> "Desembarque".
function normalizarTipoReq_(valor) {
  const texto = String(valor === null || valor === undefined ? '' : valor).trim();
  return /^desemb/i.test(texto) ? 'Desembarque' : valor;
}

// Roda UMA vez pelo editor do Apps Script: troca "Desemb." (e variações)
// por "Desembarque" na coluna TIPO DE REQ. da aba requisiçao.
function padronizarDesembarqueNaPlanilha() {
  const cfg = TABELAS.requisicoes;
  const { aba, cabecalho, valores } = lerAba_(cfg);
  const col = cabecalho.indexOf(cfg.campos.tipoReq);
  if (col === -1) { Logger.log('Coluna "' + cfg.campos.tipoReq + '" não encontrada.'); return; }
  let trocados = 0;
  for (let i = 1; i < valores.length; i++) {
    const atual = String(valores[i][col]).trim();
    if (/^desemb/i.test(atual) && atual !== 'Desembarque') {
      aba.getRange(i + 1, col + 1).setValue('Desembarque');
      trocados++;
    }
  }
  Logger.log('RESULTADO: ' + trocados + ' linha(s) trocada(s) para "Desembarque".');
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

// Mapa "código sem pontuação" -> "código como foi cadastrado no Estoque
// (com ponto)". Só inclui códigos que realmente têm ponto.
let cacheMapaCodigos_ = null;
function mapaCodigosComPonto_() {
  if (cacheMapaCodigos_) return cacheMapaCodigos_;
  const mapa = {};
  try {
    const cfg = TABELAS.estoque;
    const { cabecalho, valores } = lerAba_(cfg);
    const col = cabecalho.indexOf(cfg.chaveColuna);
    if (col !== -1) {
      for (let i = 1; i < valores.length; i++) {
        const texto = String(valores[i][col]);
        if (texto.indexOf('.') !== -1) mapa[normalizarParaComparar_(texto)] = texto;
      }
    }
  } catch (e) {}
  cacheMapaCodigos_ = mapa;
  return mapa;
}

// Escreve um código como TEXTO PURO ("@" = formato texto do Sheets), pra
// o Sheets nunca transformar "10.603901" em número e perder o ponto.
function escreverCodigoComoTexto_(celula, codigo) {
  celula.setNumberFormat('@');
  celula.setValue(String(codigo));
}

function upsertLinha_(cfg, registro) {
  const { aba, cabecalho, valores } = lerAba_(cfg);
  const colChave = cabecalho.indexOf(cfg.chaveColuna);
  if (colChave === -1) {
    throw new Error('Coluna-chave "' + cfg.chaveColuna + '" não encontrada na aba "' + cfg.aba + '". Confira o cabeçalho.');
  }

  const valorChave = registro[cfg.chaveApp];
  let idxLinhaExistente = valores.findIndex((linha, idx) => idx > 0 && String(linha[colChave]) === String(valorChave));
  let achouPorCodigoParecido = false;

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
      achouPorCodigoParecido = idxLinhaExistente > 0;
    }
  }

  // Coluna que guarda o código Fluig nesta aba (IDFluig, Fluig...), se houver.
  const nomeColunaCodigo = cfg.campos.idFluig;

  if (idxLinhaExistente > 0) {
    Object.entries(cfg.campos).forEach(([chaveApp, nomeColuna]) => {
      if (registro[chaveApp] === undefined) return;
      const colIdx = cabecalho.indexOf(nomeColuna);
      if (colIdx === -1) return;
      const celula = aba.getRange(idxLinhaExistente + 1, colIdx + 1);

      if (nomeColuna === nomeColunaCodigo) {
        const novo = String(registro[chaveApp]);
        const atual = String(valores[idxLinhaExistente][colIdx]);
        // Nunca troca um código COM ponto por um SEM ponto.
        if (atual.indexOf('.') !== -1 && novo.indexOf('.') === -1) return;
        // Linha achada só por ser "parecida": preserva o código que já está
        // na planilha, a menos que ele esteja sem ponto e o novo tenha.
        if (achouPorCodigoParecido && !(atual.indexOf('.') === -1 && novo.indexOf('.') !== -1)) return;
        escreverCodigoComoTexto_(celula, novo);
        return;
      }
      celula.setValue(valorSeguroParaCelula_(registro[chaveApp]));
    });
  } else {
    // Já deixa a célula do código formatada como texto ANTES de gravar,
    // senão o Sheets converte "10.603901" em número na hora do appendRow.
    const colCodigo = nomeColunaCodigo ? cabecalho.indexOf(nomeColunaCodigo) : -1;
    if (colCodigo !== -1) aba.getRange(aba.getLastRow() + 1, colCodigo + 1).setNumberFormat('@');

    const novaLinha = cabecalho.map((col) => {
      const chaveApp = Object.keys(cfg.campos).find((k) => cfg.campos[k] === col);
      if (!chaveApp || registro[chaveApp] === undefined) return '';
      return chaveApp === 'idFluig' ? String(registro[chaveApp]) : valorSeguroParaCelula_(registro[chaveApp]);
    });
    aba.appendRow(novaLinha);

    if (colCodigo !== -1 && registro.idFluig !== undefined && registro.idFluig !== '') {
      escreverCodigoComoTexto_(aba.getRange(aba.getLastRow(), colCodigo + 1), registro.idFluig);
    }
  }
}

// Roda UMA vez pelo editor do Apps Script: formata as colunas de código
// como texto e devolve o ponto aos códigos de Movimentos e itens status
// que o Sheets tinha convertido em número (usando o Estoque como
// referência). Estoque: só lista no log o que ainda estiver sem ponto.
function corrigirIdsSemPontoNaPlanilha() {
  const mapa = mapaCodigosComPonto_();
  let corrigidos = 0;
  const semReferencia = [];

  ['estoque', 'movimentos', 'itensStatus'].forEach((nome) => {
    const cfg = TABELAS[nome];
    const { aba, cabecalho, valores } = lerAba_(cfg);
    const col = cabecalho.indexOf(cfg.campos.idFluig);
    if (col === -1 || valores.length < 2) return;

    const novos = [];
    for (let i = 1; i < valores.length; i++) {
      let texto = valores[i][col] === '' ? '' : String(valores[i][col]);
      if (texto && texto.indexOf('.') === -1) {
        const certo = nome === 'estoque' ? null : mapa[normalizarParaComparar_(texto)];
        if (certo) { texto = certo; corrigidos++; }
        else semReferencia.push(nome + ' linha ' + (i + 1) + ': ' + texto);
      }
      novos.push([texto]);
    }
    const faixa = aba.getRange(2, col + 1, novos.length, 1);
    faixa.setNumberFormat('@');
    faixa.setValues(novos);
  });

  Logger.log('RESULTADO: ' + corrigidos + ' código(s) recuperado(s) com ponto.');
  if (semReferencia.length) {
    Logger.log('Ainda SEM ponto (conferir/corrigir à mão no Estoque):\n' + semReferencia.join('\n'));
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

    // Pessoas com acesso (aba "Acessos"): só administrador mexe.
    if (tabela === 'acessos') {
      const meuCodigo = String(corpo.codigo || '').trim();
      if (!ehAdmin_(meuCodigo)) throw new Error('Somente administrador pode alterar os acessos.');
      alterarAcesso_(acao, registro, meuCodigo);
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (!TABELAS[tabela]) throw new Error('Tabela desconhecida: ' + tabela);

    // As listas de escolhas só podem ser alteradas por administradores.
    if (tabela === 'listas' && !ehAdmin_(String(corpo.codigo || '').trim())) {
      throw new Error('Somente administrador pode alterar as listas.');
    }

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
      listas: lerTabelaComoObjetos_('listas'),
    };
    return ContentService.createTextOutput(JSON.stringify(dados))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (acao === 'validarAdmin') {
    const codigo = String(e.parameter.codigo || '').trim();
    return ContentService.createTextOutput(JSON.stringify({ ok: ehAdmin_(codigo) }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (acao === 'listarAcessos') {
    const codigo = String(e.parameter.codigo || '').trim();
    const saida = ehAdmin_(codigo) ? { ok: true, pessoas: listarAcessos_() } : { ok: false };
    return ContentService.createTextOutput(JSON.stringify(saida))
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


// ---------- Administrador ----------
// Quem é administrador: na aba "Acessos" da planilha, crie uma coluna
// chamada "Admin" e escreva "Sim" na linha de cada pessoa que pode editar
// as listas (locais, solicitantes, marcas). O código de acesso dela é o
// mesmo que ela já usa para entrar no app.
function ehAdmin_(codigo) {
  if (!codigo) return false;
  try {
    const aba = pegarPlanilha_().getSheetByName('Acessos');
    if (!aba) return false;
    const valores = aba.getDataRange().getValues();
    const cabecalho = valores[0].map((v) => String(v).trim());
    const colCodigo = cabecalho.indexOf('Codigo');
    const colAdmin = cabecalho.indexOf('Admin');
    if (colCodigo === -1 || colAdmin === -1) return false;
    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][colCodigo]).trim() === codigo) {
        return /^(sim|s|x|true|1)$/i.test(String(valores[i][colAdmin]).trim());
      }
    }
    return false;
  } catch (erro) {
    return false;
  }
}


// ---------- Pessoas com acesso (aba "Acessos": Nome | Codigo | Admin) ----------
function abaAcessos_() {
  const planilha = pegarPlanilha_();
  let aba = planilha.getSheetByName('Acessos');
  if (!aba) { aba = planilha.insertSheet('Acessos'); aba.appendRow(['Nome', 'Codigo', 'Admin']); }
  const cab = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1)).getValues()[0].map((v) => String(v).trim());
  if (cab.indexOf('Nome') === -1) aba.getRange(1, cab.length + 1).setValue('Nome');
  const cab2 = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map((v) => String(v).trim());
  if (cab2.indexOf('Codigo') === -1) aba.getRange(1, cab2.length + 1).setValue('Codigo');
  const cab3 = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0].map((v) => String(v).trim());
  if (cab3.indexOf('Admin') === -1) aba.getRange(1, cab3.length + 1).setValue('Admin');
  return aba;
}

function listarAcessos_() {
  const aba = abaAcessos_();
  const valores = aba.getDataRange().getValues();
  const cab = valores[0].map((v) => String(v).trim());
  const cN = cab.indexOf('Nome'), cC = cab.indexOf('Codigo'), cA = cab.indexOf('Admin');
  const saida = [];
  for (let i = 1; i < valores.length; i++) {
    const codigo = String(valores[i][cC]).trim();
    if (!codigo) continue;
    saida.push({ nome: String(valores[i][cN]).trim(), codigo: codigo, admin: /^(sim|s|x|true|1)$/i.test(String(valores[i][cA]).trim()) });
  }
  return saida;
}

function alterarAcesso_(acao, registro, meuCodigo) {
  const aba = abaAcessos_();
  const valores = aba.getDataRange().getValues();
  const cab = valores[0].map((v) => String(v).trim());
  const cN = cab.indexOf('Nome') + 1, cC = cab.indexOf('Codigo') + 1, cA = cab.indexOf('Admin') + 1;
  const codigo = String(registro.codigo || '').trim();
  const original = String(registro.codigoOriginal || codigo).trim();
  if (!codigo) throw new Error('Informe o código.');

  const achar = (c) => { for (let i = 1; i < valores.length; i++) if (String(valores[i][cC - 1]).trim() === c) return i + 1; return -1; };
  const linhaOriginal = achar(original);

  if (acao === 'delete') {
    if (original === meuCodigo) throw new Error('Você não pode excluir o seu próprio acesso.');
    if (linhaOriginal > 0) aba.deleteRow(linhaOriginal);
    return;
  }
  if (acao !== 'upsert') return;

  if (codigo !== original && achar(codigo) > 0) throw new Error('Já existe alguém com esse código.');
  if (linhaOriginal < 0 && achar(codigo) > 0) throw new Error('Já existe alguém com esse código.');
  const admin = registro.admin ? 'Sim' : '';
  if (original === meuCodigo && (codigo !== original || !registro.admin)) {
    throw new Error('Para não perder o seu acesso, não dá para mudar o seu código nem tirar o seu Admin por aqui.');
  }
  if (linhaOriginal > 0) {
    aba.getRange(linhaOriginal, cN).setValue(String(registro.nome || '').trim());
    aba.getRange(linhaOriginal, cC).setNumberFormat('@').setValue(codigo);
    aba.getRange(linhaOriginal, cA).setValue(admin);
  } else {
    const nova = aba.getLastRow() + 1;
    aba.getRange(nova, cN).setValue(String(registro.nome || '').trim());
    aba.getRange(nova, cC).setNumberFormat('@').setValue(codigo);
    aba.getRange(nova, cA).setValue(admin);
  }
}
