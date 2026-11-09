# Pendências — Separador de Stems

## Armadilhas vivas
- GitHub Pages: o build pode falhar sem aviso (06/11/2026, 1º build do commit `0d7914c` falhou após 4m54s). Confira `gh run list -R luksgodoy/separador-stems -L 1` e refaça com `gh api -X POST repos/luksgodoy/separador-stems/pages/builds`. Fonte: sessão /despachar de 06/11/2026.
- Embutir a página em iframe de outro domínio (Wix) pode quebrar o isolamento COOP/COEP (`coi-sw.js`), o WebGPU e o download do modelo de 90 MB. Por isso a escolha é subdomínio próprio, não iframe.
- `.claude/despacho.json` está sem rastreio no git: commitar ou pôr no `.gitignore`.
- `crypto.subtle`, WebGPU e Cache API só existem em contexto seguro: pelo IP da LAN em http a separação falha com "reading 'digest'" (`trabalhador.js:28`). Testar em `http://localhost` ou https. Fonte: sessão de 07/11/2026.
- Produção é o Worker em `~/sidra-publicar` (`npx wrangler deploy`, nome `sidra-stems`): publicar = copiar os arquivos para lá; o repositório do Sidra não é o que está no ar.

## Backlog aberto

## Deliberadamente não construído
- Mosaico girih animado (rotação e escala das camadas): feito e aprovado em teste, mas o Lucas pediu para publicar **estático** (07/11/2026). A versão animada é trocar as duas linhas `transform` de `.mosaico::before/::after` por `animation` com `@keyframes` de `translate/rotate/scale`.
- Iframe do Wix: recusado em favor de subdomínio + botão (escolha do Lucas em 06/11/2026), pelo risco de quebrar COOP/COEP e WebGPU.
- Seletor de Processamento na UI: retirado a pedido do Lucas (06/11/2026); o app usa sempre `auto` (WebGPU, com queda para WASM). Só `?teste&backend=` força outro.
- Modelos BS-Roformer-SW e DrumSep: licença de uso pessoal, não podem entrar (ver `LEIAME.md`).

- Modelo no Hugging Face (antigo item 5): não por enquanto; o modelo segue no GitHub Pages/produção (decisão do Lucas, 09/11/2026). Procedimento no `LEIAME.md` (`?modelo=`).
- Modelo `modelo/curto/` (83 MB) no repositório (antigo item 4b): decidido, o repositório é só código-fonte; modelo e `curto` vivem só em `~/sidra-publicar` (decisão do Lucas, 09/11/2026).

