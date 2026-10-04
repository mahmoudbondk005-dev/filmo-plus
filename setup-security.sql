-- سيما سيما: تأمين جدول movies (نفّذه مرة واحدة في Supabase SQL Editor)
-- القراءة للجميع، والإضافة/التعديل/الحذف لحساب الأدمن فقط.
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read movies" ON public.movies;
DROP POLICY IF EXISTS "admin insert movies" ON public.movies;
DROP POLICY IF EXISTS "admin update movies" ON public.movies;
DROP POLICY IF EXISTS "admin delete movies" ON public.movies;

CREATE POLICY "public read movies" ON public.movies
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admin insert movies" ON public.movies
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'email') = 'cimacima.egypt@gmail.com');

CREATE POLICY "admin update movies" ON public.movies
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cimacima.egypt@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'cimacima.egypt@gmail.com');

CREATE POLICY "admin delete movies" ON public.movies
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'cimacima.egypt@gmail.com');
