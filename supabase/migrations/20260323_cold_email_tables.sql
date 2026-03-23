-- Cold email feature: recruiters, email templates, email logs

-- Recruiters table
CREATE TABLE IF NOT EXISTS public.recruiters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruiters_user_id ON public.recruiters(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recruiters_user_email ON public.recruiters(user_id, email);

ALTER TABLE public.recruiters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recruiters_select_own" ON public.recruiters
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recruiters_insert_own" ON public.recruiters
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recruiters_update_own" ON public.recruiters
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recruiters_delete_own" ON public.recruiters
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_recruiters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recruiters_updated_at
  BEFORE UPDATE ON public.recruiters
  FOR EACH ROW EXECUTE FUNCTION public.set_recruiters_updated_at();


-- Email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_templates_user_id ON public.email_templates(user_id);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_templates_select_own" ON public.email_templates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "email_templates_insert_own" ON public.email_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "email_templates_update_own" ON public.email_templates
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "email_templates_delete_own" ON public.email_templates
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_email_templates_updated_at();


-- Email logs table (tracks each send)
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES public.recruiters(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  resend_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON public.email_logs(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_recruiter ON public.email_logs(recruiter_id);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_logs_select_own" ON public.email_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "email_logs_insert_own" ON public.email_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
