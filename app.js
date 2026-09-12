// app.js — regras de negócio (estoque + requisições) e renderização da tela.

const fmtData = (iso) => new Date(iso).toLocaleString('pt-BR');
const uid = () => Date.now() + '-' + Math.random().toString(36).slice(2, 8);

function paraInteiro(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n)) throw new Error('A quantidade precisa ser um número inteiro (sem vírgula ou ponto).');
  return n;
}

// ---------- ESTOQUE ----------

function contarCamposPreenchidos(item) {
  const campos = ['local', 'prateleira', 'coluna', 'linha', 'pn', 'marca', 'foto', 'obs'];
  return campos.reduce((total, campo) => total + (item[campo] ? 1 : 0), 0);
}

// Corrige duplicados criados pelo bug de código vindo como número da
// planilha (ex: 10603901 vs "10603901") — mesmo item, chaves diferentes.
// Junta tudo numa única linha, com chave sempre em texto, mantendo os
// dados mais completos e somando a quantidade de todas as cópias.
async function migrarDuplicadosEstoque() {
  const todos = await BramDB.getAll('estoque');
  const grupos = {};
  for (const item of todos) {
    const chave = String(item.idFluig);
    (grupos[chave] = grupos[chave] || []).push(item);
  }

  for (const chave in grupos) {
    const grupo = grupos[chave];
    const jaCorreto = grupo.length === 1 && typeof grupo[0].idFluig === 'string';
    if (jaCorreto) continue;

    grupo.sort((a, b) => contarCamposPreenchidos(b) - contarCamposPreenchidos(a));
    const base = grupo[0];
    const itemUnificado = { ...base, idFluig: chave };

    for (const item of grupo) {
      await BramDB.del('estoque', item.idFluig);
    }
    await BramDB.put('estoque', itemUnificado);
    await BramDB.enfileirar('estoque', 'upsert', itemUnificado);
  }
}

async function obterOuCriarEstoque(idFluig, nome, unidade) {
  idFluig = String(idFluig);
  let item = await BramDB.get('estoque', idFluig);
  if (!item) {
    item = { idFluig, nome: nome || idFluig, quantidade: 0, unidade: unidade || 'un', local: '', prateleira: '', coluna: '', linha: '', foto: '', pn: '', marca: '', obs: '', itemCritico: '' };
  }
  return item;
}

async function registrarMovimento({ idFluig, nome, tipo, quantidade, unidade, local, prateleira, coluna, linha, responsavel, observacao, foto, pn, marca, itemCritico }) {
  quantidade = paraInteiro(quantidade);
  if (!idFluig || !quantidade || quantidade <= 0) {
    throw new Error('Informe o item e uma quantidade maior que zero.');
  }

  const item = await obterOuCriarEstoque(idFluig, nome, unidade);
  if (tipo === 'saida' && item.quantidade < quantidade) {
    throw new Error(`Estoque insuficiente: há ${item.quantidade} ${item.unidade} de "${item.nome}".`);
  }

  item.quantidade = tipo === 'entrada' ? item.quantidade + quantidade : item.quantidade - quantidade;
  if (local) item.local = local;
  if (prateleira) item.prateleira = prateleira;
  if (coluna) item.coluna = coluna;
  if (linha) item.linha = linha;
  if (foto) item.foto = foto;
  if (pn) item.pn = pn;
  if (marca) item.marca = marca;
  if (itemCritico) item.itemCritico = itemCritico === 'Sim';
  if (observacao) item.obs = observacao;
  if (nome) item.nome = nome;

  await BramDB.put('estoque', item);
  await BramDB.enfileirar('estoque', 'upsert', item);

  const mov = {
    id: uid(),
    idFluig,
    nome: item.nome,
    tipo,
    quantidade,
    unidade: item.unidade,
    local: item.local,
    responsavel: responsavel || '',
    observacao: observacao || '',
    data: new Date().toISOString(),
  };
  await BramDB.put('movimentos', mov);
  await BramDB.enfileirar('movimentos', 'upsert', mov);

  return { item, mov };
}

// Exclui um item de estoque por completo (não é uma saída — some da lista).
// Atualiza só os dados cadastrais do item (local, prateleira, coluna, linha,
// foto, P/N, marca, observação) — não mexe na quantidade nem gera movimento.
async function atualizarDadosItem({ idFluig, nome, local, prateleira, coluna, linha, foto, pn, marca, observacao, itemCritico }) {
  const item = await obterOuCriarEstoque(idFluig, nome);
  if (nome) item.nome = nome;
  if (local) item.local = local;
  if (prateleira) item.prateleira = prateleira;
  if (coluna) item.coluna = coluna;
  if (linha) item.linha = linha;
  if (foto) item.foto = foto;
  if (pn) item.pn = pn;
  if (marca) item.marca = marca;
  if (itemCritico) item.itemCritico = itemCritico === 'Sim';
  if (observacao) item.obs = observacao;

  await BramDB.put('estoque', item);
  await BramDB.enfileirar('estoque', 'upsert', item);
  return item;
}

