ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'reciclagem';
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_categoria_check CHECK (categoria IN ('reciclagem','adega'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS desativado_em timestamptz;

-- O segmento só pode ser alterado pelo backend (operador), nunca pelo próprio cliente
CREATE OR REPLACE FUNCTION public.bloquear_troca_categoria()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.categoria IS DISTINCT FROM OLD.categoria
     AND coalesce(auth.role(), '') IN ('authenticated','anon') THEN
    RAISE EXCEPTION 'O segmento da empresa não pode ser alterado pelo usuário';
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.bloquear_troca_categoria() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER t_bloquear_troca_categoria
BEFORE UPDATE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.bloquear_troca_categoria();