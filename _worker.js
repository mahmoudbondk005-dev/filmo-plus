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
function isSeries(cat) { return cat === "مسلسلات عربي" || cat === "مسلسلات أجنبي"; }
function itemPath(row) {
  const kind = isSeries(row.category) ? "series" : "movie";
  return `/${kind}/${encodeURIComponent(slugify(row.title))}~${encodeURIComponent(String(row.Id ?? row.id))}`;
}
function description(row) {
  const d = String(row.description || "").trim();
  if (d) return d.slice(0, 160);
  const type = isSeries(row.category) ? "مسلسل" : "فيلم";
  const year = row.year ? ` ${row.year}` : "";
  return `شاهد ${type}${year} ${row.title || ""} عبر سيما سيما. معلومات العمل والصورة وبيانات المشاهدة.`.trim().slice(0,160);
}
async function getMovie(id) {
  const queries = ["Id", "id"];
  for (const key of queries) {
    const url = `${SUPABASE_URL}/rest/v1/movies?select=*&${key}=eq.${encodeURIComponent(id)}&limit=1`;
    const r = await fetch(url, { headers: headers() });
    if (!r.ok) continue;
    const data = await r.json();
    if (Array.isArray(data) && data[0]) return data[0];
  }
  return null;
}
async function getAllRows() {
  const rows = [];
  let start = 0;
  const page = 1000;
  for (;;) {
    const url = `${SUPABASE_URL}/rest/v1/movies?select=Id,id,title,category,year,poster_url&order=Id.desc&limit=${page}&offset=${start}`;
    let r = await fetch(url, { headers: headers() });
    if (!r.ok) {
      const url2 = `${SUPABASE_URL}/rest/v1/movies?select=*&order=id.desc&limit=${page}&offset=${start}`;
      r = await fetch(url2, { headers: headers() });
    }
    if (!r.ok) throw new Error("Supabase sitemap request failed");
    const data = await r.json();
    if (!Array.isArray(data) || !data.length) break;
    rows.push(...data);
    if (data.length < page) break;
    start += page;
    if (start > 100000) break;
  }
  return rows;
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
  if (row.rating && Number(row.rating) > 0) data.aggregateRating = {"@type":"AggregateRating","ratingValue":Number(row.rating),"bestRating":10};
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const meta = `\n<title>${esc(title)}</title>\n<meta name="description" content="${esc(desc)}">\n<link rel="canonical" href="${esc(url)}">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="سيما سيما">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${esc(url)}">${image ? `\n<meta property="og:image" content="${esc(image)}">` : ""}\n<script type="application/ld+json">${json}</script>`;
  return html.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta name="description"[^>]*>/i, "").replace(/<link rel="canonical"[^>]*>/i, "").replace("</head>", meta + "\n</head>");
}
function staticSitemap(rows) {
  const urls = ["/", "/privacy.html", "/terms.html", "/contact.html"];
  for (const row of rows) {
    if (row && (row.Id ?? row.id) != null && row.title) urls.push(itemPath(row));
  }
  const unique = [...new Set(urls)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` + unique.map(p => `  <url><loc>${xmlEsc(SITE + p)}</loc></url>`).join("\n") + "\n</urlset>";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/sitemap.xml") {
        const rows = await getAllRows();
        return new Response(staticSitemap(rows), { headers: { "content-type": "application/xml; charset=UTF-8", "cache-control": "public, max-age=300" } });
      }
      const match = url.pathname.match(/^\/(movie|series)\/[^/]+~([^/]+)$/i);
      if (match) {
        const id = decodeURIComponent(match[2]);
        const row = await getMovie(id);
        const asset = await env.ASSETS.fetch(new Request(new URL("/index.html", url), request));
        if (!row) return asset;
        const html = await asset.text();
        return new Response(injectSeo(html, row, SITE + url.pathname), {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "public, max-age=300" }
        });
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      return env.ASSETS.fetch(request);
    }
  }
};
