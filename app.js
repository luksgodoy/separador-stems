// Pagina "Glass": escolhe/arrasta o audio, decodifica (Web Audio, 44,1 kHz estereo), manda para o Worker,
// toca os 4 stems sincronizados (mudo/solo/volume) e baixa cada WAV ou todos num .zip.
// A decodificacao, o Worker (trabalhador.js, dsp.js) e a escrita de WAV nao mudam: aqui e so a pagina.
import { texto, idiomaAtual } from "./idiomas.js";
import { gerarZip, crc32 } from "./zip.js";
import { gerarProjetoAbleton } from "./ableton.js";
import { gerarTraktorStem, suportaAac } from "./traktor.js";

const ORDEM = ["vocals", "drums", "bass", "other"];
const TAXA = 44100;
const PICOS = 128;
const LARGURA = 384;                 // viewBox das ondas
const params = new URLSearchParams(location.search);
// onde estao manifesto.json e os pedacos do modelo; ?modelo=URL troca (ex.: Hugging Face)
// Processamento: o app sempre pede "auto" (WebGPU, com queda para WASM no Worker); nao ha seletor na pagina.
// So para o teste automatizado (?teste&backend=wasm|webgpu) o backend pode ser forcado, sem aparecer na UI.
const BACKEND = params.has("teste") && ["webgpu", "wasm"].includes(params.get("backend")) ? params.get("backend") : "auto";
const MODELO_BASE = new URL(params.get("modelo") || "./modelo/", location.href).href;

const $ = (id) => document.getElementById(id);
const el = { zona: $("zona"), entrada: $("entrada"), nome: $("arquivo-nome"), meta: $("arquivo-meta"), pronto: $("arquivo-pronto"),
  ondaArquivo: $("onda-arquivo"), bits: $("bits"), overlap: $("overlap"), resumoOpcoes: $("resumo-opcoes"),
  separar: $("separar"), cancelar: $("cancelar"), novo: $("btn-novo"), tentar: $("btn-tentar"), novoErro: $("btn-novo-erro"), novoResultado: $("btn-novo-resultado"),
  selecao: $("tela-selecao"), zonaInicial: $("zona-inicial"), zonaArquivo: $("zona-arquivo"),
  painel: $("painel-status"), anel: $("anel"), anelPct: $("anel-pct"), texto: $("status-texto"), barra: $("barra"),
  detalhe: $("status-detalhe"), avisos: $("avisos"),
  erro: $("painel-erro"), erroNome: $("erro-nome"), erroMeta: $("erro-meta"),
  toast: $("toast"), toastDetalhe: $("toast-detalhe"), toastFechar: $("toast-fechar"),
  resultado: $("painel-resultado"), resumo: $("resumo"), play: $("btn-play"), iconePlay: $("icone-play"), iconePause: $("icone-pause"),
  tempo: $("tempo"), total: $("duracao-total"), baixarTodos: $("baixar-todos"), expTraktor: $("exp-traktor"), expAbleton: $("exp-ableton") };