async function excluirItemEstoque(idFluig) {
  idFluig = String(idFluig);
  const item = await BramDB.get('estoque', idFluig);
  if (!item) throw new Error('Item não encontrado.');
  await BramDB.del('estoque', idFluig);
  await BramDB.enfileirar('estoque', 'delete', { idFluig });
}

// ---------- REQUISIÇÕES ----------
// tipoReq: 'Pedido' | 'Desembarque' | 'Cadastro'
// tipo (só relevante quando tipoReq === 'Pedido'): 'OPERAÇÃO' | 'MANUTENÇÃO'

async function criarRequisicao({ solicitante, tipoReq, tipo, helm, reqNumero }) {
  const ehPedidoManutencao = tipoReq === 'Pedido' && tipo === 'MANUTENÇÃO';
  const req = {
    id: uid(),
    reqNumero: reqNumero || '',
    solicitante: solicitante || '',
    tipoReq: tipoReq || 'Pedido',
    tipo: tipoReq === 'Pedido' ? (tipo || 'OPERAÇÃO') : '',
    helm: ehPedidoManutencao ? (helm || '') : '',
    data: new Date().toISOString(),
    status: 'Aberta',
  };
  await BramDB.put('requisicoes', req);
  await BramDB.enfileirar('requisicoes', 'upsert', req);
  return req;
}

// Ação rápida: marca a requisição inteira como concluída ou cancelada
// diretamente (sem mexer nos itens um por um).
async function definirStatusRequisicao(requisicaoId, novoStatus) {
  const requisicao = await BramDB.get('requisicoes', requisicaoId);
  if (!requisicao) throw new Error('Requisição não encontrada.');
  requisicao.status = novoStatus;
  requisicao.dataFinalizada = new Date().toISOString();
  await BramDB.put('requisicoes', requisicao);
  await BramDB.enfileirar('requisicoes', 'upsert', requisicao);
}

async function excluirRequisicao(requisicaoId) {
  const requisicao = await BramDB.get('requisicoes', requisicaoId);
  if (!requisicao) throw new Error('Requisição não encontrada.');
  const itens = (await BramDB.getAll('itensStatus')).filter((i) => i.requisicaoId === requisicaoId);

  for (const item of itens) {
    // Devolve ao estoque o que estava reservado (Pedido + Manutenção) e ainda não foi usado.
    if (requisicao.tipoReq === 'Pedido' && requisicao.tipo === 'MANUTENÇÃO' && item.status !== 'Cancelado') {
      const pendente = item.quantidadeSolicitada - item.qtdeRecebida;
      if (pendente > 0) {
        const itemEstoque = await obterOuCriarEstoque(item.idFluig, item.nomeItem);
        itemEstoque.quantidade += pendente;
        await BramDB.put('estoque', itemEstoque);
        await BramDB.enfileirar('estoque', 'upsert', itemEstoque);
      }
    }
    await BramDB.del('itensStatus', item.id);
    await BramDB.enfileirar('itensStatus', 'delete', { id: item.id });
  }

  await BramDB.del('requisicoes', requisicaoId);
  await BramDB.enfileirar('requisicoes', 'delete', { id: requisicaoId });
}

async function adicionarItemRequisicao({ requisicaoId, idFluig, nomeItem, quantidadeSolicitada }) {
  const requisicao = await BramDB.get('requisicoes', requisicaoId);
  if (!requisicao) throw new Error('Requisição não encontrada.');
  quantidadeSolicitada = paraInteiro(quantidadeSolicitada);

  const itemEstoque = await obterOuCriarEstoque(idFluig, nomeItem);
  const ehPedidoManutencao = requisicao.tipoReq === 'Pedido' && requisicao.tipo === 'MANUTENÇÃO';

  // Pedido de Manutenção: material já sai reservado do estoque no momento do pedido.
  if (ehPedidoManutencao) {
    if (itemEstoque.quantidade < quantidadeSolicitada) {
      throw new Error(`Estoque insuficiente para reservar: há ${itemEstoque.quantidade} ${itemEstoque.unidade}.`);
    }
    itemEstoque.quantidade -= quantidadeSolicitada;
    await BramDB.put('estoque', itemEstoque);
    await BramDB.enfileirar('estoque', 'upsert', itemEstoque);
  }

  const item = {
    id: uid(),
    requisicaoId,
    idFluig,
    nomeItem: nomeItem || itemEstoque.nome,
    quantidadeSolicitada,
    qtdeRecebida: 0,
    quantidadeAgora: 0,
    status: 'Aberto', // Aberto | Parc. | Concluído | Cancelado
    dataFinalizada: '',
  };
  await BramDB.put('itensStatus', item);
  await BramDB.enfileirar('itensStatus', 'upsert', item);
  return item;
}

