فيلمو — نسخة محسّنة (مجانية بدون اشتراكات)

1) افتح index.html لمعاينة الموقع.
2) admin.html واجهة إدارة (كلمة المرور: Filmo2026).

الميزات:
- مفضلة محلية + سجل مشاهدة
- بحث فوري
- جلب بيانات تلقائي من TMDB (اسم، بوستر، سنة، تقييم، وصف)

إعداد TMDB (مهم للإضافة التلقائية):
1. ادخل https://www.themoviedb.org وسجّل حساب مجاني
2. Settings → API → اطلب API Key (v3 auth)
3. انسخ المفتاح وضعّه في admin.html مكان:
   const TMDB_API_KEY = "YOUR_TMDB_API_KEY_HERE";

4) للإطلاق: دومين + HTTPS + تفعيل RLS على Supabase.
5) لا تضع روابط محتوى محمي بحقوق إلا بترخيص.


HLS v3 diagnostic update: player now reports manifest/level/fragment stages, uses anonymous cross-origin requests, avoids forced autoplay, and distinguishes network/HTTP 401/403/media failures.
