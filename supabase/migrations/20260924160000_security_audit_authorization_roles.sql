-- ==============================================================================
-- MIGRATION: 20260924160000_security_audit_authorization_roles.sql
-- AUDITORIA COMPLETA DE AUTORIZAÇÃO, ROLES E PRIVILÉGIOS ADMINISTRATIVOS
-- BASE ZERO UM (Base 01: Recicle & Gerencie + Base Admin Hub)
-- ==============================================================================

-- 1. TRIGGER DE PROTEÇÃO DE CAMPOS ADMINISTRATIVOS EM PROFILES
-- Impede escalação de privilégio, auto-reativação de contas desativadas
-- e manipulação de flags LGPD por usuários comuns.
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_master boolean;
  v_is_tenant_admin boolean;
BEGIN
  -- Apenas para chamadas vindas de clientes autenticados
  IF auth.role() = 'authenticated' THEN
    v_is_master := public.is_master_admin();
    v_is_tenant_admin := (public.has_role(auth.uid(), 'admin') AND NEW.empresa_id = public.current_empresa_id());

    -- Bloqueio estrito de auto-reativação (bypass de desativação)
    IF OLD.id = auth.uid() AND OLD.ativo = false AND NEW.ativo = true AND NOT v_is_master THEN
      RAISE EXCEPTION 'Acesso negado: um usuário desativado não pode reativar a própria conta diretamente.';
    END IF;

    -- Usuários não-administradores não podem alterar ativo, datas ou motivo de desativação
    IF NOT (v_is_master OR v_is_tenant_admin) THEN
      IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
        RAISE EXCEPTION 'Acesso negado: a situação da conta (ativo) só pode ser alterada por administradores.';
      END IF;
      IF OLD.desativado_em IS DISTINCT FROM NEW.desativado_em THEN
        RAISE EXCEPTION 'Acesso negado: a data de desativação só pode ser alterada por administradores.';
      END IF;
      IF OLD.exclusao_programada_para IS DISTINCT FROM NEW.exclusao_programada_para THEN
        RAISE EXCEPTION 'Acesso negado: a data programada de exclusão só pode ser alterada por administradores.';
      END IF;
      IF OLD.motivo_desativacao IS DISTINCT FROM NEW.motivo_desativacao THEN
        RAISE EXCEPTION 'Acesso negado: o motivo de desativação só pode ser alterado por administradores.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_sensitive_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_protect_sensitive ON public.profiles;
CREATE TRIGGER trg_profiles_protect_sensitive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- 2. TRIGGER DE PROTEÇÃO CONTRA REMOÇÃO DO ÚLTIMO ADMINISTRADOR ATIVO DA EMPRESA
-- Impede que uma empresa fique órfã de administrador por exclusão ou despromoção acidental/maliciosa.
CREATE OR REPLACE FUNCTION public.protect_last_active_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count integer;
  v_target_empresa uuid;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_master_admin() THEN
    v_target_empresa := COALESCE(OLD.empresa_id, NEW.empresa_id);

    -- Verifica se estamos deletando um papel de admin ou rebaixando de admin para outro papel
    IF OLD.role = 'admin' AND (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.role != 'admin')) THEN
      SELECT count(*) INTO v_admin_count
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.empresa_id = v_target_empresa
        AND ur.role = 'admin'
        AND ur.user_id != OLD.user_id
        AND p.ativo = true;

      IF v_admin_count = 0 THEN
        RAISE EXCEPTION 'Operação bloqueada: não é permitido remover ou despromover o único administrador ativo da organização.';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_last_active_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_roles_protect_last_admin ON public.user_roles;
CREATE TRIGGER trg_roles_protect_last_admin
  BEFORE UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_active_admin();

-- 3. REFORÇO DE PERMISSÕES EXECUTE
REVOKE ALL ON FUNCTION public.is_master_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.can_finance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_finance() TO authenticated;
