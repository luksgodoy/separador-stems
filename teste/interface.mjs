// Teste da interface no Chrome sem janela, sem rodar o modelo (usa separadorTeste.simular):
// Tipo (3 opcoes, 2 idiomas), ausencia do seletor de processamento, play por faixa e alternancia com o transporte.
// Uso: ORT_DIR=<pasta com node_modules/puppeteer-core> node teste/interface.mjs [porta]   (servidor na pasta do app)
import { createRequire } from "node:module";
import { join } from "node:path";
const porta = process.argv[2] || "8090";
const puppeteer = createRequire(join(process.env.ORT_DIR, "x.js"))("puppeteer-core");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const nav = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-first-run", "--autoplay-policy=no-user-gesture-required"] });
const pag = await nav.newPage();
const erros = [];
pag.on("pageerror", (e) => erros.push(e.message));
await pag.goto(`http://127.0.0.1:${porta}/?teste`, { waitUntil: "load" });
await pag.waitForFunction(() => self.crossOriginIsolated, { timeout: 15000 }).catch(() => {});
await pag.waitForFunction(() => window.separadorTeste, { timeout: 15000 });
let falhas = 0;
const ok = (c, m) => { console.log(`${c ? "OK   " : "FALHA"} ${m}`); if (!c) falhas++; };
const esp = (ms) => new Promise((r) => setTimeout(r, ms));
const ganhos = () => pag.evaluate(() => window.separadorTeste.ganhos());
const pos = () => pag.evaluate(() => window.separadorTeste.posicao());
const icones = () => pag.evaluate(() => ({
  topo: !document.getElementById("icone-pause").hidden ? "pause" : "play",
  ...Object.fromEntries(["vocals", "drums", "bass", "other"].map((n) => [n, document.querySelector(`#stem-${n} .ic-pause`).hidden ? "play" : "pause"])) }));
const aria = (n) => pag.$eval(`#stem-${n} .btn-play-stem`, (b) => b.getAttribute("aria-label"));

for (const idioma of ["pt", "en"]) {
  await pag.evaluate((i) => document.querySelector(`[data-idioma="${i}"]`).click(), idioma);
  const d = await pag.evaluate(() => ({
    rotulo: document.querySelector("#overlap").closest("label").firstElementChild.textContent,
    ops: [...document.querySelectorAll("#overlap option")].map((o) => `${o.value}=${o.textContent}`),
    resumo: document.getElementById("resumo-opcoes").textContent,
    backend: !!document.getElementById("backend"), proc: !!document.querySelector('[data-i18n="proc"]') }));
  const esperado = idioma === "pt" ? ["0.1=Rápido", "0.25=Padrão", "0.5=Alto"] : ["0.1=Fast", "0.25=Standard", "0.5=High"];
  ok(JSON.stringify(d.ops) === JSON.stringify(esperado), `[${idioma}] Tipo: ${d.rotulo} -> ${d.ops.join(" / ")}`);
  ok(d.resumo === (idioma === "pt" ? "24 bits · Padrão" : "24 bit · Standard"), `[${idioma}] resumo: ${d.resumo}`);
  ok(!d.backend && !d.proc, `[${idioma}] sem seletor de processamento`);
}
ok(await pag.$eval("#overlap", (s) => s.value) === "0.25", "padrao 0.25");
await pag.evaluate(() => { document.getElementById("overlap").value = "0.5"; document.getElementById("overlap").dispatchEvent(new Event("change")); });
ok((await pag.$eval("#resumo-opcoes", (e) => e.textContent)).endsWith("High"), "resumo acompanha a troca para High");

// sinais sinteticos de 4 s
await pag.evaluate(async () => {
  const N = 44100 * 4, mk = (nome, f) => { const e = new Float32Array(N); for (let i = 0; i < N; i++) e[i] = 0.3 * Math.sin(2 * Math.PI * f * i / 44100); return { nome, esq: e, dir: e.slice() }; };
  await window.separadorTeste.simular([mk("vocals", 440), mk("drums", 220), mk("bass", 110), mk("other", 880)]);
});
await pag.evaluate(() => document.querySelector('[data-idioma="pt"]').click());
ok((await aria("drums")) === "Tocar Bateria", `aria pt: ${await aria("drums")}`);

