// Pagina "Glass": escolhe/arrasta o audio, decodifica (Web Audio, 44,1 kHz estereo), manda para o Worker,
// toca os 4 stems sincronizados (mudo/solo/volume) e baixa cada WAV ou todos num .zip.
// A decodificacao, o Worker (trabalhador.js, dsp.js) e a escrita de WAV nao mudam: aqui e so a pagina.
import { texto, idiomaAtual } from "./idiomas.js";

const ORDEM = ["vocals", "drums", "bass", "other"];
const TAXA = 44100;
const PICOS = 96;
const LARGURA = 384;                 // viewBox das ondas
const params = new URLSearchParams(location.search);
// onde estao manifesto.json e os pedacos do modelo; ?modelo=URL troca (ex.: Hugging Face)
const MODELO_BASE = new URL(params.get("modelo") || "./modelo/", location.href).href;

const $ = (id) => document.getElementById(id);
const el = { zona: $("zona"), entrada: $("entrada"), nome: $("arquivo-nome"), meta: $("arquivo-meta"), pronto: $("arquivo-pronto"),
  ondaArquivo: $("onda-arquivo"), bits: $("bits"), backend: $("backend"), overlap: $("overlap"), resumoOpcoes: $("resumo-opcoes"),
  separar: $("separar"), cancelar: $("cancelar"), novo: $("btn-novo"), tentar: $("btn-tentar"), novoErro: $("btn-novo-erro"),
  selecao: $("tela-selecao"), zonaInicial: $("zona-inicial"), zonaArquivo: $("zona-arquivo"),
  painel: $("painel-status"), anel: $("anel"), anelPct: $("anel-pct"), texto: $("status-texto"), barra: $("barra"),
  detalhe: $("status-detalhe"), avisos: $("avisos"),
  erro: $("painel-erro"), erroNome: $("erro-nome"), erroMeta: $("erro-meta"),
  toast: $("toast"), toastDetalhe: $("toast-detalhe"), toastFechar: $("toast-fechar"),
  resultado: $("painel-resultado"), resumo: $("resumo"), play: $("btn-play"), iconePlay: $("icone-play"), iconePause: $("icone-pause"),
  tempo: $("tempo"), total: $("duracao-total"), baixarTodos: $("baixar-todos") };

// textos dinamicos que o idiomas.js nao tem (o resto vem de texto(chave, idioma))
const D = {
  pt: { mono: "mono", janela: (k, n) => `Janela ${k} de ${n}`, restantes: "restantes", baixando: "Baixando o modelo (só na primeira vez)",
    carregando: "Carregando o modelo", preparando: "Preparando o modelo no navegador", separandoCom: (b) => `Separando (${b})`,
    pouco: "Pode levar alguns segundos.", gerandoWav: "Gerando os arquivos WAV…", mbDe: (a, b) => `${a} de ${b} MB`,
    longo: (d) => `Áudio longo (${d}): pode faltar memória.`, abrir: (m) => `não consegui abrir este arquivo de áudio (${m})`,
    worker: (m) => `erro no worker: ${m}`, desconhecido: "desconhecido",
    resumo: (seg, be, thr, dur, por, pico) => `Separado em ${seg} (${be}${thr}) · ${dur} de áudio · ${por} s por minuto de áudio`
      + (pico ? ` · reescalado para não estourar (pico ${pico})` : ""),
    thread: (n) => `, ${n} thread${n > 1 ? "s" : ""}` },
  en: { mono: "mono", janela: (k, n) => `Window ${k} of ${n}`, restantes: "left", baixando: "Downloading the model (first time only)",
    carregando: "Loading the model", preparando: "Preparing the model in the browser", separandoCom: (b) => `Separating (${b})`,
    pouco: "This may take a few seconds.", gerandoWav: "Generating the WAV files…", mbDe: (a, b) => `${a} of ${b} MB`,
    longo: (d) => `Long audio (${d}): may run out of memory.`, abrir: (m) => `couldn't open this audio file (${m})`,
    worker: (m) => `worker error: ${m}`, desconhecido: "unknown",
    resumo: (seg, be, thr, dur, por, pico) => `Separated in ${seg} (${be}${thr}) · ${dur} of audio · ${por} s per minute of audio`
      + (pico ? ` · rescaled to avoid clipping (peak ${pico})` : ""),
    thread: (n) => `, ${n} thread${n > 1 ? "s" : ""}` },
};
const L = () => D[idiomaAtual()];
const T = (chave) => texto(chave, idiomaAtual());
const dec1 = (n) => (idiomaAtual() === "pt" ? n.replace(".", ",") : n);   // 8.4 -> 8,4 em pt
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const mb = (bytes) => dec1((bytes / 1e6).toFixed(1));

