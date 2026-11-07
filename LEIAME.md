# Separador de Stems — versão web

Uma página estática que separa voz, bateria, baixo e outros instrumentos **dentro do navegador do
visitante**. Não tem servidor nem upload. O modelo é o **htdemucs** (Demucs v4, Meta/FAIR, MIT),
exportado para ONNX em `~/Stem Pessoal`. Roda com o ONNX Runtime Web 1.30.0 (MIT), que vem do jsDelivr
com a versão fixa.
Só entram os pesos do htdemucs: o BS-Roformer-SW e o DrumSep (licença de uso pessoal) **não** podem entrar aqui.

## Peças

| Arquivo | O que faz |
|---|---|
| `index.html`, `app.js` | interface: escolher ou arrastar o áudio, decodificar com Web Audio (`OfflineAudioContext` a 44,1 kHz, mono vira estéreo), barra de progresso por janela com tempo restante, player Web Audio sincronizado (mudo/solo/volume), download de WAV 16 ou 24 bits por stem ou todos num .zip, interface em PT/EN |
| `ableton.js`, `ableton-modelo.js`, `zip.js` | exportação para o Ableton Live 12: um `.zip` com `<nome> Project/<nome>.als` (XML em gzip) e os WAVs da original e dos 4 stems, uma faixa cada. `ableton-modelo.js` é **gerado** por `ferramentas/montar-modelo-als.py` a partir de um set real do Live 12; não edite à mão |
| `traktor.js` | exportação Traktor Stems (`.stem.mp4`): 5 faixas AAC (mix + Drums, Bass, Other, Vocals) e o JSON do formato no átomo `stem`. Codifica com WebCodecs (Chrome, Edge, Safari); onde não há AAC o botão fica desabilitado |
| `trabalhador.js` | Web Worker (module). Baixa o modelo com cache, cria a sessão (WebGPU; se falhar, WASM) e separa janela a janela |
| `dsp.js` | porte de `stems.py`: STFT/ISTFT CaC (hann, n_fft 4096, hop 1024, normalized, center, reflect), janelas de 343 980 amostras com sobreposição de 0,25, fusão triangular, normalização média/desvio do mix e `rescale` |
| `coi-sw.js`, `_headers` | isolamento entre origens (COOP/COEP), que o WASM precisa para usar várias threads. O `_headers` vale no Cloudflare Pages; o service worker cobre o GitHub Pages, que não deixa configurar cabeçalho |
| `modelo/` | **gerado** (não versionado, ver `.gitignore`): `manifesto.json` + 5 pedaços de até 20 MB |
| `ferramentas/preparar_modelo.py` | gera `modelo/` a partir de `~/Stem Pessoal/modelos/htdemucs_seg343980.onnx` |
| `teste/` | `referencia.py` (Python), `validar.mjs` (Node), `navegador.mjs` (Chrome sem janela, com o modelo) e `interface.mjs` (Chrome sem janela, só a interface: Tipo, play por faixa) |

## Decisão sobre o modelo: pesos fp16, cálculo em fp32, servido em pedaços junto com o site

Cada inicializador fp32 é gravado em fp16 e ganha um `Cast` para fp32 na entrada do grafo. O onnxruntime
dobra esses `Cast` quando cria a sessão, então a inferência continua toda em fp32. Só os pesos sofrem
arredondamento. O arquivo cai de 174 MB para **90,4 MB**, gravado em **5 pedaços de até 20 MB** (abaixo
dos 25 MiB por arquivo do Cloudflare Pages e dos 100 MB do GitHub Pages). O `manifesto.json` traz o
sha256 de cada pedaço, e o nome do pedaço carrega o hash do modelo, de modo que o cache HTTP nunca
serve um pedaço de versão antiga. No navegador, os pedaços vão para a **Cache API**: a página baixa uma
vez, confere o sha256 e apaga as versões velhas.

O modelo fica **no próprio site** (mesma origem): não precisa de CORS nem de conta em outro serviço.
Para hospedar fora (Hugging Face, GitHub Release com CORS), é só subir o conteúdo de `modelo/` e abrir
a página com `?modelo=https://huggingface.co/<usuário>/<repo>/resolve/main/`.
A página exige que a origem mande `Access-Control-Allow-Origin` (o Hugging Face manda). **Asset de
GitHub Release não manda CORS**, então não serve para ser baixado direto pelo navegador.

Erro medido contra o fp32, na separação completa do `teste/sinal_sintetico.wav` (onnxruntime CPU, Python):

| Variante | Tamanho | drums | bass | other | vocals | Decisão |
|---|---|---|---|---|---|---|
| fp32 original | 174 MB | — | — | — | — | grande demais |
| **fp16 nos pesos** | **90,4 MB** | 9,8e-5 (−80 dB) | 8,5e-6 (−101 dB) | 1,6e-4 (−76 dB) | 6,5e-4 (−64 dB) | **adotada** |
| int8 por canal (DequantizeLinear) | 48,9 MB | 1,8e-2 (−35 dB) | 5,0e-3 (−46 dB) | 2,0e-2 (−34 dB) | 7,5e-2 (−22 dB) | recusada: erro audível |

