-- Migration: fix_set_numero_ticket_not_found
-- Date: 2026-09-25
-- Description:
--   Fix bug in set_numero_ticket() trigger function where a ticket with
--   numero_ticket = NULL would incorrectly raise the exception
--   "Ticket does not exist or belongs to another company".
--
--   Root cause: the old code used `IF NEW.numero_ticket IS NULL` as a proxy
--   for "row not found", which is incorrect — it also fires when the row EXISTS
--   but its numero_ticket column is NULL.
--
--   Fix: use PL/pgSQL's `IF NOT FOUND` diagnostic which is set by SELECT...INTO
--   and correctly reflects whether any row matched the query.

-- ============================================================
-- 1. Fix set_numero_ticket() — used on movimentacoes_estoque
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_numero_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.numero_ticket INTO NEW.numero_ticket
    FROM public.tickets t
    WHERE t.id = NEW.ticket_id AND t.empresa_id = NEW.empresa_id;

    -- Use NOT FOUND instead of IS NULL to correctly detect missing rows.
    -- A ticket may legitimately have numero_ticket = NULL (before the trigger
    -- set_numero_ticket_tickets fires), and that should NOT raise an exception.
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket % does not exist or belongs to another company', NEW.ticket_id;
    END IF;
  END IF;

  IF NEW.numero_ticket IS NULL THEN
    SELECT GREATEST(
      COALESCE((SELECT MAX(numero_ticket) FROM public.tickets WHERE empresa_id = NEW.empresa_id), 0),
      COALESCE((SELECT MAX(numero_ticket) FROM public.movimentacoes_estoque WHERE empresa_id = NEW.empresa_id), 0)
    ) + 1 INTO NEW.numero_ticket;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_numero_ticket() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. set_numero_ticket_tickets() — no change needed, but
--    re-apply with pg_temp search_path for consistency.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_numero_ticket_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.numero_ticket IS NULL THEN
    SELECT GREATEST(
      COALESCE((SELECT MAX(numero_ticket) FROM public.tickets WHERE empresa_id = NEW.empresa_id), 0),
      COALESCE((SELECT MAX(numero_ticket) FROM public.movimentacoes_estoque WHERE empresa_id = NEW.empresa_id), 0)
    ) + 1 INTO NEW.numero_ticket;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_numero_ticket_tickets() FROM PUBLIC, anon, authenticated;
