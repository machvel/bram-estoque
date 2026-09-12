// ui.js — liga a interface (estilo AppSheet: listas + FAB + bottom sheets)
// às regras de negócio de app.js/db.js/sync.js.

const NOME_TELA = { estoque: 'Estoque', requisicoes: 'Requisições', movimentos: 'Últimos movimentos', sincronizar: 'Sincronizar' };

function irParaAba(aba) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
  document.querySelectorAll('.tela').forEach((t) => t.classList.add('oculta'));
  document.getElementById('tela-' + aba).classList.remove('oculta');
  document.getElementById('tituloTela').textContent = NOME_TELA[aba];

  const fab = document.getElementById('fabAdicionar');
  fab.classList.toggle('oculto', aba === 'sincronizar' || aba === 'movimentos');
  // No celular, Sincronizar e Últimos movimentos só são acessíveis pelo menu
  // ☰ (somem da barra de baixo). No computador, o CSS mostra tudo sempre.

  if (aba === 'requisicoes') renderRequisicoes();
  if (aba === 'estoque') renderEstoque();
  if (aba === 'movimentos') renderMovimentos();
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => irParaAba(btn.dataset.aba));
});

// ---------- Menu lateral (drawer) ----------

function abrirDrawer() {
  document.getElementById('drawer').classList.remove('oculto');
  document.getElementById('drawerFundo').classList.remove('oculta');
}
function fecharDrawer() {
  document.getElementById('drawer').classList.add('oculto');
  document.getElementById('drawerFundo').classList.add('oculta');
}
document.getElementById('btnMenu').addEventListener('click', abrirDrawer);
document.getElementById('drawerFundo').addEventListener('click', fecharDrawer);
document.querySelectorAll('.drawer-item').forEach((btn) => {
  btn.addEventListener('click', () => { irParaAba(btn.dataset.aba); fecharDrawer(); });
});

function abaAtiva() {
  return document.getElementById('tela-sincronizar').classList.contains('oculta')
    ? (document.getElementById('tela-requisicoes').classList.contains('oculta') ? 'estoque' : 'requisicoes')
    : 'sincronizar';
}

function mostrarMensagem(elId, texto, tipo) {
  const el = document.getElementById(elId);
  el.textContent = texto;
  el.className = 'mensagem' + (tipo ? ' ' + tipo : '');
}

function abrirSheet(id) { document.getElementById(id).classList.remove('oculta'); }
function fecharSheet(id) { document.getElementById(id).classList.add('oculta'); }

let modoEdicaoItem = false;
function definirModoFormMovimento(edicao) {
  modoEdicaoItem = edicao;
  document.getElementById('segmentoTipoMov').classList.toggle('oculto-flex', edicao);
  document.getElementById('campoQuantidadeMov').classList.toggle('oculto-flex', edicao);
  document.getElementById('movQuantidade').required = !edicao;
  document.getElementById('tituloFormMovimento').textContent = edicao ? 'Editar item' : 'Registrar movimento';
  document.getElementById('sheetCaixaMovimento').classList.toggle('sheet-caixa-escura', edicao);
}

document.getElementById('fabAdicionar').addEventListener('click', () => {
  if (abaAtiva() === 'estoque') { definirModoFormMovimento(false); abrirSheet('modalMovimento'); }
  else if (abaAtiva() === 'requisicoes') abrirSheet('modalRequisicao');
});
document.getElementById('btnCancelarMovimento').addEventListener('click', () => fecharSheet('modalMovimento'));
document.getElementById('btnCancelarRequisicao').addEventListener('click', () => fecharSheet('modalRequisicao'));

// ---------- Foto do item (captura + compressão) ----------

let fotoAtualBase64 = '';

function comprimirImagem(arquivo, maxLado = 640, qualidade = 0.6) {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxLado) { height = Math.round(height * (maxLado / width)); width = maxLado; }
        else if (height > maxLado) { width = Math.round(width * (maxLado / height)); height = maxLado; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', qualidade));
      };
      img.onerror = reject;
      img.src = leitor.result;
    };
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

document.getElementById('movFoto').addEventListener('change', async (evt) => {
  const arquivo = evt.target.files[0];
  if (!arquivo) return;
  mostrarMensagem('msgFoto', 'Processando foto…');
  try {
    fotoAtualBase64 = await comprimirImagem(arquivo);
    const preview = document.getElementById('fotoPreview');
    preview.src = fotoAtualBase64;
    preview.classList.remove('oculto-flex');
    document.getElementById('btnRemoverFoto').classList.remove('oculto-flex');
    const kb = Math.round((fotoAtualBase64.length * 0.75) / 1024);
    mostrarMensagem('msgFoto', `Foto pronta (~${kb} KB).`, 'ok');
  } catch (e) {
    mostrarMensagem('msgFoto', 'Não foi possível processar a foto.', 'erro');
  }
});

