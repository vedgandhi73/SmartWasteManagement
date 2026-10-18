CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Eco Hero',
  phone text, address text,
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1), 'Eco Hero'));
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.reports (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  location text NOT NULL,
  waste_type text NOT NULL,
  amount text NOT NULL,
  image_url text,
  verification_result jsonb,
  status text NOT NULL DEFAULT 'pending',
  collector_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed-in read reports" ON public.reports FOR SELECT TO authenticated USING (true);

CREATE TABLE public.collected_wastes (
  id bigserial PRIMARY KEY,
  report_id bigint NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  collector_id uuid NOT NULL,
  collection_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'verified'
);
GRANT SELECT ON public.collected_wastes TO authenticated;
GRANT ALL ON public.collected_wastes TO service_role;
ALTER TABLE public.collected_wastes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own collections" ON public.collected_wastes FOR SELECT TO authenticated USING (collector_id = auth.uid());

CREATE TABLE public.transactions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  type text NOT NULL,
  amount integer NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transactions" ON public.transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.notifications (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  message text NOT NULL,
  type text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notif read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notif update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.reward_items (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  description text,
  cost integer NOT NULL,
  collection_info text NOT NULL,
  is_available boolean NOT NULL DEFAULT true
);
GRANT SELECT ON public.reward_items TO authenticated;
GRANT ALL ON public.reward_items TO service_role;
ALTER TABLE public.reward_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read rewards" ON public.reward_items FOR SELECT TO authenticated USING (true);
INSERT INTO public.reward_items (name, description, cost, collection_info) VALUES
('Reusable Water Bottle','Stainless steel bottle to cut plastic use',50,'Pick up at any community eco-hub'),
('Tree Planting Certificate','We plant a tree in your name',100,'Certificate emailed within 7 days'),
('Compost Starter Kit','Everything to start composting at home',200,'Delivered to your saved address'),
('Eco Store Voucher','$25 voucher for partner eco stores',350,'Voucher code sent to your notifications');

CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE(user_id uuid, name text, points bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, COALESCE(SUM(t.amount) FILTER (WHERE t.type LIKE 'earned%'),0)::bigint
  FROM public.profiles p LEFT JOIN public.transactions t ON t.user_id = p.id
  GROUP BY p.id, p.name ORDER BY 3 DESC LIMIT 50
$$;
REVOKE EXECUTE ON FUNCTION public.get_leaderboard() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_impact_stats()
RETURNS TABLE(waste_collected numeric, reports_submitted bigint, tokens_earned bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE((SELECT SUM(COALESCE(NULLIF(substring(amount from '(\d+(?:\.\d+)?)'),'')::numeric,0)) FROM public.reports WHERE status = 'verified'),0),
    (SELECT COUNT(*) FROM public.reports),
    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE type LIKE 'earned%'),0)::bigint
$$;
GRANT EXECUTE ON FUNCTION public.get_impact_stats() TO anon, authenticated;

CREATE POLICY "upload own waste images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'waste-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "read waste images" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'waste-images');