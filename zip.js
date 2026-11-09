// Zip sem compressao (metodo 0), usado pelo WAV .zip e pelo projeto do Ableton.
const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = TABELA_CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** itens: [{ nome, dados: ArrayBuffer|Uint8Array }] -> Blob .zip (metodo 0 = armazenado). */
export function gerarZip(itens) {
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
  if (pos > 0xffffffff || tamCentral > 0xffffffff || itens.length > 0xffff) throw new Error("zip grande demais (acima de 4 GB): o formato sem zip64 nao comporta");
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, itens.length, true); fim.setUint16(10, itens.length, true);
  fim.setUint32(12, tamCentral, true); fim.setUint32(16, pos, true);
  return new Blob([...partes, ...central, fim.buffer], { type: "application/zip" });
}