document.getElementById('btnRemoverFoto').addEventListener('click', () => {
  fotoAtualBase64 = '';
  document.getElementById('movFoto').value = '';
  document.getElementById('fotoPreview').classList.add('oculto-flex');
  document.getElementById('btnRemoverFoto').classList.add('oculto-flex');
  mostrarMensagem('msgFoto', '');
});

function limparFoto() {
  fotoAtualBase64 = '';
  document.getElementById('fotoPreview').classList.add('oculto-flex');
  document.getElementById('btnRemoverFoto').classList.add('oculto-flex');
  mostrarMensagem('msgFoto', '');
}

// ---------- Seletor de cores (Prateleira) ----------

document.querySelectorAll('.seletor-cores').forEach((grupo) => {
  const alvo = document.getElementById(grupo.dataset.alvo);
  grupo.querySelectorAll('.cor-bolinha').forEach((bolinha) => {
    bolinha.addEventListener('click', () => {
      grupo.querySelectorAll('.cor-bolinha').forEach((b) => b.classList.remove('selecionada'));
      bolinha.classList.add('selecionada');
      alvo.value = bolinha.dataset.cor;
    });
  });
});

function limparSeletorCor(grupoEl) {
  grupoEl.querySelectorAll('.cor-bolinha').forEach((b) => b.classList.remove('selecionada'));
  document.getElementById(grupoEl.dataset.alvo).value = '';
}

// ---------- Status de conexão + fila ----------

let sincronizandoAgora = false;

async function atualizarStatusConexao() {
  const luz = document.getElementById('luzConexao');
  const texto = document.getElementById('textoConexao');
  const pendentes = await BramDB.tamanhoFila();
  const contador = document.getElementById('contadorFila');
  if (contador) contador.textContent = pendentes;

  if (!navigator.onLine) {
    luz.className = 'dot offline';
    texto.textContent = 'offline';
  } else if (pendentes > 0) {
    luz.className = 'dot pendente';
    texto.textContent = 'sincronizando…';
  } else {
    luz.className = 'dot online';
    texto.textContent = 'sincronizado';
  }

  // Tenta sincronizar sozinho sempre que há conexão e algo pendente,
  // sem precisar a pessoa tocar em nada.
  if (navigator.onLine && pendentes > 0 && !sincronizandoAgora && BramSync.getBackendUrl()) {
    sincronizandoAgora = true;
    try {
      await BramSync.sincronizarFila();
    } finally {
      sincronizandoAgora = false;
      const restam = await BramDB.tamanhoFila();
      const luz2 = document.getElementById('luzConexao');
      const texto2 = document.getElementById('textoConexao');
      if (restam > 0) {
        luz2.className = 'dot pendente';
        texto2.textContent = restam + ' pendente(s)';
      } else {
        luz2.className = 'dot online';
        texto2.textContent = 'sincronizado';
      }
      if (contador) contador.textContent = restam;
    }
  }
}

window.addEventListener('online', atualizarStatusConexao);
window.addEventListener('offline', atualizarStatusConexao);
document.addEventListener('bram-sync', atualizarStatusConexao);

// ---------- ESTOQUE ----------

let tipoMovimentoSelecionado = 'entrada';
document.querySelectorAll('.seg-tipo').forEach((btn) => {
  btn.addEventListener('click', () => {
    tipoMovimentoSelecionado = btn.dataset.tipo;
    document.querySelectorAll('.seg-tipo').forEach((b) => b.classList.remove('selecionado-entrada', 'selecionado-saida'));
    btn.classList.add(tipoMovimentoSelecionado === 'entrada' ? 'selecionado-entrada' : 'selecionado-saida');
  });
});

function inicial(nome) {
  return (nome || '?').trim().charAt(0).toUpperCase();
}

const CORES_PRATELEIRA = {
  Green: '#34A853', Yellow: '#FBBC04', Orange: '#FA7B17', Red: '#EA4335',
  Purple: '#9C27B0', Blue: '#4285F4', White: '#FFFFFF', Black: '#202124',
};

function localCompleto(i) {
  const bolinhaPrateleira = i.prateleira
    ? `<span class="bolinha-inline" style="background:${CORES_PRATELEIRA[i.prateleira] || '#ccc'}"></span>`
    : '';
  const endereco = [bolinhaPrateleira, i.coluna && `Col. ${i.coluna}`, i.linha && `Lin. ${i.linha}`].filter(Boolean).join(' · ');
  return [i.local, endereco].filter(Boolean).join(' · ') || 'sem local';
}

function avatarItem(i) {
  if (i.foto) return `<img class="card-avatar-img" src="${i.foto}" alt="${i.nome}" />`;
  return `<div class="card-avatar">${inicial(i.nome)}</div>`;
}

