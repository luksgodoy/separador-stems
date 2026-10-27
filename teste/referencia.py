"""Gera a referencia Python para validar o porte JS (dsp.js) e o modelo no navegador.

Uso (venv do Stem Pessoal, que tem torch + onnxruntime):
  "~/Stem Pessoal/.venv/bin/python" referencia.py PASTA_SAIDA [MODELO.onnx]

Grava em PASTA_SAIDA (float32 cru, little-endian):
  mix0.f32     janela 0 normalizada (2, L)
  cac0.f32     espectro_cac(mix0)            (4, 2048, 336)
  xfreq0.f32   saida xfreq do ONNX na janela  (4, 4, 2048, 336)
  xtempo0.f32  saida xtempo do ONNX           (4, 2, L)
  onda0.f32    ispectro_cac(xfreq0)          (4, 2, L)
  stems.f32    separacao completa de stems.separar (sem pos-processamento) (4, 2, N)
"""
import sys, json, time
from pathlib import Path
import numpy as np
import soundfile as sf
import torch

STEM = Path.home() / "Stem Pessoal"
sys.path.insert(0, str(STEM))
import stems  # noqa: E402

saida = Path(sys.argv[1]); saida.mkdir(parents=True, exist_ok=True)
modelo = sys.argv[2] if len(sys.argv) > 2 else str(STEM / "modelos" / "htdemucs_seg343980.onnx")
cfg = stems.carregar_config(STEM / "config.toml")
cfg["posprocessamento"]["clip"] = "nenhum"
L, nfft, hop = 343980, 4096, 1024

x, sr = sf.read(str(STEM / "teste" / "sinal_sintetico.wav"), dtype="float32", always_2d=True)
x = np.ascontiguousarray(x.T)
assert sr == 44100

import onnxruntime as ort
sess = ort.InferenceSession(modelo, providers=["CPUExecutionProvider"])

# janela 0 (N > L, entao e o comeco do audio normalizado)
m = torch.from_numpy(x)
ref = m.mean(0); media, desvio = ref.mean(), ref.std() + 1e-8
mix0 = ((m - media) / desvio)[:, :L].contiguous()
cac = stems.espectro_cac(mix0[None], nfft, hop)
xf, xt = sess.run(None, {"mix": mix0[None].numpy(), "cac": cac.numpy()})
onda = stems.ispectro_cac(torch.from_numpy(xf), nfft, hop, L)
for nome, arr in (("mix0", mix0.numpy()), ("cac0", cac.numpy()), ("xfreq0", xf), ("xtempo0", xt),
                  ("onda0", onda.numpy())):
    np.ascontiguousarray(arr, dtype="<f4").tofile(saida / f"{nome}.f32")

t = time.time()
out = stems.separar(sess, L, cfg, x, lambda s: None)
dt = time.time() - t
np.ascontiguousarray(out, dtype="<f4").tofile(saida / "stems.f32")
json.dump({"N": int(x.shape[1]), "L": L, "segundos_separacao": round(dt, 2), "modelo": modelo},
          open(saida / "info.json", "w"), indent=1)
print(f"referencia gravada em {saida} (N={x.shape[1]}, separacao {dt:.1f} s)")
