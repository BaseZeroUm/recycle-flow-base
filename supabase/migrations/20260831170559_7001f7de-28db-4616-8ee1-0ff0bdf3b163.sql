DO $$ BEGIN
  CREATE TYPE public.caixa_tipo AS ENUM ('abertura','aporte','compra','despesa','sangria','conferencia');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.caixa_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo public.caixa_tipo NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  descricao text,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  lancamento_id uuid REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  diferenca numeric,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.caixa_movimentos TO authenticated;
GRANT ALL ON public.caixa_movimentos TO service_role;

ALTER TABLE public.caixa_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caixa_movimentos_all ON public.caixa_movimentos;
CREATE POLICY caixa_movimentos_all ON public.caixa_movimentos
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE INDEX IF NOT EXISTS caixa_movimentos_empresa_idx ON public.caixa_movimentos (empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS caixa_movimentos_ticket_idx ON public.caixa_movimentos (ticket_id);
CREATE INDEX IF NOT EXISTS caixa_movimentos_lancamento_idx ON public.caixa_movimentos (lancamento_id);

DROP TRIGGER IF EXISTS t_caixa_movimentos_updated ON public.caixa_movimentos;
CREATE TRIGGER t_caixa_movimentos_updated BEFORE UPDATE ON public.caixa_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS forma_pagamento text;