O erro do fp16 fica abaixo da diferença que já existe entre o WASM e o onnxruntime CPU no próprio
fp32 (até 3,6e-3). O vocals tem o maior erro relativo porque o sinal sintético quase não tem voz, e o
denominador fica pequeno.

## Validação do porte (erro relativo, norma L2)

Medido em 27/10/2026 contra `~/Stem Pessoal/stems.py`, só com o sinal sintético, num Apple M4 com Chrome 156:

| O quê | drums | bass | other | vocals |
|---|---|---|---|---|
| STFT JS × `espectro_cac` (janela 0, 4×2048×336) | 1,5e-7 (as quatro fontes juntas) | | | |
| ISTFT JS × `ispectro_cac` (janela 0) | 1,3e-7 | 1,6e-7 | 1,1e-7 | 1,1e-7 |
| separação completa, Node + onnxruntime-web WASM, fp16 | 3,5e-4 | 4,4e-4 | 7,8e-4 | 3,0e-3 |
| separação completa, **página no Chrome, WebGPU**, fp16 | 1,1e-4 | 2,4e-5 | 3,5e-4 | 1,5e-3 |
| separação completa, **página no Chrome, WASM**, fp16 | 3,5e-4 | 4,4e-4 | 7,8e-4 | 3,0e-3 |

O STFT e a ISTFT batem com o Python no nível do float32 (cerca de 1e-7). O que sobra na separação completa
vem do modelo: a ordem das operações e as implementações de Erf e Softmax em cada backend.

## Tempos e requisitos

Medidos com 60 s de áudio (o sinal sintético repetido 5×), Apple M4 de 10 núcleos, Chrome 156:

| Backend | Tempo por minuto de áudio |
|---|---|
| WebGPU (Metal) | **~19 s** |
| WASM, 8 threads (com isolamento COOP/COEP) | ~48 s |
| WASM, 1 thread (sem isolamento) | ~103 s |

Na primeira visita somam-se o download de 90 MB e alguns segundos para criar a sessão (~1 s no Node, ~3 s no Chrome com o modelo servido localmente). Em máquina mais modesta,
espere tempos várias vezes maiores (**estimativa, não medida**).

- **Navegador:** Chrome ou Edge 113+ (WebGPU). Firefox e Safari caem no WASM. Pelo desenho, devem
  funcionar (ES modules em worker, `OfflineAudioContext`, Cache API), **mas não foram testados**.
- **Memória:** no backend WASM, o processo chegou a ~2,9 GB de RSS no Node: o heap do WASM com o modelo
  mais as ativações do transformer, perto do teto de 4 GB do wasm32. Com WebGPU, as ativações ficam na
  GPU. Somam-se ~1,8 MB por segundo de áudio no worker (entrada e 4 stems em float32), ou seja, ~0,5 GB
  numa faixa de 5 min. **Celular não é alvo.** A página avisa quando o áudio passa de 15 min.
- A saída sai sempre a 44,1 kHz, estéreo, com a duração da entrada. A página não volta à taxa original
  (o `stems.py` volta).

## Testar localmente

```bash
cd ~/Separador-Stems/publico/web
"$HOME/Stem Pessoal/.venv/bin/python" ferramentas/preparar_modelo.py      # gera modelo/ (uma vez, ~10 s)
python3 -m http.server 8790 --bind 127.0.0.1                              # e abrir http://127.0.0.1:8790
```

Validação numérica (precisa de `npm i onnxruntime-web@1.30.0 puppeteer-core@25.13.0` numa pasta
qualquer, que é a `ORT_DIR`):

```bash
cd teste
"$HOME/Stem Pessoal/.venv/bin/python" referencia.py /tmp/ref                 # referência Python
node validar.mjs /tmp/ref                                                   # STFT/ISTFT
ORT_DIR=/caminho node validar.mjs /tmp/ref /caminho/htdemucs_fp16.onnx fp16  # + modelo no WASM (Node)
ORT_DIR=/caminho node navegador.mjs /tmp/ref webgpu                         # página no Chrome (servidor no ar); o backend vai por ?teste&backend=, a página não tem seletor
ORT_DIR=/caminho node interface.mjs 8090                                    # interface sem rodar o modelo
```

`preparar_modelo.py --so-onnx --saida /caminho` grava o `.onnx` inteiro, que o `validar.mjs` usa.

## Publicar no GitHub Pages (decisão do Lucas, nada foi publicado)

1. Criar um repositório público, por exemplo `separador-stems-web`, e copiar para ele o **conteúdo** desta
   pasta, **incluindo `modelo/`**: tirar `modelo/` do `.gitignore` nesse repositório. Os pedaços de 20 MB
   passam no limite do GitHub, que alerta acima de 50 MB e recusa acima de 100 MB.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / raiz.
3. Abrir `https://<usuário>.github.io/separador-stems-web/`. Na primeira visita o `coi-sw.js` se registra
   e recarrega a página uma vez, para o WASM ganhar threads.

**Cloudflare Pages:** mesmo conteúdo, sem passo de build. O `_headers` já manda COOP/COEP.

**Antes de publicar**, confira a licença dos pesos: o MIT do repositório Demucs cobre o código. Que cubra
também os pesos é a leitura usual, mas não há texto explícito (ver o README de `~/Stem Pessoal`). Ao
distribuir os pesos, a página deve citar a fonte (já cita) e o MIT.