async function renderEstoque() {
  const filtro = (document.getElementById('buscaEstoque').value || '').toLowerCase();
  const bate = (i) => !filtro
    || String(i.nome || '').toLowerCase().includes(filtro)
    || String(i.idFluig || '').toLowerCase().includes(filtro)
    || String(i.pn || '').toLowerCase().includes(filtro)
    || String(i.marca || '').toLowerCase().includes(filtro)
    || String(i.obs || '').toLowerCase().includes(filtro);
  const itens = (await BramDB.getAll('estoque'))
    .filter(bate)
    .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));
  const container = document.getElementById('listaEstoqueCards');
  container.innerHTML = itens.map((i) => `
    <div class="card-item card-item--clicavel" data-idfluig="${i.idFluig}">
      ${avatarItem(i)}
      <div class="card-item-info">
        <div class="card-item-nome">${i.nome}</div>
        <div class="card-item-sub"><span>${i.idFluig}</span><span>${localCompleto(i)}</span></div>
      </div>
      <div class="card-item-qtd">${i.quantidade}</div>
    </div>`).join('') || '<div class="lista-vazia">Nenhum item encontrado. Toque em + para lançar.</div>';
  container.querySelectorAll('.card-item--clicavel').forEach((card) => {
    card.addEventListener('click', () => abrirDetalheItem(card.dataset.idfluig));
  });

  const datalist = document.getElementById('listaEstoque');
  datalist.innerHTML = itens.map((i) => `<option value="${i.idFluig}">${i.nome}</option>`).join('');
}

async function renderMovimentos() {
  const movs = (await BramDB.getAll('movimentos')).sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 30);
  document.getElementById('listaMovimentosCards').innerHTML = movs.map((m) => `
    <div class="card-item ${m.tipo === 'entrada' ? 'mov-entrada-borda' : 'mov-saida-borda'}">
      <div class="card-avatar">${inicial(m.nome)}</div>
      <div class="card-item-info">
        <div class="card-item-nome"><span class="icone-mov ${m.tipo === 'entrada' ? 'mov-entrada' : 'mov-saida'}">${m.tipo === 'entrada' ? '↓' : '↑'}</span>${m.nome}</div>
        <div class="card-item-sub"><span>${fmtData(m.data)}</span><span>${m.responsavel || '—'}</span></div>
      </div>
      <div class="card-item-qtd" style="background:none;color:var(--texto-fraco)">${m.quantidade}</div>
    </div>`).join('') || '<div class="lista-vazia">Nenhum movimento ainda.</div>';
}

document.getElementById('buscaEstoque').addEventListener('input', renderEstoque);

document.getElementById('btnScanBusca').addEventListener('click', () => {
  BramScanner.abrirScanner((codigo) => {
    const campo = document.getElementById('buscaEstoque');
    campo.value = codigo;
    renderEstoque();
  });
});

// ---------- Detalhe do item + ajuste rápido de quantidade ----------

let itemDetalheAtual = null;

async function abrirDetalheItem(idFluig) {
  const item = await BramDB.get('estoque', idFluig);
  if (!item) return;
  itemDetalheAtual = item;
  renderDetalheItem();
  document.getElementById('modalDetalheItem').classList.remove('oculta');
  document.querySelector('.app-shell').classList.add('detalhe-aberto');
}

function renderDetalheItem() {
  const item = itemDetalheAtual;
  document.getElementById('detalheNome').textContent = item.nome;
  document.getElementById('detalheCodigo').textContent = item.idFluig;

  const foto = document.getElementById('detalheFoto');
  const avatar = document.getElementById('detalheAvatar');
  if (item.foto) {
    foto.src = item.foto; foto.classList.remove('oculto-flex');
    avatar.classList.add('oculto-flex');
  } else {
    avatar.textContent = inicial(item.nome); avatar.classList.remove('oculto-flex');
    foto.classList.add('oculto-flex');
  }

  document.getElementById('detalhePn').textContent = item.pn || '—';
  document.getElementById('detalheItemCritico').textContent = item.itemCritico === true ? 'Sim' : item.itemCritico === false ? 'Não' : '—';
  document.getElementById('detalheMarca').textContent = item.marca || '—';
  document.getElementById('detalheLocal').textContent = item.local || '—';
  const corBolinha = item.prateleira
    ? `<span class="bolinha-inline" style="background:${CORES_PRATELEIRA[item.prateleira] || '#ccc'}"></span> ${item.prateleira}`
    : '—';
  document.getElementById('detalhePrateleira').innerHTML = corBolinha;
  document.getElementById('detalheColuna').textContent = item.coluna || '—';
  document.getElementById('detalheLinha').textContent = item.linha || '—';
  document.getElementById('detalheObs').textContent = item.obs || '—';
  document.getElementById('detalheQuantidade').textContent = item.quantidade;
  document.getElementById('btnDiminuir').disabled = item.quantidade <= 0;
}

document.getElementById('btnAumentar').addEventListener('click', async () => {
  try {
    await BramApp.registrarMovimento({ idFluig: itemDetalheAtual.idFluig, nome: itemDetalheAtual.nome, tipo: 'entrada', quantidade: 1 });
    itemDetalheAtual = await BramDB.get('estoque', itemDetalheAtual.idFluig);
    renderDetalheItem();
    await renderEstoque();
    await atualizarStatusConexao();
  } catch (e) {
    mostrarMensagem('msgDetalheItem', e.message, 'erro');
  }
});

