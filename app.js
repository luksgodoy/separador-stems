// Pagina: escolhe/arrasta o audio, decodifica (Web Audio, 44,1 kHz estereo), manda para o Worker
// e mostra players e downloads de cada stem.

const NOMES = { vocals: "Voz (vocals)", drums: "Bateria (drums)", bass: "Baixo (bass)", other: "Outros instrumentos (other)" };
const ORDEM = ["vocals", "drums", "bass", "other"];
const TAXA = 44100;
const params = new URLSearchParams(location.search);
// onde estao manifesto.json e os pedacos do modelo; ?modelo=URL troca (ex.: Hugging Face)
const MODELO_BASE = new URL(params.get("modelo") || "./modelo/", location.href).href;

const $ = (id) => document.getElementById(id);
const el = { zona: $("zona"), entrada: $("entrada"), nome: $("arquivo-nome"), bits: $("bits"), backend: $("backend"),
  overlap: $("overlap"), separar: $("separar"), cancelar: $("cancelar"), painel: $("painel-status"),
  texto: $("status-texto"), barra: $("barra"), detalhe: $("status-detalhe"), avisos: $("avisos"),
  resultado: $("painel-resultado"), stems: $("stems"), resumo: $("resumo") };

let arquivo = null;
let trabalhador = null;
let urls = [];
let inicioJanelas = 0;
let duracao = 0;
let ocupado = false;

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

// ---------------------------------------------------------------- escolha do arquivo
function escolher(f) {
  if (!f) return;
  arquivo = f;
  el.nome.textContent = `${f.name} (${(f.size / 1e6).toFixed(1)} MB)`;
  el.separar.disabled = ocupado;
}
el.zona.addEventListener("click", () => el.entrada.click());
el.zona.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); el.entrada.click(); } });
el.entrada.addEventListener("change", () => escolher(el.entrada.files[0]));
["dragenter", "dragover"].forEach((t) => el.zona.addEventListener(t, (e) => { e.preventDefault(); el.zona.classList.add("sobre"); }));
["dragleave", "drop"].forEach((t) => el.zona.addEventListener(t, (e) => { e.preventDefault(); el.zona.classList.remove("sobre"); }));
el.zona.addEventListener("drop", (e) => escolher(e.dataTransfer.files[0]));

// ---------------------------------------------------------------- status
function status(texto, frac, detalhe = "") {
  el.painel.classList.remove("oculto");
  el.texto.textContent = texto;
  if (frac != null) el.barra.style.width = `${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%`;
  el.detalhe.textContent = detalhe;
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

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
  w.onerror = (ev) => falhar(`erro no worker: ${ev.message || "desconhecido"}`);
  return w;
}

function tratar(m) {
  if (m.tipo === "progresso") {
    if (m.etapa === "modelo") status(m.texto, m.feito / m.total, `${(m.feito / 1e6).toFixed(0)} de ${(m.total / 1e6).toFixed(0)} MB`);
    else if (m.etapa === "sessao") status(m.texto, null, "Pode levar alguns segundos.");
    else if (m.etapa === "separar") {
      if (m.feito === 0) inicioJanelas = performance.now();
      let det = `Janela ${m.feito} de ${m.total}`;
      if (m.feito > 0) {
        const porJanela = (performance.now() - inicioJanelas) / 1000 / m.feito;
        det += ` · ~${mmss(porJanela * (m.total - m.feito))} restantes`;
      }
      status(m.texto, m.feito / m.total, det);
    }
  } else if (m.tipo === "aviso") {
    el.avisos.textContent += m.texto + "\n";
  } else if (m.tipo === "separado") {
    const thr = m.threads ? `, ${m.threads} thread${m.threads > 1 ? "s" : ""}` : "";
    el.resumo.textContent = `Separado em ${mmss(m.segundos)} (${m.backend.toUpperCase()}${thr}) · `
      + `${mmss(duracao)} de áudio · ${(m.segundos / Math.max(duracao, 1) * 60).toFixed(0)} s por minuto de áudio`
      + (m.pico > 0.999 ? ` · reescalado para não estourar (pico ${m.pico.toFixed(2)})` : "");
    status("Pronto", 1, "Gerando os arquivos WAV…");
    pedirWavs();
  } else if (m.tipo === "wavs") {
    mostrar(m.lista, m.bits);
    status("Pronto", 1, "");
    terminarOcupado();
  } else if (m.tipo === "brutos") {
    window.__brutos && window.__brutos(m.lista);
  } else if (m.tipo === "erro") {
    falhar(m.texto);
  }
}

