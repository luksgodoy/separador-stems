// Service worker minimo que acrescenta COOP/COEP as respostas da propria origem, para a pagina
// ficar "crossOriginIsolated" e o WASM poder usar varias threads em hospedagens que nao deixam
// configurar cabecalhos (GitHub Pages). No Cloudflare Pages o arquivo _headers ja resolve.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.cache === "only-if-cached" && req.mode !== "same-origin") return;
  if (new URL(req.url).origin !== self.location.origin) return;   // CDN: ja manda CORS/CORP
  e.respondWith((async () => {
    const r = await fetch(req);
    if (r.status === 0) return r;
    const h = new Headers(r.headers);
    h.set("Cross-Origin-Opener-Policy", "same-origin");
    h.set("Cross-Origin-Embedder-Policy", "require-corp");
    h.set("Cross-Origin-Resource-Policy", "same-origin");
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  })());
});
