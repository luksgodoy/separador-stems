// Projeto do Ableton Live 12: um .zip com "<nome> Project/<nome>.als" e os WAVs em Samples/Imported.
// O .als e um XML comprimido em gzip. O esqueleto vem de ableton-modelo.js (gerado de um set real do Live 12 por
// ferramentas/montar-modelo-als.py); aqui so se clona a faixa de audio, uma por stem, e se preenchem os marcadores.
import { MODELO } from "./ableton-modelo.js";
import { gerarZip } from "./zip.js";

export const BPM_PADRAO = 120;   // o Sidra nao detecta andamento: clipes sem warp tocam na velocidade original em qualquer BPM
const BASE_PONTEIRO = 40000;     // acima de qualquer id de ponteiro do esqueleto (o maior la e ~35 mil)
const BASE_FAIXA = 20;           // ids de faixa

// Indices da paleta do Live (0 a 69), um por faixa
export const CORES = { original: 0, vocals: 25, drums: 13, bass: 8, other: 17 };

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const nomeSeguro = (s) => (String(s).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim() || "Sidra").slice(0, 120);

function preencher(s, mapa) {
  return s.replace(/__([A-Z0-9]+)__/g, (m, k) => {
    if (!(k in mapa)) throw new Error(`marcador sem valor no modelo do Ableton: ${m}`);
    return mapa[k];
  });
}

/**
 * faixas: [{ chave, nome, arquivo (nome do WAV), bytes (tamanho), ativa }] na ordem em que aparecem no Live.
 * amostras: numero de amostras de cada WAV (todos tem o mesmo tamanho). Devolve o texto do .als (XML).
 */
export function montarAls({ faixas, amostras, taxa = 44100, bpm = BPM_PADRAO, agora = Math.floor(Date.now() / 1000) }) {
  const seg = amostras / taxa;
  const beats = seg * bpm / 60;
  const partes = faixas.map((f, i) => {
    const caminho = `Samples/Imported/${f.arquivo}`;
    const clipe = preencher(MODELO.clipe, {
      CID: 1, NOME: esc(f.nome), COR: CORES[f.chave] ?? 0, BEATS: beats, SEG: seg, AMOSTRAS: amostras,
      CAMINHO: esc(caminho), BYTES: f.bytes, DATA: agora,
    });
    const mapa = { TID: BASE_FAIXA + i, NOME: esc(f.nome), COR: CORES[f.chave] ?? 0, ATIVA: f.ativa ? "true" : "false", CLIPES: clipe };
    for (let k = 0; k < MODELO.nPonteiros; k++) mapa["P" + k] = BASE_PONTEIRO + i * 100 + k;
    return preencher(MODELO.faixa, mapa);
  });
  const next = BASE_PONTEIRO + faixas.length * 100 + 100;
  return preencher(MODELO.antes, { BPM: bpm, NEXT: next }) + partes.join("\n") + preencher(MODELO.depois, { BPM: bpm, NEXT: next });
}

async function gzip(texto) {
  const fluxo = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

/**
 * base: nome da musica. stems: [{ chave, nome, wav: ArrayBuffer }]; original: { wav } opcional.
 * Devolve um Blob .zip com a pasta do projeto pronta para abrir no Live 12.
 */
export async function gerarProjetoAbleton({ base, original, stems, taxa = 44100, amostras }) {
  const nome = nomeSeguro(base);
  const lista = [];
  if (original) lista.push({ chave: "original", nome: "Original", wav: original, ativa: false });
  for (const s of stems) lista.push({ chave: s.chave, nome: s.nome, wav: s.wav, ativa: true });
  for (const f of lista) f.arquivo = `${nome} - ${f.nome}.wav`;
  const als = montarAls({ faixas: lista.map((f) => ({ ...f, bytes: f.wav.byteLength })), amostras, taxa });
  const pasta = `${nome} Project/`;
  const itens = [{ nome: `${pasta}${nome}.als`, dados: await gzip(als) }];
  for (const f of lista) itens.push({ nome: `${pasta}Samples/Imported/${f.arquivo}`, dados: f.wav });
  return gerarZip(itens);
}