let fase = "inicial";            // inicial | arquivo | processando | resultado | erro
let arquivo = null;
let dec = null;                  // { esq, dir, canais } (some ao ir para o Worker, que recebe os buffers)
let duracao = 0;
let canais = 2;
let trabalhador = null;
let rodada = 0;                  // invalida decodificacao/separacao antiga ao trocar de arquivo ou cancelar
let ocupado = false;
let inicioJanelas = 0;
let progressoAtual = null;       // ultimo "progresso" do Worker, para refazer o texto ao trocar de idioma
let separadoAtual = null;        // ultimo "separado", idem
let erroAtual = null;            // { fn: (L) => string } | { cru: string }
let brutos = null;               // [{nome, esq, dir}] em Float32Array, vindos do Worker
let wavs = null;                 // { bits, porNome: {nome: ArrayBuffer} }
let ondasProntas = false;

// ---------------------------------------------------------------- isolamento entre origens
// WASM com varias threads exige COOP/COEP. Cloudflare Pages manda pelos _headers; no GitHub Pages
// (sem cabecalhos) o service worker coi-sw.js os acrescenta e a pagina recarrega uma vez.
async function garantirIsolamento() {
  if (self.crossOriginIsolated || !("serviceWorker" in navigator) || params.has("semcoi")) return;
  try {
    const reg = await navigator.serviceWorker.register("coi-sw.js");
    let jaTentou = false;
    try { jaTentou = sessionStorage.getItem("coi-recarregou") === "1"; } catch {}
    if (!jaTentou && (reg.active || navigator.serviceWorker.controller)) {
      try { sessionStorage.setItem("coi-recarregou", "1"); } catch {}
      location.reload();
    } else if (!jaTentou) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        try { sessionStorage.setItem("coi-recarregou", "1"); } catch {}
        location.reload();
      }, { once: true });
    }
  } catch { /* sem service worker: segue com 1 thread no WASM */ }
}
garantirIsolamento();

// ---------------------------------------------------------------- estados da tela
function ir(nova) {
  fase = nova;
  el.selecao.hidden = !(nova === "inicial" || nova === "arquivo");
  el.zonaInicial.hidden = nova !== "inicial";
  el.zonaArquivo.hidden = nova !== "arquivo";
  el.novo.hidden = nova !== "arquivo";
  el.painel.classList.toggle("oculto", nova !== "processando");
  el.cancelar.classList.toggle("oculto", nova !== "processando");
  el.erro.hidden = nova !== "erro";
  el.resultado.classList.toggle("oculto", nova !== "resultado");
  if (nova !== "erro") el.toast.hidden = true;
  atualizarBotaoSeparar();
}
function atualizarBotaoSeparar() { el.separar.disabled = !(arquivo && dec) || ocupado; }

// ---------------------------------------------------------------- resumo das opcoes
const curto = (sel) => (sel.selectedOptions[0]?.textContent || "").replace(/\s*\(.*\)\s*$/, "").trim();
function atualizarResumoOpcoes() { el.resumoOpcoes.textContent = `${curto(el.bits)} · ${curto(el.backend)} · ${curto(el.overlap)}`; }
[el.bits, el.backend, el.overlap].forEach((s) => s.addEventListener("change", atualizarResumoOpcoes));

