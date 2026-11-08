# Pendências — Separador de Stems

## Armadilhas vivas
- GitHub Pages: o build pode falhar sem aviso (06/11/2026, 1º build do commit `0d7914c` falhou após 4m54s). Confira `gh run list -R luksgodoy/separador-stems -L 1` e refaça com `gh api -X POST repos/luksgodoy/separador-stems/pages/builds`. Fonte: sessão /despachar de 06/11/2026.
- Embutir a página em iframe de outro domínio (Wix) pode quebrar o isolamento COOP/COEP (`coi-sw.js`), o WebGPU e o download do modelo de 90 MB. Por isso a escolha é subdomínio próprio, não iframe.
- `.claude/despacho.json` está sem rastreio no git: commitar ou pôr no `.gitignore`.
- `crypto.subtle`, WebGPU e Cache API só existem em contexto seguro: pelo IP da LAN em http a separação falha com "reading 'digest'" (`trabalhador.js:28`). Testar em `http://localhost` ou https. Fonte: sessão de 07/11/2026.
- Produção é o Worker em `~/sidra-publicar` (`npx wrangler deploy`, nome `sidra-stems`): publicar = copiar os arquivos para lá; o repositório do Sidra não é o que está no ar.

## Backlog aberto
0. **Validar as exportações nos programas reais.** `.als` no Live 12: o último teste deu "could not be opened" nos 5 WAVs com `RelativePathType 3`; falta testar tipo 1 (o dos sets reais do Lucas), caminho absoluto e nome sem acento, e depois mudar o modelo em `ferramentas/montar-modelo-als.py` e regenerar `ableton-modelo.js`. `.stem.mp4` nunca foi aberto no Traktor Pro 3. O Lucas disse "está funcionando" em 07/11/2026, sem detalhe do que abriu. [modelo: sonnet]
0b. **Web Analytics do Cloudflare (opção 2).** Falta o token do snippet (Analytics & Logs → Web Analytics → Add site → manual). Script com `crossorigin` por causa do COEP; testar a separação depois. Atualizar o texto de privacidade, que hoje só diz "Nada sai do seu computador", para citar o contador. [modelo: sonnet]
0c. **Limpar `#i-ableton` e `#i-traktor`** (symbols antigos em `index.html`, sem uso desde os logos oficiais). [modelo: sonnet]
0e. **`LICENSE` e nota de créditos** (Demucs, ONNX Runtime) no Sidra; túnel ngrok para testar no celular (precisa do sim do Lucas); opção de mostrar só o idioma ativo no FAQ; arrastar na waveform (hoje só clique); Analytics Engine opcional para o contador.
0d. **Limpar arquivos de stems gerados pelo Lucas**: pedido em 07/11/2026, mas nenhum arquivo do Sidra foi achado em Downloads/Desktop (as pastas `… Project` do Desktop são projetos dele). Perguntar o caminho.
1. **Enviar ao GitHub os avisos de requisitos e uso.** Estão em `idiomas.js` e `index.html`, na árvore de trabalho, **sem commit nem push**. Conferir o layout em 390 px com o screenshot da versão final antes de publicar. [modelo: sonnet]
2. **Subdomínio + botão no Wix.** Falta o Lucas informar: nome do subdomínio, onde está o DNS e criar o registro CNAME. Depois: arquivo `CNAME` no repositório, domínio no GitHub Pages, HTTPS, e botão/menu no Wix. [modelo: sonnet]
3. **Decisões abertas do Lucas:**
   - botão "Novo arquivo" no estado resultado (hoje só recarregando a página);
   - selects de opções (Tipo, bits) acessíveis no resultado (hoje somem com `#tela-selecao`);
   - opacidade do cartão com Mudo/Solo enquanto o play dele toca a faixa (`data-inativo`).