## Corrigido, mantido para o registro
- 09/11/2026 · Publicado em sidrastems.com (versao `2878c5a6`): FAQ so no idioma ativo (`975c9dd`), arrastar na waveform (`4df5526`) e Analytics Engine `SEPARACOES` (dataset `sidra_separacoes`, ativado na conta). `docs/` fora dos assets publicos (`.assetsignore` em `~/sidra-publicar`; `/docs/pendencias.md` agora responde 404). Falta ver o dataset receber a primeira separacao.
- 09/11/2026 · FAQ e rótulo de contato só no idioma ativo: CSS `html[lang=…] [lang=…] { display: none }`, os dois idiomas seguem no HTML estático (SEO intacto, JSON-LD não mudou): `975c9dd`.
- 09/11/2026 · Arrastar na waveform move o playhead de todos os canais (pointer events, mouse e toque; tocando, recomeça uma vez ao soltar; clique simples e play por cartão intactos): `4df5526`, 5 checagens novas em `teste/interface.mjs`.
- 09/11/2026 · Contador no Analytics Engine: binding `SEPARACOES` (dataset `sidra_separacoes`) em `~/sidra-publicar/wrangler.jsonc`, 1 ponto por separação em `worker.js` (blob1 = `request.cf.country`, blob2 = dia, sem IP; KV `CONTAGEM` mantido; falha do dataset não derruba a contagem). `wrangler deploy --dry-run` valida os bindings; **não publicado**. O `worker.js` não vive neste repositório (só em `~/sidra-publicar`).
- 09/11/2026 · Live 12.4 derrubava o `.als` (SIGSEGV, ponteiro nulo): o esqueleto era do Live 12.1.5. Molde regenerado de um set salvo pelo 12.4 e `RelativePathType 1` em `ferramentas/montar-modelo-als.py`: `a6eac3b`.
- 09/11/2026 · `LICENSE` MIT (`65a46dc`); Web Analytics do Cloudflare com `crossorigin` por causa do COEP e texto de privacidade citando o contador (`5d33979`); token da skill `sidra-acessos` trocado (Keychain `sidra-cf-analytics`, consulta testada).
- 09/11/2026 · Publicado em sidrastems.com (versao `1b3fe423`): `.als` corrigido, botao Novo arquivo, creditos, contador, remocao dos symbols antigos. `modelo/curto/` segue so em `~/sidra-publicar`.
- 09/11/2026 · Repositório reconciliado com a produção (`b155b24`): a produção era o lado mais novo (8/11 contra 7/11) e o correto — `app.js` com `pedirWavs()` primeiro e `brutos` com `liberar` (entrega sem copiar, o worker solta os stems), `trabalhador.js` com modo celular e janela curta, `dsp.js` com `segmento`, títulos e FAQ de SEO. O `trabalhador.js` antigo do repositório só entendia `brutos` com cópia; o novo entende os dois. Avisos de requisitos e uso já estavam commitados desde `3b0fef3`. `.claude/` e `.DS_Store` no `.gitignore`. Push feito para `main`.
- 09/11/2026 · Botão "Novo arquivo" no estado resultado (`39f2872`): dentro do grupo de exportação, reusa `novoArquivo()` (termina o worker, para o player, libera buffers e URLs de objeto), texto pt/en pela chave `novo`, coberto em `teste/interface.mjs`. Subdomínio/Wix descartado.
- 09/11/2026 · Créditos (Demucs/htdemucs, MIT, Meta/FAIR; ONNX Runtime Web, MIT, Microsoft) no `LEIAME.md` e no rodapé (`creditos` em `idiomas.js`); symbols `#i-ableton` e `#i-traktor` removidos do `index.html` (grep: nenhuma referência, só as definições).
- 09/11/2026 · Regressões achadas ao testar e corrigidas: com o 4º botão o grupo de exportação espremia o tempo/resumo a 768 px (`@media (max-width:900px) { #exportar { flex: 1 1 100% } }`); `separadorTeste.brutos()` travava depois do fluxo novo (o worker já soltou os stems) e agora lê os da página; `teste/navegador.mjs` ganhou `protocolTimeout` de 15 min.
- 08/11/2026 · Criada a skill `~/.claude/skills/sidra-acessos` (`SKILL.md` + `acessos.py`): consulta só leitura do GraphQL do Cloudflare e separa gente (beacon `/cdn-cgi/rum`) de bot (UA Unknown, Googlebot, headless, curl, scanners 404); cruza com o KV `CONTAGEM`. Vive fora do repositório, em `~/.claude/skills`.
- 07/11/2026 · Publicado em sidrastems.com (versão `4ff48e7a`): logos oficiais do Traktor (`logo-traktor.png`) e do Ableton (`logo-ableton.svg`) nos botões de exportação, clique na waveform leva todos os canais ao ponto (`irPara` em `app.js`), e-mail de contato e FAQ com efeito de camadas no hover, textos do FAQ resumidos.
- 07/11/2026 · Live recusava o `.als` por "Slot count mismatch": `FreezeSequencer/ClipSlotList` também precisa ter 1 slot por cena; corrigido em `ferramentas/montar-modelo-als.py`.
- 07/11/2026 · Waveform enchia tudo (pico absoluto): agora barras de RMS com escala no percentil 95; stems usam escala comum.
- 06/11/2026 · Interface Glass (proposta 1f) aplicada: `2046621` (index.html, idiomas.js) e `a7e5e78` (app.js, player Web Audio, zip).
- 06/11/2026 · "Sobreposição" virou "Tipo" (Rápido/Padrão/Alto = 0,10/0,25/0,50); backend fixo em automático; play independente e aditivo em cada faixa: `0d7914c`.
- 06/11/2026 · Playhead SVG nunca aparecia (`hidden` não é propriedade de SVG); corrigido com `toggleAttribute("hidden")` no `a7e5e78`.