// ---------------------------------------------------------------- ondas (SVG de area, 96 picos)
// pico de cada bloco = maior |amostra| entre os dois canais (sem normalizar: o que e baixo parece baixo)
function picos(canaisL) {
  const n = canaisL[0].length, out = new Float32Array(PICOS);
  for (let i = 0; i < PICOS; i++) {
    const a = Math.floor((i * n) / PICOS), b = Math.max(a + 1, Math.floor(((i + 1) * n) / PICOS));
    let m = 0;
    for (const c of canaisL) for (let j = a; j < b && j < n; j++) { const v = c[j] < 0 ? -c[j] : c[j]; if (v > m) m = v; }
    out[i] = Math.min(1, m);
  }
  return out;
}
function caminho(p) {
  let cima = "M0,50", baixo = "";
  for (let i = 0; i < p.length; i++) cima += ` L${i * 4},${(50 - p[i] * 44).toFixed(1)}`;
  for (let i = p.length - 1; i >= 0; i--) baixo += ` L${i * 4},${(50 + p[i] * 44).toFixed(1)}`;
  return `${cima}${baixo} Z`;
}
function desenharOnda(svg, p, prog) {
  const d = caminho(p);
  svg.querySelector(".onda-fundo").setAttribute("d", d);
  svg.querySelector(".onda-frente").setAttribute("d", d);
  posicaoOnda(svg, prog);
}
function posicaoOnda(svg, prog) {
  const x = prog * LARGURA;
  svg.querySelector(".onda-corte").setAttribute("width", x.toFixed(2));
  const cab = svg.querySelector(".onda-cabeca");
  cab.toggleAttribute("hidden", !(prog > 0 && prog < 1));   // SVG nao tem a propriedade .hidden
  cab.setAttribute("x1", x.toFixed(2)); cab.setAttribute("x2", x.toFixed(2));
}

// ---------------------------------------------------------------- escolha do arquivo
async function escolher(f) {
  if (!f || ocupado) return;
  parar(true);
  limparResultado();
  const minha = ++rodada;
  arquivo = f; dec = null; duracao = 0;
  el.meta.textContent = "";
  el.pronto.hidden = true;
  desenharOnda(el.ondaArquivo, new Float32Array(PICOS), 1);
  atualizarMetaArquivo();
  ir("arquivo");
  try {
    const d = await decodificar(f);
    if (minha !== rodada) return;
    dec = d; duracao = d.esq.length / TAXA; canais = d.canais;
    desenharOnda(el.ondaArquivo, picos([d.esq, d.dir]), 1);
    el.pronto.hidden = false;
    atualizarMetaArquivo();
    atualizarBotaoSeparar();
  } catch (e) {
    if (minha !== rodada) return;
    falharComArquivo((x) => x.abrir(e.message || e));
  }
}
function atualizarMetaArquivo() {
  if (!arquivo) return;
  el.nome.textContent = `${arquivo.name} (${mb(arquivo.size)} MB)`;
  el.erroNome.textContent = el.nome.textContent;
  el.meta.textContent = duracao ? `${mmss(duracao)} · ${dec1("44.1")} kHz · ${canais > 1 ? T("estereo") : L().mono}` : "";
  el.erroMeta.textContent = duracao ? mmss(duracao) : "";
}
function novoArquivo() {
  rodada++;
  if (trabalhador) { trabalhador.terminate(); trabalhador = null; }
  parar(true); limparResultado();
  arquivo = null; dec = null; duracao = 0; ocupado = false; erroAtual = null; el.entrada.value = "";
  ir("inicial");
}

el.zona.addEventListener("click", () => el.entrada.click());
el.zona.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.entrada.click(); } });
el.entrada.addEventListener("change", () => { escolher(el.entrada.files[0]); });
["dragenter", "dragover"].forEach((t) => el.zona.addEventListener(t, (e) => { e.preventDefault(); el.zona.classList.add("sobre"); }));
["dragleave", "drop"].forEach((t) => el.zona.addEventListener(t, (e) => { e.preventDefault(); el.zona.classList.remove("sobre"); }));
el.zona.addEventListener("drop", (e) => escolher(e.dataTransfer.files[0]));
el.novo.addEventListener("click", novoArquivo);
el.novoErro.addEventListener("click", novoArquivo);

