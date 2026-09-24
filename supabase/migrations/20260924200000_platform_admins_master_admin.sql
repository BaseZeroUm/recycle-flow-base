-- ==============================================================================
-- MIGRATION: 20260924200000_platform_admins_master_admin.sql
-- CRIAÇÃO DA TABELA DEDICADA DE PLATFORM ADMINS E GOVERNANÇA DE MASTER ADMIN
-- ==============================================================================

-- 1. TABELA DEDICADA: platform_admins
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- Habilita e força Row Level Security
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins FORCE ROW LEVEL SECURITY;

-- Garante que nenhuma policy direta exista para o cliente.
-- Sem policies definidas, qualquer SELECT/INSERT/UPDATE/DELETE direto
-- originado do cliente web via PostgREST é estritamente bloqueado.
DROP POLICY IF EXISTS "platform_admins_select" ON public.platform_admins;

-- 2. FUNÇÃO CANÔNICA: is_master_admin()
-- Substitui qualquer versão provisória anterior
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.platform_admins pa
    JOIN public.profiles p ON p.id = pa.user_id
    WHERE pa.user_id = auth.uid() 
      AND p.ativo = true
      AND p.desativado_em IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_master_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;

-- 3. RPC DE PROMOÇÃO: promote_platform_admin(target_user_id)
CREATE OR REPLACE FUNCTION public.promote_platform_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_ativo boolean;
  v_target_desativado timestamptz;
BEGIN
  -- 1. Apenas Master Admin autenticado pode promover
  IF auth.role() != 'authenticated' OR NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Master Admins da plataforma podem promover outros administradores.';
  END IF;

  -- 2. Valida existência em auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado em auth.users.';
  END IF;

  -- 3. Valida se o perfil existe e está ativo
  SELECT ativo, desativado_em 
  INTO v_target_ativo, v_target_desativado
  FROM public.profiles 
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil do usuário não encontrado em public.profiles.';
  END IF;

  IF v_target_ativo IS NOT TRUE OR v_target_desativado IS NOT NULL THEN
    RAISE EXCEPTION 'Não é possível promover um usuário cuja conta esteja desativada ou inativa.';
  END IF;

  -- 4. Inserção idempotente em platform_admins
  INSERT INTO public.platform_admins (user_id, created_at, created_by)
  VALUES (target_user_id, now(), auth.uid())
  ON CONFLICT (user_id) DO NOTHING;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_platform_admin(uuid) TO authenticated;

-- 4. RPC DE REMOÇÃO: demote_platform_admin(target_user_id)
CREATE OR REPLACE FUNCTION public.demote_platform_admin(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_admins_count integer;
  v_is_target_master boolean;
BEGIN
  -- 1. Apenas Master Admin autenticado pode revogar
  IF auth.role() != 'authenticated' OR NOT public.is_master_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas Master Admins da plataforma podem revogar privilégios administrativos.';
  END IF;

  -- 2. Verifica se o alvo é Master Admin
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = target_user_id
  ) INTO v_is_target_master;

  IF NOT v_is_target_master THEN
    RETURN true; -- Operação idempotente
  END IF;

  -- 3. Impede a remoção do último Master Admin ativo
  SELECT count(*)
  INTO v_active_admins_count
  FROM public.platform_admins pa
  JOIN public.profiles p ON p.id = pa.user_id
  WHERE pa.user_id != target_user_id
    AND p.ativo = true
    AND p.desativado_em IS NULL;

  IF v_active_admins_count = 0 THEN
    RAISE EXCEPTION 'Operação bloqueada: não é permitido remover o último Master Admin ativo da plataforma.';
  END IF;

  -- 4. Remoção atômica
  DELETE FROM public.platform_admins WHERE user_id = target_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.demote_platform_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.demote_platform_admin(uuid) TO authenticated;