## Validado
- 2026-11-09 · Testes em outros navegadores, arrastar e soltar real, áudio longo, som audível, stems reais do modelo, Solo com play por cartão: Lucas considerou testado e fechado (antigo item 4); o teste do `?curto` no celular foi descartado — fonte: decisão do Lucas.
- 2026-11-09 · `node teste/interface.mjs` passa inteiro com as 5 checagens novas de arrasto (parado, em outra faixa, clique simples, tocando mantendo só a bateria, toque); FAQ mostra só `pt-BR` (390 px) ou só `en` (768 px), sem rolagem horizontal — fonte: `teste/interface.mjs`, screenshots do puppeteer.
- 2026-11-09 · Export do Ableton aberto no Live 12.4.25b1 com as 5 faixas (o Lucas testou no servidor local, depois do molde novo) e `.stem.mp4` ok no Traktor — fonte: teste do Lucas, `a6eac3b`.
- 2026-11-09 · `node teste/interface.mjs` passa inteiro (com os 3 checks novos do Novo arquivo pt/en e volta à tela inicial); `node teste/navegador.mjs <ref> auto` (separação real, WebGPU apple metal-3, sinal sintético de 12 s, modelo completo) chega ao resultado e bate com o `stems.py` fp32: drums 1,1e-4, bass 2,4e-5, other 3,5e-4, vocals 1,5e-3 (erro relativo); servidor `http://127.0.0.1` — fonte: `teste/interface.mjs`, `teste/navegador.mjs`, `teste/referencia.py`
- 2026-11-09 · Layout do resultado conferido por screenshot em 390 px e 768 px (sem rolagem horizontal, scrollWidth = clientWidth; créditos legíveis no rodapé; após o ajuste do `#exportar`, tempo e resumo ocupam a linha toda a 768 px) — fonte: screenshots do puppeteer, `teste/interface.mjs` simulando 4 stems
- 2026-11-08 · Primeira leitura dos acessos (07 a 08/11): 1.131 req e 190 únicos em 07/11 contra 174 req e 21 únicos em 08/11; só 82 beacons de navegador real (EUA 37, BR 27, FR 16, CA 2), 297 req da Holanda quase todas sem User-Agent, 47 Googlebot, scanners de `/.env` e `/.npmrc` (404, inofensivos); 3 separações no KV (1 em 07/11 e 2 em 08/11) — fonte: `~/.claude/skills/sidra-acessos/acessos.py`. O plano gratuito não dá pontuação de bot nem ASN.
- 2026-11-07 · Clique na waveform movendo todos os canais testado pelo Lucas no servidor local (tocando e parado); logos conferidos em screenshot 390 px; deploy verificado por curl (HTML referencia `logo-traktor`, SVG responde 200) — fonte: `app.js` (`irPara`), `~/sidra-publicar`
- 2026-11-07 · `.stem.mp4` gerado por `traktor.js` passa no ffprobe e decodifica no ffmpeg (5 faixas AAC, JSON no átomo `stem`); contador `/api/separou` responde 204 e não é exposto (GET 405) — fonte: `traktor.js`, `~/sidra-publicar/worker.js`
- 2026-11-06 · Fluxo real com o htdemucs (backend wasm, áudio de 5 s e 60 s: 9 janelas, ~26 s por minuto de áudio) chega ao resultado; cancelar, erro, troca de idioma e troca de bits regeneram corretamente — fonte: commit `a7e5e78`
- 2026-11-06 · "Baixar todos" gera `.zip` store-only que passa em `unzip -t` — fonte: commit `a7e5e78`
- 2026-11-06 · `teste/interface.mjs` (25+ verificações, sem modelo) cobre Tipo, ausência do select de processamento e play por faixa — fonte: commit `0d7914c`