document.getElementById('btnDiminuir').addEventListener('click', async () => {
  try {
    await BramApp.registrarMovimento({ idFluig: itemDetalheAtual.idFluig, nome: itemDetalheAtual.nome, tipo: 'saida', quantidade: 1 });
    itemDetalheAtual = await BramDB.get('estoque', itemDetalheAtual.idFluig);
    renderDetalheItem();
    await renderEstoque();
    await atualizarStatusConexao();
  } catch (e) {
    mostrarMensagem('msgDetalheItem', e.message, 'erro');
  }
});

document.getElementById('detalheFoto').addEventListener('click', () => {
  const src = document.getElementById('detalheFoto').src;
  if (!src) return;
  document.getElementById('fotoAmpliadaImg').src = src;
  document.getElementById('modalFotoAmpliada').classList.remove('oculta');
});
document.getElementById('btnFecharFotoAmpliada').addEventListener('click', () => {
  document.getElementById('modalFotoAmpliada').classList.add('oculta');
});
document.getElementById('modalFotoAmpliada').addEventListener('click', (evt) => {
  if (evt.target.id === 'modalFotoAmpliada') evt.currentTarget.classList.add('oculta');
});

document.getElementById('btnFecharDetalheItem').addEventListener('click', () => {
  document.getElementById('modalDetalheItem').classList.add('oculta');
  document.querySelector('.app-shell').classList.remove('detalhe-aberto');
  mostrarMensagem('msgDetalheItem', '');
});

document.getElementById('btnEditarDetalhes').addEventListener('click', () => {
  document.getElementById('modalDetalheItem').classList.add('oculta');
  document.querySelector('.app-shell').classList.remove('detalhe-aberto');
  const item = itemDetalheAtual;
  definirModoFormMovimento(true);
  document.getElementById('movIdFluig').value = item.idFluig;
  document.getElementById('movNome').value = item.nome;
  document.getElementById('movPn').value = item.pn || '';
  document.getElementById('movMarca').value = item.marca || '';
  document.getElementById('movItemCritico').value = item.itemCritico === true ? 'Sim' : item.itemCritico === false ? 'Não' : '';
  document.getElementById('movLocal').value = item.local || '';
  document.getElementById('movColuna').value = item.coluna || '';
  document.getElementById('movLinha').value = item.linha || '';
  document.getElementById('movObservacao').value = item.obs || '';
  if (item.foto) {
    const preview = document.getElementById('fotoPreview');
    preview.src = item.foto; preview.classList.remove('oculto-flex');
    document.getElementById('btnRemoverFoto').classList.remove('oculto-flex');
    fotoAtualBase64 = item.foto;
  }
  if (item.prateleira) {
    const bolinha = document.querySelector(`#modalMovimento .cor-bolinha[data-cor="${item.prateleira}"]`);
    if (bolinha) bolinha.classList.add('selecionada');
    document.getElementById('movPrateleira').value = item.prateleira;
  }
  abrirSheet('modalMovimento');
});

document.getElementById('btnExcluirItemEstoque').addEventListener('click', async () => {
  if (!confirm(`Excluir "${itemDetalheAtual.nome}" do estoque? Essa ação não pode ser desfeita.`)) return;
  try {
    await BramApp.excluirItemEstoque(itemDetalheAtual.idFluig);
    document.getElementById('modalDetalheItem').classList.add('oculta');
    document.querySelector('.app-shell').classList.remove('detalhe-aberto');
    await renderEstoque();
    await atualizarStatusConexao();
  } catch (e) {
    mostrarMensagem('msgDetalheItem', e.message, 'erro');
  }
});

document.getElementById('formMovimento').addEventListener('submit', async (evt) => {
  evt.preventDefault();
  const dadosComuns = {
    idFluig: document.getElementById('movIdFluig').value.trim(),
    nome: document.getElementById('movNome').value.trim(),
    pn: document.getElementById('movPn').value.trim(),
    marca: document.getElementById('movMarca').value.trim(),
    itemCritico: document.getElementById('movItemCritico').value,
    local: document.getElementById('movLocal').value.trim(),
    prateleira: document.getElementById('movPrateleira').value.trim(),
    coluna: document.getElementById('movColuna').value.trim(),
    linha: document.getElementById('movLinha').value.trim(),
    observacao: document.getElementById('movObservacao').value.trim(),
    foto: fotoAtualBase64,
  };
  try {
    if (modoEdicaoItem) {
      await BramApp.atualizarDadosItem(dadosComuns);
      mostrarMensagem('msgMovimento', 'Item atualizado.', 'ok');
    } else {
      await BramApp.registrarMovimento({
        ...dadosComuns,
        tipo: tipoMovimentoSelecionado,
        quantidade: document.getElementById('movQuantidade').value,
        responsavel: document.getElementById('movResponsavel').value.trim(),
      });
      mostrarMensagem('msgMovimento', tipoMovimentoSelecionado === 'entrada' ? 'Entrada registrada.' : 'Saída registrada.', 'ok');
    }
    evt.target.reset();
    limparSeletorCor(document.querySelector('#modalMovimento .seletor-cores'));
    limparFoto();
    await renderEstoque();
    await atualizarStatusConexao();
    setTimeout(() => { fecharSheet('modalMovimento'); mostrarMensagem('msgMovimento', ''); definirModoFormMovimento(false); }, 500);
  } catch (e) {
    mostrarMensagem('msgMovimento', e.message, 'erro');
  }
});

