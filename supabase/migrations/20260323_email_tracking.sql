-- Add open tracking fields to email_logs
ALTER TABLE public.email_logs
  ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;

-- RPC to atomically increment open count (ignores opens within 30s of send)
CREATE OR REPLACE FUNCTION public.increment_open_count(log_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.email_logs
  SET open_count = open_count + 1,
      opened_at = COALESCE(opened_at, now())
  WHERE id = log_id
    AND sent_at < now() - interval '30 seconds';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