// ---------------------------------------------------------------- status do processamento
function status(titulo, frac, detalhe = "") {
  el.texto.textContent = titulo;
  if (frac != null) {
    const pct = Math.round(Math.max(0, Math.min(1, frac)) * 100);
    el.barra.style.width = `${pct}%`;
    el.anel.style.setProperty("--p", `${pct}%`);
    el.anel.setAttribute("aria-valuenow", String(pct));
    el.anelPct.textContent = `${pct}%`;
  }
  el.detalhe.textContent = detalhe;
}
function renderProgresso() {
  const m = progressoAtual; if (!m) return;
  const t = L(), nome = arquivo ? `${arquivo.name} · ` : "";
  if (m.etapa === "modelo") {
    status(m.texto.startsWith("Baixando") ? t.baixando : t.carregando, m.feito / m.total, t.mbDe((m.feito / 1e6).toFixed(0), (m.total / 1e6).toFixed(0)));
  } else if (m.etapa === "sessao") {
    status(t.preparando, null, t.pouco);
  } else if (m.etapa === "separar") {
    let det = `${nome}${t.janela(m.feito, m.total)}`;
    if (m.feito > 0) det += ` · ~${mmss(((performance.now() - inicioJanelas) / 1000 / m.feito) * (m.total - m.feito))} ${t.restantes}`;
    status(t.separandoCom(m.texto.match(/\((.*)\)/)?.[1] || ""), m.feito / m.total, det);
  } else if (m.etapa === "wav") {
    status(T("pronto"), 1, t.gerandoWav);
  }
}

// ---------------------------------------------------------------- decodificacao
async function decodificar(f) {
  const bytes = await f.arrayBuffer();
  // decodeAudioData reamostra para a taxa do contexto: 44,1 kHz
  const ctx = new OfflineAudioContext(2, 1, TAXA);
  const buf = await ctx.decodeAudioData(bytes);
  const esq = buf.getChannelData(0).slice();
  const dir = buf.numberOfChannels > 1 ? buf.getChannelData(1).slice() : esq.slice();
  return { esq, dir, canais: buf.numberOfChannels };
}

// ---------------------------------------------------------------- worker
function novoTrabalhador() {
  const w = new Worker(new URL("trabalhador.js", import.meta.url), { type: "module" });
  w.onmessage = (ev) => tratar(ev.data);
  w.onerror = (ev) => falharCru(L().worker(ev.message || L().desconhecido));
  return w;
}

function tratar(m) {
  if (m.tipo === "progresso") {
    if (m.etapa === "separar" && m.feito === 0) inicioJanelas = performance.now();
    progressoAtual = m;
    renderProgresso();
  } else if (m.tipo === "aviso") {
    el.avisos.textContent += m.texto + "\n";
  } else if (m.tipo === "separado") {
    separadoAtual = m;
    progressoAtual = { etapa: "wav" };
    renderProgresso();
    trabalhador.postMessage({ tipo: "brutos" });   // copia em float32 para as ondas e o player
  } else if (m.tipo === "brutos") {
    if (window.__brutos) { const f = window.__brutos; window.__brutos = null; f(m.lista); return; }   // teste automatizado
    brutos = m.lista;
    ondasProntas = false;
    pedirWavs();
  } else if (m.tipo === "wavs") {
    mostrar(m.lista, m.bits);
    terminarOcupado();
  } else if (m.tipo === "erro") {
    falharCru(m.texto);
  }
}

function pedirWavs() { trabalhador.postMessage({ tipo: "wavs", bits: Number(el.bits.value) }); }

function renderResumo() {
  const m = separadoAtual;
  if (!m) { el.resumo.textContent = ""; return; }
  const t = L();
  el.resumo.textContent = t.resumo(mmss(m.segundos), m.backend.toUpperCase(), m.threads ? t.thread(m.threads) : "", mmss(duracao),
    (m.segundos / Math.max(duracao, 1) * 60).toFixed(0), m.pico > 0.999 ? dec1(m.pico.toFixed(2)) : "");
}

// ---------------------------------------------------------------- resultado
const cartao = (nome) => $(`stem-${nome}`);
const estado = Object.fromEntries(ORDEM.map((n) => [n, { mudo: false, solo: false, volume: 100 }]));
let urls = [];
let buffers = null;      // { nome: AudioBuffer }
const metaStem = (n) => `${dec1("44.1")} kHz · ${T("estereo")} · ${mb(wavs.porNome[n].byteLength)} MB`;

