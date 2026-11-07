// Idiomas (pt/en) da interface "Glass": dicionario, escolha e aplicacao no DOM.
//
// Uso no HTML:
//   data-i18n="chave"        -> troca o textContent pelo texto da chave (TXT[idioma][chave])
//   data-i18n="a.b"          -> caminho com ponto (ex.: nomes.vocals)
//   data-i18n-html="chave"   -> idem, mas com innerHTML (so para texto nosso, com links)
//   data-i18n-aria="chave"   -> troca o atributo aria-label
//
// O objeto TXT abaixo e copia literal do dicionario do prototipo (Propostas Separador de Stems.dc.html,
// handoff do Claude Design). Varias chaves (arquivoNome, duracao, janela, resumo, erroDet, linha...)
// sao textos de DEMONSTRACAO do prototipo: o app.js real escreve os valores de verdade nesses lugares.
// O que o prototipo nao tinha (opcoes dos selects, rotulos do play, link do "Como funciona") esta em EXTRA.

export const TXT = {
  pt: {
    titulo: "Sidra", sub1: "Voz, bateria, baixo e outros instrumentos, separados", sub2: "no seu navegador", sub3: ". O áudio não sai do seu computador: não há servidor nem upload.",
    sub3b: "O áudio não sai do seu computador: não há servidor nem upload.",
    arraste: "Arraste um arquivo de áudio aqui", ouClique: "ou clique para escolher (WAV, MP3, FLAC, OGG, M4A — o que o navegador souber abrir)",
    formato: "Formato do WAV", sobre: "Tipo", separar: "Separar", cancelar: "Cancelar", b24: "24 bits", tipoRapido: "Rápido", tipoPadrao: "Padrão", tipoAlto: "Alto",
    lendo: "Lendo o áudio", separando: "Separando", janela: "Janela 14 de 23 · ~0:41 restantes", pronto: "Pronto", erro: "Não deu certo",
    erroDet: "não consegui abrir este arquivo de áudio (EncodingError: Unable to decode audio data)",
    baixar: "Baixar WAV 24 bits", baixarTodos: "Baixar todos", resumo: "Separado em 1:12 (WEBGPU) · 3:42 de áudio · 19 s por minuto de áudio",
    comoT: "Como funciona", como: "O modelo htdemucs (Demucs v4, Meta/FAIR, licença MIT) roda aqui mesmo, com o ONNX Runtime Web. A saída é sempre 44,1 kHz estéreo.",
    req: "Requisitos", reqTxt: "Funciona melhor no Chrome ou no Edge 113+, que usam a placa de vídeo (WebGPU). Firefox e Safari usam a CPU: é mais lento e chega a ~3 GB de memória. Na primeira visita são baixados ~90 MB do modelo (depois ficam em cache). Precisa de memória livre suficiente; celular não é recomendado e músicas acima de 15 minutos podem esgotá-la.",
    uso: "Uso", usoTxt: "O áudio não sai do seu computador. Envie apenas áudio que você tem direito de usar e processar. O modelo é o htdemucs (Demucs, Meta/FAIR, licença MIT); o resultado pode não ser perfeito.",
    arquivoNome: "demo_mix.mp3 (8,4 MB)", duracao: "3:42", estereo: "estéreo", prontoPara: "Pronto para separar",
    nomes: { vocals: "Voz", drums: "Bateria", bass: "Baixo", other: "Outros" }, nomesLongos: { vocals: "Voz (vocals)", drums: "Bateria (drums)", bass: "Baixo (bass)", other: "Outros instrumentos (other)" },
    estados: { inicial: "Inicial", arquivo: "Arquivo", processando: "Processando", resultado: "Resultado", erro: "Erro" },
    mute: "Mudo", solo: "Solo", novo: "Novo arquivo", tentar: "Tentar de novo", opcoes: "Opções", opcoesCaps: "OPÇÕES", privacidade: "Nada sai do seu computador", stemsT: "stems",
    linha: { inicial: "AGUARDANDO ENTRADA", arquivo: "PRONTO · 3:42 · 44.1 kHz", processando: "SEPARANDO · JANELA 14/23", resultado: "PRONTO · 4 STEMS · 1:12", erro: "ERRO · DECODIFICAÇÃO" },
    expWav: "WAV (.zip)", expTraktor: "Traktor Stems", expAbleton: "Ableton Live",
    expWavAria: "Baixar os 4 WAVs em um .zip", expTraktorAria: "Baixar um arquivo .stem.mp4 para o Traktor", expAbletonAria: "Baixar um projeto do Ableton Live 12 com a faixa original e as 4 faixas separadas",
  },
  en: {
    titulo: "Sidra", sub1: "Vocals, drums, bass and other instruments, separated", sub2: "in your browser", sub3: ". Your audio never leaves your computer: no server, no upload.",
    sub3b: "Your audio never leaves your computer: no server, no upload.",
    arraste: "Drop an audio file here", ouClique: "or click to choose (WAV, MP3, FLAC, OGG, M4A — anything your browser can open)",
    formato: "WAV format", sobre: "Type", separar: "Separate", cancelar: "Cancel", b24: "24 bit", tipoRapido: "Fast", tipoPadrao: "Standard", tipoAlto: "High",
    lendo: "Reading audio", separando: "Separating", janela: "Window 14 of 23 · ~0:41 left", pronto: "Done", erro: "Something went wrong",
    erroDet: "couldn't open this audio file (EncodingError: Unable to decode audio data)",
    baixar: "Download 24-bit WAV", baixarTodos: "Download all", resumo: "Separated in 1:12 (WEBGPU) · 3:42 of audio · 19 s per minute of audio",
    comoT: "How it works", como: "The htdemucs model (Demucs v4, Meta/FAIR, MIT license) runs right here with ONNX Runtime Web. Output is always 44.1 kHz stereo.",
    req: "Requirements", reqTxt: "Works best in Chrome or Edge 113+, which use the GPU (WebGPU). Firefox and Safari use the CPU: slower, and memory use reaches ~3 GB. The first visit downloads ~90 MB of model (cached afterwards). You need enough free memory; phones are not recommended and songs over 15 minutes may exhaust it.",
    uso: "Usage", usoTxt: "Your audio never leaves your computer. Upload only audio you have the right to use and process. The model is htdemucs (Demucs, Meta/FAIR, MIT license); the result may not be perfect.",
    arquivoNome: "demo_mix.mp3 (8.4 MB)", duracao: "3:42", estereo: "stereo", prontoPara: "Ready to separate",
    nomes: { vocals: "Vocals", drums: "Drums", bass: "Bass", other: "Other" }, nomesLongos: { vocals: "Vocals", drums: "Drums", bass: "Bass", other: "Other instruments" },
    estados: { inicial: "Initial", arquivo: "File", processando: "Processing", resultado: "Result", erro: "Error" },
    mute: "Mute", solo: "Solo", novo: "New file", tentar: "Try again", opcoes: "Options", opcoesCaps: "OPTIONS", privacidade: "Nothing leaves your computer", stemsT: "stems",
    linha: { inicial: "WAITING FOR INPUT", arquivo: "READY · 3:42 · 44.1 kHz", processando: "SEPARATING · WINDOW 14/23", resultado: "DONE · 4 STEMS · 1:12", erro: "ERROR · DECODING" },
    expWav: "WAV (.zip)", expTraktor: "Traktor Stems", expAbleton: "Ableton Live",
    expWavAria: "Download the 4 WAVs in a .zip", expTraktorAria: "Download a .stem.mp4 file for Traktor", expAbletonAria: "Download an Ableton Live 12 project with the original track and the 4 separated tracks",
  },
};

