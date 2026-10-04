-- اختياري ومهم: القراءة للجميع، والإضافة/التعديل/الحذف للمسؤول فقط.
-- شغّله في Supabase SQL Editor. راجع Authentication > Policies بعده وتأكد أنه لا توجد سياسات أخرى تسمح للعامة بالتعديل.
ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cima_public_read" ON public.movies;
CREATE POLICY "cima_public_read" ON public.movies FOR SELECT USING (true);

DROP POLICY IF EXISTS "cima_admin_write" ON public.movies;
CREATE POLICY "cima_admin_write" ON public.movies FOR ALL TO authenticated
USING (auth.uid() = '3a01b63c-f6d4-43a7-8996-4ef5521a0c70'::uuid)
WITH CHECK (auth.uid() = '3a01b63c-f6d4-43a7-8996-4ef5521a0c70'::uuid);
