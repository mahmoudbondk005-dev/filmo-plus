const SUPABASE_URL = "https://axvibvssjizkrfdqlyow.supabase.co";
const SUPABASE_KEY = "sb_publishable_72qMAroeSPFAMXfL2AoVQA_5RnDslsh";
const SITE = "https://cimacima.online";

function headers() {
  return { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY };
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}
function xmlEsc(v) { return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"}[c])); }
function slugify(v) {
  return String(v || "").trim().toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "item";
}
function isSeries(cat) { const c = String(cat || "").trim(); return c === "مسلسلات عربي" || c === "مسلسلات أجنبي" || c === "مسلسل"; }
function itemPath(row) {
  const kind = isSeries(row.category) ? "series" : "movie";
  return `/${kind}/${encodeURIComponent(slugify(row.title))}~${encodeURIComponent(String(row.Id ?? row.id))}`;
}
function description(row) {
  const type = isSeries(row.category) ? "مسلسل" : "فيلم";
  const year = row.year ? ` ${row.year}` : "";
  const lead = `مشاهدة وتحميل ${type} ${row.title || ""}${year} كامل اون لاين.`.replace(/\s+/g, " ");
  const d = String(row.description || "").trim().replace(/\s+/g, " ");
  return (d ? `${lead} ${d}` : `${lead} معلومات العمل وقصته وروابط المشاهدة عبر سيما سيما.`).slice(0, 160);
}
async function getMovie(id) {
  let sawOk = false;
  for (const key of ["Id", "id"]) {
    const url = `${SUPABASE_URL}/rest/v1/movies?select=*&${key}=eq.${encodeURIComponent(id)}&limit=1`;
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) continue;
    sawOk = true;
    const data = await r.json();
    if (Array.isArray(data) && data[0]) return data[0];
  }
  return sawOk ? null : undefined;
}
async function getAllRows() {
  const attempts = [
    { sel: "Id,title,category,created_at", order: "Id.desc" },
    { sel: "Id,title,category", order: "Id.desc" },
    { sel: "id,title,category", order: "id.desc" },
    { sel: "*", order: "Id.desc" },
    { sel: "*", order: "id.desc" },
    { sel: "*", order: "" }
  ];
  const page = 1000;
  for (const at of attempts) {
    const rows = [];
    let start = 0;
    let ok = true;
    for (;;) {
      const url = `${SUPABASE_URL}/rest/v1/movies?select=${at.sel}${at.order ? "&order=" + at.order : ""}&limit=${page}&offset=${start}`;
      const r = await fetch(url, { headers: headers() });
      if (!r.ok) { ok = false; break; }
      const data = await r.json();
      if (!Array.isArray(data) || !data.length) break;
      rows.push(...data);
      if (data.length < page) break;
      start += page;
      if (start > 100000) break;
    }
    if (ok) return rows;
  }
  throw new Error("Supabase sitemap request failed");
}
function ssrBlock(row) {
  const title = esc(row.title || "");
  const desc = esc(String(row.description || "").trim() || description(row));
  const img = String(row.poster_url || "").trim();
  const meta = [row.category, row.year, row.duration, row.rating ? "تقييم " + row.rating : ""].filter(Boolean).map(esc).join(" • ");
  return `<section id="ssr-seo" style="max-width:1100px;margin:16px auto;padding:16px;background:#0f1622;border:1px solid #202c3e;border-radius:16px;display:flex;gap:16px;align-items:flex-start"><div style="flex:1;min-width:0"><h1 style="margin:0 0 8px;font-size:24px">${title}</h1><p style="margin:0 0 8px;color:#a3a8b3">${meta}</p><p style="margin:0;line-height:1.9">${desc}</p></div>${img ? `<img src="${esc(img)}" alt="${title}" width="120" height="180" style="border-radius:12px;object-fit:cover;flex:0 0 auto">` : ""}</section>`;
}
function injectSeo(html, row, url) {
  const title = `${row.title || "عمل"} - مشاهدة وتحميل | سيما سيما`;
  const desc = description(row);
  const image = String(row.poster_url || "").trim();
  const type = isSeries(row.category) ? "TVSeries" : "Movie";
  const data = {
    "@context": "https://schema.org",
    "@type": type,
    "name": row.title || "",
    "description": desc,
    "url": url
  };
  if (image) data.image = image;
  if (row.year) data.dateCreated = `${row.year}-01-01`;
  if (row.category) data.genre = row.category;
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const meta = `\n<title>${esc(title)}</title>\n<meta name="description" content="${esc(desc)}">\n<link rel="canonical" href="${esc(url)}">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="سيما سيما">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${esc(url)}">${image ? `\n<meta property="og:image" content="${esc(image)}">` : ""}\n<script type="application/ld+json">${json}</script>`;
  return html.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta name="description"[^>]*>/i, "").replace(/<link rel="canonical"[^>]*>/i, "").replace(/<meta property="og:(type|site_name|title|description|url|image)"[^>]*>/gi, "").replace("</head>", meta + "\n<style>body:has(#details[style*=\"display: block\"]) #ssr-seo{display:none!important}</style>\n</head>").replace('<div id="details"', ssrBlock(row) + '<div id="details"');
}
async function loadHtml(env, url, request, paths) {
  for (const p of paths) {
    try {
      const r = await env.ASSETS.fetch(new Request(new URL(p, url), request));
      if (r && r.status === 200) return r;
    } catch (e) {}
  }
  return null;
}
function lastmod(row) {
  const v = row.updated_at || row.created_at;
  if (!v) return "";
  const d = new Date(v);
  return isNaN(d) ? "" : `<lastmod>${d.toISOString().slice(0, 10)}</lastmod>`;
}
function staticSitemap(rows) {
  const entries = ["/", "/privacy", "/terms", "/contact", "/dmca"].map(p => ({ p, lm: "" }));
  for (const row of rows) {
    if (row && (row.Id ?? row.id) != null && row.title) entries.push({ p: itemPath(row), lm: lastmod(row) });
  }
  const seen = new Set();
  const list = entries.filter(e => !seen.has(e.p) && seen.add(e.p));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` + list.map(e => `  <url><loc>${xmlEsc(SITE + e.p)}</loc>${e.lm}</url>`).join("\n") + "\n</urlset>";
}
function redirect301(path) { return Response.redirect(SITE + path, 301); }
async function notFound(env, url, request) {
  const r = await env.ASSETS.fetch(new Request(new URL("/__not-found__", url), request));
  const h = new Headers(r.headers);
  h.set("x-robots-tag", "noindex");
  h.set("cache-control", "public, max-age=60");
  return new Response(r.body, { status: 404, headers: h });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/sitemap.xml") {
        let rows;
        try { rows = await getAllRows(); }
        catch (e) { return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "content-type": "text/plain; charset=UTF-8", "retry-after": "300" } }); }
        return new Response(staticSitemap(rows), { headers: { "content-type": "application/xml; charset=UTF-8", "cache-control": "public, max-age=300" } });
      }
      // الروابط القديمة /?movie=ID تتحول بشكل دائم (301) للرابط الأساسي
      if (url.pathname === "/" && url.searchParams.get("movie")) {
        const oldRow = await getMovie(url.searchParams.get("movie"));
        if (oldRow && oldRow.title) return Response.redirect(SITE + itemPath(oldRow), 301);
      }
      const p = url.pathname;
      if (/^\/(movie|series)\//i.test(p)) {
        const m = p.match(/^\/(movie|series)\/[^/]+~([^/]+)\/?$/i);
        if (!m) return notFound(env, url, request);
        let id;
        try { id = decodeURIComponent(m[2]); } catch (e) { return notFound(env, url, request); }
        const row = await getMovie(id);
        if (row === null) return notFound(env, url, request);
        if (row && row.title) {
          const canon = itemPath(row);
          let same = false;
          try { same = !p.endsWith("/") && decodeURIComponent(p) === decodeURIComponent(canon); } catch (e) {}
          if (!same) return redirect301(canon);
        }
        // الرابط الجميل يعرض صفحة الفيلم الحقيقية (movie.html) بنفس الـ SEO
        const page = await loadHtml(env, url, request, ["/movie.html", "/movie"]);
        const asset = page || await loadHtml(env, url, request, ["/index.html", "/"]);
        if (!asset) return env.ASSETS.fetch(request);
        if (!row) return asset;
        let html = injectSeo(await asset.text(), row, SITE + itemPath(row));
        if (page) {
          const fix = '<script>window.__MOVIE_ID__=' + JSON.stringify(String(row.Id ?? row.id)) + ';</script>';
          html = html.replace(/<head[^>]*>/i, mm => mm + fix);
        }
        return new Response(html, {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "public, max-age=300" }
        });
      }
      // الروابط القديمة /movie.html?movie=ID تتحول نهائيًا (301) للرابط الأساسي
      if (p === "/movie" || p === "/movie.html") {
        const id = url.searchParams.get("movie");
        if (id) {
          const row = await getMovie(id);
          if (row === null) return notFound(env, url, request);
          if (row && row.title) return redirect301(itemPath(row));
        }
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      return env.ASSETS.fetch(request);
    }
  }
};
