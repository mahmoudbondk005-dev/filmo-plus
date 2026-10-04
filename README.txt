سيما سيما - https://cimacima.online

ملفات الرفع (كلها في مستوى واحد بدون مجلدات):
index.html, admin.html, privacy.html, terms.html, contact.html,
googlebb509c5cada2b404.html, robots.txt, _headers, _worker.js,
setup-downloads.sql, setup-security.sql

خطوات الإعداد:
1) Supabase > SQL Editor: نفّذ setup-downloads.sql ثم setup-security.sql.
2) Supabase > Authentication: عطّل التسجيل الجديد (Allow new users to sign up).
3) Cloudflare Pages > Settings > Variables and Secrets: أضف سرّ TMDB_API_KEY.
4) احذف sitemap.xml القديم من GitHub (الخريطة بقت تلقائية من _worker.js).

مهم: لا تكتب كلمات مرور أو مفاتيح سرية داخل المستودع.