document.getElementById('btnScanMovimento').addEventListener('click', () => {
  BramScanner.abrirScanner((codigo) => { document.getElementById('movIdFluig').value = codigo; preencherNomePorCodigo(); });
});

async function preencherNomePorCodigo() {
  const idFluig = document.getElementById('movIdFluig').value.trim();
  const nomeCampo = document.getElementById('movNome');
  if (!idFluig || nomeCampo.value.trim()) return;
  const item = await BramDB.get('estoque', idFluig);
  if (!item) return;
  nomeCampo.value = item.nome;
  const pnCampo = document.getElementById('movPn');
  const marcaCampo = document.getElementById('movMarca');
  if (!pnCampo.value.trim() && item.pn) pnCampo.value = item.pn;
  if (!marcaCampo.value.trim() && item.marca) marcaCampo.value = item.marca;
}
document.getElementById('movIdFluig').addEventListener('change', preencherNomePorCodigo);
document.getElementById('movIdFluig').addEventListener('input', preencherNomePorCodigo);

// ---------- REQUISIÇÕES ----------

function atualizarVisibilidadeTipo() {
  const mostra = document.getElementById('reqTipoReq').value === 'Pedido';
  document.getElementById('campoReqTipo').style.display = mostra ? '' : 'none';
  atualizarVisibilidadeHelm();
}
function atualizarVisibilidadeHelm() {
  const ehPedidoManutencao = document.getElementById('reqTipoReq').value === 'Pedido' && document.getElementById('reqTipo').value === 'MANUTENÇÃO';
  document.getElementById('campoReqHelm').style.display = ehPedidoManutencao ? '' : 'none';
}
document.getElementById('reqTipoReq').addEventListener('change', atualizarVisibilidadeTipo);
document.getElementById('reqTipo').addEventListener('change', atualizarVisibilidadeHelm);
atualizarVisibilidadeTipo();

document.getElementById('formRequisicao').addEventListener('submit', async (evt) => {
  evt.preventDefault();
  try {
    await BramApp.criarRequisicao({
      reqNumero: document.getElementById('reqNumero').value.trim(),
      solicitante: document.getElementById('reqSolicitante').value.trim(),
      tipoReq: document.getElementById('reqTipoReq').value,
      tipo: document.getElementById('reqTipo').value,
      helm: document.getElementById('reqHelm').value.trim(),
    });
    mostrarMensagem('msgRequisicao', 'Requisição criada.', 'ok');
    evt.target.reset();
    atualizarVisibilidadeTipo();
    await renderRequisicoes();
    await atualizarStatusConexao();
    setTimeout(() => { fecharSheet('modalRequisicao'); mostrarMensagem('msgRequisicao', ''); }, 500);
  } catch (e) {
    mostrarMensagem('msgRequisicao', e.message, 'erro');
  }
});

function chipStatus(status) {
  if (status === 'Concluído' || status === 'Concluída') return 'chip-ok';
  if (status === 'Parc.' || status === 'Em andamento') return 'chip-alerta';
  if (status === 'Cancelado') return 'chip-perigo';
  return 'chip-neutro';
}

function bordaRequisicao(status) {
  if (status === 'Concluída') return 'borda-ok';
  if (status === 'Em andamento') return 'borda-alerta';
  return '';
}

async function preencherNomePorCodigoRequisicao(card) {
  const idFluig = card.querySelector('.in-idfluig').value.trim();
  const nomeCampo = card.querySelector('.in-nome');
  const linkCadastrar = card.querySelector('.link-cadastrar-item');
  const item = idFluig ? await BramDB.get('estoque', idFluig) : null;

  if (item && !nomeCampo.value.trim()) nomeCampo.value = item.nome;
  linkCadastrar.classList.toggle('oculto-flex', !idFluig || !!item);
}

function grupoStatusRequisicao(status) {
  const s = (status || '').toLowerCase();
  if (s.indexOf('cancel') !== -1) return 'canceladas';
  if (s.indexOf('conclu') !== -1) return 'concluidas';
  return 'abertas';
}

let gruposAbertos = { abertas: true, concluidas: false, canceladas: false };

