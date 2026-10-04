// سيما سيما - ملف واحد يعوّض مجلد functions (Cloudflare Pages Advanced Mode)
// يعمل: /movie/ID  +  /sitemap.xml  +  /api/tmdb
const SB = "https://axvibvssjizkrfdqlyow.supabase.co";
const KEY = "sb_publishable_72qMAroeSPFAMXfL2AoVQA_5RnDslsh";
const SITE = "https://cimacima.online";
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
const sbHeaders = { apikey: KEY, Authorization: "Bearer " + KEY };

async function getRow(id) {
  for (const col of ["Id", "id"]) {
    const r = await fetch(`${SB}/rest/v1/movies?select=*&${col}=eq.${encodeURIComponent(id)}&limit=1`, { headers: sbHeaders });
    if (r.ok) { const rows = await r.json(); return rows[0] || null; }
  }
  return null;
}

async function moviePage(id, request, env) {
  const row = /^[\w-]{1,64}$/.test(id) ? await getRow(id) : null;
  if (!row) return Response.redirect(SITE + "/", 302);
  const page = await env.ASSETS.fetch(new Request(new URL("/", request.url)));
  let html = await page.text();
  const title = (row.title || "") + " | سيما سيما";
  const desc = (row.description || ("مشاهدة وتحميل " + row.title + " على سيما سيما")).replace(/\s+/g, " ").slice(0, 160);
  const url = `${SITE}/movie/${encodeURIComponent(id)}`;
  const img = row.poster_url || "";
  const ld = {
    "@context": "https://schema.org",
    "@type": /مسلسل/.test(row.category || "") ? "TVSeries" : "Movie",
    name: row.title, description: desc, url, image: img || undefined,
    dateCreated: row.year || undefined,
  };
  const head = `
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="video.movie">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${img ? `<meta property="og:image" content="${esc(img)}">` : ""}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
  html = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<link rel="canonical"[^>]*>/, "")
    .replace(/<meta property="og:[^>]*>\s*/g, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, "")
    .replace("</head>", head + "\n</head>");
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}

async function sitemap() {
  let ids = [];
  for (const col of ["Id", "id"]) {
    const r = await fetch(`${SB}/rest/v1/movies?select=${col}&order=${col}.desc&limit=5000`, { headers: sbHeaders });
    if (r.ok) { ids = (await r.json()).map((x) => x[col]); break; }
  }
  const u = (loc, cf, p) => `  <url><loc>${loc}</loc><changefreq>${cf}</changefreq><priority>${p}</priority></url>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[u(SITE + "/", "daily", "1.0"), ...["privacy", "terms", "contact"].map((p) => u(`${SITE}/${p}.html`, "monthly", "0.3")), ...ids.map((i) => u(`${SITE}/movie/${i}`, "weekly", "0.8"))].join("\n")}
</urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

async function tmdb(request, env) {
  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  if (!/^(search\/(movie|tv)|(movie|tv)\/\d+)$/.test(path) || !env.TMDB_API_KEY) {
    return new Response(JSON.stringify({ error: "bad request" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const q = new URLSearchParams();
  for (const k of ["query", "language", "include_adult"]) if (url.searchParams.has(k)) q.set(k, url.searchParams.get(k));
  q.set("api_key", env.TMDB_API_KEY);
  const r = await fetch("https://api.themoviedb.org/3/" + path + "?" + q.toString());
  return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (request.method === "GET") {
      const m = pathname.match(/^\/movie\/([^\/]+)\/?$/);
      if (m) return moviePage(decodeURIComponent(m[1]), request, env);
      if (pathname === "/sitemap.xml") return sitemap();
      if (pathname === "/api/tmdb") return tmdb(request, env);
    }
    return env.ASSETS.fetch(request);
  },
};