function pedirWavs() { trabalhador.postMessage({ tipo: "wavs", bits: Number(el.bits.value) }); }

function mostrar(lista, bits) {
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  el.stems.innerHTML = "";
  const base = (arquivo?.name || "audio").replace(/\.[^.]+$/, "");
  const porNome = Object.fromEntries(lista.map((x) => [x.nome, x.wav]));
  for (const nome of ORDEM) {
    const url = URL.createObjectURL(new Blob([porNome[nome]], { type: "audio/wav" }));
    urls.push(url);
    const div = document.createElement("div");
    div.className = "stem";
    const h = document.createElement("h3"); h.textContent = NOMES[nome];
    const a = document.createElement("a"); a.href = url; a.download = `${base}_${nome}.wav`;
    a.textContent = `Baixar WAV ${bits} bits (${(porNome[nome].byteLength / 1e6).toFixed(1)} MB)`;
    const au = document.createElement("audio"); au.controls = true; au.preload = "metadata"; au.src = url;
    div.append(h, a, au);
    el.stems.append(div);
  }
  el.resultado.classList.remove("oculto");
}

el.bits.addEventListener("change", () => { if (!ocupado && trabalhador && urls.length) { ocupado = true; status("Gerando os arquivos WAV…", 1); pedirWavs(); } });

function falhar(texto) {
  status("Não deu certo", 0, "");
  el.avisos.textContent += texto + "\n";
  terminarOcupado();
}
function terminarOcupado() {
  ocupado = false;
  el.separar.disabled = !arquivo;
  el.cancelar.classList.add("oculto");
}

el.separar.addEventListener("click", async () => {
  if (!arquivo || ocupado) return;
  ocupado = true;
  el.separar.disabled = true;
  el.cancelar.classList.remove("oculto");
  el.avisos.textContent = "";
  el.resultado.classList.add("oculto");
  try {
    status("Lendo o áudio", null, arquivo.name);
    const { esq, dir } = await decodificar(arquivo);
    duracao = esq.length / TAXA;
    if (duracao > 15 * 60) el.avisos.textContent += `Áudio longo (${mmss(duracao)}): pode faltar memória.\n`;
    trabalhador = trabalhador || novoTrabalhador();
    trabalhador.postMessage({ tipo: "separar", esq, dir, base: MODELO_BASE, backend: el.backend.value,
      overlap: Number(el.overlap.value) }, [esq.buffer, dir.buffer]);
  } catch (e) {
    falhar(`não consegui abrir este arquivo de áudio (${e.message || e})`);
  }
});

el.cancelar.addEventListener("click", () => {
  if (trabalhador) trabalhador.terminate();
  trabalhador = null;   // o proximo pedido recria (e le o modelo do cache)
  status("Cancelado", 0, "");
  terminarOcupado();
});

// gancho do teste automatizado (teste/navegador.mjs): so com ?teste na URL
if (params.has("teste")) {
  window.separadorTeste = {
    brutos: () => new Promise((ok) => { window.__brutos = ok; trabalhador.postMessage({ tipo: "brutos" }); }),
    estado: () => ({ texto: el.texto.textContent, detalhe: el.detalhe.textContent, avisos: el.avisos.textContent,
      resumo: el.resumo.textContent, ocupado, isolado: self.crossOriginIsolated }),
  };
}
