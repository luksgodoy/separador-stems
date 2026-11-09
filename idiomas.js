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
    req: "Requisitos", reqTxt: "<strong>Chrome ou Edge 113+</strong> usam a placa de vídeo (<strong>WebGPU</strong>); Firefox e Safari usam a CPU, bem mais lento. Na primeira visita baixa <strong>~90 MB</strong> do modelo (depois fica em cache). Celular não é recomendado e músicas acima de <strong>15 min</strong> podem esgotar a memória.",
    uso: "Uso", usoTxt: "Seu áudio <strong>nunca sai do computador</strong>. Envie só áudio que você tem <strong>direito de usar</strong>; o resultado pode não ser perfeito.",
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
    req: "Requirements", reqTxt: "<strong>Chrome or Edge 113+</strong> use the GPU (<strong>WebGPU</strong>); Firefox and Safari use the CPU, much slower. The first visit downloads <strong>~90 MB</strong> of model (cached afterwards). Phones are not recommended and songs over <strong>15 min</strong> may exhaust memory.",
    uso: "Usage", usoTxt: "Your audio <strong>never leaves your computer</strong>. Upload only audio you have the <strong>right to use</strong>; the result may not be perfect.",
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
    comoHtml: 'O modelo <a href="https://github.com/facebookresearch/demucs">htdemucs</a> (Demucs v4, Meta/FAIR, licença <strong>MIT</strong>) roda <strong>no seu navegador</strong> via <a href="https://onnxruntime.ai/">ONNX Runtime Web</a>. Saída: <strong>44,1 kHz estéreo</strong>.',
    titulo_pagina: "Sidra · Separador de Stems e Removedor de Vocal",
  },
  en: {
    b16: "16 bit",
    tocar: "Play", pausar: "Pause", fechar: "Close", volume: "Volume",
    zonaAria: "Choose an audio file", idiomaAria: "Language", wav: "WAV",
    comoHtml: 'The <a href="https://github.com/facebookresearch/demucs">htdemucs</a> model (Demucs v4, Meta/FAIR, <strong>MIT</strong> license) runs <strong>in your browser</strong> via <a href="https://onnxruntime.ai/">ONNX Runtime Web</a>. Output: <strong>44.1 kHz stereo</strong>.',
    titulo_pagina: "Sidra · Stem Separator & Vocal Remover",
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
