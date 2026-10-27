// Valida o porte JS (dsp.js) contra a referencia Python (referencia.py) e, opcionalmente,
// a separacao completa com onnxruntime-web (backend WASM) no Node.
//
// Uso:
//   node validar.mjs PASTA_REF                         # so STFT/ISTFT
//   ORT_DIR=<pasta com node_modules/onnxruntime-web> node validar.mjs PASTA_REF MODELO.onnx [rotulo]
//
// MODELO.onnx pode ser o fp32 original ou a versao de distribuicao (fp16 nos pesos).

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as dsp from "../dsp.js";

const aqui = dirname(fileURLToPath(import.meta.url));
const [ref, modelo, rotulo = "modelo"] = process.argv.slice(2);
if (!ref) { console.error("uso: node validar.mjs PASTA_REF [MODELO.onnx]"); process.exit(1); }
const ler = (n) => { const b = readFileSync(join(ref, n)); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const info = JSON.parse(readFileSync(join(ref, "info.json"), "utf8"));
const L = dsp.SEGMENTO, T = Math.ceil(L / dsp.HOP), FQ = dsp.NFFT / 2, S = 4;

function erroRel(a, b) {
  let num = 0, den = 0;
  for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; num += d * d; den += b[i] * b[i]; }
  return Math.sqrt(num) / (Math.sqrt(den) + 1e-12);
}
function erroMax(a, b) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; }
const fmt = (x) => x.toExponential(2);

// 1) STFT
const mix0 = ler("mix0.f32");
let t0 = performance.now();
const cac = dsp.espectroCac(mix0.subarray(0, L), mix0.subarray(L, 2 * L), L);
const tStft = performance.now() - t0;
const cacPy = ler("cac0.f32");
console.log(`STFT  (4x2048x336): erro relativo ${fmt(erroRel(cac, cacPy))} | max abs ${fmt(erroMax(cac, cacPy))} | ${tStft.toFixed(0)} ms`);

// 2) ISTFT, por fonte
const xf = ler("xfreq0.f32"), ondaPy = ler("onda0.f32");
t0 = performance.now();
const linhas = [];
for (let s = 0; s < S; s++) {
  const [e, d] = dsp.ispectroCac(xf, s, T, L);
  const j = new Float32Array(2 * L); j.set(e, 0); j.set(d, L);
  linhas.push(`${dsp.FONTES[s]} ${fmt(erroRel(j, ondaPy.subarray(s * 2 * L, (s + 1) * 2 * L)))}`);
}
console.log(`ISTFT (4 fontes): erro relativo ${linhas.join(" | ")} | ${(performance.now() - t0).toFixed(0)} ms`);

if (!modelo) process.exit(0);

// 3) Separacao completa com onnxruntime-web (WASM) no Node
const req = createRequire(join(process.env.ORT_DIR || aqui, "x.js"));
const ort = req("onnxruntime-web");
ort.env.wasm.numThreads = Number(process.env.THREADS || 0) || undefined;
const pcm = lerWav(join(process.env.HOME, "Stem Pessoal", "teste", "sinal_sintetico.wav"));
t0 = performance.now();
const sess = await ort.InferenceSession.create(readFileSync(modelo), { executionProviders: ["wasm"] });
const tCarga = performance.now() - t0;
const rodar = async (mix, cacIn) => {
  const r = await sess.run({
    mix: new ort.Tensor("float32", mix, [1, 2, L]),
    cac: new ort.Tensor("float32", cacIn, [1, 4, FQ, T]),
  });
  return { xfreq: r.xfreq.data, xtempo: r.xtempo.data };
};
// janela 0 isolada: saida do ONNX no WASM vs onnxruntime CPU do Python (mesma entrada)
const r0 = await rodar(mix0, cacPy);
console.log(`[${rotulo}] janela 0, WASM vs Python CPU: xfreq ${fmt(erroRel(r0.xfreq, xf))} | xtempo ${fmt(erroRel(r0.xtempo, ler("xtempo0.f32")))}`);
t0 = performance.now();
const tempos = [];
const stems = await dsp.separar(pcm[0], pcm[1], async (m, c) => { const a = performance.now(); const r = await rodar(m, c); tempos.push(performance.now() - a); return r; });
const tSep = (performance.now() - t0) / 1000;
const py = ler("stems.f32"), N = info.N;
const err = dsp.FONTES.map((n, s) => {
  const j = new Float32Array(2 * N); j.set(stems[s][0], 0); j.set(stems[s][1], N);
  return `${n} ${fmt(erroRel(j, py.subarray(s * 2 * N, (s + 1) * 2 * N)))}`;
});
console.log(`[${rotulo}] separacao completa JS+WASM vs stems.py (fp32 CPU): ${err.join(" | ")}`);
console.log(`[${rotulo}] carga ${(tCarga / 1000).toFixed(1)} s | separacao ${tSep.toFixed(1)} s para ${(N / 44100).toFixed(1)} s de audio | ${(tempos.reduce((a, b) => a + b) / tempos.length / 1000).toFixed(1)} s por janela de inferencia`);

function lerWav(caminho) {
  const b = readFileSync(caminho), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let o = 12, fmtc = null, dados = null;
  while (o < b.length) {
    const id = b.toString("ascii", o, o + 4), tam = v.getUint32(o + 4, true);
    if (id === "fmt ") fmtc = { canais: v.getUint16(o + 10, true), taxa: v.getUint32(o + 12, true), bits: v.getUint16(o + 22, true), tipo: v.getUint16(o + 8, true) };
    if (id === "data") dados = [o + 8, tam];
    o += 8 + tam + (tam & 1);
  }
  const { canais, bits } = fmtc, bps = bits / 8, n = dados[1] / (bps * canais);
  const out = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    const p = dados[0] + (i * canais + Math.min(c, canais - 1)) * bps;
    let x;
    if (bits === 16) x = v.getInt16(p, true) / 32768;
    else if (bits === 24) { x = b[p] | (b[p + 1] << 8) | (b[p + 2] << 16); if (x & 0x800000) x -= 1 << 24; x /= 8388608; }
    else x = v.getFloat32(p, true);
    out[c][i] = x;
  }
  return out;
}
