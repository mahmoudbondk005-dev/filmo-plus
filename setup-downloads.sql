-- سيما سيما: إضافة روابط تحميل متعددة لكل فيلم/مسلسل
-- شغّل هذا مرة واحدة في Supabase SQL Editor.
ALTER TABLE public.movies
ADD COLUMN IF NOT EXISTS download_links text DEFAULT '[]';

-- اختياري: لو أردت جعل العمود يقبل NULL أيضًا، اتركه كما هو.
-- التطبيق يخزن الروابط بصيغة JSON مثل:
-- [{"name":"سيرفر 1","url":"https://example.com/file"},{"name":"سيرفر 2","url":"https://example.com/file2"}]