// Acrescentado por nos (nao existe no prototipo).
export const EXTRA = {
  pt: {
    b16: "16 bits",
    tocar: "Tocar", pausar: "Pausar", fechar: "Fechar", volume: "Volume",
    zonaAria: "Escolher arquivo de áudio", idiomaAria: "Idioma", wav: "WAV",
    comoHtml: 'O modelo <a href="https://github.com/facebookresearch/demucs">htdemucs</a> (Demucs v4, Meta/FAIR, licença MIT) roda aqui mesmo, com o <a href="https://onnxruntime.ai/">ONNX Runtime Web</a>. A saída é sempre 44,1 kHz estéreo.',
    titulo_pagina: "Sidra · Separador de Stems",
  },
  en: {
    b16: "16 bit",
    tocar: "Play", pausar: "Pause", fechar: "Close", volume: "Volume",
    zonaAria: "Choose an audio file", idiomaAria: "Language", wav: "WAV",
    comoHtml: 'The <a href="https://github.com/facebookresearch/demucs">htdemucs</a> model (Demucs v4, Meta/FAIR, MIT license) runs right here with <a href="https://onnxruntime.ai/">ONNX Runtime Web</a>. Output is always 44.1 kHz stereo.',
    titulo_pagina: "Sidra · Stem Separator",
  },
};

// ---------------------------------------------------------------- escolha e aplicacao
export function idiomaInicial() {
  let salvo = null;
  try { salvo = localStorage.getItem("idioma"); } catch {}
  if (salvo === "pt" || salvo === "en") return salvo;
  return (navigator.language || "").toLowerCase().startsWith("pt") ? "pt" : "en";
}

export function texto(chave, idioma) {
  const achar = (obj) => chave.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  const v = achar(TXT[idioma]);
  return v !== undefined ? v : achar(EXTRA[idioma]);
}

let atual = "pt";
export const idiomaAtual = () => atual;

export function aplicarIdioma(idioma, raiz = document) {
  atual = idioma;
  document.documentElement.lang = idioma === "pt" ? "pt-BR" : "en";
  document.title = EXTRA[idioma].titulo_pagina;
  raiz.querySelectorAll("[data-i18n]").forEach((e) => { const v = texto(e.dataset.i18n, idioma); if (v !== undefined) e.textContent = v; });
  raiz.querySelectorAll("[data-i18n-html]").forEach((e) => { const v = texto(e.dataset.i18nHtml, idioma); if (v !== undefined) e.innerHTML = v; });
  raiz.querySelectorAll("[data-i18n-aria]").forEach((e) => { const v = texto(e.dataset.i18nAria, idioma); if (v !== undefined) e.setAttribute("aria-label", v); });
  raiz.querySelectorAll("[data-idioma]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.idioma === idioma)));
  document.dispatchEvent(new CustomEvent("idioma", { detail: idioma }));   // o app.js escuta para refazer textos dinamicos
}

export function escolherIdioma(idioma) {
  try { localStorage.setItem("idioma", idioma); } catch {}
  aplicarIdioma(idioma);
}

// auto-inicializacao (o index.html carrega este modulo)
document.querySelectorAll("[data-idioma]").forEach((b) => b.addEventListener("click", () => escolherIdioma(b.dataset.idioma)));
aplicarIdioma(idiomaInicial());
