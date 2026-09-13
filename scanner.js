// scanner.js — leitura de código de barras pela câmera.
// 1ª opção: BarcodeDetector nativa (Chrome/Android/Edge) — rápida e 100% offline.
// 2ª opção (fallback): biblioteca Quagga2 carregada de um CDN — funciona em
// qualquer navegador, incluindo Safari/iPhone, mas precisa de internet a
// primeira vez que for usada (depois disso o app guarda em cache sozinho).

const QUAGGA_CDN_URL = 'https://unpkg.com/@ericblade/quagga2/dist/quagga.min.js';
let quaggaCarregando = null;

function suportaLeituraCamera() {
  return 'mediaDevices' in navigator; // câmera em si — o método de leitura é escolhido depois
}

function carregarQuagga() {
  if (window.Quagga) return Promise.resolve();
  if (quaggaCarregando) return quaggaCarregando;

  quaggaCarregando = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = QUAGGA_CDN_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o leitor de código de barras (precisa de internet na primeira vez).'));
    document.head.appendChild(script);
  });
  return quaggaCarregando;
}

function criarOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.innerHTML = `
    <div class="scanner-caixa">
      <div class="scanner-camera-area"></div>
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
  const areaCamera = overlay.querySelector('.scanner-camera-area');
  const dica = overlay.querySelector('.scanner-dica');
  const botaoFechar = overlay.querySelector('.scanner-fechar');
  let stream = null;
  let intervalo = null;
  let usandoQuagga = false;
  let encerrado = false;

  function encerrar() {
    if (encerrado) return;
    encerrado = true;
    if (intervalo) clearInterval(intervalo);
    if (usandoQuagga && window.Quagga) { try { window.Quagga.stop(); } catch (e) {} }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    overlay.remove();
  }
  botaoFechar.addEventListener('click', encerrar);

  // 1ª opção: leitura nativa do navegador (offline, mais rápida) — usa um
  // <video> próprio, com a câmera que a gente mesmo pede.
  if ('BarcodeDetector' in window) {
    try {
      const video = document.createElement('video');
      video.className = 'scanner-video';
      video.autoplay = true; video.playsInline = true; video.muted = true;
      areaCamera.appendChild(video);

      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream;

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
      // se der erro (câmera negada, ou detector nativo falhou), cai pro fallback abaixo
      if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
      areaCamera.innerHTML = '';
    }
  }

  // 2ª opção: biblioteca Quagga2 (funciona em qualquer navegador, incl.
  // Safari) — ela mesma pede acesso à câmera e cria o próprio vídeo dentro
  // do container que a gente passa.
  dica.textContent = 'Carregando leitor de código de barras…';
  try {
    await carregarQuagga();
    if (encerrado) return;
    usandoQuagga = true;
    dica.textContent = 'Aponte a câmera para o código de barras';

    window.Quagga.init({
      inputStream: {
        type: 'LiveStream',
        target: areaCamera,
        constraints: { facingMode: 'environment' },
      },
      locator: { patchSize: 'medium', halfSample: true },
      numOfWorkers: 2,
      decoder: {
        readers: ['code_128_reader', 'ean_reader', 'ean_8_reader', 'code_39_reader', 'upc_reader', 'upc_e_reader'],
      },
      locate: true,
    }, (erro) => {
      if (erro) {
        dica.textContent = 'Não foi possível acessar a câmera. Verifique a permissão do navegador.';
        return;
      }
      if (encerrado) return;
      window.Quagga.start();
      window.Quagga.onDetected((resultado) => {
        const valor = resultado && resultado.codeResult && resultado.codeResult.code;
        if (valor && !encerrado) {
          encerrar();
          aoLer(valor);
        }
      });
    });
  } catch (e) {
    dica.textContent = e.message || 'Não foi possível carregar o leitor de código de barras. Digite manualmente.';
  }
}

window.BramScanner = { abrirScanner, suportaLeituraCamera };
