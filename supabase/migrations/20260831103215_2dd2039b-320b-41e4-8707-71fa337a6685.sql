ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS trial_ate timestamptz NOT NULL DEFAULT (now() + interval '1 day'),
  ADD COLUMN IF NOT EXISTS assinatura_ativa boolean NOT NULL DEFAULT false;

UPDATE public.empresas SET assinatura_ativa = true WHERE created_at < now();