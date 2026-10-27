"""Prepara o modelo para hospedagem estatica: pesos em fp16 (ou int8) no arquivo, calculo em fp32.

Os inicializadores fp32 viram fp16 e ganham um Cast para fp32 logo na entrada do grafo
(ou, em int8, um DequantizeLinear por canal). O onnxruntime dobra esses Cast/DQ na criacao da
sessao, entao a inferencia continua toda em fp32: a unica perda e o arredondamento dos pesos.
Depois divide o .onnx em pedacos de ate --pedaco MB (Cloudflare Pages aceita 25 MiB por arquivo)
e grava manifesto.json com tamanho e sha256 de cada pedaco.

Uso (venv do Stem Pessoal):
  "~/Stem Pessoal/.venv/bin/python" preparar_modelo.py [--tipo fp16|int8] [--saida ../modelo] [--pedaco 20]
"""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
import onnx
from onnx import helper, numpy_helper, TensorProto

ORIGEM = Path.home() / "Stem Pessoal" / "modelos" / "htdemucs_seg343980.onnx"


def converter(modelo: onnx.ModelProto, tipo: str) -> onnx.ModelProto:
    g = modelo.graph
    novos_init, novos_nos = [], []
    for ini in list(g.initializer):
        if ini.data_type != TensorProto.FLOAT:
            novos_init.append(ini)
            continue
        w = numpy_helper.to_array(ini)
        nome = ini.name
        if tipo == "int8" and w.ndim >= 2 and w.size >= 1024:
            eixo = 0
            m = np.abs(w).reshape(w.shape[0], -1).max(1)
            esc = np.where(m > 0, m / 127.0, 1.0).astype(np.float32)
            q = np.clip(np.round(w / esc.reshape((-1,) + (1,) * (w.ndim - 1))), -127, 127).astype(np.int8)
            novos_init += [numpy_helper.from_array(q, nome + "_q"), numpy_helper.from_array(esc, nome + "_esc"),
                           numpy_helper.from_array(np.zeros_like(esc, dtype=np.int8), nome + "_zp")]
            novos_nos.append(helper.make_node("DequantizeLinear", [nome + "_q", nome + "_esc", nome + "_zp"], [nome],
                                              axis=eixo, name=nome + "_dq"))
        elif w.size >= 16:
            novos_init.append(numpy_helper.from_array(w.astype(np.float16), nome + "_h"))
            novos_nos.append(helper.make_node("Cast", [nome + "_h"], [nome], to=TensorProto.FLOAT, name=nome + "_cast"))
        else:
            novos_init.append(ini)
    del g.initializer[:]
    g.initializer.extend(novos_init)
    nos = novos_nos + list(g.node)
    del g.node[:]
    g.node.extend(nos)
    return modelo


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tipo", choices=["fp16", "int8", "fp32"], default="fp16")
    ap.add_argument("--saida", default=str(Path(__file__).resolve().parent.parent / "modelo"))
    ap.add_argument("--pedaco", type=float, default=20.0, help="MB por pedaco (1 MB = 1e6 bytes)")
    ap.add_argument("--so-onnx", action="store_true", help="grava so o .onnx inteiro, sem pedacos")
    a = ap.parse_args()
    saida = Path(a.saida); saida.mkdir(parents=True, exist_ok=True)
    m = onnx.load(str(ORIGEM))
    if a.tipo != "fp32":
        m = converter(m, a.tipo)
    onnx.checker.check_model(m)
    dados = m.SerializeToString()
    nome = f"htdemucs_{a.tipo}.onnx"
    if a.so_onnx:
        (saida / nome).write_bytes(dados)
        print(f"{saida / nome}: {len(dados)/1e6:.1f} MB")
        return
    for velho in saida.glob(f"htdemucs_{a.tipo}.*.parte*"):
        velho.unlink()
    tam = int(a.pedaco * 1e6)
    curto = hashlib.sha256(dados).hexdigest()[:10]   # nome muda junto com o conteudo: cache HTTP nunca serve pedaco velho
    partes = []
    for i in range(0, len(dados), tam):
        p = dados[i:i + tam]
        arq = f"htdemucs_{a.tipo}.{curto}.parte{len(partes):02d}"
        (saida / arq).write_bytes(p)
        partes.append({"arquivo": arq, "bytes": len(p), "sha256": hashlib.sha256(p).hexdigest()})
    manifesto = {"modelo": nome, "tipo": a.tipo, "bytes": len(dados),
                 "sha256": hashlib.sha256(dados).hexdigest(), "segmento": 343980,
                 "origem": "htdemucs (Demucs v4, Meta/FAIR, MIT), assinatura 955717e8", "partes": partes}
    (saida / "manifesto.json").write_text(json.dumps(manifesto, indent=1))
    print(f"{nome}: {len(dados)/1e6:.1f} MB em {len(partes)} pedacos de ate {a.pedaco:.0f} MB -> {saida}")


if __name__ == "__main__":
    main()
