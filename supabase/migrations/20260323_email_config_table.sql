-- Per-user email configuration (Gmail credentials)
CREATE TABLE IF NOT EXISTS public.email_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gmail_email TEXT NOT NULL DEFAULT '',
  gmail_app_password TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_config_select_own" ON public.email_config
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "email_config_insert_own" ON public.email_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "email_config_update_own" ON public.email_config
  FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_email_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_config_updated_at
  BEFORE UPDATE ON public.email_config
  FOR EACH ROW EXECUTE FUNCTION public.set_email_config_updated_at();
