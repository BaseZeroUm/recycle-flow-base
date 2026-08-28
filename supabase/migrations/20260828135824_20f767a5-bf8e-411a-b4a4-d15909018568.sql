ALTER TABLE public.movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS numero_ticket integer,
  ADD COLUMN IF NOT EXISTS peso_bruto numeric,
  ADD COLUMN IF NOT EXISTS tara numeric,
  ADD COLUMN IF NOT EXISTS valor_unitario numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS veiculo_placa text,
  ADD COLUMN IF NOT EXISTS motorista text;

CREATE OR REPLACE FUNCTION public.set_numero_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_ticket IS NULL THEN
    SELECT COALESCE(MAX(numero_ticket), 0) + 1 INTO NEW.numero_ticket
    FROM public.movimentacoes_estoque
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.set_numero_ticket() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_numero_ticket ON public.movimentacoes_estoque;
CREATE TRIGGER t_numero_ticket BEFORE INSERT ON public.movimentacoes_estoque
FOR EACH ROW EXECUTE FUNCTION public.set_numero_ticket();

WITH numerados AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY empresa_id ORDER BY created_at) AS n
  FROM public.movimentacoes_estoque WHERE numero_ticket IS NULL
)
UPDATE public.movimentacoes_estoque m SET numero_ticket = numerados.n
FROM numerados WHERE m.id = numerados.id;

CREATE UNIQUE INDEX IF NOT EXISTS movimentacoes_ticket_unq ON public.movimentacoes_estoque (empresa_id, numero_ticket);