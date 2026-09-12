// scanner.js — leitura de código de barras pela câmera, 100% offline.
// Usa a BarcodeDetector nativa do navegador (Chrome/Android/Edge).
// Se o navegador não suportar, avisa e deixa a pessoa digitar manualmente.

function suportaLeituraCamera() {
  return 'BarcodeDetector' in window && 'mediaDevices' in navigator;
}

async function abrirScanner(aoLer) {
  if (!suportaLeituraCamera()) {
    alert('Seu navegador não suporta leitura automática de código de barras. Digite o código manualmente.');
    return;
  }

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

  const video = overlay.querySelector('.scanner-video');
  const botaoFechar = overlay.querySelector('.scanner-fechar');
  let stream = null;
  let intervalo = null;

  function encerrar() {
    if (intervalo) clearInterval(intervalo);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    overlay.remove();
  }
  botaoFechar.addEventListener('click', encerrar);

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;

    const detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'qr_code'],
    });

    intervalo = setInterval(async () => {
      try {
        const codigos = await detector.detect(video);
        if (codigos.length > 0) {
          const valor = codigos[0].rawValue;
          encerrar();
          aoLer(valor);
        }
      } catch (e) {
        // ignora falhas pontuais de leitura de um frame — tenta de novo no próximo intervalo
      }
    }, 300);
  } catch (e) {
    overlay.querySelector('.scanner-dica').textContent = 'Não foi possível acessar a câmera. Verifique a permissão do navegador.';
  }
}

window.BramScanner = { abrirScanner, suportaLeituraCamera };
