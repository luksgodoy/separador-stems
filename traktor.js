// Traktor Stems (.stem.mp4): um MP4 com 5 faixas AAC (mixagem + 4 stems) e o JSON do formato num atomo "stem" em moov/udta.
// Ordem das faixas de stem no formato da Native Instruments: Drums, Bass, Other (Melody), Vocals. E a mesma ordem de saida do Demucs.
// Duas partes: codificarAac() usa WebCodecs (so no navegador) e empacotar() monta o MP4 (puro, testavel no Node).

export const STEMS_TRAKTOR = [
  { chave: "drums", nome: "Drums", cor: "#009E73" },
  { chave: "bass", nome: "Bass", cor: "#D55E00" },
  { chave: "other", nome: "Other", cor: "#CC79A7" },
  { chave: "vocals", nome: "Vocals", cor: "#56B4E9" },
];
export const BITRATE_AAC = 256000;
const QUADRO = 1024;   // amostras por quadro AAC-LC

// ---------------------------------------------------------------- suporte e codificacao (navegador)
const configAac = (taxa) => ({ codec: "mp4a.40.2", sampleRate: taxa, numberOfChannels: 2, bitrate: BITRATE_AAC, aac: { format: "aac" } });

/** true se este navegador sabe codificar AAC-LC pelo WebCodecs (Chrome/Edge/Safari; Firefox e Linux costumam nao saber). */
export async function suportaAac(taxa = 44100) {
  try {
    if (typeof AudioEncoder === "undefined" || typeof AudioData === "undefined") return false;
    return !!(await AudioEncoder.isConfigSupported(configAac(taxa))).supported;
  } catch { return false; }
}

/** esq/dir: Float32Array. Devolve { amostras: Uint8Array[] (um por quadro AAC), asc: Uint8Array }. */
export async function codificarAac(esq, dir, taxa = 44100, aoProgredir = () => {}) {
  const amostras = [];
  let asc = null, erro = null;
  const enc = new AudioEncoder({
    output: (chunk, meta) => {
      if (meta?.decoderConfig?.description && !asc) asc = new Uint8Array(meta.decoderConfig.description instanceof ArrayBuffer ? meta.decoderConfig.description : meta.decoderConfig.description.buffer.slice(meta.decoderConfig.description.byteOffset, meta.decoderConfig.description.byteOffset + meta.decoderConfig.description.byteLength));
      const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); amostras.push(b);
    },
    error: (e) => { erro = e; },
  });
  enc.configure(configAac(taxa));
  const BLOCO = 16384, N = esq.length;
  for (let i = 0; i < N; i += BLOCO) {
    if (erro) throw erro;
    const n = Math.min(BLOCO, N - i), d = new Float32Array(2 * n);
    d.set(esq.subarray(i, i + n), 0); d.set(dir.subarray(i, i + n), n);
    const ad = new AudioData({ format: "f32-planar", sampleRate: taxa, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / taxa * 1e6), data: d });
    enc.encode(ad); ad.close();
    while (enc.encodeQueueSize > 8) { await new Promise((r) => setTimeout(r, 4)); if (erro) throw erro; }
    aoProgredir(Math.min(1, (i + n) / N));
  }
  await enc.flush(); enc.close();
  if (erro) throw erro;
  if (!asc) asc = ascPadrao(taxa);
  return { amostras, asc };
}

// AudioSpecificConfig de AAC-LC estereo: 5 bits objeto (2) + 4 bits indice de taxa + 4 bits canais (2)
const TAXAS = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
export function ascPadrao(taxa) {
  const i = TAXAS.indexOf(taxa);
  if (i < 0) throw new Error("taxa de amostragem sem indice AAC: " + taxa);
  const v = (2 << 11) | (i << 7) | (2 << 3);
  return new Uint8Array([v >> 8, v & 255]);
}

// ---------------------------------------------------------------- MP4
const enc8 = new TextEncoder();
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u16 = (n) => new Uint8Array([(n >> 8) & 255, n & 255]);
const u8 = (n) => new Uint8Array([n & 255]);
const zeros = (n) => new Uint8Array(n);
function juntar(...ps) {
  let t = 0; for (const p of ps) t += p.length;
  const o = new Uint8Array(t); let k = 0;
  for (const p of ps) { o.set(p, k); k += p.length; }
  return o;
}
const caixa = (tipo, ...conteudo) => { const c = juntar(...conteudo); return juntar(u32(8 + c.length), enc8.encode(tipo), c); };
const cheia = (tipo, versao, flags, ...conteudo) => caixa(tipo, u8(versao), u8(flags >> 16), u8(flags >> 8), u8(flags), ...conteudo);
const MATRIZ = juntar(u32(0x10000), zeros(12), u32(0x10000), zeros(12), u32(0x40000000));

function descritor(tag, ...conteudo) {
  const c = juntar(...conteudo);
  if (c.length > 127) throw new Error("descritor grande demais");
  return juntar(u8(tag), u8(c.length), c);
}
function esds(idFaixa, asc, bitrate) {
  const dec = descritor(0x04, u8(0x40), u8(0x15), zeros(3), u32(bitrate), u32(bitrate), descritor(0x05, asc));
  return cheia("esds", 0, 0, descritor(0x03, u16(idFaixa), u8(0), dec, descritor(0x06, u8(2))));
}

