// Testes de unidade sem modelo e sem navegador: janelas, WAV, zip e nome seguro.
// Uso: node teste/unidades.mjs
import * as dsp from "../dsp.js";
import { gerarZip, crc32 } from "../zip.js";
import { nomeSeguro } from "../ableton.js";

let falhas = 0;
const ok = (cond, nome, extra = "") => { console.log(`${cond ? "OK  " : "FALHA"}  ${nome}${cond ? "" : " " + extra}`); if (!cond) falhas++; };

// ---- planoJanelas: toda amostra de 0..N-1 fica coberta, e o recorte nunca passa de L
const L = 1000;
for (const N of [1, L - 1, L, L + 1, Math.round(3.3 * L)]) {
  for (const overlap of [0.1, 0.25, 0.5]) {
    const plano = dsp.planoJanelas(N, L, overlap);
    const cobertura = new Uint8Array(N);
    for (const j of plano) for (let i = 0; i < j.real; i++) cobertura[j.off + i] = 1;
    const falta = cobertura.indexOf(0);
    ok(falta === -1 && plano.every((j) => j.real >= 1 && j.real <= L && j.delta === L - j.real),
      `planoJanelas N=${N} overlap=${overlap}`, `amostra descoberta: ${falta}`);
  }
}

// ---- codificarWav: cabecalho e valores, 16 e 24 bits, clamp
{
  const esq = Float32Array.of(0, 1, -1, 2, -2, 0.5), dir = Float32Array.of(0, -1, 1, 0, 0, -0.5);
  for (const bits of [16, 24]) {
    const buf = dsp.codificarWav(esq, dir, 44100, bits), v = new DataView(buf), bps = bits / 8, bloco = 2 * bps;
    const txt = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n));
    ok(txt(0, 4) === "RIFF" && txt(8, 4) === "WAVE" && txt(12, 4) === "fmt " && txt(36, 4) === "data", `WAV ${bits}: marcas do cabecalho`);
    ok(buf.byteLength === 44 + esq.length * bloco && v.getUint32(4, true) === buf.byteLength - 8 && v.getUint32(40, true) === esq.length * bloco, `WAV ${bits}: tamanhos`);
    ok(v.getUint16(22, true) === 2 && v.getUint32(24, true) === 44100 && v.getUint16(34, true) === bits, `WAV ${bits}: canais, taxa e bits`);
    const amostra = (i, canal) => {
      const o = 44 + i * bloco + canal * bps;
      if (bits === 16) return v.getInt16(o, true);
      let x = v.getUint8(o) | (v.getUint8(o + 1) << 8) | (v.getUint8(o + 2) << 16);
      return x & 0x800000 ? x - 0x1000000 : x;
    };
    const max = bits === 16 ? 32767 : 8388607;
    ok(amostra(1, 0) === max && amostra(2, 0) === -max && amostra(3, 0) === max && amostra(4, 0) === -max, `WAV ${bits}: clamp em +-1 e sinal negativo`);
    ok(amostra(5, 0) === Math.round(0.5 * max) && amostra(5, 1) === Math.round(-0.5 * max), `WAV ${bits}: valor intermediario`);
  }
}

// ---- reescalar: so reescala se o pico conjunto passar de 0,999
{
  const a = [[Float32Array.of(2, -1), Float32Array.of(0.5, 0)]];
  const pico = dsp.reescalar(a);
  ok(pico === 2 && Math.abs(a[0][0][0] - 0.999) < 1e-6 && Math.abs(a[0][1][0] - 0.24975) < 1e-6, "reescalar: pico 2 vira 0,999 e as outras acompanham");
  const b = [[Float32Array.of(0.5), Float32Array.of(0.25)]];
  dsp.reescalar(b);
  ok(b[0][0][0] === 0.5, "reescalar: abaixo de 0,999 nao mexe");
}

// ---- gerarZip: estrutura e CRC (o erro acima de 4 GB nao e testavel aqui: exigiria alocar 4 GB)
{
  const dados = new TextEncoder().encode("ola, sidra");
  const blob = gerarZip([{ nome: "a.txt", dados }, { nome: "pasta/é.txt", dados }]);
  const u8 = new Uint8Array(await blob.arrayBuffer()), v = new DataView(u8.buffer);
  ok(v.getUint32(0, true) === 0x04034b50, "zip: assinatura do primeiro registro");
  ok(v.getUint32(14, true) === crc32(dados), "zip: CRC do primeiro arquivo");
  const eocd = u8.length - 22;
  ok(v.getUint32(eocd, true) === 0x06054b50 && v.getUint16(eocd + 10, true) === 2, "zip: fim do diretorio com 2 entradas");
}

// ---- nomeSeguro
ok(nomeSeguro("a\\b/c:d") === "a_b_c_d", "nomeSeguro: separadores viram _");
ok(nomeSeguro("..oculto") === "oculto" && nomeSeguro("   ") === "Sidra" && nomeSeguro("") === "Sidra", "nomeSeguro: ponto inicial, vazio e espaco");
ok(nomeSeguro("a\u007fb\u0085c") === "a_b_c", "nomeSeguro: caracteres de controle C1");
{
  const longo = nomeSeguro("😀".repeat(200));
  ok(Array.from(longo).length === 120 && !longo.includes("�"), "nomeSeguro: corte de 120 nao parte emoji");
}

console.log(falhas ? `${falhas} falha(s)` : "tudo certo");
process.exit(falhas ? 1 : 0);