function mostrar(lista, bits) {
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  const base = baseNome();
  wavs = { bits, porNome: Object.fromEntries(lista.map((x) => [x.nome, x.wav])) };
  if (!ondasProntas && brutos) prepararStems();
  for (const nome of ORDEM) {
    const c = cartao(nome);
    c.querySelector(".stem-meta").textContent = metaStem(nome);
    const url = URL.createObjectURL(new Blob([wavs.porNome[nome]], { type: "audio/wav" }));
    urls.push(url);
    c.querySelector(".btn-wav").onclick = () => baixarUrl(url, `${base}_${nome}.wav`);
  }
  renderResumo();
  el.total.textContent = mmss(duracao);
  atualizarTempo();
  ir("resultado");
}

function prepararStems() {
  buffers = {};
  for (const x of brutos) {
    const b = new AudioBuffer({ length: x.esq.length, numberOfChannels: 2, sampleRate: TAXA });
    b.copyToChannel(x.esq, 0); b.copyToChannel(x.dir, 1);
    buffers[x.nome] = b;
    desenharOnda(cartao(x.nome).querySelector(".onda"), picos([x.esq, x.dir]), 0);
  }
  ondasProntas = true;
  for (const n of ORDEM) { estado[n] = { mudo: false, solo: false, volume: 100 }; cartao(n).querySelector(".volume").value = 100; }
  aplicarEstado();
}

function limparResultado() {
  brutos = null; buffers = null; wavs = null; ondasProntas = false; separadoAtual = null;
  urls.forEach(URL.revokeObjectURL); urls = [];
}

const baseNome = () => (arquivo?.name || "audio").replace(/\.[^.]+$/, "");
function baixarUrl(url, nome) {
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.append(a); a.click(); a.remove();
}

// trocar o formato depois do resultado regenera os WAVs
el.bits.addEventListener("change", () => {
  if (!ocupado && trabalhador && wavs) {
    ocupado = true;
    progressoAtual = { etapa: "wav" };
    renderProgresso();
    pedirWavs();
  }
});

// ---------------------------------------------------------------- zip (store, sem compressao)
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = TABELA_CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** itens: [{ nome, dados: ArrayBuffer|Uint8Array }] -> Blob .zip (metodo 0 = armazenado). */
function gerarZip(itens) {
  const enc = new TextEncoder(), agora = new Date();
  const hora = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
  const data = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();
  const partes = [], central = [];
  let pos = 0, tamCentral = 0;
  for (const it of itens) {
    const nome = enc.encode(it.nome), dados = it.dados instanceof Uint8Array ? it.dados : new Uint8Array(it.dados);
    const crc = crc32(dados);
    const loc = new DataView(new ArrayBuffer(30));
    loc.setUint32(0, 0x04034b50, true); loc.setUint16(4, 20, true); loc.setUint16(6, 0x0800, true);   // 0x0800: nomes em UTF-8
    loc.setUint16(10, hora, true); loc.setUint16(12, data, true);
    loc.setUint32(14, crc, true); loc.setUint32(18, dados.length, true); loc.setUint32(22, dados.length, true);
    loc.setUint16(26, nome.length, true);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true);
    cen.setUint16(12, hora, true); cen.setUint16(14, data, true);
    cen.setUint32(16, crc, true); cen.setUint32(20, dados.length, true); cen.setUint32(24, dados.length, true);
    cen.setUint16(28, nome.length, true); cen.setUint32(42, pos, true);
    partes.push(loc.buffer, nome, dados);
    central.push(cen.buffer, nome);
    pos += 30 + nome.length + dados.length;
    tamCentral += 46 + nome.length;
  }
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, itens.length, true); fim.setUint16(10, itens.length, true);
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
  return new Blob([...partes, ...central, fim.buffer], { type: "application/zip" });
}
el.baixarTodos.addEventListener("click", () => {
  if (!wavs) return;
  const base = baseNome();
  const url = URL.createObjectURL(gerarZip(ORDEM.map((n) => ({ nome: `${base}_${n}.wav`, dados: wavs.porNome[n] }))));
  baixarUrl(url, `${base}_stems.zip`);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});

