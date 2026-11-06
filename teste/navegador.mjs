// Teste de ponta a ponta no Chrome sem janela (puppeteer-core): abre a pagina servida localmente,
// envia o sinal sintetico, separa com o backend pedido e compara os stems com stems.py.
//
// Uso:
//   python3 -m http.server 8790 --bind 127.0.0.1   (na pasta publico/web, em outro terminal)
//   ORT_DIR=<pasta com node_modules/puppeteer-core> node navegador.mjs PASTA_REF [webgpu|wasm|auto] [porta]
//   WAV=outro.wav (so mede tempo)  EXTRA="&semcoi" (WASM em 1 thread, como sem isolamento)

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const [ref, backend = "auto", porta = "8790"] = process.argv.slice(2);
const req = createRequire(join(process.env.ORT_DIR, "x.js"));
const puppeteer = req("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const WAV = process.env.WAV || join(process.env.HOME, "Stem Pessoal", "teste", "sinal_sintetico.wav");
const FONTES = ["drums", "bass", "other", "vocals"];

const nav = await puppeteer.launch({ executablePath: CHROME, headless: true,
  args: ["--enable-unsafe-webgpu", "--enable-gpu", "--use-angle=metal", "--no-first-run"] });
const pag = await nav.newPage();
const logs = [];
pag.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
pag.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));
await pag.goto(`http://127.0.0.1:${porta}/?teste${process.env.EXTRA || ""}`, { waitUntil: "load" });
// o service worker recarrega a pagina uma vez para ficar crossOriginIsolated
await pag.waitForFunction(() => self.crossOriginIsolated, { timeout: 15000 }).catch(() => {});
await pag.waitForFunction(() => window.separadorTeste, { timeout: 15000 });
const adaptador = await pag.evaluate(async () => {
  try { const a = await navigator.gpu?.requestAdapter(); return a ? (a.info?.vendor || "sim") + " " + (a.info?.architecture || "") : "nenhum"; }
  catch (e) { return "erro " + e.message; }
});
const isolado = await pag.evaluate(() => self.crossOriginIsolated);
console.log(`Chrome ${await nav.version()} | adaptador WebGPU: ${adaptador} | crossOriginIsolated: ${isolado}`);

await pag.select("#backend", backend);
const entrada = await pag.$("#entrada");
await entrada.uploadFile(WAV);
await pag.click("#separar");
const t0 = Date.now();
let estado;
for (;;) {
  await new Promise((r) => setTimeout(r, 1000));
  estado = await pag.evaluate(() => window.separadorTeste.estado());
  if (estado.fase === "resultado" || estado.fase === "erro") break;
  if (Date.now() - t0 > 30 * 60 * 1000) { estado.texto = "tempo esgotado"; break; }
}
console.log(`estado: ${estado.texto} | ${estado.resumo}${estado.avisos ? " | avisos: " + estado.avisos.trim() : ""} | ${((Date.now() - t0) / 1000).toFixed(1)} s no total (com download/carga do modelo)`);
if (estado.fase !== "resultado") { console.log(logs.slice(-30).join("\n")); await nav.close(); process.exit(1); }

const emCache = await pag.evaluate(async () => (await (await caches.open("separador-stems-modelo")).keys()).length);
console.log(`pedacos do modelo no Cache API: ${emCache}`);
if (process.env.WAV) { await nav.close(); process.exit(0); }   // so tempo: sem referencia para comparar
const b64 = await pag.evaluate(async () => {
  const lista = await window.separadorTeste.brutos();
  const cod = (f) => { const u = new Uint8Array(f.buffer); let s = ""; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
  return lista.map((x) => ({ nome: x.nome, esq: cod(x.esq), dir: cod(x.dir) }));
});
const info = JSON.parse(readFileSync(join(ref, "info.json"), "utf8"));
const N = info.N;
const pyb = readFileSync(join(ref, "stems.f32"));
const py = new Float32Array(pyb.buffer, pyb.byteOffset, pyb.byteLength / 4);
const dec = (s) => { const b = Buffer.from(s, "base64"); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const linhas = b64.map((x) => {
  const s = FONTES.indexOf(x.nome);
  const a = [dec(x.esq), dec(x.dir)];
  let num = 0, den = 0;
  for (let c = 0; c < 2; c++) for (let i = 0; i < N; i++) { const r = py[(s * 2 + c) * N + i]; const d = a[c][i] - r; num += d * d; den += r * r; }
  return `${x.nome} ${(Math.sqrt(num) / Math.sqrt(den)).toExponential(2)}`;
});
console.log(`[navegador/${backend}] stems vs stems.py (fp32 CPU): ${linhas.join(" | ")}`);
const erros = logs.filter((l) => /error|pageerror/i.test(l));
if (erros.length) console.log(erros.slice(0, 10).join("\n"));
await nav.close();
