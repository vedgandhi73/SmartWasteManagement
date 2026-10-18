DROP POLICY IF EXISTS "signed-in read reports" ON public.reports;
CREATE POLICY "read own, open or assigned reports" ON public.reports FOR SELECT TO authenticated
USING (user_id = auth.uid() OR collector_id = auth.uid() OR status = 'pending');

DROP POLICY IF EXISTS "read rewards" ON public.reward_items;
CREATE POLICY "read available rewards" ON public.reward_items FOR SELECT TO authenticated
USING (is_available = true);

DROP POLICY IF EXISTS "read waste images" ON storage.objects;
CREATE POLICY "read own waste images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'waste-images' AND (storage.foldername(name))[1] = auth.uid()::text);