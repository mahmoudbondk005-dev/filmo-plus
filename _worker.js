const SUPABASE_URL = "https://axvibvssjizkrfdqlyow.supabase.co";
const SUPABASE_KEY = "sb_publishable_72qMAroeSPFAMXfL2AoVQA_5RnDslsh";
const SITE = "https://cimacima.online";
// false = صفحات الحلقات noindex,follow وغير موجودة في الـ sitemap (تفهرس صفحة المسلسل فقط). اجعلها true لفهرسة الحلقات.
const INDEX_EPISODES = true;
const SITEMAP_CHUNK = 10000;   // عدد الروابط في كل ملف sitemap (الحد الأقصى المسموح 50000)
const HOME_LATEST = 48;        // عدد الأعمال المعروضة كروابط في الصفحة الرئيسية للزواحف

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
function isSeries(cat) {
  // دعم التصنيفات الفرعية مثل التركية والكورية والآسيوية دون اعتبارها أفلامًا.
  const c = String(cat || "").trim().toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ");
  return /^(مسلسل|مسلسلات)(?:\s|$)/.test(c) ||
    /^(series|tv series|tv show|web series|television series)$/.test(c);
}
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
  const ep = INDEX_EPISODES ? ",episodes" : "";
  const attempts = [
    { sel: "Id,title,category,created_at,updated_at" + ep, order: "Id.desc" },
    { sel: "Id,title,category,created_at" + ep, order: "Id.desc" },
    { sel: "Id,title,category" + ep, order: "Id.desc" },
    { sel: "id,title,category" + ep, order: "id.desc" },
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
function episodeUrlList(row) {
  const data = parseEpisodesForWorker(row.episodes);
  const out = [];
  const sd = data.find(x => x && x.__cimaSeasons === true && x.enabled !== false);
  if (sd && Array.isArray(sd.seasons) && sd.seasons.length) {
    sd.seasons.forEach((s, si) => (Array.isArray(s.episodes) ? s.episodes : []).forEach((ep, ei) => out.push({ p: itemPath(row) + `/season/${si + 1}/episode/${ei + 1}`, label: `${s.name || ("الموسم " + (si + 1))} - ${(ep && ep.title) || ("الحلقة " + (ei + 1))}` })));
  } else {
    data.filter(x => x && !x.__cimaOverlay && !x.__cimaSeasons).forEach((ep, ei) => out.push({ p: itemPath(row) + `/episode/${ei + 1}`, label: String(ep.title || ("الحلقة " + (ei + 1))) }));
  }
  return out;
}
function episodeNavHtml(row, currentPath) {
  const list = episodeUrlList(row).slice(0, 60);
  if (!list.length) return "";
  return `<nav aria-label="الحلقات" style="margin-top:14px;display:flex;flex-wrap:wrap;gap:8px">` + list.map(e => `<a href="${esc(e.p)}" style="color:#ffb000;text-decoration:none;border:1px solid #202c3e;border-radius:10px;padding:6px 12px;font-size:14px"${e.p === currentPath ? ' aria-current="page"' : ""}>${esc(e.label)}</a>`).join("") + `</nav>`;
}
async function getRelated(row) {
  try {
    const cat = String(row.category || "").trim();
    const id = row.Id ?? row.id;
    if (!cat) return [];
    for (const key of ["Id", "id"]) {
      const url = `${SUPABASE_URL}/rest/v1/movies?select=${key},title,category&category=eq.${encodeURIComponent(cat)}&${key}=neq.${encodeURIComponent(id)}&order=${key}.desc&limit=6`;
      const r = await fetch(url, { headers: headers() });
      if (!r.ok) continue;
      const data = await r.json();
      if (Array.isArray(data)) return data.filter(x => x && x.title);
    }
  } catch (e) {}
  return [];
}
function relatedHtml(items) {
  if (!items || !items.length) return "";
  return `<nav aria-label="أعمال مشابهة" style="margin-top:14px"><div style="font-weight:700;margin-bottom:6px">أعمال مشابهة</div><div style="display:flex;flex-wrap:wrap;gap:8px">` + items.map(r => `<a href="${esc(itemPath(r))}" style="color:#ffb000;text-decoration:none;border:1px solid #202c3e;border-radius:10px;padding:6px 12px;font-size:14px">${esc(r.title)}</a>`).join("") + `</div></nav>`;
}
function breadcrumbHtml(crumbs) {
  return `<nav aria-label="مسار التنقل" style="font-size:13px;color:#a3a8b3;margin-bottom:10px">` + crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${esc(c.url.replace(SITE, "") || "/")}" style="color:#a3a8b3;text-decoration:none">${esc(c.name)}</a>` : `<span>${esc(c.name)}</span>`).join(" › ") + `</nav>`;
}
function breadcrumbJson(crumbs) {
  return JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": crumbs.map((c, i) => ({ "@type": "ListItem", "position": i + 1, "name": c.name, "item": c.url })) }).replace(/</g, "\\u003c");
}
function ssrBlock(row, extra) {
  extra = extra || {};
  const title = esc(row.title || "");
  const desc = esc(String(row.description || "").trim() || description(row));
  const img = String(row.poster_url || "").trim();
  const meta = [row.category, row.year, row.duration, row.rating ? "تقييم " + row.rating : ""].filter(Boolean).map(esc).join(" • ");
  return `<section id="ssr-seo" style="max-width:1100px;margin:16px auto;padding:16px;background:#0f1622;border:1px solid #202c3e;border-radius:16px;display:flex;gap:16px;align-items:flex-start"><div style="flex:1;min-width:0">${extra.crumbs ? breadcrumbHtml(extra.crumbs) : ""}<h1 style="margin:0 0 8px;font-size:24px">${title}</h1><p style="margin:0 0 8px;color:#a3a8b3">${meta}</p><p style="margin:0;line-height:1.9">${desc}</p>${isSeries(row.category) ? episodeNavHtml(row, "") : ""}${relatedHtml(extra.related)}</div>${img ? `<img src="${esc(img)}" alt="${title}" width="120" height="180" style="border-radius:12px;object-fit:cover;flex:0 0 auto">` : ""}</section>`;
}
function injectSeo(html, row, url, extra) {
  extra = extra || {};
  const crumbs = extra.crumbs || [{ name: "الرئيسية", url: SITE + "/" }, { name: row.title || "", url: SITE + itemPath(row) }];
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
  const meta = `\n<title>${esc(title)}</title>\n<meta name="description" content="${esc(desc)}">\n<link rel="canonical" href="${esc(url)}">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="سيما سيما">\n<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:url" content="${esc(url)}">${image ? `\n<meta property="og:image" content="${esc(image)}">` : ""}\n<script type="application/ld+json">${json}</script>\n<script type="application/ld+json">${breadcrumbJson(crumbs)}</script>`;
  return html.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta name="description"[^>]*>/i, "").replace(/<link rel="canonical"[^>]*>/i, "").replace(/<meta property="og:(type|site_name|title|description|url|image)"[^>]*>/gi, "").replace("</head>", meta + "\n<style>body:has(#details[style*=\"display: block\"]) #ssr-seo{display:none!important}body:has(#ssr-seo) #details:not([style*=\"display: block\"]){display:none!important}body:has(#ssr-seo) footer{visibility:hidden}body:has(#details[style*=\"display: block\"]) footer{visibility:visible}</style><noscript><style>footer{visibility:visible!important}</style></noscript>\n</head>").replace('<div id="details"', () => ssrBlock(row, { related: extra.related, crumbs }) + '<div id="details"');
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
function buildEntries(rows) {
  const entries = ["/", "/privacy", "/terms", "/contact", "/dmca"].map(p => ({ p, lm: "" }));
  for (const row of rows) {
    if (row && (row.Id ?? row.id) != null && row.title) {
      entries.push({ p: itemPath(row), lm: lastmod(row) });
      if (INDEX_EPISODES && isSeries(row.category)) {
        for (const e of episodeUrlList(row)) entries.push({ p: e.p, lm: lastmod(row) });
      }
    }
  }
  const seen = new Set();
  return entries.filter(e => !seen.has(e.p) && seen.add(e.p));
}
function sitemapUrlset(list) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` + list.map(e => `  <url><loc>${xmlEsc(SITE + e.p)}</loc>${e.lm || ""}</url>`).join("\n") + "\n</urlset>";
}
function sitemapIndex(n) {
  const now = new Date().toISOString().slice(0, 10);
  let out = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  for (let k = 1; k <= n; k++) out += `  <sitemap><loc>${SITE}/sitemap-${k}.xml</loc><lastmod>${now}</lastmod></sitemap>\n`;
  return out + "</sitemapindex>";
}
// نخزّن قائمة الروابط في Cache API 10 دقائق حتى لا نسحب الجدول كله من Supabase مع كل طلب
async function getEntriesCached(ctx) {
  const cache = caches.default;
  const key = new Request(SITE + "/__cache/sitemap-entries");
  const hit = await cache.match(key);
  if (hit) { try { return await hit.json(); } catch (e) {} }
  const list = buildEntries(await getAllRows());
  const res = new Response(JSON.stringify(list), { headers: { "content-type": "application/json", "cache-control": "public, max-age=600" } });
  if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(key, res)); else await cache.put(key, res);
  return list;
}
const XML_HEADERS = { "content-type": "application/xml; charset=UTF-8", "cache-control": "public, max-age=600" };
async function handleSitemap(url, ctx) {
  let list;
  try { list = await getEntriesCached(ctx); }
  catch (e) { return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "content-type": "text/plain; charset=UTF-8", "retry-after": "300" } }); }
  const total = Math.max(1, Math.ceil(list.length / SITEMAP_CHUNK));
  if (url.pathname === "/sitemap.xml") return new Response(sitemapIndex(total), { headers: XML_HEADERS });
  const m = url.pathname.match(/^\/sitemap-(\d+)\.xml$/);
  const n = m ? Number(m[1]) : 0;
  if (!n || n > total) return new Response("Not found", { status: 404, headers: { "x-robots-tag": "noindex" } });
  return new Response(sitemapUrlset(list.slice((n - 1) * SITEMAP_CHUNK, n * SITEMAP_CHUNK)), { headers: XML_HEADERS });
}

// ===== الصفحة الرئيسية: روابط حقيقية لأحدث الأعمال داخل الـ HTML (يستفيد منها الزاحف قبل تشغيل JS) =====
async function getLatest(limit) {
  const attempts = [
    { sel: "Id,title,category,year", order: "Id.desc" },
    { sel: "id,title,category,year", order: "id.desc" },
    { sel: "Id,title,category", order: "Id.desc" },
    { sel: "id,title,category", order: "id.desc" },
    { sel: "*", order: "" }
  ];
  for (const at of attempts) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/movies?select=${at.sel}${at.order ? "&order=" + at.order : ""}&limit=${limit}`, { headers: headers() });
    if (!r.ok) continue;
    const data = await r.json();
    if (Array.isArray(data)) return data.filter(x => x && x.title && (x.Id ?? x.id) != null);
  }
  throw new Error("latest failed");
}
function homeListHtml(rows) {
  if (!rows.length) return "";
  const links = rows.map(r => `<a href="${esc(itemPath(r))}" style="color:#ffb000;text-decoration:none;border:1px solid #202c3e;border-radius:10px;padding:6px 12px;font-size:14px">${esc(r.title)}${r.year ? " (" + esc(r.year) + ")" : ""}</a>`).join("");
  return `<section id="ssr-home" style="margin:28px 0"><h2 style="font-size:20px;margin:0 0 12px">أحدث الأفلام والمسلسلات المضافة</h2><nav aria-label="أحدث الأعمال" style="display:flex;flex-wrap:wrap;gap:8px">${links}</nav></section>`;
}

