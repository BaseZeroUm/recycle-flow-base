-- Permite trial_ate nulo para planos permanentes (sem data de expiração/sem trial)
ALTER TABLE public.empresas ALTER COLUMN trial_ate DROP NOT NULL;
