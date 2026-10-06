// Cloudflare Pages Function: يبني sitemap.xml تلقائيًا من قاعدة البيانات
const SB = "https://axvibvssjizkrfdqlyow.supabase.co";
const KEY = "sb_publishable_72qMAroeSPFAMXfL2AoVQA_5RnDslsh";
const BASE = "https://cimacima.online";

async function load(order) {
  return fetch(SB + "/rest/v1/movies?select=*&order=" + order, {
    headers: { apikey: KEY, Authorization: "Bearer " + KEY },
  });
}

export async function onRequest() {
  let r = await load("Id.desc");
  if (!r.ok) r = await load("id.desc");
  const rows = r.ok ? await r.json() : [];
  const urls = [BASE + "/"];
  for (const row of rows.slice(0, 49000)) {
    const id = row.Id ?? row.id;
    if (id != null) urls.push(BASE + "/?movie=" + encodeURIComponent(String(id)));
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => "<url><loc>" + u + "</loc></url>").join("\n") + "\n</urlset>";
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