// 1. play da bateria: so ela tem ganho
await pag.click("#stem-drums .btn-play-stem"); await esp(600);
let g = await ganhos(), ic = await icones();
ok(g.drums === 1 && g.vocals === 0 && g.bass === 0 && g.other === 0, `play da bateria -> ganhos ${JSON.stringify(g)}`);
ok(ic.drums === "pause" && ic.vocals === "play" && ic.topo === "pause", `icones ${JSON.stringify(ic)}`);
ok((await aria("drums")) === "Pausar Bateria", `aria: ${await aria("drums")}`);
const p1 = await pos(); await esp(400); ok((await pos()) > p1, "playhead avanca");
ok((await pag.$eval("#stem-vocals .onda-corte", (r) => Number(r.getAttribute("width")))) > 0, "waveform de outra faixa acompanha o mesmo tempo");
ok((await pag.$$eval(".btn-mudo,.btn-solo", (b) => b.every((x) => x.getAttribute("aria-pressed") === "false"))), "Mudo/Solo intactos");
// 2. liga o baixo sem parar a bateria: dois tocando, posicao continua
const antes = await pos();
await pag.click("#stem-bass .btn-play-stem"); await esp(300);
g = await ganhos(); ic = await icones();
ok(g.drums === 1 && g.bass === 1 && g.vocals === 0 && g.other === 0, `bateria + baixo: ${JSON.stringify(g)}`);
ok(ic.drums === "pause" && ic.bass === "pause" && ic.vocals === "play", `icones ${JSON.stringify(ic)}`);
const p2 = await pos(); ok(p2 > antes + 0.25, `posicao continua (${antes.toFixed(2)} -> ${p2.toFixed(2)})`);
// 3. desliga a bateria, baixo segue
await pag.click("#stem-drums .btn-play-stem"); await esp(300);
g = await ganhos(); ic = await icones();
ok(g.drums === 0 && g.bass === 1 && ic.bass === "pause" && ic.drums === "play" && ic.topo === "pause", `so baixo: ${JSON.stringify(g)}`);
ok((await pos()) > p2, "posicao seguiu correndo");
// 4. desliga a ultima: pausa e congela
await pag.click("#stem-bass .btn-play-stem"); await esp(200);
const pp = await pos(); await esp(300);
ok((await pos()) === pp && pp > 0, `pausa congela a posicao (${pp.toFixed(2)} s)`);
ok(Object.values(await icones()).every((v) => v === "play"), "todos os icones em play");
// 5. topo liga as 4 a partir da posicao; um cartao desliga so uma; topo pausa tudo
await pag.click("#btn-play"); await esp(300);
g = await ganhos(); ic = await icones();
ok(Object.values(g).every((v) => v === 1) && ic.topo === "pause" && (await pos()) > pp, `topo liga as 4 sem voltar a zero: ${JSON.stringify(g)}`);
await pag.click("#stem-vocals .btn-play-stem"); await esp(200);
g = await ganhos(); ok(g.vocals === 0 && g.drums === 1 && g.bass === 1 && g.other === 1, `desliga so a voz: ${JSON.stringify(g)}`);
await pag.click("#btn-play"); await esp(200);
ok(Object.values(await icones()).every((v) => v === "play"), "topo pausa tudo");
// 6. Mudo vale para o que toca
await pag.click("#stem-other .btn-mudo");
await pag.click("#stem-other .btn-play-stem"); await pag.click("#stem-drums .btn-play-stem"); await esp(200);
g = await ganhos(); ok(g.other === 0 && g.drums === 1, `Mudo zera o ganho da faixa ligada: ${JSON.stringify(g)}`);
await pag.click("#btn-play");
await pag.evaluate(() => document.querySelector('[data-idioma="en"]').click());
ok((await aria("vocals")) === "Play Vocals", `aria en: ${await aria("vocals")}`);
// 6b. Arrastar na waveform: pointer events movem o playhead de todos os canais; clique simples continua valendo
{
  if ((await icones()).topo === "pause") await pag.click("#btn-play");
  await esp(150);
  const caixa = async (n) => pag.$eval(`#stem-${n} .onda`, (o) => { const r = o.getBoundingClientRect(); return { x: r.left, y: r.top + r.height / 2, w: r.width }; });
  let c = await caixa("bass");
  await pag.mouse.move(c.x + c.w * 0.25, c.y); await pag.mouse.down();
  await pag.mouse.move(c.x + c.w * 0.5, c.y, { steps: 5 });
  const meio = await pos();
  await pag.mouse.move(c.x + c.w * 0.75, c.y, { steps: 5 }); await pag.mouse.up();
  const fim = await pos();
  ok(meio > 1.7 && meio < 2.3 && fim > 2.7 && fim < 3.3, `arrastar parado move a posicao (meio ${meio.toFixed(2)}, fim ${fim.toFixed(2)} de 4 s)`);
  ok((await pag.$eval("#stem-vocals .onda-corte", (r) => Number(r.getAttribute("width")))) > 0, "arrasto em uma faixa move as outras (mesmo relogio)");
  await pag.mouse.click(c.x + c.w * 0.1, c.y);
  const clique = await pos(); ok(clique > 0.2 && clique < 0.6, `clique simples continua indo ao ponto (${clique.toFixed(2)} s)`);
  // tocando: arrasto mantem as faixas ligadas e recomeca no ponto ao soltar
  await pag.click("#stem-drums .btn-play-stem"); await esp(150);
  c = await caixa("vocals");
  await pag.mouse.move(c.x + c.w * 0.2, c.y); await pag.mouse.down();
  await pag.mouse.move(c.x + c.w * 0.6, c.y, { steps: 5 }); await pag.mouse.up(); await esp(100);
  const g2 = await ganhos(), p2 = await pos();
  ok(g2.drums === 1 && g2.vocals === 0 && (await icones()).topo === "pause" && p2 > 2.3 && p2 < 2.9, `arrastar tocando segue tocando so a bateria (${JSON.stringify(g2)}, ${p2.toFixed(2)} s)`);
  // toque (touch): arrasto por pointer events de toque
  await pag.touchscreen.touchStart(c.x + c.w * 0.3, c.y);
  await pag.touchscreen.touchMove(c.x + c.w * 0.8, c.y);
  await pag.touchscreen.touchEnd(); await esp(100);
  const p3 = await pos(); ok(p3 > 3.0 && p3 < 3.6, `arrasto por toque (${p3.toFixed(2)} s)`);
  await pag.click("#btn-play"); await esp(100);
}
// 7. Novo arquivo no resultado: volta a selecao e limpa o estado
await pag.evaluate(() => document.querySelector('[data-idioma="pt"]').click());
ok((await pag.$eval("#btn-novo-resultado", (b) => b.textContent.trim())) === "Novo arquivo", "botao Novo arquivo (pt)");
await pag.evaluate(() => document.querySelector('[data-idioma="en"]').click());
ok((await pag.$eval("#btn-novo-resultado", (b) => b.textContent.trim())) === "New file", "botao New file (en)");
await pag.click("#btn-novo-resultado"); await esp(200);
const ap = await pag.evaluate(() => ({ sel: !document.getElementById("tela-selecao").hidden, res: document.getElementById("painel-resultado").classList.contains("oculto"), ini: !document.getElementById("zona-inicial").hidden }));
ok(ap.sel && ap.res && ap.ini, `Novo arquivo volta a tela inicial: ${JSON.stringify(ap)}`);
ok(erros.length === 0, `sem pageerror ${erros.join("|")}`);
await nav.close();
console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
