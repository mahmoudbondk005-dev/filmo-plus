// يصحّح الرابط الأساسي (canonical) لكل صفحة فيلم قبل ما جوجل يقرأ الصفحة
export async function onRequest(context) {
  const res = await context.next();
  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("movie");
    const type = res.headers.get("content-type") || "";
    if (!id || !type.includes("text/html")) return res;
    return new HTMLRewriter()
      .on('link[rel="canonical"]', {
        element(el) {
          el.setAttribute("href", "https://cimacima.online/?movie=" + encodeURIComponent(id));
        },
      })
      .transform(res);
  } catch (e) {
    return res;
  }
}