// Recebimento (total ou parcial) de um item de requisição.
async function receberItemRequisicao({ itemId, quantidadeAgora, local, prateleira, coluna, linha }) {
  const item = await BramDB.get('itensStatus', itemId);
  if (!item) throw new Error('Item não encontrado.');
  const requisicao = await BramDB.get('requisicoes', item.requisicaoId);

  quantidadeAgora = paraInteiro(quantidadeAgora);
  if (!quantidadeAgora || quantidadeAgora <= 0) throw new Error('Informe uma quantidade maior que zero.');

  const restante = item.quantidadeSolicitada - item.qtdeRecebida;
  if (quantidadeAgora > restante) {
    throw new Error(`Só falta receber ${restante}. Quantidade informada é maior que o pendente.`);
  }

  item.qtdeRecebida += quantidadeAgora;
  item.quantidadeAgora = quantidadeAgora;
  item.status = item.qtdeRecebida >= item.quantidadeSolicitada ? 'Concluído' : 'Parc.';
  if (item.status === 'Concluído') item.dataFinalizada = new Date().toISOString();

  // Só Pedido mexe no estoque. Desembarque/Cadastro são só registro.
  if (requisicao.tipoReq === 'Pedido' && requisicao.tipo === 'OPERAÇÃO') {
    // Operação: ao concluir/receber, o item vai direto pro estoque.
    const itemEstoque = await obterOuCriarEstoque(item.idFluig, item.nomeItem);
    if (!itemEstoque.local && !local) {
      throw new Error('LOCAL_NECESSARIO'); // sinalizador especial para a UI pedir o local
    }
    itemEstoque.quantidade += quantidadeAgora;
    if (local) itemEstoque.local = local;
    if (prateleira) itemEstoque.prateleira = prateleira;
    if (coluna) itemEstoque.coluna = coluna;
    if (linha) itemEstoque.linha = linha;
    await BramDB.put('estoque', itemEstoque);
    await BramDB.enfileirar('estoque', 'upsert', itemEstoque);

    const mov = {
      id: uid(),
      idFluig: item.idFluig,
      nome: item.nomeItem,
      tipo: 'entrada',
      quantidade: quantidadeAgora,
      unidade: itemEstoque.unidade,
      local: itemEstoque.local,
      responsavel: requisicao.solicitante,
      observacao: `Recebido da requisição ${requisicao.id}`,
      data: new Date().toISOString(),
    };
    await BramDB.put('movimentos', mov);
    await BramDB.enfileirar('movimentos', 'upsert', mov);
  }
  // Pedido de Manutenção: material já foi reservado na criação; concluir não mexe no estoque.
  // Desembarque / Cadastro: nunca mexem no estoque.

  await BramDB.put('itensStatus', item);
  await BramDB.enfileirar('itensStatus', 'upsert', item);
  await atualizarStatusRequisicao(requisicao.id);
  return item;
}

async function cancelarItemRequisicao(itemId) {
  const item = await BramDB.get('itensStatus', itemId);
  if (!item) throw new Error('Item não encontrado.');
  const requisicao = await BramDB.get('requisicoes', item.requisicaoId);

  // Devolve ao estoque o que havia sido reservado (Pedido + Manutenção) e não foi usado.
  if (requisicao.tipoReq === 'Pedido' && requisicao.tipo === 'MANUTENÇÃO' && item.status !== 'Cancelado') {
    const pendente = item.quantidadeSolicitada - item.qtdeRecebida;
    if (pendente > 0) {
      const itemEstoque = await obterOuCriarEstoque(item.idFluig, item.nomeItem);
      itemEstoque.quantidade += pendente;
      await BramDB.put('estoque', itemEstoque);
      await BramDB.enfileirar('estoque', 'upsert', itemEstoque);
    }
  }

  item.status = 'Cancelado';
  item.dataFinalizada = new Date().toISOString();
  await BramDB.put('itensStatus', item);
  await BramDB.enfileirar('itensStatus', 'upsert', item);
  await atualizarStatusRequisicao(requisicao.id);
}

async function atualizarStatusRequisicao(requisicaoId) {
  const requisicao = await BramDB.get('requisicoes', requisicaoId);
  if (!requisicao) return;
  const todos = (await BramDB.getAll('itensStatus')).filter((i) => i.requisicaoId === requisicaoId);
  if (todos.length === 0) return;
  const relevantes = todos.filter((i) => i.status !== 'Cancelado');
  const status = relevantes.length > 0 && relevantes.every((i) => i.status === 'Concluído')
    ? 'Concluída'
    : relevantes.some((i) => i.status === 'Parc.' || i.status === 'Concluído')
    ? 'Em andamento'
    : 'Aberta';
  if (status === requisicao.status) return; // nada mudou — não enfileira de novo
  requisicao.status = status;
  await BramDB.put('requisicoes', requisicao);
  await BramDB.enfileirar('requisicoes', 'upsert', requisicao);
}

window.BramApp = {
  registrarMovimento,
  atualizarDadosItem,
  excluirItemEstoque,
  migrarDuplicadosEstoque,
  criarRequisicao,
  excluirRequisicao,
  definirStatusRequisicao,
  adicionarItemRequisicao,
  receberItemRequisicao,
  cancelarItemRequisicao,
  atualizarStatusRequisicao,
};