async function renderRequisicoes() {
  const filtro = (document.getElementById('buscaRequisicoes').value || '').toLowerCase();
  const todosItens = await BramDB.getAll('itensStatus');

  const bateFiltro = (r) => {
    if (!filtro) return true;
    if (String(r.reqNumero || '').toLowerCase().includes(filtro)) return true;
    if (String(r.solicitante || '').toLowerCase().includes(filtro)) return true;
    if (String(r.obs || '').toLowerCase().includes(filtro)) return true;
    const itensDaReq = todosItens.filter((i) => i.requisicaoId === r.id);
    return itensDaReq.some((i) =>
      String(i.nomeItem || '').toLowerCase().includes(filtro) ||
      String(i.idFluig || '').toLowerCase().includes(filtro)
    );
  };

  const requisicoes = (await BramDB.getAll('requisicoes'))
    .filter(bateFiltro)
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  const container = document.getElementById('listaRequisicoes');

  if (requisicoes.length === 0) {
    container.innerHTML = '<div class="lista-vazia">Nenhuma requisição encontrada. Toque em + para criar.</div>';
    return;
  }

  const grupos = { abertas: [], concluidas: [], canceladas: [] };
  requisicoes.forEach((r) => grupos[grupoStatusRequisicao(r.status)].push(r));

  const NOMES_GRUPO = { abertas: 'Abertas', concluidas: 'Concluídas', canceladas: 'Canceladas' };

  container.innerHTML = Object.keys(NOMES_GRUPO).map((chave) => {
    const lista = grupos[chave];
    if (lista.length === 0) return '';
    const aberto = gruposAbertos[chave];
    return `
    <button type="button" class="grupo-requisicao-cabecalho" data-grupo="${chave}">
      <span>${NOMES_GRUPO[chave]} (${lista.length})</span>
      <span class="seta-grupo ${aberto ? 'aberta' : ''}">▾</span>
    </button>
    <div class="grupo-requisicao-corpo ${aberto ? '' : 'oculto-flex'}">
      ${lista.map((r) => renderCardRequisicao(r, todosItens)).join('')}
    </div>`;
  }).join('');

  ligarEventosRequisicoes(container);
}

function renderCardRequisicao(r, todosItens) {
  const itens = todosItens.filter((i) => i.requisicaoId === r.id);
  const tituloTipo = r.tipoReq === 'Pedido' ? `Pedido · ${r.tipo === 'MANUTENÇÃO' ? 'Manutenção' : 'Operação'}` : (r.tipoReq || 'Pedido');
  const numero = r.reqNumero ? `REQ ${r.reqNumero}` : '';
  return `
    <div class="card-requisicao ${bordaRequisicao(r.status)}" data-req="${r.id}">
      <button type="button" class="req-cabecalho req-cabecalho--clicavel">
        <div>
          <div class="req-titulo">${[numero, r.solicitante || '(sem nome)', tituloTipo].filter(Boolean).join(' · ')}</div>
          <div class="req-data">${fmtData(r.data)}${r.helm ? ` · HELM ${r.helm}` : ''} · ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}</div>
        </div>
        <span class="chip ${chipStatus(r.status)}">${r.status}</span>
      </button>
      <div class="req-corpo oculto-flex">
        ${itens.map((i) => `
          <div class="item-req-linha" data-item="${i.id}">
            <span>${i.nomeItem} — ${i.qtdeRecebida}/${i.quantidadeSolicitada}</span>
            <span class="chip ${chipStatus(i.status)}">${i.status}</span>
            <span class="acoes">
              ${i.status !== 'Concluído' && i.status !== 'Cancelado' ? `
                <button class="botao botao-texto btn-receber" data-item="${i.id}">Receber</button>
                <button class="botao botao-perigo-texto btn-cancelar" data-item="${i.id}">Cancelar</button>` : ''}
            </span>
          </div>`).join('')}
        <div class="form-item-inline">
          <span class="campo-com-scan">
            <input type="text" class="in-idfluig" placeholder="Código" />
            <button type="button" class="botao-scan btn-scan-item" aria-label="Ler código de barras">📷</button>
          </span>
          <input type="text" class="in-nome" placeholder="Descrição" />
          <button type="button" class="link-cadastrar-item oculto-flex campo-linha-inteira">Item não encontrado no estoque — toque aqui para cadastrar</button>
          <input type="number" class="in-qtd campo-linha-inteira" placeholder="Qtd." min="1" step="1" inputmode="numeric" />
          <button class="botao btn-add-item">+ item</button>
        </div>
        <button type="button" class="botao botao-perigo-texto btn-excluir-requisicao" style="width:100%; margin-top:8px">Excluir requisição</button>
      </div>
    </div>`;
}