// ---------------------------------------------------------------- player (Web Audio)
let ctx = null;
let fontes = null;       // { nome: { src, gain } } enquanto toca
let tocando = false;
let deslocamento = 0;    // segundos ja tocados quando parado
let inicioCtx = 0;       // ctx.currentTime em que a musica estaria no zero (para o trecho atual)
let quadro = 0;

const algumSolo = () => ORDEM.some((n) => estado[n].solo);
const ativo = (n) => (algumSolo() ? estado[n].solo : !estado[n].mudo);
const ganhoEfetivo = (n) => (ativo(n) ? estado[n].volume / 100 : 0);
function aplicarEstado() {
  for (const n of ORDEM) {
    const c = cartao(n), e = estado[n];
    c.querySelector(".btn-mudo").setAttribute("aria-pressed", String(e.mudo));
    c.querySelector(".btn-solo").setAttribute("aria-pressed", String(e.solo));
    c.dataset.inativo = String(!ativo(n));
    if (fontes) fontes[n].gain.gain.setTargetAtTime(ganhoEfetivo(n), ctx.currentTime, 0.01);
  }
}
const posicao = () => (tocando ? Math.max(0, Math.min(duracao, ctx.currentTime - inicioCtx)) : deslocamento);
function atualizarTempo() {
  const p = posicao(), prog = duracao ? Math.min(1, p / duracao) : 0;
  el.tempo.textContent = mmss(p);
  for (const n of ORDEM) posicaoOnda(cartao(n).querySelector(".onda"), prog);
}
function iconePlay() {
  el.iconePlay.hidden = tocando; el.iconePause.hidden = !tocando;
  el.play.setAttribute("aria-label", T(tocando ? "pausar" : "tocar"));
}
function tocar() {
  if (!buffers) return;
  ctx = ctx || new AudioContext({ sampleRate: TAXA });
  if (ctx.state === "suspended") ctx.resume();
  fontes = {};
  for (const n of ORDEM) {
    const src = ctx.createBufferSource(); src.buffer = buffers[n];
    const gain = ctx.createGain(); gain.gain.value = ganhoEfetivo(n);
    src.connect(gain).connect(ctx.destination);
    fontes[n] = { src, gain };
  }
  const quando = ctx.currentTime + 0.05;   // 50 ms de folga para os quatro comecarem juntos
  inicioCtx = quando - deslocamento;
  for (const n of ORDEM) fontes[n].src.start(quando, deslocamento);
  tocando = true;
  iconePlay();
  const passo = () => {
    if (!tocando) return;
    if (ctx.currentTime - inicioCtx >= duracao) { parar(true); return; }   // fim da musica: volta ao zero
    atualizarTempo();
    quadro = requestAnimationFrame(passo);
  };
  quadro = requestAnimationFrame(passo);
}
function pausar() { deslocamento = posicao(); parar(false); }
/** Para as fontes. zerar=true volta ao inicio (fim da musica, novo arquivo, nova separacao). */
function parar(zerar) {
  cancelAnimationFrame(quadro);
  if (fontes) { for (const n of ORDEM) { try { fontes[n].src.stop(); } catch {} fontes[n].src.disconnect(); fontes[n].gain.disconnect(); } fontes = null; }
  tocando = false;
  if (zerar) deslocamento = 0;
  iconePlay();
  atualizarTempo();
}
el.play.addEventListener("click", () => (tocando ? pausar() : tocar()));

for (const n of ORDEM) {
  const c = cartao(n);
  c.querySelector(".btn-mudo").addEventListener("click", () => { estado[n].mudo = !estado[n].mudo; aplicarEstado(); });
  c.querySelector(".btn-solo").addEventListener("click", () => { estado[n].solo = !estado[n].solo; aplicarEstado(); });
  c.querySelector(".volume").addEventListener("input", (e) => { estado[n].volume = Number(e.target.value); aplicarEstado(); });
}

