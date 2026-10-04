const SUPABASE_URL = "https://axvibvssjizkrfdqlyow.supabase.co";
const SUPABASE_KEY = "sb_publishable_72qMAroeSPFAMXfL2AoVQA_5RnDslsh";
const SITE = "https://cimacima.online";

function slugify(value) {
  return String(value || "عمل").trim().toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[^\u0600-\u06FFa-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "") || "work";
}
function categoryName(cat) {
  const c = String(cat || "").trim();
  if (c === "فيلم" || c === "دراما") return "أفلام عربي";
  if (c === "مسلسل") return "مسلسلات عربي";
  return c || "أفلام عربي";
}
function isSeries(cat) { return categoryName(cat).startsWith("مسلسلات"); }
function itemId(row) { return String(row?.Id ?? row?.id ?? ""); }
function itemPath(row) {
  const type = categoryName(row?.category);
  return `${isSeries(type) ? "/series/" : "/movie/"}${slugify(row?.title)}~${encodeURIComponent(itemId(row))}`;
}
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function jsonLd(v) { return JSON.stringify(v).replace(/</g, "\\u003c"); }
function sbHeaders() { return {apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`}; }

async function getById(id) {
  const headers = sbHeaders();
  let url = `${SUPABASE_URL}/rest/v1/movies?select=*&Id=eq.${encodeURIComponent(id)}&limit=1`;
  let r = await fetch(url, {headers});
  if (!r.ok) {
    url = `${SUPABASE_URL}/rest/v1/movies?select=*&id=eq.${encodeURIComponent(id)}&limit=1`;
    r = await fetch(url, {headers});
  }
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] || null;
}

function seoPage(row, path) {
  if (!row) return new Response("Not found", {status:404, headers:{"content-type":"text/plain; charset=utf-8"}});
  const name = row.title || "سيما سيما";
  const type = categoryName(row.category);
  const series = isSeries(type);
  const kind = series ? "مسلسل" : "فيلم";
  const year = row.year ? String(row.year) : "";
  const desc = String(row.description || `شاهد ${kind} ${name}${year ? ` لعام ${year}` : ""} على سيما سيما.`).replace(/\s+/g," ").slice(0,160);
  const image = row.poster_url || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1500&q=80";
  const canonical = SITE + path;
  let episodes = [];
  try { episodes = Array.isArray(row.episodes) ? row.episodes : JSON.parse(row.episodes || "[]"); } catch {}
  episodes = episodes.filter(x => x && !x.__cimaOverlay);
  const schema = {
    "@context":"https://schema.org",
    "@type": series ? "TVSeries" : "Movie",
    "name": name,
    "description": desc,
    "image": [image],
    "url": canonical
  };
  if (year) schema.dateCreated = year;
  if (row.rating !== null && row.rating !== undefined && row.rating !== "" && !isNaN(Number(row.rating))) {
    schema.aggregateRating = {"@type":"AggregateRating","ratingValue":Number(row.rating),"bestRating":10,"worstRating":0};
  }
  const episodesHtml = series && episodes.length ? `<section><h2>الحلقات</h2><ol>${episodes.map((e,i)=>`<li>${esc(e.title || `الحلقة ${i+1}`)}</li>`).join("")}</ol></section>` : "";
  const watch = `<a class="btn" href="/#movie=${encodeURIComponent(itemId(row))}">▶ ${series ? "فتح المسلسل" : "مشاهدة الفيلم"}</a>`;
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(name)}${year ? ` ${esc(year)}` : ""} | سيما سيما</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:site_name" content="سيما سيما"><meta property="og:type" content="${series ? "video.tv_show" : "video.movie"}"><meta property="og:title" content="${esc(name)}${year ? ` ${esc(year)}` : ""} | سيما سيما"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(image)}"><meta name="twitter:card" content="summary_large_image"><script type="application/ld+json">${jsonLd(schema)}</script><style>body{margin:0;background:#090b10;color:#f5f5f5;font-family:Tahoma,Arial,sans-serif}.wrap{max-width:900px;margin:auto;padding:24px}.card{background:#141821;border:1px solid #252b36;border-radius:18px;padding:22px;display:flex;gap:24px}.poster{width:230px;max-width:35%;height:340px;object-fit:cover;border-radius:12px;background:#222}.muted{color:#a9afba;line-height:1.9}.btn{display:inline-block;background:#ffb000;color:#111;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:900;margin-top:12px}h1{margin-top:0}li{padding:8px}.brand{color:#ffb000;font-weight:900;font-size:22px;margin-bottom:18px}@media(max-width:650px){.card{display:block}.poster{width:180px;max-width:none;height:270px}}</style></head><body><main class="wrap"><div class="brand">سيما سيما</div><article class="card"><img class="poster" src="${esc(image)}" alt="${esc(name)}"><div><h1>${esc(name)}</h1><p class="muted">${esc(type)}${year ? ` • ${esc(year)}` : ""}${row.rating ? ` • ⭐ ${esc(row.rating)}` : ""}</p><p class="muted">${esc(desc)}</p>${watch}</div></article>${episodesHtml}<p><a href="/">العودة إلى سيما سيما</a></p></main></body></html>`;
  return new Response(html, {headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300"}});
}

async function handleSitemap() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/movies?select=Id,id,title,category&limit=5000`, {headers:sbHeaders()});
  if (!r.ok) return new Response("Sitemap unavailable", {status:502});
  const rows = await r.json();
  const urls = rows.map(x => `<url><loc>${esc(SITE + itemPath(x))}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url><url><loc>${SITE}/privacy.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url><url><loc>${SITE}/terms.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url><url><loc>${SITE}/contact.html</loc><changefreq>monthly</changefreq><priority>0.3</priority></url>${urls}</urlset>`;
  return new Response(xml, {headers:{"content-type":"application/xml; charset=utf-8","cache-control":"public, max-age=300"}});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);
    if (path === "/sitemap.xml") return handleSitemap();
    const m = path.match(/^\/(movie|series)\/(.+)$/);
    if (m) {
      const slug = m[2];
      const i = slug.lastIndexOf("~");
      const id = i >= 0 ? slug.slice(i + 1) : "";
      const row = id ? await getById(id) : null;
      return seoPage(row, row ? itemPath(row) : path);
    }
    return env.ASSETS.fetch(request);
  }
};
