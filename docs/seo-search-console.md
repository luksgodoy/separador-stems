# Sidra: Search Console e indexação

Site: https://sidrastems.com/ · sitemap: https://sidrastems.com/sitemap.xml
Publicado como Worker com arquivos estáticos (`~/sidra-publicar`, `npx wrangler deploy`).

## 1. Google Search Console (você, logado na conta Google)

1. Abra https://search.google.com/search-console e clique em **Adicionar propriedade**.
2. Escolha **Domínio** (não "Prefixo do URL") e digite `sidrastems.com`. Cobre `www` e `https` de uma vez.
3. O Google mostra um registro **TXT**. No Cloudflare: **sidrastems.com → DNS → Records → Add record**
   - Tipo `TXT`, Nome `@`, Conteúdo = o texto que o Google deu (`google-site-verification=...`), proxy não se aplica.
4. Volte ao Search Console e clique em **Verificar** (pode levar alguns minutos).
5. **Sitemaps** (menu lateral) → digite `sitemap.xml` → **Enviar**. Deve ficar "Sucesso".
6. **Inspeção de URL** → cole `https://sidrastems.com/` → **Solicitar indexação**.

## 2. Bing Webmaster Tools (5 minutos)

Em https://www.bing.com/webmasters use **Importar do Google Search Console**. Isso também cobre DuckDuckGo e o Ecosia, que usam o índice do Bing.

## 3. Conferir depois de 2 a 7 dias

- Pesquisar `site:sidrastems.com` no Google. Se aparecer, está indexado.
- Search Console → **Páginas**: a home deve estar em "Indexada". Se estiver em "Descoberta, mas não indexada", é normal em site novo; aguarde.
- Search Console → **Desempenho**: acompanhe as consultas e o CTR.

## 4. Consultas que o site já mira

PT: separador de stems, separar voz da música, tirar vocal, acapella online, separar bateria e baixo, isolador de vocal grátis.
EN: stem separator, stem splitter, vocal remover, acapella maker, separate vocals drums bass, demucs online.

## 5. O que mais traz visitas (fora do site)

Meta tag sozinha não ranqueia um site novo; links de fora e uso real, sim:
- repositório no GitHub (público, com link do site no README e nos "About");
- Product Hunt, Hacker News (Show HN), Reddit (r/WeAreTheMusicMakers, r/edmproduction, r/musicproduction);
- vídeo curto mostrando antes e depois (YouTube/TikTok), com o link na descrição.

## 6. Pendências pequenas

- `www.sidrastems.com` responde com o mesmo conteúdo do apex. O `canonical` aponta para o apex, o que evita duplicidade. Se quiser, crie uma Redirect Rule no Cloudflare (www → apex, 301).
- Se mudar o texto do site, atualize o `<lastmod>` do `sitemap.xml`.
- Idioma: a página troca PT/EN por JavaScript na mesma URL, então os dois idiomas dividem uma URL só. Se quiser ranquear melhor em cada língua, o próximo passo é criar `/en/` com HTML próprio e `hreflang`.