4. **Testes que faltam:** Safari, Firefox, WebGPU em outras placas, arrastar e soltar real, áudio >15 min (alerta), som audível, layout em 768 px, resultado com stems reais do modelo, Solo combinado com play por cartão, `teste/navegador.mjs` (separação real) depois das mudanças de Tipo e backend automático.
5. **Modelo no Hugging Face**, só se a divulgação crescer: o GitHub Pages dá cerca de 100 GB/mês, ou ~1.000 visitantes novos (90 MB cada). Procedimento no `LEIAME.md` (`?modelo=`). Lucas decidiu (06/11/2026) manter no GitHub por enquanto.

## Deliberadamente não construído
- Mosaico girih animado (rotação e escala das camadas): feito e aprovado em teste, mas o Lucas pediu para publicar **estático** (07/11/2026). A versão animada é trocar as duas linhas `transform` de `.mosaico::before/::after` por `animation` com `@keyframes` de `translate/rotate/scale`.
- Iframe do Wix: recusado em favor de subdomínio + botão (escolha do Lucas em 06/11/2026), pelo risco de quebrar COOP/COEP e WebGPU.
- Seletor de Processamento na UI: retirado a pedido do Lucas (06/11/2026); o app usa sempre `auto` (WebGPU, com queda para WASM). Só `?teste&backend=` força outro.
- Modelos BS-Roformer-SW e DrumSep: licença de uso pessoal, não podem entrar (ver `LEIAME.md`).

## Corrigido, mantido para o registro
- 07/11/2026 · Publicado em sidrastems.com (versão `4ff48e7a`): logos oficiais do Traktor (`logo-traktor.png`) e do Ableton (`logo-ableton.svg`) nos botões de exportação, clique na waveform leva todos os canais ao ponto (`irPara` em `app.js`), e-mail de contato e FAQ com efeito de camadas no hover, textos do FAQ resumidos.
- 07/11/2026 · Live recusava o `.als` por "Slot count mismatch": `FreezeSequencer/ClipSlotList` também precisa ter 1 slot por cena; corrigido em `ferramentas/montar-modelo-als.py`.
- 07/11/2026 · Waveform enchia tudo (pico absoluto): agora barras de RMS com escala no percentil 95; stems usam escala comum.
- 06/11/2026 · Interface Glass (proposta 1f) aplicada: `2046621` (index.html, idiomas.js) e `a7e5e78` (app.js, player Web Audio, zip).
- 06/11/2026 · "Sobreposição" virou "Tipo" (Rápido/Padrão/Alto = 0,10/0,25/0,50); backend fixo em automático; play independente e aditivo em cada faixa: `0d7914c`.
- 06/11/2026 · Playhead SVG nunca aparecia (`hidden` não é propriedade de SVG); corrigido com `toggleAttribute("hidden")` no `a7e5e78`.

## Validado
- 2026-11-07 · Clique na waveform movendo todos os canais testado pelo Lucas no servidor local (tocando e parado); logos conferidos em screenshot 390 px; deploy verificado por curl (HTML referencia `logo-traktor`, SVG responde 200) — fonte: `app.js` (`irPara`), `~/sidra-publicar`
- 2026-11-07 · `.stem.mp4` gerado por `traktor.js` passa no ffprobe e decodifica no ffmpeg (5 faixas AAC, JSON no átomo `stem`); contador `/api/separou` responde 204 e não é exposto (GET 405) — fonte: `traktor.js`, `~/sidra-publicar/worker.js`
- 2026-11-06 · Fluxo real com o htdemucs (backend wasm, áudio de 5 s e 60 s: 9 janelas, ~26 s por minuto de áudio) chega ao resultado; cancelar, erro, troca de idioma e troca de bits regeneram corretamente — fonte: commit `a7e5e78`
- 2026-11-06 · "Baixar todos" gera `.zip` store-only que passa em `unzip -t` — fonte: commit `a7e5e78`
- 2026-11-06 · `teste/interface.mjs` (25+ verificações, sem modelo) cobre Tipo, ausência do select de processamento e play por faixa — fonte: commit `0d7914c`
