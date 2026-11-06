# Pendências — Separador de Stems

## Armadilhas vivas
- GitHub Pages: o build pode falhar sem aviso (06/11/2026, 1º build do commit `0d7914c` falhou após 4m54s). Confira `gh run list -R luksgodoy/separador-stems -L 1` e refaça com `gh api -X POST repos/luksgodoy/separador-stems/pages/builds`. Fonte: sessão /despachar de 06/11/2026.
- Embutir a página em iframe de outro domínio (Wix) pode quebrar o isolamento COOP/COEP (`coi-sw.js`), o WebGPU e o download do modelo de 90 MB. Por isso a escolha é subdomínio próprio, não iframe.
- `.claude/despacho.json` está sem rastreio no git: commitar ou pôr no `.gitignore`.

## Backlog aberto
1. **Enviar ao GitHub os avisos de requisitos e uso.** Estão em `idiomas.js` e `index.html`, na árvore de trabalho, **sem commit nem push**. Conferir o layout em 390 px com o screenshot da versão final antes de publicar. [modelo: sonnet]
2. **Subdomínio + botão no Wix.** Falta o Lucas informar: nome do subdomínio, onde está o DNS e criar o registro CNAME. Depois: arquivo `CNAME` no repositório, domínio no GitHub Pages, HTTPS, e botão/menu no Wix. [modelo: sonnet]
3. **Decisões abertas do Lucas:**
   - botão "Novo arquivo" no estado resultado (hoje só recarregando a página);
   - selects de opções (Tipo, bits) acessíveis no resultado (hoje somem com `#tela-selecao`);
   - opacidade do cartão com Mudo/Solo enquanto o play dele toca a faixa (`data-inativo`).
4. **Testes que faltam:** Safari, Firefox, WebGPU em outras placas, arrastar e soltar real, áudio >15 min (alerta), som audível, layout em 768 px, resultado com stems reais do modelo, Solo combinado com play por cartão, `teste/navegador.mjs` (separação real) depois das mudanças de Tipo e backend automático.
5. **Modelo no Hugging Face**, só se a divulgação crescer: o GitHub Pages dá cerca de 100 GB/mês, ou ~1.000 visitantes novos (90 MB cada). Procedimento no `LEIAME.md` (`?modelo=`). Lucas decidiu (06/11/2026) manter no GitHub por enquanto.

## Deliberadamente não construído
- Iframe do Wix: recusado em favor de subdomínio + botão (escolha do Lucas em 06/11/2026), pelo risco de quebrar COOP/COEP e WebGPU.
- Seletor de Processamento na UI: retirado a pedido do Lucas (06/11/2026); o app usa sempre `auto` (WebGPU, com queda para WASM). Só `?teste&backend=` força outro.
- Modelos BS-Roformer-SW e DrumSep: licença de uso pessoal, não podem entrar (ver `LEIAME.md`).

## Corrigido, mantido para o registro
- 06/11/2026 · Interface Glass (proposta 1f) aplicada: `2046621` (index.html, idiomas.js) e `a7e5e78` (app.js, player Web Audio, zip).
- 06/11/2026 · "Sobreposição" virou "Tipo" (Rápido/Padrão/Alto = 0,10/0,25/0,50); backend fixo em automático; play independente e aditivo em cada faixa: `0d7914c`.
- 06/11/2026 · Playhead SVG nunca aparecia (`hidden` não é propriedade de SVG); corrigido com `toggleAttribute("hidden")` no `a7e5e78`.

## Validado
- 2026-11-06 · Fluxo real com o htdemucs (backend wasm, áudio de 5 s e 60 s: 9 janelas, ~26 s por minuto de áudio) chega ao resultado; cancelar, erro, troca de idioma e troca de bits regeneram corretamente — fonte: commit `a7e5e78`
- 2026-11-06 · "Baixar todos" gera `.zip` store-only que passa em `unzip -t` — fonte: commit `a7e5e78`
- 2026-11-06 · `teste/interface.mjs` (25+ verificações, sem modelo) cobre Tipo, ausência do select de processamento e play por faixa — fonte: commit `0d7914c`