// textos dinamicos que o idiomas.js nao tem (o resto vem de texto(chave, idioma))
const D = {
  pt: { mono: "mono", janela: (k, n) => `Janela ${k} de ${n}`, restantes: "restantes", baixando: "Baixando o modelo (só na primeira vez)",
    carregando: "Carregando o modelo", preparando: "Preparando o modelo no navegador", separandoCom: (b) => `Separando (${b})`,
    pouco: "Pode levar alguns segundos.", gerandoWav: "Gerando os arquivos WAV…", gerandoExp: "Gerando…", expFalhou: "Não consegui gerar o arquivo", semAac: "Este navegador não codifica AAC: use Chrome, Edge ou Safari para o Traktor Stems.", mbDe: (a, b) => `${a} de ${b} MB`,
    longo: (d) => `Áudio longo (${d}): pode faltar memória.`, abrir: (m) => `não consegui abrir este arquivo de áudio (${m})`,
    worker: (m) => `erro no worker: ${m}`, desconhecido: "desconhecido",
    resumo: (seg, be, thr, dur, por, pico) => `Separado em ${seg} (${be}${thr}) · ${dur} de áudio · ${por} s por minuto de áudio`
      + (pico ? ` · reescalado para não estourar (pico ${pico})` : ""),
    thread: (n) => `, ${n} thread${n > 1 ? "s" : ""}` },
  en: { mono: "mono", janela: (k, n) => `Window ${k} of ${n}`, restantes: "left", baixando: "Downloading the model (first time only)",
    carregando: "Loading the model", preparando: "Preparing the model in the browser", separandoCom: (b) => `Separating (${b})`,
    pouco: "This may take a few seconds.", gerandoWav: "Generating the WAV files…", gerandoExp: "Generating…", expFalhou: "Could not generate the file", semAac: "This browser cannot encode AAC: use Chrome, Edge or Safari for Traktor Stems.", mbDe: (a, b) => `${a} of ${b} MB`,
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
function atualizarResumoOpcoes() { el.resumoOpcoes.textContent = `${curto(el.bits)} · ${curto(el.overlap)}`; }
[el.bits, el.overlap].forEach((s) => s.addEventListener("change", atualizarResumoOpcoes));

// ---------------------------------------------------------------- ondas (SVG de barras, 128 blocos)
// Cada barra e o RMS do bloco (o pico de uma musica masterizada enche tudo). A escala e o percentil 95 dos blocos,
// com curva suave: o refrão fica alto, a introducao e os silencios ficam baixos. `ref` fixa a escala (cartoes dos stems
// usam a mesma, para o stem fraco parecer fraco).
function energia(canaisL) {
  const n = canaisL[0].length, out = new Float32Array(PICOS);
  for (let i = 0; i < PICOS; i++) {
    const a = Math.floor((i * n) / PICOS), b = Math.max(a + 1, Math.floor(((i + 1) * n) / PICOS));
    let soma = 0, k = 0;
    for (const c of canaisL) for (let j = a; j < b && j < n; j++) { soma += c[j] * c[j]; k++; }
    out[i] = Math.sqrt(soma / Math.max(1, k));
  }
  return out;
}
function percentil95(v) { const o = Array.from(v).sort((x, y) => x - y); return o[Math.min(o.length - 1, Math.floor(o.length * 0.95))] || 1e-6; }
function picos(canaisL, ref) {
  const e = energia(canaisL), r = ref || percentil95(e);
  return e.map((v) => Math.min(1, Math.pow(v / r, 0.7)));
}
function caminho(p) {
  const passo = LARGURA / p.length, larg = passo * 0.62;
  let d = "";
  for (let i = 0; i < p.length; i++) {
    const h = Math.max(1.5, p[i] * 44) * 2, x = (i * passo + (passo - larg) / 2).toFixed(2);
    d += `M${x},${(50 - h / 2).toFixed(1)}h${larg.toFixed(2)}v${h.toFixed(1)}h-${larg.toFixed(2)}Z`;
  }
  return d;
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
el.novoResultado.addEventListener("click", novoArquivo);

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

// Conta quantas separacoes terminaram: um POST vazio, sem nome, duracao nem qualquer dado da musica (so no site publicado)
function contarSeparacao() {
  try { if (location.hostname === "sidrastems.com") navigator.sendBeacon("/api/separou"); } catch {}
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
    contarSeparacao();
    progressoAtual = { etapa: "wav" };
    renderProgresso();
    pedirWavs();   // primeiro os WAVs (o worker ainda tem os stems); depois ele entrega os stems sem copiar
  } else if (m.tipo === "brutos") {
    if (window.__brutos) { const f = window.__brutos; window.__brutos = null; f(m.lista); return; }   // teste automatizado
    brutos = m.lista;
    ondasProntas = false;
    mostrar(wavsPendentes.lista, wavsPendentes.bits);
    wavsPendentes = null;
    terminarOcupado();
  } else if (m.tipo === "wavs") {
    wavsPendentes = m;
    trabalhador.postMessage({ tipo: "brutos", liberar: true });
  } else if (m.tipo === "erro") {
    falharCru(m.texto);
  }
}

let wavsPendentes = null;
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
  const ref = Math.max(...brutos.map((x) => percentil95(energia([x.esq, x.dir]))));
  for (const x of brutos) {
    const b = new AudioBuffer({ length: x.esq.length, numberOfChannels: 2, sampleRate: TAXA });
    b.copyToChannel(x.esq, 0); b.copyToChannel(x.dir, 1);
    buffers[x.nome] = b;
    desenharOnda(cartao(x.nome).querySelector(".onda"), picos([x.esq, x.dir], ref), 0);
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
    regerarWavs(Number(el.bits.value));
  }
});
// os stems ja estao na pagina (o worker os soltou): recodifica aqui mesmo
async function regerarWavs(bits) {
  try {
    const dsp = await import("./dsp.js");
    const lista = [];
    for (const x of brutos) { lista.push({ nome: x.nome, wav: dsp.codificarWav(x.esq, x.dir, TAXA, bits) }); await new Promise((r) => setTimeout(r)); }
    mostrar(lista, bits);
  } catch (e) { falharCru(String((e && e.message) || e)); return; }
  terminarOcupado();
}