// ===== حالة عدم توفر قاعدة البيانات: 503 مؤقتة بدل صفحة 200 بلا SEO، فلا تُفهرس نسخة عامة بالغلط =====
async function unavailable(env, url, request, paths) {
  const page = await loadHtml(env, url, request, paths);
  const h = { "content-type": "text/html; charset=UTF-8", "retry-after": "300", "cache-control": "no-store" };
  if (!page) return new Response("Service temporarily unavailable", { status: 503, headers: { "content-type": "text/plain; charset=UTF-8", "retry-after": "300", "cache-control": "no-store" } });
  return new Response(page.body, { status: 503, headers: h });
}
function parseEpisodesForWorker(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch (e) {} }
  return [];
}
function workerHasSeasons(row) {
  const sd = parseEpisodesForWorker(row.episodes).find(x => x && x.__cimaSeasons === true && x.enabled !== false);
  return !!(sd && Array.isArray(sd.seasons) && sd.seasons.length);
}
function workerEpisode(row, seasonNumber, episodeNumber) {
  const data = parseEpisodesForWorker(row.episodes);
  const seasonData = data.find(x => x && x.__cimaSeasons === true && x.enabled !== false);
  let list = data.filter(x => x && !x.__cimaSeasons && !x.__cimaOverlay);
  let seasonName = "";
  if (seasonData && Array.isArray(seasonData.seasons) && seasonNumber > 0) {
    const season = seasonData.seasons[seasonNumber - 1];
    if (!season || !Array.isArray(season.episodes)) return null;
    list = season.episodes;
    seasonName = season.name || ("الموسم " + seasonNumber);
  }
  const ep = list[episodeNumber - 1];
  if (!ep) return null;
  const nameAt = n => { const e = list[n - 1]; return e ? String(e.title || ("الحلقة " + n)) : ""; };
  return { ep, seasonName, title: String(ep.title || ("الحلقة " + episodeNumber)), seasonNumber, episodeNumber, total: list.length, prevTitle: nameAt(episodeNumber - 1), nextTitle: nameAt(episodeNumber + 1) };
}
function episodeDescription(row, info) {
  const ep = info && info.ep ? info.ep : {};
  const specific = [ep.description, ep.summary, ep.overview, ep.synopsis, ep.plot]
    .find(v => typeof v === "string" && v.trim().length > 30);
  if (specific) return String(specific).replace(/\s+/g, " ").trim();
  // لا ننسب أحداثًا غير موجودة للحلقة؛ نستخدم بياناتها المؤكدة فقط.
  const season = info.seasonName ? ` ضمن ${info.seasonName}` : "";
  return `هذه صفحة ${info.title} من مسلسل ${row.title || ""}${season}. رقم الحلقة ${info.episodeNumber} من إجمالي ${info.total} حلقة. يمكنك الانتقال إلى الحلقة السابقة أو التالية والعودة إلى صفحة المسلسل للاطلاع على القصة والتفاصيل الكاملة.`.replace(/\s+/g, " ").trim();
}
function episodeHasDownloads(info) {
  let d = info && info.ep ? info.ep.downloads : null;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { d = null; } }
  return Array.isArray(d) && d.some(x => x && x.url);
}
function episodeFaqHtml(nameWithKind, info, sName, label) {
  const items = [[`كم عدد حلقات ${nameWithKind}؟`, `يتوفر حاليًا على الموقع ${info.total} حلقة${sName ? " في " + sName : ""}.`]];
  if (episodeHasDownloads(info)) items.push([`كيف أحمّل ${label(info.title)}؟`, "اضغط على أحد روابط التحميل الظاهرة في هذه الصفحة، ثم اختر الجودة المناسبة من صفحة التحميل."]);
  return `<h2 class="ei-h">أسئلة شائعة</h2><div class="ei-faq">${items.map(q => `<div><h3>${esc(q[0])}</h3><p>${esc(q[1])}</p></div>`).join("")}</div>`;
}
function episodeInfoHtml(row, info, seasonsCount) {
  const multi = seasonsCount > 1;
  const sName = multi ? (info.seasonName || "") : "";
  const label = t => ((sName ? sName + " " : "") + t).trim();
  const title = String(row.title || "");
  const nameWithKind = title.indexOf("مسلسل ") === 0 ? title : "مسلسل " + title;
  const cat = String(row.category || "");
  const lead = `شاهد ${nameWithKind} — ${label(info.title)} اون لاين على سيما سيما.${cat ? " التصنيف: " + cat + "." : ""} القصة الكاملة وباقي الحلقات في صفحة المسلسل.`;
  const chips = [];
  if (row.year) chips.push(String(row.year));
  if (row.rating && String(row.rating) !== "—") chips.push("⭐ " + row.rating);
  if (cat) chips.push(cat);
  if (row.duration) chips.push(String(row.duration));
  if (sName) chips.push(sName);
  chips.push(`الحلقة ${info.episodeNumber} من ${info.total}`);
  const base = itemPath(row) + (info.seasonNumber > 0 ? `/season/${info.seasonNumber}` : "");
  const links = [];
  if (info.episodeNumber > 1 && info.prevTitle) links.push(`<a href="${esc(base + "/episode/" + (info.episodeNumber - 1))}" onclick="return epClick(event, ${info.episodeNumber - 2})">الحلقة السابقة: ${esc(label(info.prevTitle))}</a>`);
  if (info.episodeNumber < info.total && info.nextTitle) links.push(`<a href="${esc(base + "/episode/" + (info.episodeNumber + 1))}" onclick="return epClick(event, ${info.episodeNumber})">الحلقة التالية: ${esc(label(info.nextTitle))}</a>`);
  const d = episodeDescription(row, info);
  const short = d.length > 300 ? d.slice(0, 300).replace(/\s+\S*$/, "") + "…" : d;
  return `<section id="epInfo" class="ep-info"><p class="ei-lead">${esc(lead)}</p>` +
    `<div class="ei-chips">${chips.map(c => `<span>${esc(c)}</span>`).join("")}</div>` +
    (links.length ? `<div class="ei-links">${links.join("")}</div>` : "") +
    (short ? `<h2 class="ei-h">نبذة سريعة</h2><p class="ei-desc">${esc(short)}</p>` : "") +
    episodeFaqHtml(nameWithKind, info, sName, label) +
    `<a class="ei-more" href="${esc(itemPath(row))}">← اقرأ القصة والتفاصيل كاملة</a></section>`;
}
function injectEpisodeSeo(html, row, url, info, extra) {
  extra = extra || {};
  const epName = info.title;
  const seasonsCount = (() => { const sd = parseEpisodesForWorker(row.episodes).find(x => x && x.__cimaSeasons === true && x.enabled !== false); return sd && Array.isArray(sd.seasons) ? sd.seasons.length : 0; })();
  const heading = `${/^مسلسل\s/.test(String(row.title || "")) ? "مشاهدة وتحميل" : "مشاهدة وتحميل مسلسل"} ${row.title || ""}${seasonsCount > 1 && info.seasonName ? " " + info.seasonName : ""} ${epName}`.replace(/\s+/g, " ").trim();
  const title = `${heading} | سيما سيما`;
  const desc = (`${heading}. ` + episodeDescription(row, info)).replace(/\s+/g, " ").slice(0, 160);
  const crumbs = [{ name: "الرئيسية", url: SITE + "/" }, { name: row.title || "", url: SITE + itemPath(row) }, { name: (seasonsCount > 1 && info.seasonName ? info.seasonName + " " : "") + epName, url }];
  let out = injectSeo(html, row, url, { related: extra.related, crumbs });
  // watch.html الأصلية noindex. لصفحات الحلقات الصحيحة نحدد الفهرسة حسب INDEX_EPISODES.
  out = out.replace(/<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${INDEX_EPISODES ? "index,follow" : "noindex,follow"}">`);
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${esc(desc)}">`)
    .replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${esc(title)}">`)
    .replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${esc(desc)}">`);
  out = out.replace(/<section id="ssr-seo"[\s\S]*?<\/section>/i, `<section id="ssr-seo" style="max-width:1100px;margin:16px auto;padding:16px;background:#0f1622;border:1px solid #202c3e;border-radius:16px">${breadcrumbHtml(crumbs)}<h1 style="margin:0 0 8px;font-size:24px">${esc(heading)}</h1><p style="margin:0 0 8px;color:#a3a8b3">${esc(info.seasonName || "حلقة من المسلسل")}</p><p style="margin:0;line-height:1.9">${esc(desc)}</p><p style="margin:8px 0 0"><a href="${esc(itemPath(row))}" style="color:#ffb000;text-decoration:none">${esc(row.title || "المسلسل")} - كل الحلقات</a></p>${episodeNavHtml(row, url.slice(SITE.length))}${relatedHtml(extra.related)}</section>`);
  out = out.replace('<section id="epInfo" class="ep-info"></section>', () => episodeInfoHtml(row, info, seasonsCount));
  const schema = {
    "@context": "https://schema.org", "@type": "TVEpisode",
    "name": heading, "episodeNumber": info.episodeNumber,
    "description": desc, "url": url,
    "partOfSeries": { "@type": "TVSeries", "name": row.title || "", "url": SITE + itemPath(row) }
  };
  const episodeImage = String(info.ep && (info.ep.poster_url || info.ep.image || info.ep.thumbnail) || row.poster_url || "").trim();
  if (episodeImage) schema.image = episodeImage;
  if (info.seasonNumber > 0) schema.partOfSeason = { "@type": "TVSeason", "seasonNumber": info.seasonNumber, "name": info.seasonName };
  out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, "\\u003c")}</script>`);
  return out;
}

function redirect301(path) { return Response.redirect(SITE + path, 301); }
async function notFound(env, url, request) {
  const r = await env.ASSETS.fetch(new Request(new URL("/__not-found__", url), request));
  const h = new Headers(r.headers);
  h.set("x-robots-tag", "noindex");
  h.set("cache-control", "public, max-age=60");
  return new Response(r.body, { status: 404, headers: h });
}
// نخزّن الصفحات المُولّدة 5 دقائق على حافة كلاودفلير: أسرع للزائر والزاحف ويخفف الضغط على Supabase
function cacheAndReturn(ctx, request, res) {
  if (request.method === "GET" && ctx && ctx.waitUntil) ctx.waitUntil(caches.default.put(request, res.clone()));
  return res;
}
const HTML_OK = { "content-type": "text/html; charset=UTF-8", "cache-control": "public, max-age=300" };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const isGet = request.method === "GET";
    try {
      if (url.pathname === "/sitemap.xml" || /^\/sitemap-\d+\.xml$/.test(url.pathname)) {
        return await handleSitemap(url, ctx);
      }
      // الروابط القديمة /?movie=ID تتحول بشكل دائم (301) للرابط الأساسي
      if (url.pathname === "/" && url.searchParams.get("movie")) {
        const oldRow = await getMovie(url.searchParams.get("movie"));
        if (oldRow && oldRow.title) return Response.redirect(SITE + itemPath(oldRow), 301);
      }
      const p = url.pathname;

      // الصفحة الرئيسية: نضيف قائمة روابط حقيقية لأحدث الأعمال داخل الـ HTML
      if (isGet && p === "/" && !url.search) {
        const hit = await caches.default.match(request);
        if (hit) return hit;
        const asset = await env.ASSETS.fetch(request);
        if (!asset || asset.status !== 200) return asset;
        try {
          const rows = await getLatest(HOME_LATEST);
          const list = homeListHtml(rows);
          if (!list) return asset;
          const html = (await asset.clone().text()).replace("</main>", () => list + "</main>");
          return cacheAndReturn(ctx, request, new Response(html, { status: 200, headers: HTML_OK }));
        } catch (e) { return asset; }
      }

      const cacheable = isGet && /^\/(movie|series)\//i.test(p);
      if (cacheable) {
        const hit = await caches.default.match(request);
        if (hit) return hit;
      }

      // روابط الحلقات
      const episodeMatch = p.match(/^\/series\/[^/]+~([^/]+)\/(?:season\/(\d+)\/)?episode\/(\d+)\/?$/i);
      if (episodeMatch) {
        let id;
        try { id = decodeURIComponent(episodeMatch[1]); } catch (e) { return notFound(env, url, request); }
        const row = await getMovie(id);
        if (row === null) return notFound(env, url, request);
        // قاعدة البيانات غير متاحة مؤقتًا: 503 بدل 404 حتى لا تُحذف الصفحة من الفهرس
        if (row === undefined) return unavailable(env, url, request, ["/watch.html", "/watch", "/index.html"]);
        if (!row.title || !isSeries(row.category)) return notFound(env, url, request);
        const seasonNumber = Number(episodeMatch[2] || 0);
        const episodeNumber = Number(episodeMatch[3]);
        if (seasonNumber && !workerHasSeasons(row)) {
          if (workerEpisode(row, 0, episodeNumber)) return redirect301(itemPath(row) + `/episode/${episodeNumber}`);
          return notFound(env, url, request);
        }
        const info = workerEpisode(row, seasonNumber, episodeNumber);
        if (!info) return notFound(env, url, request);
        const canonical = itemPath(row) + (seasonNumber ? `/season/${seasonNumber}` : "") + `/episode/${episodeNumber}`;
        if (p.replace(/\/$/, "") !== canonical) return redirect301(canonical);
        const page = await loadHtml(env, url, request, ["/watch.html", "/watch", "/index.html"]);
        if (!page) return env.ASSETS.fetch(request);
        const related = await getRelated(row);
        const html = injectEpisodeSeo(await page.text(), row, SITE + canonical, info, { related });
        return cacheAndReturn(ctx, request, new Response(html, { status: 200, headers: HTML_OK }));
      }
      if (/^\/(movie|series)\//i.test(p)) {
        const m = p.match(/^\/(movie|series)\/[^/]+~([^/]+)\/?$/i);
        if (!m) return notFound(env, url, request);
        let id;
        try { id = decodeURIComponent(m[2]); } catch (e) { return notFound(env, url, request); }
        const row = await getMovie(id);
        if (row === null) return notFound(env, url, request);
        // قاعدة البيانات غير متاحة مؤقتًا: 503 (الزاحف يعيد المحاولة) بدل صفحة 200 عامة بلا SEO
        if (row === undefined) return unavailable(env, url, request, ["/movie.html", "/movie", "/index.html"]);
        if (row.title) {
          const canon = itemPath(row);
          let same = false;
          try { same = !p.endsWith("/") && decodeURIComponent(p) === decodeURIComponent(canon); } catch (e) {}
          if (!same) return redirect301(canon);
        }
        // الرابط الجميل يعرض صفحة الفيلم الحقيقية (movie.html) بنفس الـ SEO
        const page = await loadHtml(env, url, request, ["/movie.html", "/movie"]);
        const asset = page || await loadHtml(env, url, request, ["/index.html", "/"]);
        if (!asset) return env.ASSETS.fetch(request);
        const related = await getRelated(row);
        let html = injectSeo(await asset.text(), row, SITE + itemPath(row), { related });
        if (page) {
          const fix = '<script>window.__MOVIE_ID__=' + JSON.stringify(String(row.Id ?? row.id)) + ';</script>';
          html = html.replace(/<head[^>]*>/i, mm => mm + fix);
        }
        return cacheAndReturn(ctx, request, new Response(html, { status: 200, headers: HTML_OK }));
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
      if (/^\/(movie|series)\//i.test(url.pathname)) {
        try { return await unavailable(env, url, request, ["/movie.html", "/index.html"]); } catch (e2) {}
      }
      return env.ASSETS.fetch(request);
    }
  }
};
