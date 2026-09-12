// scanner.js — leitura de código de barras pela câmera.
// 1ª opção: BarcodeDetector nativa (Chrome/Android/Edge) — rápida e 100% offline.
// 2ª opção (fallback): biblioteca ZXing carregada de um CDN — funciona em
// qualquer navegador, incluindo Safari/iPhone, mas precisa de internet a
// primeira vez que for usada (depois disso o navegador costuma guardar em
// cache sozinho).

const ZXING_CDN_URL = 'https://unpkg.com/@zxing/browser@latest';
let zxingCarregando = null;

function suportaLeituraCamera() {
  return 'mediaDevices' in navigator; // câmera em si — o método de leitura é escolhido depois
}

function carregarZXing() {
  if (window.ZXingBrowser) return Promise.resolve();
  if (zxingCarregando) return zxingCarregando;

  zxingCarregando = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ZXING_CDN_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o leitor de código de barras (precisa de internet na primeira vez).'));
    document.head.appendChild(script);
  });
  return zxingCarregando;
}

function criarOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.innerHTML = `
    <div class="scanner-caixa">
      <video class="scanner-video" autoplay playsinline muted></video>
      <p class="scanner-dica">Aponte a câmera para o código de barras</p>
      <button class="botao scanner-fechar">Cancelar</button>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
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
  let leitorZXing = null;
  let encerrado = false;

  function encerrar() {
    if (encerrado) return;
    encerrado = true;
    if (intervalo) clearInterval(intervalo);
    if (leitorZXing) { try { leitorZXing.reset(); } catch (e) {} }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    overlay.remove();
  }
  botaoFechar.addEventListener('click', encerrar);

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
  } catch (e) {
    dica.textContent = 'Não foi possível acessar a câmera. Verifique a permissão do navegador.';
    return;
  }

  // 1ª opção: leitura nativa do navegador (offline, mais rápida).
  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
      });
      intervalo = setInterval(async () => {
        try {
          const codigos = await detector.detect(video);
          if (codigos.length > 0 && !encerrado) {
            const valor = codigos[0].rawValue;
            encerrar();
            aoLer(valor);
          }
        } catch (e) {
          // ignora falha pontual de um frame, tenta de novo no próximo
        }
      }, 300);
      return;
    } catch (e) {
      // se der erro ao criar o detector nativo, cai pro fallback abaixo
    }
  }

  // 2ª opção: biblioteca ZXing (funciona em qualquer navegador, incl. Safari).
  dica.textContent = 'Carregando leitor de código de barras…';
  try {
    await carregarZXing();
    if (encerrado) return;
    dica.textContent = 'Aponte a câmera para o código de barras';
    leitorZXing = new ZXingBrowser.BrowserMultiFormatReader();
    leitorZXing.decodeFromVideoElement(video, (resultado, erro) => {
      if (resultado && !encerrado) {
        const valor = resultado.getText();
        encerrar();
        aoLer(valor);
      }
      // erros de "nenhum código encontrado nesse frame" são normais e ignorados
    });
  } catch (e) {
    dica.textContent = e.message || 'Não foi possível carregar o leitor de código de barras. Digite manualmente.';
  }
}

window.BramScanner = { abrirScanner, suportaLeituraCamera };