el.baixarTodos.addEventListener("click", () => {
  if (!wavs) return;
  const base = baseNome();
  const url = URL.createObjectURL(gerarZip(ORDEM.map((n) => ({ nome: `${base}_${n}.wav`, dados: wavs.porNome[n] }))));
  baixarUrl(url, `${base}_stems.zip`);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});


// ---------------------------------------------------------------- Traktor Stems e Ableton Live
let aacOk = false;
suportaAac(TAXA).then((ok) => { aacOk = ok; if (!ok) { el.expTraktor.disabled = true; el.expTraktor.title = L().semAac; } });

/** O original nao fica em memoria depois da separacao: decodifica de novo do arquivo escolhido. */
async function originalDecodificado() {
  if (dec) return dec;
  if (!arquivo?.arrayBuffer) throw new Error("original indisponivel");
  return decodificar(arquivo);
}
const bruto = (n) => brutos.find((x) => x.nome === n);

async function exportar(botao, fazer) {
  if (!wavs || !brutos || botao.getAttribute("aria-busy") === "true") return;
  botao.setAttribute("aria-busy", "true");
  const rotulo = botao.querySelector("[data-i18n]"), antes = rotulo.textContent;
  rotulo.textContent = L().gerandoExp;
  try { await fazer((p) => { rotulo.textContent = `${L().gerandoExp} ${Math.round(p * 100)}%`; }); }
  catch (e) {
    console.error(e);
    botao.title = `${L().expFalhou}: ${e.message || e}`;
    rotulo.textContent = L().expFalhou;
    await new Promise((r) => setTimeout(r, 3500));
  }
  finally { botao.removeAttribute("aria-busy"); rotulo.textContent = antes; }
}
function baixarBlob(blob, nome) {
  const url = URL.createObjectURL(blob);
  baixarUrl(url, nome);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

el.expAbleton.addEventListener("click", () => exportar(el.expAbleton, async () => {
  const base = baseNome(), o = await originalDecodificado();
  const dsp = await import("./dsp.js");
  const orig = dsp.codificarWav(o.esq, o.dir, TAXA, wavs.bits);
  const stems = ORDEM.map((n) => ({ chave: n, nome: n[0].toUpperCase() + n.slice(1), wav: wavs.porNome[n] }));
  const blob = await gerarProjetoAbleton({ base, original: orig, stems, taxa: TAXA, amostras: o.esq.length });
  baixarBlob(blob, `${base} Project.zip`);
}));

el.expTraktor.addEventListener("click", () => exportar(el.expTraktor, async (prog) => {
  if (!aacOk) throw new Error(L().semAac);
  const base = baseNome(), o = await originalDecodificado();
  const entradas = { mix: { esq: o.esq, dir: o.dir } };
  for (const n of ["drums", "bass", "other", "vocals"]) entradas[n] = bruto(n);
  baixarBlob(await gerarTraktorStem(entradas, TAXA, prog), `${base}.stem.mp4`);
}));

// ---------------------------------------------------------------- player (Web Audio)
let ctx = null;
let fontes = null;       // { nome: { src, gain } } enquanto toca
let tocando = false;
let deslocamento = 0;    // segundos ja tocados quando parado
let inicioCtx = 0;       // ctx.currentTime em que a musica estaria no zero (para o trecho atual)
let quadro = 0;

const algumSolo = () => ORDEM.some((n) => estado[n].solo);
const ativo = (n) => (algumSolo() ? estado[n].solo : !estado[n].mudo);
// Decisao: cada faixa tem seu proprio play, independente. `ativas` e o conjunto de faixas ligadas; as 4 fontes
// partem juntas no mesmo relogio (inicioCtx/deslocamento) e ligar/desligar uma faixa so mexe no ganho dela, entao
// as outras seguem tocando e a posicao e continua. Ganho = faixa ligada E ativa pela regra de Mudo/Solo ? volume : 0.
// Topo: play liga as 4; pause (qualquer faixa tocando) desliga todas e congela a posicao. Tocando = ativas nao vazio.
const ativas = new Set();
const ganhoEfetivo = (n) => (ativas.has(n) && ativo(n) ? estado[n].volume / 100 : 0);
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
  for (const n of ORDEM) {
    const c = cartao(n), ligado = ativas.has(n);
    c.querySelector(".ic-play").hidden = ligado; c.querySelector(".ic-pause").hidden = !ligado;
    c.querySelector(".btn-play-stem").setAttribute("aria-label", `${T(ligado ? "pausar" : "tocar")} ${T("nomes." + n)}`);
  }
}
/** Liga as faixas `quais`; se nada tocava, inicia as 4 fontes (mudas as nao ligadas) a partir de `deslocamento`. */
function tocar(quais = ORDEM) {
  if (!buffers) return;
  for (const n of quais) ativas.add(n);
  if (tocando) { aplicarEstado(); iconePlay(); return; }
  ctx = ctx || new AudioContext({ sampleRate: TAXA });
  if (ctx.state === "suspended") ctx.resume();
  fontes = {};
  for (const n of ORDEM) {
    const src = ctx.createBufferSource(); src.buffer = buffers[n];
    const gain = ctx.createGain(); gain.gain.value = ganhoEfetivo(n);
    src.connect(gain).connect(ctx.destination);
    fontes[n] = { src, gain };
  }
  const quando = ctx.currentTime + 0.05;   // 50 ms de folga para as fontes comecarem juntas
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
  ativas.clear();
  if (zerar) deslocamento = 0;
  iconePlay();
  atualizarTempo();
}
/** Pula para `seg`: tocando, recomeca as fontes no ponto com as mesmas faixas ligadas; parado, so move a posicao. */
function irPara(seg) {
  if (!buffers || !duracao) return;
  seg = Math.max(0, Math.min(duracao - 0.01, seg));
  if (tocando) { const ligadas = [...ativas]; parar(false); deslocamento = seg; tocar(ligadas); }
  else { deslocamento = seg; atualizarTempo(); }
}
// clicar na onda de qualquer stem leva as 4 faixas ao ponto clicado (o relogio e um so)
for (const n of ORDEM) {
  const onda = cartao(n).querySelector(".onda");
  onda.style.cursor = "pointer";
  onda.addEventListener("click", (e) => {
    const r = onda.getBoundingClientRect();
    if (r.width) irPara(((e.clientX - r.left) / r.width) * duracao);
  });
}
// topo: tocando (qualquer faixa) -> pausa tudo; parado -> liga as 4
el.play.addEventListener("click", () => (tocando ? pausar() : tocar()));
// cartao: liga/desliga so aquela faixa; ao desligar a ultima, pausa (posicao congelada)
function cliqueFaixa(n) {
  if (!ativas.has(n)) { tocar([n]); return; }
  ativas.delete(n);
  if (ativas.size) { aplicarEstado(); iconePlay(); } else pausar();
}