// ---------------------------------------------------------------- erros
function mostrarToast() {
  const e = erroAtual;
  el.toastDetalhe.textContent = e ? (e.cru !== undefined ? e.cru : e.fn(L())) : "";
  el.toast.hidden = !e;
}
function falhar(erro) {
  erroAtual = erro;
  ocupado = false;
  if (fase === "resultado") { atualizarBotaoSeparar(); mostrarToast(); return; }   // falha ao regenerar WAV: fica no resultado
  if (trabalhador && fase === "processando") { trabalhador.terminate(); trabalhador = null; }
  atualizarMetaArquivo();
  ir("erro");
  mostrarToast();
}
const falharComArquivo = (fn) => falhar({ fn });   // texto que depende do idioma
const falharCru = (texto) => falhar({ cru: texto });
function terminarOcupado() { ocupado = false; atualizarBotaoSeparar(); }
el.toastFechar.addEventListener("click", () => { el.toast.hidden = true; });

// ---------------------------------------------------------------- separar / tentar de novo / cancelar
async function separar() {
  if (!arquivo || ocupado) return;
  ocupado = true;
  const minha = ++rodada;
  parar(true); limparResultado();
  el.avisos.textContent = "";
  progressoAtual = null;
  ir("processando");
  status(T("lendo"), 0, arquivo.name);
  try {
    if (!dec) dec = await decodificar(arquivo);
    if (minha !== rodada) return;
    duracao = dec.esq.length / TAXA; canais = dec.canais;
    if (duracao > 15 * 60) el.avisos.textContent += L().longo(mmss(duracao)) + "\n";
    const { esq, dir } = dec; dec = null;   // os buffers vao para o Worker; "tentar de novo"/cancelar decodificam outra vez
    trabalhador = trabalhador || novoTrabalhador();
    trabalhador.postMessage({ tipo: "separar", esq, dir, base: MODELO_BASE, backend: el.backend.value,
      overlap: Number(el.overlap.value) }, [esq.buffer, dir.buffer]);
  } catch (e) {
    if (minha !== rodada) return;
    falharComArquivo((x) => x.abrir(e.message || e));
  }
}
el.separar.addEventListener("click", separar);
el.tentar.addEventListener("click", () => { el.toast.hidden = true; erroAtual = null; if (arquivo) separar(); });

el.cancelar.addEventListener("click", () => {
  rodada++;
  if (trabalhador) trabalhador.terminate();
  trabalhador = null;   // o proximo pedido recria (e le o modelo do cache)
  ocupado = false;
  progressoAtual = null;
  const f = arquivo;
  if (dec || !f) { ir("arquivo"); return; }
  arquivo = null;       // os buffers ja foram para o Worker: decodifica de novo para voltar ao estado "arquivo"
  escolher(f);
});

// ---------------------------------------------------------------- idioma: refaz os textos dinamicos
document.addEventListener("idioma", () => {
  atualizarResumoOpcoes();
  atualizarMetaArquivo();
  renderProgresso();
  renderResumo();
  iconePlay();
  if (!el.toast.hidden) mostrarToast();
  if (wavs) for (const n of ORDEM) cartao(n).querySelector(".stem-meta").textContent = metaStem(n);
});
atualizarResumoOpcoes();
ir("inicial");

// gancho do teste automatizado (teste/navegador.mjs): so com ?teste na URL
if (params.has("teste")) {
  window.separadorTeste = {
    brutos: () => new Promise((ok) => { window.__brutos = ok; trabalhador.postMessage({ tipo: "brutos" }); }),
    estado: () => ({ fase, texto: el.texto.textContent, detalhe: el.detalhe.textContent, avisos: el.avisos.textContent,
      resumo: el.resumo.textContent, ocupado, isolado: self.crossOriginIsolated }),
    ganhos: () => Object.fromEntries(ORDEM.map((n) => [n, ganhoEfetivo(n)])),
    posicao, gerarZip, crc32,
    // injeta stems sinteticos como se viessem do Worker (ondas, player, mute/solo, zip, sem rodar o modelo)
    async simular(lista, bits = 24) {
      const dsp = await import("./dsp.js");
      brutos = lista; ondasProntas = false; duracao = lista[0].esq.length / TAXA;
      arquivo = arquivo || { name: "sintetico.wav", size: 1 };
      separadoAtual = { segundos: 12, backend: "wasm", threads: 2, pico: 1 };
      mostrar(lista.map((x) => ({ nome: x.nome, wav: dsp.codificarWav(x.esq, x.dir, dsp.TAXA, bits) })), bits);
    },
  };
}
