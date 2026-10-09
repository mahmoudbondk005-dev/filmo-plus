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
function kindWord(row) { return isSeries(row.category) ? "مسلسل" : "فيلم"; }
function pageTitle(row) {
  const y = row.year ? ` (${row.year})` : "";
  return `مشاهدة وتحميل ${kindWord(row)} ${row.title || ""}${y} | سيما سيما`.replace(/\s+/g, " ");
}
function description(row) {
  const d = String(row.description || "").replace(/\s+/g, " ").trim();
  if (d) return d.slice(0, 160);
  const year = row.year ? ` ${row.year}` : "";
  return `شاهد ${kindWord(row)}${year} ${row.title || ""} أون لاين بجودة عالية عبر سيما سيما. معلومات العمل والصورة وبيانات المشاهدة والتحميل.`.replace(/\s+/g, " ").trim().slice(0, 160);
}
function posterOf(row) {
  const p = String(row.poster_url || "").trim();
  return /^https?:\/\//i.test(p) && !/via\.placeholder\.com/.test(p) ? p : "";
}

// ok=false => Supabase failed (don't treat as "not found")
async function getMovie(id) {
  let reached = false;
  for (const key of ["Id", "id"]) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/movies?select=*&${key}=eq.${encodeURIComponent(id)}&limit=1`, { headers: headers() });
      if (!r.ok) continue;
      reached = true;
      const data = await r.json();
      if (Array.isArray(data) && data[0]) return { row: data[0], ok: true };
    } catch (e) {}
  }
  return { row: null, ok: reached };
}
async function getAllRows() {
  const attempts = [
    { sel: "Id,title,category,poster_url", order: "Id.desc" },
    { sel: "id,title,category,poster_url", order: "id.desc" },
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

function stripOldSeo(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+name="robots"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "");
}
function injectSeo(html, row, url) {
  const title = pageTitle(row);
  const desc = description(row);
  const image = posterOf(row);
  const series = isSeries(row.category);
  const name = row.title || "";

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      Object.assign({
        "@type": series ? "TVSeries" : "Movie",
        "@id": url + "#work",
        "name": name,
        "description": desc,
        "url": url,
        "inLanguage": "ar"
      }, image ? { image } : {}, row.year ? { datePublished: String(row.year) } : {}, row.category ? { genre: row.category } : {}),
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "سيما سيما", "item": SITE + "/" },
          { "@type": "ListItem", "position": 2, "name": series ? "مسلسلات" : "أفلام", "item": SITE + "/#" + (row.category ? encodeURIComponent(row.category) : "latest") },
          { "@type": "ListItem", "position": 3, "name": name, "item": url }
        ]
      }
    ]
  };
  const json = JSON.stringify(ld).replace(/</g, "\\u003c");

  const meta = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="${series ? "video.tv_show" : "video.movie"}">`,
    `<meta property="og:site_name" content="سيما سيما">`,
    `<meta property="og:locale" content="ar_AR">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    image ? `<meta property="og:image" content="${esc(image)}">` : "",
    image ? `<meta property="og:image:alt" content="${esc(name)}">` : "",
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    image ? `<meta name="twitter:image" content="${esc(image)}">` : "",
    `<script type="application/ld+json" id="ld">${json}</script>`
  ].filter(Boolean).join("\n");

  let out = stripOldSeo(html).replace(/<script type="application\/ld\+json" id="ld">[\s\S]*?<\/script>/i, "");
  out = out.replace("</head>", meta + "\n</head>");

  // محتوى حقيقي في الـ HTML نفسه ليراه الزاحف بدون تشغيل JavaScript (الـ JS يستبدله لاحقاً بنفس البيانات)
  out = out
    .replace(/<h1 id="dtitle">\s*<\/h1>/i, `<h1 id="dtitle">${esc(name)}</h1>`)
    .replace(/<p id="ddesc">\s*<\/p>/i, `<p id="ddesc">${esc(String(row.description || "").trim() || desc)}</p>`)
    .replace(/<img id="dimg" alt=""/i, `<img id="dimg" ${image ? `src="${esc(image)}" ` : ""}alt="${esc(name)}"`);
  return out;
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
function htmlResponse(body, status) {
  return new Response(body, {
    status: status || 200,
    headers: { "content-type": "text/html; charset=UTF-8", "cache-control": "public, max-age=300" }
  });
}
async function withHeader(resp, name, value) {
  const h = new Headers(resp.headers);
  h.set(name, value);
  return new Response(resp.body, { status: resp.status, statusText: resp.statusText, headers: h });
}

function sitemap(rows) {
  const staticUrls = [["/", "1.0"], ["/privacy", "0.3"], ["/terms", "0.3"], ["/contact", "0.3"]];
  const seen = new Set();
  const items = staticUrls.map(([p, pr]) => `  <url><loc>${xmlEsc(SITE + p)}</loc><priority>${pr}</priority></url>`);
  for (const row of rows) {
    if (!row || (row.Id ?? row.id) == null || !row.title) continue;
    const p = itemPath(row);
    if (seen.has(p)) continue;
    seen.add(p);
    const img = posterOf(row);
    items.push(`  <url><loc>${xmlEsc(SITE + p)}</loc><priority>0.8</priority>${img ? `<image:image><image:loc>${xmlEsc(img)}</image:loc><image:title>${xmlEsc(row.title)}</image:title></image:image>` : ""}</url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${items.join("\n")}\n</urlset>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/sitemap.xml") {
        let rows;
        try { rows = await getAllRows(); }
        catch (e) { return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "content-type": "text/plain; charset=UTF-8", "retry-after": "300" } }); }
        return new Response(sitemap(rows), { headers: { "content-type": "application/xml; charset=UTF-8", "cache-control": "public, max-age=300" } });
      }

      // صفحة المشاهدة والإدارة: لا تُفهرس (محتواها مكرر / خاص)
      if (url.pathname === "/watch.html" || url.pathname === "/watch") {
        return withHeader(await env.ASSETS.fetch(request), "X-Robots-Tag", "noindex, follow");
      }
      if (url.pathname === "/admin.html" || url.pathname === "/admin") {
        return withHeader(await env.ASSETS.fetch(request), "X-Robots-Tag", "noindex, nofollow");
      }

      // الرابط الجميل /movie/اسم~ID  أو  /series/اسم~ID  → صفحة التفاصيل (movie.html) مع SEO كامل
      const match = url.pathname.match(/^\/(movie|series)\/[^/]+~([^/]+)$/i);
      if (match) {
        const id = decodeURIComponent(match[2]);
        const { row, ok } = await getMovie(id);
        const asset = await loadHtml(env, url, request, ["/movie.html", "/index.html", "/"]);
        if (!asset) return env.ASSETS.fetch(request);
        if (!row) {
          // عمل غير موجود فعلاً → 404 حقيقي (وليس soft-404). لو Supabase نفسه تعطل نرجع الصفحة عادي.
          return ok ? htmlResponse(await asset.text(), 404) : asset;
        }
        const canonicalPath = itemPath(row);
        if (decodeURIComponent(url.pathname) !== decodeURIComponent(canonicalPath)) {
          return Response.redirect(SITE + canonicalPath, 301);
        }
        return htmlResponse(injectSeo(await asset.text(), row, SITE + canonicalPath));
      }

      // الرابط القديم /movie.html?movie=ID → 301 إلى الرابط الجميل (يمنع تكرار الصفحات)
      if (url.pathname === "/movie" || url.pathname === "/movie.html") {
        const id = url.searchParams.get("movie");
        if (id) {
          const { row } = await getMovie(id);
          if (row) return Response.redirect(SITE + itemPath(row), 301);
        }
      }
      return env.ASSETS.fetch(request);
    } catch (e) {
      return env.ASSETS.fetch(request);
    }
  }
};