function ligarEventosRequisicoes(container) {
  container.querySelectorAll('.grupo-requisicao-cabecalho').forEach((btn) => {
    btn.addEventListener('click', () => {
      const chave = btn.dataset.grupo;
      gruposAbertos[chave] = !gruposAbertos[chave];
      renderRequisicoes();
    });
  });

  container.querySelectorAll('.req-cabecalho--clicavel').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.nextElementSibling.classList.toggle('oculto-flex');
    });
  });

  container.querySelectorAll('.btn-scan-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.card-requisicao');
      const campo = btn.closest('.campo-com-scan').querySelector('.in-idfluig');
      BramScanner.abrirScanner((codigo) => {
        campo.value = codigo;
        preencherNomePorCodigoRequisicao(card);
      });
    });
  });

  container.querySelectorAll('.in-idfluig').forEach((campo) => {
    campo.addEventListener('input', () => preencherNomePorCodigoRequisicao(campo.closest('.card-requisicao')));
    campo.addEventListener('change', () => preencherNomePorCodigoRequisicao(campo.closest('.card-requisicao')));
  });

  container.querySelectorAll('.link-cadastrar-item').forEach((link) => {
    link.addEventListener('click', () => {
      const card = link.closest('.card-requisicao');
      const idFluig = card.querySelector('.in-idfluig').value.trim();
      const nome = card.querySelector('.in-nome').value.trim();
      if (!idFluig) return;
      definirModoFormMovimento(true);
      document.getElementById('movIdFluig').value = idFluig;
      document.getElementById('movNome').value = nome;
      abrirSheet('modalMovimento');
    });
  });

  container.querySelectorAll('.btn-add-item').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.card-requisicao');
      const requisicaoId = card.dataset.req;
      const idFluig = card.querySelector('.in-idfluig').value.trim();
      const nome = card.querySelector('.in-nome').value.trim();
      const qtd = card.querySelector('.in-qtd').value;
      try {
        await BramApp.adicionarItemRequisicao({ requisicaoId, idFluig, nomeItem: nome, quantidadeSolicitada: qtd });
        await renderRequisicoes();
        await renderEstoque();
        await atualizarStatusConexao();
      } catch (e) {
        alert(e.message);
      }
    });
  });

  container.querySelectorAll('.btn-receber').forEach((btn) => {
    btn.addEventListener('click', () => abrirFluxoRecebimento(btn.dataset.item));
  });
  container.querySelectorAll('.btn-cancelar').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Cancelar este item da requisição?')) return;
      await BramApp.cancelarItemRequisicao(btn.dataset.item);
      await renderRequisicoes();
      await renderEstoque();
      await atualizarStatusConexao();
    });
  });
  container.querySelectorAll('.btn-excluir-requisicao').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.card-requisicao');
      if (!confirm('Excluir esta requisição e todos os seus itens? Essa ação não pode ser desfeita.')) return;
      try {
        await BramApp.excluirRequisicao(card.dataset.req);
        await renderRequisicoes();
        await renderEstoque();
        await atualizarStatusConexao();
      } catch (e) {
        alert(e.message);
      }
    });
  });
}

document.getElementById('buscaRequisicoes').addEventListener('input', renderRequisicoes);

async function renderItensAvulsos() {
  const filtro = (document.getElementById('buscaAvulsos').value || '').trim().toLowerCase();
  const container = document.getElementById('listaItensAvulsos');

  if (!filtro) {
    container.innerHTML = '<div class="lista-vazia">Digite algo acima para buscar no histórico (são muitos itens para listar todos de uma vez).</div>';
    return;
  }

  const todosItens = await BramDB.getAll('itensStatus');
  const avulsos = todosItens
    .filter((i) => !i.requisicaoId)
    .filter((i) => String(i.nomeItem || '').toLowerCase().includes(filtro) || String(i.idFluig || '').toLowerCase().includes(filtro))
    .slice(0, 60);

  if (avulsos.length === 0) {
    container.innerHTML = '<div class="lista-vazia">Nenhum item avulso encontrado com esse termo.</div>';
    return;
  }

  container.innerHTML = avulsos.map((i) => `
    <div class="item-req-linha" data-item="${i.id}" style="background:var(--superficie); border-radius:8px; padding:10px 12px; border-top:none; box-shadow:0 1px 2px rgba(0,0,0,0.08); margin-bottom:6px;">
      <span>${i.nomeItem || '(sem nome)'} — ${i.idFluig || 's/ código'} · ${i.qtdeRecebida || 0}/${i.quantidadeSolicitada || '?'}</span>
      <span class="chip ${chipStatus(i.status)}">${i.status}</span>
      <span class="acoes">
        ${i.status !== 'Concluído' && i.status !== 'Cancelado' ? `
          <button class="botao botao-texto btn-receber-avulso" data-item="${i.id}">Receber</button>
          <button class="botao botao-perigo-texto btn-cancelar-avulso" data-item="${i.id}">Cancelar</button>` : ''}
      </span>
    </div>`).join('');

  container.querySelectorAll('.btn-receber-avulso').forEach((btn) => {
    btn.addEventListener('click', () => abrirFluxoRecebimento(btn.dataset.item, renderItensAvulsos));
  });
  container.querySelectorAll('.btn-cancelar-avulso').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Cancelar este item?')) return;
      await BramApp.cancelarItemRequisicao(btn.dataset.item);
      await renderItensAvulsos();
      await renderEstoque();
      await atualizarStatusConexao();
    });
  });
}

