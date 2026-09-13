// scanner.js — leitura de código de barras pela câmera.
//
// Sempre usa a API padrão BarcodeDetector do navegador. Em navegadores que
// já têm isso embutido (Chrome/Android), usa direto — rápido e 100% offline.
// Em navegadores sem essa leitura embutida (Safari/iPhone), carrega uma
// biblioteca (zbar-wasm) que "se disfarça" de BarcodeDetector, então o
// resto do código nem precisa saber a diferença. zbar-wasm é baseada numa
// biblioteca C madura (ZBar) e costuma ler com mais precisão que
// bibliotecas 100% JavaScript.
//
// Precisa de internet só na primeira vez que usar a câmera nesse
// aparelho — depois disso o app guarda em cache sozinho (veja sw.js).

const ZBAR_WASM_URL = 'https://cdn.jsdelivr.net/npm/@undecaf/zbar-wasm@0.9.15/dist/index.js';
const POLYFILL_URL = 'https://cdn.jsdelivr.net/npm/@undecaf/barcode-detector-polyfill@0.9.20/dist/index.js';
let carregandoPolyfill = null;

// Exige a MESMA leitura se repetir algumas vezes seguidas antes de aceitar
// como certa — evita que um quadro isolado com ruído confunda a leitura e
// registre um código errado.
const LEITURAS_PARA_CONFIRMAR = 3;

function suportaLeituraCamera() {
  return 'mediaDevices' in navigator; // câmera em si — o método de leitura é escolhido depois
}

function carregarScript_(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o leitor de código de barras (precisa de internet na primeira vez).'));
    document.head.appendChild(script);
  });
}

function carregarZbarEPolyfill_() {
  return carregarScript_(ZBAR_WASM_URL).then(() => carregarScript_(POLYFILL_URL));
}

// Garante que window.BarcodeDetector exista — usa a nativa se o navegador
// já tiver, senão carrega o substituto (zbar-wasm) uma vez só. Se os
// arquivos carregarem "com sucesso" mas vierem incompletos (ex: cache
// quebrado no meio do caminho), tenta de novo uma vez, ignorando qualquer
// cache antigo.
function garantirBarcodeDetector() {
  if ('BarcodeDetector' in window) return Promise.resolve();
  if (carregandoPolyfill) return carregandoPolyfill;

  const pronto = () => window.barcodeDetectorPolyfill && window.barcodeDetectorPolyfill.BarcodeDetectorPolyfill;

  carregandoPolyfill = carregarZbarEPolyfill_()
    .then(() => {
      if (pronto()) return;
      // Veio incompleto — tenta de novo forçando ignorar cache antigo.
      const semCache = '?v=' + Date.now();
      return carregarScript_(ZBAR_WASM_URL + semCache).then(() => carregarScript_(POLYFILL_URL + semCache));
    })
    .then(() => {
      if (!pronto()) {
        throw new Error('O leitor de código de barras não carregou corretamente. Verifique sua internet e tente de novo.');
      }
      window.BarcodeDetector = window.barcodeDetectorPolyfill.BarcodeDetectorPolyfill;
    })
    .catch((e) => {
      carregandoPolyfill = null; // permite tentar de novo na próxima vez que abrir o scanner
      throw e;
    });
  return carregandoPolyfill;
}

function criarOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.innerHTML = `
    <div class="scanner-caixa">
      <div class="scanner-camera-area"><video class="scanner-video" autoplay playsinline muted></video></div>
      <p class="scanner-dica">Aponte a câmera para o código de barras</p>
      <button class="botao scanner-fechar">Cancelar</button>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

// Recebe cada leitura "crua" da câmera; só chama aoConfirmar(codigo) depois
// da mesma leitura se repetir LEITURAS_PARA_CONFIRMAR vezes seguidas.
function criarConfirmadorLeitura(aoConfirmar, aoProgredir) {
  let ultimoCodigo = null;
  let contagem = 0;
  return function (codigo) {
    if (!codigo) return;
    if (codigo === ultimoCodigo) {
      contagem += 1;
    } else {
      ultimoCodigo = codigo;
      contagem = 1;
    }
    if (aoProgredir) aoProgredir(contagem, LEITURAS_PARA_CONFIRMAR);
    if (contagem >= LEITURAS_PARA_CONFIRMAR) {
      aoConfirmar(codigo);
    }
  };
}

async function abrirScanner(aoLer) {
  if (!('mediaDevices' in navigator)) {
    alert('Este navegador não tem acesso à câmera. Digite o código manualmente.');
    return;
  }

  const overlay = criarOverlay();
  const video = overlay.querySelector('.scanner-video');
  const dica = overlay.querySelector('.scanner-dica');
  const botaoFechar = overlay.querySelector('.scanner-fechar');
  let stream = null;
  let intervalo = null;
  let encerrado = false;

  function encerrar() {
    if (encerrado) return;
    encerrado = true;
    if (intervalo) clearInterval(intervalo);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    overlay.remove();
  }
  botaoFechar.addEventListener('click', encerrar);

  const mostrarProgresso = (contagem, necessarias) => {
    if (encerrado) return;
    dica.textContent = contagem >= necessarias
      ? 'Código confirmado!'
      : `Confirmando leitura… (${contagem}/${necessarias})`;
  };
  const confirmar = criarConfirmadorLeitura((codigo) => {
    encerrar();
    aoLer(codigo);
  }, mostrarProgresso);

  if (!('BarcodeDetector' in window)) {
    dica.textContent = 'Carregando leitor de código de barras…';
  }
  try {
    await garantirBarcodeDetector();
  } catch (e) {
    dica.textContent = e.message;
    return;
  }
  if (encerrado) return;
  dica.textContent = 'Aponte a câmera para o código de barras';

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
  } catch (e) {
    dica.textContent = 'Não foi possível acessar a câmera. Verifique a permissão do navegador.';
    return;
  }

  const detector = new BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
  });
  intervalo = setInterval(async () => {
    try {
      const codigos = await detector.detect(video);
      if (codigos.length > 0 && !encerrado) {
        confirmar(codigos[0].rawValue);
      }
    } catch (e) {
      // ignora falha pontual de um frame, tenta de novo no próximo
    }
  }, 250);
}

window.BramScanner = { abrirScanner, suportaLeituraCamera };
