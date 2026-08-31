CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero_ticket integer,
  tipo public.tipo_movimentacao NOT NULL,
  data date NOT NULL DEFAULT current_date,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  observacoes text,
  responsavel text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tickets_all ON public.tickets;
CREATE POLICY tickets_all ON public.tickets
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE INDEX IF NOT EXISTS tickets_empresa_idx ON public.tickets (empresa_id, data DESC);
CREATE UNIQUE INDEX IF NOT EXISTS tickets_empresa_numero_unq ON public.tickets (empresa_id, numero_ticket);

CREATE OR REPLACE FUNCTION public.set_numero_ticket_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.numero_ticket IS NULL THEN
    SELECT GREATEST(
      COALESCE((SELECT MAX(numero_ticket) FROM public.tickets WHERE empresa_id = NEW.empresa_id), 0),
      COALESCE((SELECT MAX(numero_ticket) FROM public.movimentacoes_estoque WHERE empresa_id = NEW.empresa_id), 0)
    ) + 1 INTO NEW.numero_ticket;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_numero_ticket_tickets ON public.tickets;
CREATE TRIGGER trg_set_numero_ticket_tickets
  BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_numero_ticket_tickets();

ALTER TABLE public.movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS movimentacoes_ticket_id_idx ON public.movimentacoes_estoque (ticket_id);

DROP INDEX IF EXISTS public.movimentacoes_ticket_unq;

CREATE OR REPLACE FUNCTION public.set_numero_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.numero_ticket INTO NEW.numero_ticket FROM public.tickets t WHERE t.id = NEW.ticket_id;
  END IF;
  IF NEW.numero_ticket IS NULL THEN
    SELECT GREATEST(
      COALESCE((SELECT MAX(numero_ticket) FROM public.tickets WHERE empresa_id = NEW.empresa_id), 0),
      COALESCE((SELECT MAX(numero_ticket) FROM public.movimentacoes_estoque WHERE empresa_id = NEW.empresa_id), 0)
    ) + 1 INTO NEW.numero_ticket;
  END IF;
  RETURN NEW;
END; $$;