-- شغّله مرة واحدة في Supabase SQL Editor لتفعيل "الأكثر مشاهدة".
-- لو عمود المعرّف عندك اسمه id (حرف صغير) بدّل "Id" بـ id في الدالة.
ALTER TABLE public.movies ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_views(movie_id bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.movies SET views = COALESCE(views, 0) + 1 WHERE "Id" = movie_id;
$$;
GRANT EXECUTE ON FUNCTION public.increment_views(bigint) TO anon, authenticated;