for (const n of ORDEM) {
  const c = cartao(n);
  c.querySelector(".btn-play-stem").addEventListener("click", () => cliqueFaixa(n));
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
    trabalhador.postMessage({ tipo: "separar", esq, dir, base: MODELO_BASE, backend: BACKEND,
      overlap: Number(el.overlap.value), curto: params.has("curto") }, [esq.buffer, dir.buffer]);
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
    brutos: () => (brutos   // o worker ja soltou os stems (entrega sem copia): usa os que a pagina recebeu
      ? Promise.resolve(brutos.map((x) => ({ nome: x.nome, esq: x.esq.slice(), dir: x.dir.slice() })))
      : new Promise((ok) => { window.__brutos = ok; trabalhador.postMessage({ tipo: "brutos" }); })),
    estado: () => ({ fase, texto: el.texto.textContent, detalhe: el.detalhe.textContent, avisos: el.avisos.textContent,
      resumo: el.resumo.textContent, ocupado, isolado: self.crossOriginIsolated }),
    ganhos: () => Object.fromEntries(ORDEM.map((n) => [n, ganhoEfetivo(n)])),
    posicao, gerarZip, crc32,
    // injeta stems sinteticos como se viessem do Worker (ondas, player, mute/solo, zip, sem rodar o modelo)
    async simular(lista, bits = 24, original = null) {
      const dsp = await import("./dsp.js");
      brutos = lista; ondasProntas = false; duracao = lista[0].esq.length / TAXA;
      arquivo = original || arquivo || { name: "sintetico.wav", size: 1 };
      separadoAtual = { segundos: 12, backend: "wasm", threads: 2, pico: 1 };
      mostrar(lista.map((x) => ({ nome: x.nome, wav: dsp.codificarWav(x.esq, x.dir, dsp.TAXA, bits) })), bits);
    },
  };
}