function trak(idFaixa, f, taxa, deslocamento, duracaoMs) {
  const n = f.amostras.length;
  const mp4a = caixa("mp4a", zeros(6), u16(1), zeros(8), u16(2), u16(16), u16(0), u16(0), u32(taxa * 65536), esds(idFaixa, f.asc, BITRATE_AAC));
  const stbl = caixa("stbl",
    cheia("stsd", 0, 0, u32(1), mp4a),
    cheia("stts", 0, 0, u32(1), u32(n), u32(QUADRO)),
    cheia("stsc", 0, 0, u32(1), u32(1), u32(n), u32(1)),
    cheia("stsz", 0, 0, u32(0), u32(n), ...f.amostras.map((a) => u32(a.length))),
    cheia("stco", 0, 0, u32(1), u32(deslocamento)));
  const minf = caixa("minf", cheia("smhd", 0, 0, u16(0), u16(0)),
    caixa("dinf", cheia("dref", 0, 0, u32(1), cheia("url ", 0, 1))), stbl);
  const mdia = caixa("mdia",
    cheia("mdhd", 0, 0, u32(0), u32(0), u32(taxa), u32(n * QUADRO), u16(0x55c4), u16(0)),
    cheia("hdlr", 0, 0, u32(0), enc8.encode("soun"), zeros(12), enc8.encode("SoundHandler\0")),
    minf);
  const tkhd = cheia("tkhd", 0, 7, u32(0), u32(0), u32(idFaixa), u32(0), u32(duracaoMs), zeros(8), u16(0), u16(0), u16(0x0100), u16(0), MATRIZ, u32(0), u32(0));
  return caixa("trak", tkhd, mdia);
}

/**
 * faixas: 5 itens { amostras: Uint8Array[], asc: Uint8Array }, na ordem: mixagem, Drums, Bass, Other, Vocals.
 * Devolve Uint8Array do .stem.mp4 (moov antes do mdat, para abrir sem ler o arquivo inteiro).
 */
export function empacotar({ faixas, taxa = 44100, stems = STEMS_TRAKTOR }) {
  if (faixas.length !== 1 + stems.length) throw new Error("esperadas 1 mixagem + " + stems.length + " faixas de stem");
  const quadros = Math.max(...faixas.map((f) => f.amostras.length));
  const duracaoMs = Math.round(quadros * QUADRO / taxa * 1000);
  const json = JSON.stringify({
    mastering_dsp: {
      compressor: { ratio: 3, output_gain: 0.5, enabled: false, release: 0.300000011920929, attack: 0.003000000026077032, input_gain: 0.5, threshold: 0, hp_cutoff: 300, dry_wet: 50 },
      limiter: { release: 0.05000000074505806, threshold: 0, ceiling: -0.3499999940395355, enabled: false },
    },
    version: 1,
    stems: stems.map((s) => ({ color: s.cor, name: s.nome })),
  });
  const ftyp = caixa("ftyp", enc8.encode("M4A "), u32(0), enc8.encode("M4A "), enc8.encode("mp42"), enc8.encode("isom"), u32(0));
  const moov = (deslocamentos) => caixa("moov",
    cheia("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(duracaoMs), u32(0x10000), u16(0x0100), zeros(10), MATRIZ, zeros(24), u32(faixas.length + 1)),
    ...faixas.map((f, i) => trak(i + 1, f, taxa, deslocamentos[i], duracaoMs)),
    caixa("udta", caixa("stem", enc8.encode(json))));
  // o tamanho do moov nao depende dos deslocamentos (campos de 32 bits): monta uma vez para medir, outra para valer
  const tamMoov = moov(faixas.map(() => 0)).length;
  const inicio = ftyp.length + tamMoov + 8;
  const deslocamentos = [];
  let pos = inicio, tamDados = 0;
  for (const f of faixas) {
    deslocamentos.push(pos);
    const t = f.amostras.reduce((s, a) => s + a.length, 0);
    pos += t; tamDados += t;
  }
  if (8 + tamDados > 0xffffffff) throw new Error("arquivo maior que 4 GB");
  const mdat = new Uint8Array(8 + tamDados);
  mdat.set(u32(8 + tamDados), 0); mdat.set(enc8.encode("mdat"), 4);
  let k = 8;
  for (const f of faixas) for (const a of f.amostras) { mdat.set(a, k); k += a.length; }
  return juntar(ftyp, moov(deslocamentos), mdat);
}

/** Codifica mixagem + 4 stems e devolve o Blob .stem.mp4. entradas: { mix:{esq,dir}, drums:{esq,dir}, bass, other, vocals }. */
export async function gerarTraktorStem(entradas, taxa = 44100, aoProgredir = () => {}) {
  const ordem = ["mix", ...STEMS_TRAKTOR.map((s) => s.chave)];
  const faixas = [];
  for (let i = 0; i < ordem.length; i++) {
    const e = entradas[ordem[i]];
    faixas.push(await codificarAac(e.esq, e.dir, taxa, (p) => aoProgredir((i + p) / ordem.length)));
  }
  return new Blob([empacotar({ faixas, taxa })], { type: "audio/mp4" });
}