document.getElementById('buscaAvulsos').addEventListener('input', renderItensAvulsos);

async function abrirFluxoRecebimento(itemId, aoAtualizar) {
  aoAtualizar = aoAtualizar || renderRequisicoes;
  const qtd = prompt('Quantidade recebida agora:');
  if (qtd === null) return;
  try {
    await BramApp.receberItemRequisicao({ itemId, quantidadeAgora: qtd });
    await aoAtualizar();
    await renderEstoque();
    await atualizarStatusConexao();
  } catch (e) {
    if (e.message === 'LOCAL_NECESSARIO') {
      abrirModalLocal(async (local, prateleira, coluna, linha) => {
        try {
          await BramApp.receberItemRequisicao({ itemId, quantidadeAgora: qtd, local, prateleira, coluna, linha });
          await aoAtualizar();
          await renderEstoque();
          await atualizarStatusConexao();
        } catch (e2) {
          alert(e2.message);
        }
      });
    } else {
      alert(e.message);
    }
  }
}

function abrirModalLocal(aoConfirmar) {
  const modal = document.getElementById('modalLocal');
  const input = document.getElementById('modalLocalInput');
  const inputPrateleira = document.getElementById('modalPrateleiraInput');
  const inputColuna = document.getElementById('modalColunaInput');
  const inputLinha = document.getElementById('modalLinhaInput');
  input.value = ''; inputColuna.value = ''; inputLinha.value = '';
  limparSeletorCor(modal.querySelector('.seletor-cores'));
  modal.classList.remove('oculta');

  const fechar = () => modal.classList.add('oculta');
  document.getElementById('modalLocalConfirmar').onclick = () => {
    const valor = input.value.trim();
    if (!valor) return;
    fechar();
    aoConfirmar(valor, inputPrateleira.value.trim(), inputColuna.value.trim(), inputLinha.value.trim());
  };
  document.getElementById('modalLocalCancelar').onclick = fechar;
}

// ---------- SINCRONIZAÇÃO ----------

document.getElementById('backendUrl').value = BramSync.getBackendUrl();

document.getElementById('formBackend').addEventListener('submit', (evt) => {
  evt.preventDefault();
  BramSync.setBackendUrl(document.getElementById('backendUrl').value);
  mostrarMensagem('msgBackend', 'Endereço salvo.', 'ok');
  atualizarStatusConexao();
});

document.getElementById('btnSincronizarAgora').addEventListener('click', async () => {
  mostrarMensagem('msgSync', 'Sincronizando…');
  const r = await BramSync.sincronizarFila((feitos, total) => {
    mostrarMensagem('msgSync', `Enviando… ${feitos}/${total}`);
  });
  if (r.erro === 'sem-url') mostrarMensagem('msgSync', 'Configure o endereço do backend primeiro.', 'erro');
  else if (r.erro === 'interrompido') mostrarMensagem('msgSync', `Enviado ${r.enviados}, mas a conexão caiu. Restam ${r.restantes}.`, 'erro');
  else mostrarMensagem('msgSync', `Tudo sincronizado (${r.enviados} enviados).`, 'ok');
  await atualizarStatusConexao();
});

document.getElementById('btnPuxarServidor').addEventListener('click', async () => {
  if (!confirm('Isso vai trazer os dados da planilha para este aparelho. Continuar?')) return;
  mostrarMensagem('msgSync', 'Puxando dados da planilha…');
  try {
    await BramSync.puxarDoServidor();
    await BramApp.migrarDuplicadosEstoque();
    mostrarMensagem('msgSync', 'Dados atualizados a partir da planilha.', 'ok');
    await renderEstoque();
    await renderRequisicoes();
  } catch (e) {
    mostrarMensagem('msgSync', e.message, 'erro');
  }
});

document.getElementById('btnLimparFila').addEventListener('click', async () => {
  const quantos = await BramDB.tamanhoFila();
  if (quantos === 0) { mostrarMensagem('msgSync', 'A fila já está vazia.', 'ok'); return; }
  if (!confirm(`Isso vai apagar ${quantos} alteração(ões) pendente(s) de envio, sem tentar enviar pra planilha. Use isso só se a fila estiver travada. Continuar?`)) return;
  await BramDB.limparFila();
  mostrarMensagem('msgSync', 'Fila pendente limpa.', 'ok');
  await atualizarStatusConexao();
});

// ---------- Inicialização ----------

(async function iniciar() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  await BramDB.abrirDB();
  await BramApp.migrarDuplicadosEstoque();
  await renderEstoque();
  await atualizarStatusConexao();

  if (navigator.onLine && BramSync.getBackendUrl()) {
    BramSync.sincronizarFila().then(atualizarStatusConexao);
  }
  setInterval(atualizarStatusConexao, 5000);
})();
