-- ==============================================================================
-- DEPLOY CONSOLIDADO — AUDITORIA DE SEGURANÇA BASE ZERO UM
-- Gerado em: 2026-09-24
-- Este script contém as 6 migrations de segurança na ordem estrita de execução,
-- encapsuladas em uma transação única (BEGIN / COMMIT) e finalizadas com a
-- promoção do primeiro Master Admin da plataforma.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- ETAPA 1 DE 6: 20260924150000_security_audit_rls_hardening.sql
-- ==============================================================================

-- ==============================================================================
-- MIGRATION: 20260924150000_security_audit_rls_hardening.sql
-- AUDITORIA COMPLETA DE SEGURANÇA E ISOLAMENTO MULTI-TENANT (RLS)
-- BASE ZERO UM (Base 01: Recicle & Gerencie + Base Admin Hub)
-- ==============================================================================

-- 1. GARANTIR QUE TABELA user_activity_daily EXISTE COM empresa_id
CREATE TABLE IF NOT EXISTS public.user_activity_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  data date NOT NULL,
  minutos_ativos numeric DEFAULT 0,
  UNIQUE (user_id, data)
);

-- 2. ATUALIZAR FUNÇÕES DE SEGURANÇA E AUTENTICAÇÃO
-- current_empresa_id(): Retorna a empresa_id do usuário autenticado a partir de public.profiles
CREATE OR REPLACE FUNCTION public.current_empresa_id() 
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_empresa_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO authenticated;

-- is_master_admin(): Valida se o usuário é um Administrador Master da plataforma (categoria = 'admin')
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles p
    JOIN public.empresas e ON e.id = p.empresa_id
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.empresa_id = e.id
    WHERE p.id = auth.uid() 
      AND ur.role = 'admin' 
      AND e.categoria = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_master_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;

-- has_role(): Corrigido para garantir que o papel pertence estritamente à empresa do tenant ativo
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) 
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id 
      AND ur.role = _role
      AND ur.empresa_id = public.current_empresa_id()
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- can_finance(): Garante escopo no tenant atual
CREATE OR REPLACE FUNCTION public.can_finance() 
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro');
$$;

REVOKE ALL ON FUNCTION public.can_finance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_finance() TO authenticated;

-- 3. AJUSTE DE GERAÇÃO E AUDITORIA DE TICKETS (set_numero_ticket)
-- Impede vazamento e associação cruzada de ticket de outras empresas
CREATE OR REPLACE FUNCTION public.set_numero_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ticket_id IS NOT NULL THEN
    SELECT t.numero_ticket INTO NEW.numero_ticket 
    FROM public.tickets t 
    WHERE t.id = NEW.ticket_id AND t.empresa_id = NEW.empresa_id;

    IF NEW.numero_ticket IS NULL THEN
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
END; $$;

REVOKE ALL ON FUNCTION public.set_numero_ticket() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_numero_ticket_tickets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

REVOKE ALL ON FUNCTION public.set_numero_ticket_tickets() FROM PUBLIC, anon, authenticated;

-- 4. AJUSTE DO TRIGGER DE NOVO USUÁRIO (handle_new_user)
-- Impede auto-atribuição maliciosa de categoria 'admin' no cadastro público
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_empresa uuid;
  v_plastico uuid;
  v_papel uuid;
  v_metal uuid;
  v_vidro uuid;
  v_categoria text;
BEGIN
  v_categoria := COALESCE(NULLIF(NEW.raw_user_meta_data->>'categoria', ''), 'reciclagem');
  -- Usuários públicos não podem se auto-atribuir a categoria 'admin'
  IF v_categoria = 'admin' THEN
    v_categoria := 'reciclagem';
  END IF;

  INSERT INTO public.empresas (razao_social, cnpj, telefone, categoria)
  VALUES (
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'empresa_nome',''), 'Minha Empresa'),
    NEW.raw_user_meta_data->>'empresa_cnpj',
    NEW.raw_user_meta_data->>'telefone',
    v_categoria
  ) RETURNING id INTO v_empresa;

  INSERT INTO public.profiles (id, empresa_id, nome, email)
  VALUES (NEW.id, v_empresa, COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome',''), NEW.email), NEW.email);

  INSERT INTO public.user_roles (user_id, empresa_id, role) VALUES (NEW.id, v_empresa, 'admin');

  INSERT INTO public.categorias_despesa (empresa_id, nome, grupo) VALUES
    (v_empresa,'Administrativa','administrativa'),
    (v_empresa,'Operacional','operacional'),
    (v_empresa,'Frota','frota'),
    (v_empresa,'Folha de pagamento','folha'),
    (v_empresa,'Impostos','impostos'),
    (v_empresa,'Despesas financeiras','financeira');

  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Plástico') RETURNING id INTO v_plastico;
  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Papel') RETURNING id INTO v_papel;
  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Metal') RETURNING id INTO v_metal;
  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Vidro') RETURNING id INTO v_vidro;
  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Outros');

  INSERT INTO public.materiais (empresa_id, nome, unidade, preco_compra, preco_venda, categoria_material_id) VALUES
    (v_empresa,'PET','kg',1.20,2.40,v_plastico),
    (v_empresa,'PEAD','kg',1.00,2.00,v_plastico),
    (v_empresa,'PP','kg',0.90,1.80,v_plastico),
    (v_empresa,'Papelão','kg',0.45,0.90,v_papel),
    (v_empresa,'Alumínio','kg',5.50,8.20,v_metal),
    (v_empresa,'Metal ferroso','kg',0.60,1.10,v_metal),
    (v_empresa,'Vidro','kg',0.15,0.35,v_vidro);

  RETURN NEW;
END; $function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 5. TRIGGER PARA IMUTABILIDADE DE empresa_id (PROTEÇÃO CONTRA TROCA DE TENANT)
CREATE OR REPLACE FUNCTION public.protect_empresa_id_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'A coluna empresa_id é estritamente imutável para prevenir violação de isolamento entre empresas.';
  END IF;
  RETURN NEW;
END;
$$;

-- 6. TRIGGER PARA PROTEÇÃO DE CAMPOS SENSÍVEIS EM empresas (TRIAL / ASSINATURA / PLANO / CATEGORIA)
CREATE OR REPLACE FUNCTION public.protect_empresa_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_master_admin() THEN
    IF OLD.trial_ate IS DISTINCT FROM NEW.trial_ate THEN
      RAISE EXCEPTION 'Acesso negado: trial_ate não pode ser alterado diretamente por usuários do cliente.';
    END IF;
    IF OLD.assinatura_ativa IS DISTINCT FROM NEW.assinatura_ativa THEN
      RAISE EXCEPTION 'Acesso negado: assinatura_ativa não pode ser alterada diretamente por usuários do cliente.';
    END IF;
    IF OLD.plano IS DISTINCT FROM NEW.plano THEN
      RAISE EXCEPTION 'Acesso negado: plano não pode ser alterado diretamente por usuários do cliente.';
    END IF;
    IF OLD.categoria IS DISTINCT FROM NEW.categoria THEN
      RAISE EXCEPTION 'Acesso negado: categoria não pode ser alterada diretamente por usuários do cliente.';
    END IF;
    IF OLD.ativa IS DISTINCT FROM NEW.ativa THEN
      RAISE EXCEPTION 'Acesso negado: status da empresa não pode ser alterado diretamente por usuários do cliente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_protect_sensitive ON public.empresas;
CREATE TRIGGER trg_empresas_protect_sensitive
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_sensitive_columns();

-- 7. TRIGGER PARA VALIDAR INTEGRIDADE DE CHAVES ESTRANGEIRAS MULTI-TENANT
-- Impede que usuário da empresa A aponte para registros de empresa B (ID enumeration & cross-link)
CREATE OR REPLACE FUNCTION public.validate_tenant_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'movimentacoes_estoque' THEN
    IF NEW.material_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.materiais WHERE id = NEW.material_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: o material informado não pertence a esta empresa.';
    END IF;
    IF NEW.fornecedor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.fornecedores WHERE id = NEW.fornecedor_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: o fornecedor informado não pertence a esta empresa.';
    END IF;
    IF NEW.cliente_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.clientes WHERE id = NEW.cliente_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: o cliente informado não pertence a esta empresa.';
    END IF;
    IF NEW.ticket_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tickets WHERE id = NEW.ticket_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: o ticket informado não pertence a esta empresa.';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'tickets' THEN
    IF NEW.fornecedor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.fornecedores WHERE id = NEW.fornecedor_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: o fornecedor informado não pertence a esta empresa.';
    END IF;
    IF NEW.cliente_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.clientes WHERE id = NEW.cliente_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: o cliente informado não pertence a esta empresa.';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'lancamentos' THEN
    IF NEW.categoria_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.categorias_despesa WHERE id = NEW.categoria_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: a categoria de despesa informada não pertence a esta empresa.';
    END IF;
    IF NEW.movimentacao_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.movimentacoes_estoque WHERE id = NEW.movimentacao_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: a movimentação informada não pertence a esta empresa.';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'caixa_movimentos' THEN
    IF NEW.ticket_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tickets WHERE id = NEW.ticket_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: o ticket informado não pertence a esta empresa.';
    END IF;
    IF NEW.lancamento_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.lancamentos WHERE id = NEW.lancamento_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: o lançamento informado não pertence a esta empresa.';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'materiais' THEN
    IF NEW.categoria_material_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.categorias_material WHERE id = NEW.categoria_material_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: a categoria de material não pertence a esta empresa.';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'user_roles' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'Violação multi-tenant: o usuário não pertence a esta empresa.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers de validação de FKs multi-tenant
DROP TRIGGER IF EXISTS trg_movimentacoes_fk_guard ON public.movimentacoes_estoque;
CREATE TRIGGER trg_movimentacoes_fk_guard
  BEFORE INSERT OR UPDATE ON public.movimentacoes_estoque
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();

DROP TRIGGER IF EXISTS trg_tickets_fk_guard ON public.tickets;
CREATE TRIGGER trg_tickets_fk_guard
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();

DROP TRIGGER IF EXISTS trg_lancamentos_fk_guard ON public.lancamentos;
CREATE TRIGGER trg_lancamentos_fk_guard
  BEFORE INSERT OR UPDATE ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();

DROP TRIGGER IF EXISTS trg_caixa_fk_guard ON public.caixa_movimentos;
CREATE TRIGGER trg_caixa_fk_guard
  BEFORE INSERT OR UPDATE ON public.caixa_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();

DROP TRIGGER IF EXISTS trg_materiais_fk_guard ON public.materiais;
CREATE TRIGGER trg_materiais_fk_guard
  BEFORE INSERT OR UPDATE ON public.materiais
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();

DROP TRIGGER IF EXISTS trg_roles_fk_guard ON public.user_roles;
CREATE TRIGGER trg_roles_fk_guard
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references();

-- Triggers de imutabilidade de empresa_id
DROP TRIGGER IF EXISTS trg_profiles_empresa_immutable ON public.profiles;
CREATE TRIGGER trg_profiles_empresa_immutable
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_roles_empresa_immutable ON public.user_roles;
CREATE TRIGGER trg_roles_empresa_immutable
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_materiais_empresa_immutable ON public.materiais;
CREATE TRIGGER trg_materiais_empresa_immutable
  BEFORE UPDATE ON public.materiais
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_fornecedores_empresa_immutable ON public.fornecedores;
CREATE TRIGGER trg_fornecedores_empresa_immutable
  BEFORE UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_clientes_empresa_immutable ON public.clientes;
CREATE TRIGGER trg_clientes_empresa_immutable
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_cat_mat_empresa_immutable ON public.categorias_material;
CREATE TRIGGER trg_cat_mat_empresa_immutable
  BEFORE UPDATE ON public.categorias_material
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_cat_desp_empresa_immutable ON public.categorias_despesa;
CREATE TRIGGER trg_cat_desp_empresa_immutable
  BEFORE UPDATE ON public.categorias_despesa
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_tickets_empresa_immutable ON public.tickets;
CREATE TRIGGER trg_tickets_empresa_immutable
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_mov_empresa_immutable ON public.movimentacoes_estoque;
CREATE TRIGGER trg_mov_empresa_immutable
  BEFORE UPDATE ON public.movimentacoes_estoque
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_lanc_empresa_immutable ON public.lancamentos;
CREATE TRIGGER trg_lanc_empresa_immutable
  BEFORE UPDATE ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

DROP TRIGGER IF EXISTS trg_caixa_empresa_immutable ON public.caixa_movimentos;
CREATE TRIGGER trg_caixa_empresa_immutable
  BEFORE UPDATE ON public.caixa_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.protect_empresa_id_immutable();

-- 8. DEFAULT VALUES SEGUROS PARA empresa_id (AUTO-POPULAÇÃO CONFIÁVEL)
ALTER TABLE public.materiais ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.fornecedores ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.clientes ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.categorias_material ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.categorias_despesa ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.movimentacoes_estoque ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.tickets ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.lancamentos ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.caixa_movimentos ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.user_activity_daily ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();

-- 9. LIMPEZA DE POLICIES OBSOLETAS, VULNERÁVEIS OU PERMISSIVAS DEMAIS
DROP POLICY IF EXISTS "empresa_select" ON public.empresas;
DROP POLICY IF EXISTS "empresa_update" ON public.empresas;
DROP POLICY IF EXISTS "Admins gerenciam empresas" ON public.empresas;
DROP POLICY IF EXISTS "Usuarios veem a propria empresa" ON public.empresas;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "Admins gerenciam perfis" ON public.profiles;
DROP POLICY IF EXISTS "Usuario ve e edita o proprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuario edita o proprio perfil" ON public.profiles;

DROP POLICY IF EXISTS "roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "roles_admin_manage" ON public.user_roles;
DROP POLICY IF EXISTS "roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "roles_delete" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios veem os proprios papeis" ON public.user_roles;

DROP POLICY IF EXISTS "materiais_all" ON public.materiais;
DROP POLICY IF EXISTS "materiais_select" ON public.materiais;
DROP POLICY IF EXISTS "materiais_insert" ON public.materiais;
DROP POLICY IF EXISTS "materiais_update" ON public.materiais;
DROP POLICY IF EXISTS "materiais_delete" ON public.materiais;

DROP POLICY IF EXISTS "fornecedores_all" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_select" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_insert" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_update" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_delete" ON public.fornecedores;

DROP POLICY IF EXISTS "clientes_all" ON public.clientes;
DROP POLICY IF EXISTS "clientes_select" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update" ON public.clientes;
DROP POLICY IF EXISTS "clientes_delete" ON public.clientes;

DROP POLICY IF EXISTS "categorias_material_all" ON public.categorias_material;
DROP POLICY IF EXISTS "categorias_material_select" ON public.categorias_material;
DROP POLICY IF EXISTS "categorias_material_insert" ON public.categorias_material;
DROP POLICY IF EXISTS "categorias_material_update" ON public.categorias_material;
DROP POLICY IF EXISTS "categorias_material_delete" ON public.categorias_material;

DROP POLICY IF EXISTS "categorias_all" ON public.categorias_despesa;
DROP POLICY IF EXISTS "categorias_despesa_select" ON public.categorias_despesa;
DROP POLICY IF EXISTS "categorias_despesa_insert" ON public.categorias_despesa;
DROP POLICY IF EXISTS "categorias_despesa_update" ON public.categorias_despesa;
DROP POLICY IF EXISTS "categorias_despesa_delete" ON public.categorias_despesa;

DROP POLICY IF EXISTS "Permitir acesso para usuarios autenticados em tickets" ON public.tickets;
DROP POLICY IF EXISTS "tickets_all" ON public.tickets;
DROP POLICY IF EXISTS "tickets_select" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert" ON public.tickets; -- REMOÇÃO CRÍTICA DA POLICY COM WITH CHECK (true)
DROP POLICY IF EXISTS "tickets_update" ON public.tickets;
DROP POLICY IF EXISTS "tickets_delete" ON public.tickets;

DROP POLICY IF EXISTS "movimentacoes_all" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_select" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_insert" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_update" ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS "movimentacoes_delete" ON public.movimentacoes_estoque;

DROP POLICY IF EXISTS "lancamentos_all" ON public.lancamentos;
DROP POLICY IF EXISTS "lancamentos_select" ON public.lancamentos;
DROP POLICY IF EXISTS "lancamentos_insert" ON public.lancamentos;
DROP POLICY IF EXISTS "lancamentos_update" ON public.lancamentos;
DROP POLICY IF EXISTS "lancamentos_delete" ON public.lancamentos;

DROP POLICY IF EXISTS "caixa_movimentos_all" ON public.caixa_movimentos;
DROP POLICY IF EXISTS "caixa_movimentos_select" ON public.caixa_movimentos;
DROP POLICY IF EXISTS "caixa_movimentos_insert" ON public.caixa_movimentos;
DROP POLICY IF EXISTS "caixa_movimentos_update" ON public.caixa_movimentos;
DROP POLICY IF EXISTS "caixa_movimentos_delete" ON public.caixa_movimentos;

DROP POLICY IF EXISTS "Admins podem visualizar toda atividade" ON public.user_activity_daily;
DROP POLICY IF EXISTS "Usuarios registram seu proprio ping" ON public.user_activity_daily;
DROP POLICY IF EXISTS "Admins registram atividade" ON public.user_activity_daily;
DROP POLICY IF EXISTS "Usuarios veem a propria atividade" ON public.user_activity_daily;
DROP POLICY IF EXISTS "activity_select" ON public.user_activity_daily;
DROP POLICY IF EXISTS "activity_insert" ON public.user_activity_daily;
DROP POLICY IF EXISTS "activity_update" ON public.user_activity_daily;
DROP POLICY IF EXISTS "activity_delete" ON public.user_activity_daily;

-- 10. REABILITAR E CRIAR POLICIES REFORÇADAS (CRUD EXPLÍCITO)

-- ==================== EMPRESAS ====================
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresas_select" ON public.empresas
  FOR SELECT TO authenticated
  USING (id = public.current_empresa_id() OR public.is_master_admin());

CREATE POLICY "empresas_update" ON public.empresas
  FOR UPDATE TO authenticated
  USING ((id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin')) OR public.is_master_admin())
  WITH CHECK ((id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin')) OR public.is_master_admin());

-- ==================== PROFILES ====================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_master_admin());

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid() 
    OR (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin'))
    OR public.is_master_admin()
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id() 
    OR public.is_master_admin()
  );

-- ==================== USER_ROLES ====================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_master_admin());

CREATE POLICY "roles_insert" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin'))
    OR public.is_master_admin()
  );

CREATE POLICY "roles_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin'))
    OR public.is_master_admin()
  )
  WITH CHECK (
    (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin'))
    OR public.is_master_admin()
  );

CREATE POLICY "roles_delete" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin'))
    OR public.is_master_admin()
  );

-- ==================== MATERIAIS ====================
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materiais_select" ON public.materiais
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY "materiais_insert" ON public.materiais
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "materiais_update" ON public.materiais
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "materiais_delete" ON public.materiais
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin'));

-- ==================== FORNECEDORES ====================
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedores_select" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY "fornecedores_insert" ON public.fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "fornecedores_update" ON public.fornecedores
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "fornecedores_delete" ON public.fornecedores
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin'));

-- ==================== CLIENTES ====================
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY "clientes_insert" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "clientes_update" ON public.clientes
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "clientes_delete" ON public.clientes
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin'));

-- ==================== CATEGORIAS_MATERIAL ====================
ALTER TABLE public.categorias_material ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_material_select" ON public.categorias_material
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY "categorias_material_insert" ON public.categorias_material
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "categorias_material_update" ON public.categorias_material
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "categorias_material_delete" ON public.categorias_material
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin'));

-- ==================== CATEGORIAS_DESPESA ====================
ALTER TABLE public.categorias_despesa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categorias_despesa_select" ON public.categorias_despesa
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY "categorias_despesa_insert" ON public.categorias_despesa
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.can_finance());

CREATE POLICY "categorias_despesa_update" ON public.categorias_despesa
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.can_finance())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.can_finance());

CREATE POLICY "categorias_despesa_delete" ON public.categorias_despesa
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.can_finance());

-- ==================== TICKETS ====================
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_select" ON public.tickets
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY "tickets_insert" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "tickets_update" ON public.tickets
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "tickets_delete" ON public.tickets
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operacional')));

-- ==================== MOVIMENTACOES_ESTOQUE ====================
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movimentacoes_select" ON public.movimentacoes_estoque
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY "movimentacoes_insert" ON public.movimentacoes_estoque
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "movimentacoes_update" ON public.movimentacoes_estoque
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "movimentacoes_delete" ON public.movimentacoes_estoque
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operacional')));

-- ==================== LANCAMENTOS ====================
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lancamentos_select" ON public.lancamentos
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.can_finance());

CREATE POLICY "lancamentos_insert" ON public.lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id() AND (public.can_finance() OR movimentacao_id IS NOT NULL));

CREATE POLICY "lancamentos_update" ON public.lancamentos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.can_finance())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.can_finance());

CREATE POLICY "lancamentos_delete" ON public.lancamentos
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND (public.can_finance() OR public.has_role(auth.uid(), 'operacional')));

-- ==================== CAIXA_MOVIMENTOS ====================
ALTER TABLE public.caixa_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "caixa_movimentos_select" ON public.caixa_movimentos
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY "caixa_movimentos_insert" ON public.caixa_movimentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "caixa_movimentos_update" ON public.caixa_movimentos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND public.can_finance())
  WITH CHECK (empresa_id = public.current_empresa_id() AND public.can_finance());

CREATE POLICY "caixa_movimentos_delete" ON public.caixa_movimentos
  FOR DELETE TO authenticated
  USING (empresa_id = public.current_empresa_id() AND (public.can_finance() OR public.has_role(auth.uid(), 'operacional')));

-- ==================== USER_ACTIVITY_DAILY ====================
ALTER TABLE public.user_activity_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_select" ON public.user_activity_daily
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR user_id = auth.uid() OR public.is_master_admin());

CREATE POLICY "activity_insert" ON public.user_activity_daily
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (empresa_id IS NULL OR empresa_id = public.current_empresa_id()));

CREATE POLICY "activity_update" ON public.user_activity_daily
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND (empresa_id IS NULL OR empresa_id = public.current_empresa_id()))
  WITH CHECK (user_id = auth.uid() AND (empresa_id IS NULL OR empresa_id = public.current_empresa_id()));

CREATE POLICY "activity_delete" ON public.user_activity_daily
  FOR DELETE TO authenticated
  USING ((empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(), 'admin')) OR public.is_master_admin());


-- ==============================================================================
-- ETAPA 2 DE 6: 20260924160000_security_audit_authorization_roles.sql
-- ==============================================================================

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


-- ==============================================================================
-- ETAPA 3 DE 6: 20260924170000_security_audit_api_exposure_hardening.sql
-- ==============================================================================

-- ==============================================================================
-- MIGRATION: 20260924170000_security_audit_api_exposure_hardening.sql
-- AUDITORIA COMPLETA DE EXPOSIÇÃO DE APIS, RPC, POSTGREST E SECURITY DEFINER
-- BASE ZERO UM (Base 01: Recicle & Gerencie + Base Admin Hub)
-- ==============================================================================

-- 1. BLINDAGEM DE TODAS AS FUNÇÕES COM SET search_path = public, pg_temp;
-- Elimina riscos de search_path hijacking e injeção de schemas temporários

-- 1.1 set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() 
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN 
  NEW.updated_at = now(); 
  RETURN NEW; 
END; 
$$;

-- 1.2 current_empresa_id
CREATE OR REPLACE FUNCTION public.current_empresa_id() 
RETURNS uuid
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 1.3 is_master_admin
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles p
    JOIN public.empresas e ON e.id = p.empresa_id
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.empresa_id = e.id
    WHERE p.id = auth.uid() 
      AND ur.role = 'admin' 
      AND e.categoria = 'admin'
  );
$$;

-- 1.4 has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) 
RETURNS boolean
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id 
      AND ur.role = _role
      AND ur.empresa_id = public.current_empresa_id()
  );
$$;

-- 1.5 can_finance
CREATE OR REPLACE FUNCTION public.can_finance() 
RETURNS boolean
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro');
$$;

-- 1.6 set_numero_ticket
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

    IF NEW.numero_ticket IS NULL THEN
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

-- 1.7 set_numero_ticket_tickets
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

-- 1.8 handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa uuid;
  v_plastico uuid;
  v_papel uuid;
  v_metal uuid;
  v_vidro uuid;
  v_categoria text;
BEGIN
  v_categoria := COALESCE(NULLIF(NEW.raw_user_meta_data->>'categoria', ''), 'reciclagem');
  IF v_categoria = 'admin' THEN
    v_categoria := 'reciclagem';
  END IF;

  INSERT INTO public.empresas (razao_social, cnpj, telefone, categoria)
  VALUES (
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'empresa_nome',''), 'Minha Empresa'),
    NEW.raw_user_meta_data->>'empresa_cnpj',
    NEW.raw_user_meta_data->>'telefone',
    v_categoria
  ) RETURNING id INTO v_empresa;

  INSERT INTO public.profiles (id, empresa_id, nome, email)
  VALUES (NEW.id, v_empresa, COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome',''), NEW.email), NEW.email);

  INSERT INTO public.user_roles (user_id, empresa_id, role) VALUES (NEW.id, v_empresa, 'admin');

  INSERT INTO public.categorias_despesa (empresa_id, nome, grupo) VALUES
    (v_empresa,'Administrativa','administrativa'),
    (v_empresa,'Operacional','operacional'),
    (v_empresa,'Frota','frota'),
    (v_empresa,'Folha de pagamento','folha'),
    (v_empresa,'Impostos','impostos'),
    (v_empresa,'Despesas financeiras','financeira');

  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Plástico') RETURNING id INTO v_plastico;
  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Papel') RETURNING id INTO v_papel;
  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Metal') RETURNING id INTO v_metal;
  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Vidro') RETURNING id INTO v_vidro;
  INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa,'Outros');

  INSERT INTO public.materiais (empresa_id, nome, unidade, preco_compra, preco_venda, categoria_material_id) VALUES
    (v_empresa,'PET','kg',1.20,2.40,v_plastico),
    (v_empresa,'PEAD','kg',1.00,2.00,v_plastico),
    (v_empresa,'PP','kg',0.90,1.80,v_plastico),
    (v_empresa,'Papelão','kg',0.45,0.90,v_papel),
    (v_empresa,'Alumínio','kg',5.50,8.20,v_metal),
    (v_empresa,'Metal ferroso','kg',0.60,1.10,v_metal),
    (v_empresa,'Vidro','kg',0.15,0.35,v_vidro);

  RETURN NEW;
END; 
$$;

-- 1.9 protect_empresa_id_immutable
CREATE OR REPLACE FUNCTION public.protect_empresa_id_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'A coluna empresa_id é estritamente imutável para prevenir violação de isolamento entre empresas.';
  END IF;
  RETURN NEW;
END;
$$;

-- 1.10 protect_empresa_sensitive_columns
CREATE OR REPLACE FUNCTION public.protect_empresa_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_master_admin() THEN
    IF OLD.trial_ate IS DISTINCT FROM NEW.trial_ate THEN
      RAISE EXCEPTION 'Acesso negado: trial_ate não pode ser alterado diretamente por usuários do cliente.';
    END IF;
    IF OLD.assinatura_ativa IS DISTINCT FROM NEW.assinatura_ativa THEN
      RAISE EXCEPTION 'Acesso negado: assinatura_ativa não pode ser alterada diretamente por usuários do cliente.';
    END IF;
    IF OLD.plano IS DISTINCT FROM NEW.plano THEN
      RAISE EXCEPTION 'Acesso negado: plano não pode ser alterado diretamente por usuários do cliente.';
    END IF;
    IF OLD.categoria IS DISTINCT FROM NEW.categoria THEN
      RAISE EXCEPTION 'Acesso negado: categoria não pode ser alterada diretamente por usuários do cliente.';
    END IF;
    IF OLD.ativa IS DISTINCT FROM NEW.ativa THEN
      RAISE EXCEPTION 'Acesso negado: status da empresa não pode ser alterado diretamente por usuários do cliente.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 1.11 validate_tenant_references
CREATE OR REPLACE FUNCTION public.validate_tenant_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_TABLE_NAME = 'movimentacoes_estoque' THEN
    IF NEW.material_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.materiais WHERE id = NEW.material_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'material_id % does not belong to empresa_id %', NEW.material_id, NEW.empresa_id;
    END IF;
    IF NEW.fornecedor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.fornecedores WHERE id = NEW.fornecedor_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'fornecedor_id % does not belong to empresa_id %', NEW.fornecedor_id, NEW.empresa_id;
    END IF;
    IF NEW.cliente_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.clientes WHERE id = NEW.cliente_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'cliente_id % does not belong to empresa_id %', NEW.cliente_id, NEW.empresa_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'lancamentos' THEN
    IF NEW.categoria_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.categorias_despesa WHERE id = NEW.categoria_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'categoria_id % does not belong to empresa_id %', NEW.categoria_id, NEW.empresa_id;
    END IF;
    IF NEW.movimentacao_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.movimentacoes_estoque WHERE id = NEW.movimentacao_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'movimentacao_id % does not belong to empresa_id %', NEW.movimentacao_id, NEW.empresa_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'tickets' THEN
    IF NEW.fornecedor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.fornecedores WHERE id = NEW.fornecedor_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'fornecedor_id % does not belong to empresa_id %', NEW.fornecedor_id, NEW.empresa_id;
    END IF;
    IF NEW.cliente_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.clientes WHERE id = NEW.cliente_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'cliente_id % does not belong to empresa_id %', NEW.cliente_id, NEW.empresa_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'caixa_movimentos' THEN
    IF NEW.ticket_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tickets WHERE id = NEW.ticket_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'ticket_id % does not belong to empresa_id %', NEW.ticket_id, NEW.empresa_id;
    END IF;
    IF NEW.lancamento_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.lancamentos WHERE id = NEW.lancamento_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'lancamento_id % does not belong to empresa_id %', NEW.lancamento_id, NEW.empresa_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    IF NEW.user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = NEW.user_id AND empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'user_id % does not belong to empresa_id %', NEW.user_id, NEW.empresa_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 1.12 protect_profile_sensitive_columns
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_master boolean;
  v_is_tenant_admin boolean;
BEGIN
  IF auth.role() = 'authenticated' THEN
    v_is_master := public.is_master_admin();
    v_is_tenant_admin := (public.has_role(auth.uid(), 'admin') AND NEW.empresa_id = public.current_empresa_id());

    IF OLD.id = auth.uid() AND OLD.ativo = false AND NEW.ativo = true AND NOT v_is_master THEN
      RAISE EXCEPTION 'Acesso negado: um usuário desativado não pode reativar a própria conta diretamente.';
    END IF;

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

-- 1.13 protect_last_active_admin
CREATE OR REPLACE FUNCTION public.protect_last_active_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_count integer;
  v_target_empresa uuid;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_master_admin() THEN
    v_target_empresa := COALESCE(OLD.empresa_id, NEW.empresa_id);

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

-- 2. REVOGAÇÃO EXPLÍCITA DE TODAS AS FUNÇÕES DE TRIGGER CONTRA EXPOSIÇÃO COMO RPC
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_numero_ticket() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_numero_ticket_tickets() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_empresa_id_immutable() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_empresa_sensitive_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_tenant_references() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_sensitive_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_last_active_admin() FROM PUBLIC, anon, authenticated;

-- 3. PERMISSÕES ESTRITAS DE EXECUTE APENAS NAS FUNÇÕES DE SERVIÇO AUTENTICADO
REVOKE ALL ON FUNCTION public.current_empresa_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO authenticated;

REVOKE ALL ON FUNCTION public.is_master_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.can_finance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_finance() TO authenticated;

-- 4. FORÇAR RLS ESTRIBADO (FORCE ROW LEVEL SECURITY) EM TODAS AS TABELAS OPERACIONAIS
ALTER TABLE public.empresas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores FORCE ROW LEVEL SECURITY;
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_despesa FORCE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_material FORCE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque FORCE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.caixa_movimentos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_daily FORCE ROW LEVEL SECURITY;

-- 5. REVOGAÇÃO EXPLÍCITA DE QUALQUER ACESSO ANÔNIMO A TABELAS
REVOKE ALL ON TABLE public.empresas FROM anon;
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.user_roles FROM anon;
REVOKE ALL ON TABLE public.materiais FROM anon;
REVOKE ALL ON TABLE public.fornecedores FROM anon;
REVOKE ALL ON TABLE public.clientes FROM anon;
REVOKE ALL ON TABLE public.categorias_despesa FROM anon;
REVOKE ALL ON TABLE public.categorias_material FROM anon;
REVOKE ALL ON TABLE public.movimentacoes_estoque FROM anon;
REVOKE ALL ON TABLE public.lancamentos FROM anon;
REVOKE ALL ON TABLE public.tickets FROM anon;
REVOKE ALL ON TABLE public.caixa_movimentos FROM anon;
REVOKE ALL ON TABLE public.user_activity_daily FROM anon;


-- ==============================================================================
-- ETAPA 4 DE 6: 20260924180000_security_audit_injection_length_limits.sql
-- ==============================================================================

-- ==============================================================================
-- AUDITORIA DE SEGURANÇA — ITEM 6: INJEÇÕES, VALIDAÇÕES E LIMITES DE TAMANHO
-- Migration: 20260924180000_security_audit_injection_length_limits.sql
-- Propósito: Adicionar constraints de tamanho máximo em campos textuais para
--            prevenir Resource Exhaustion (DoS) e inserção de payloads anômalos
--            arbitrariamente grandes via Supabase PostgREST API.
-- ==============================================================================

DO $$
BEGIN
  -- 1. MATERIAIS
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_materiais_nome_len') THEN
    ALTER TABLE public.materiais ADD CONSTRAINT chk_materiais_nome_len CHECK (char_length(nome) <= 255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_materiais_unidade_len') THEN
    ALTER TABLE public.materiais ADD CONSTRAINT chk_materiais_unidade_len CHECK (unidade IS NULL OR char_length(unidade::text) <= 20);
  END IF;

  -- 2. CATEGORIAS DE MATERIAL
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_categorias_material_nome_len') THEN
    ALTER TABLE public.categorias_material ADD CONSTRAINT chk_categorias_material_nome_len CHECK (char_length(nome) <= 255);
  END IF;

  -- 3. FORNECEDORES
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fornecedores_nome_len') THEN
    ALTER TABLE public.fornecedores ADD CONSTRAINT chk_fornecedores_nome_len CHECK (char_length(nome) <= 255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fornecedores_documento_len') THEN
    ALTER TABLE public.fornecedores ADD CONSTRAINT chk_fornecedores_documento_len CHECK (documento IS NULL OR char_length(documento) <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fornecedores_telefone_len') THEN
    ALTER TABLE public.fornecedores ADD CONSTRAINT chk_fornecedores_telefone_len CHECK (telefone IS NULL OR char_length(telefone) <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fornecedores_email_len') THEN
    ALTER TABLE public.fornecedores ADD CONSTRAINT chk_fornecedores_email_len CHECK (email IS NULL OR char_length(email) <= 255);
  END IF;

  -- 4. CLIENTES
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_clientes_nome_len') THEN
    ALTER TABLE public.clientes ADD CONSTRAINT chk_clientes_nome_len CHECK (char_length(nome) <= 255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_clientes_documento_len') THEN
    ALTER TABLE public.clientes ADD CONSTRAINT chk_clientes_documento_len CHECK (documento IS NULL OR char_length(documento) <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_clientes_telefone_len') THEN
    ALTER TABLE public.clientes ADD CONSTRAINT chk_clientes_telefone_len CHECK (telefone IS NULL OR char_length(telefone) <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_clientes_email_len') THEN
    ALTER TABLE public.clientes ADD CONSTRAINT chk_clientes_email_len CHECK (email IS NULL OR char_length(email) <= 255);
  END IF;

  -- 5. CATEGORIAS DE DESPESA
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_categorias_despesa_nome_len') THEN
    ALTER TABLE public.categorias_despesa ADD CONSTRAINT chk_categorias_despesa_nome_len CHECK (char_length(nome) <= 255);
  END IF;

  -- 6. LANÇAMENTOS FINANCEIROS
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lancamentos_descricao_len') THEN
    ALTER TABLE public.lancamentos ADD CONSTRAINT chk_lancamentos_descricao_len CHECK (char_length(descricao) <= 500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lancamentos_forma_pagamento_len') THEN
    ALTER TABLE public.lancamentos ADD CONSTRAINT chk_lancamentos_forma_pagamento_len CHECK (forma_pagamento IS NULL OR char_length(forma_pagamento) <= 50);
  END IF;

  -- 7. CAIXA MOVIMENTOS
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_caixa_movimentos_descricao_len') THEN
    ALTER TABLE public.caixa_movimentos ADD CONSTRAINT chk_caixa_movimentos_descricao_len CHECK (char_length(descricao) <= 500);
  END IF;

  -- 8. TICKETS E MOVIMENTAÇÕES DE ESTOQUE
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tickets_observacoes_len') THEN
    ALTER TABLE public.tickets ADD CONSTRAINT chk_tickets_observacoes_len CHECK (observacoes IS NULL OR char_length(observacoes) <= 2000);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_movimentacoes_observacoes_len') THEN
    ALTER TABLE public.movimentacoes_estoque ADD CONSTRAINT chk_movimentacoes_observacoes_len CHECK (observacoes IS NULL OR char_length(observacoes) <= 2000);
  END IF;

  -- 9. EMPRESAS
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_empresas_razao_social_len') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT chk_empresas_razao_social_len CHECK (razao_social IS NULL OR char_length(razao_social) <= 255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_empresas_nome_fantasia_len') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT chk_empresas_nome_fantasia_len CHECK (nome_fantasia IS NULL OR char_length(nome_fantasia) <= 255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_empresas_cnpj_len') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT chk_empresas_cnpj_len CHECK (cnpj IS NULL OR char_length(cnpj) <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_empresas_telefone_len') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT chk_empresas_telefone_len CHECK (telefone IS NULL OR char_length(telefone) <= 50);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_empresas_email_len') THEN
    ALTER TABLE public.empresas ADD CONSTRAINT chk_empresas_email_len CHECK (email IS NULL OR char_length(email) <= 255);
  END IF;

  -- 10. PROFILES
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_nome_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_nome_len CHECK (nome IS NULL OR char_length(nome) <= 255);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_email_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_email_len CHECK (email IS NULL OR char_length(email) <= 255);
  END IF;

END $$;


-- ==============================================================================
-- ETAPA 5 DE 6: 20260924190000_security_audit_storage_hardening.sql
-- ==============================================================================

-- ==============================================================================
-- AUDITORIA DE SEGURANÇA — ITEM 7: UPLOADS E SUPABASE STORAGE HARDENING
-- Migration: 20260924190000_security_audit_storage_hardening.sql
-- Propósito: Blindar o schema storage contra acessos anônimos e impor
--            isolamento estrito multi-tenant (empresa_id) caso qualquer bucket
--            seja criado futuramente no Supabase.
-- ==============================================================================

DO $$
BEGIN
  -- Verifica se o schema storage existe na instância PostgreSQL
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN

    -- 1. Remover policies permissivas perigosas conhecidas (caso tenham sido criadas via dashboard)
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access') THEN
      EXECUTE 'DROP POLICY "Public Access" ON storage.objects';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow All') THEN
      EXECUTE 'DROP POLICY "Allow All" ON storage.objects';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload') THEN
      EXECUTE 'DROP POLICY "Authenticated users can upload" ON storage.objects';
    END IF;

    -- 2. Criar política defensiva base para isolamento multi-tenant por empresa_id
    -- Padrão obrigatório: o primeiro diretório do path deve ser exatamente o empresa_id do usuário autenticado.
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tenant_isolation_storage_objects_select') THEN
        EXECUTE 'CREATE POLICY tenant_isolation_storage_objects_select ON storage.objects
          FOR SELECT TO authenticated
          USING (
            (storage.foldername(name))[1] = (SELECT empresa_id::text FROM public.profiles WHERE id = auth.uid())
            OR public.is_master_admin()
          )';
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tenant_isolation_storage_objects_insert') THEN
        EXECUTE 'CREATE POLICY tenant_isolation_storage_objects_insert ON storage.objects
          FOR INSERT TO authenticated
          WITH CHECK (
            (storage.foldername(name))[1] = (SELECT empresa_id::text FROM public.profiles WHERE id = auth.uid())
            OR public.is_master_admin()
          )';
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tenant_isolation_storage_objects_update') THEN
        EXECUTE 'CREATE POLICY tenant_isolation_storage_objects_update ON storage.objects
          FOR UPDATE TO authenticated
          USING (
            (storage.foldername(name))[1] = (SELECT empresa_id::text FROM public.profiles WHERE id = auth.uid())
            OR public.is_master_admin()
          )
          WITH CHECK (
            (storage.foldername(name))[1] = (SELECT empresa_id::text FROM public.profiles WHERE id = auth.uid())
            OR public.is_master_admin()
          )';
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'tenant_isolation_storage_objects_delete') THEN
        EXECUTE 'CREATE POLICY tenant_isolation_storage_objects_delete ON storage.objects
          FOR DELETE TO authenticated
          USING (
            (storage.foldername(name))[1] = (SELECT empresa_id::text FROM public.profiles WHERE id = auth.uid())
            OR public.is_master_admin()
          )';
      END IF;
    END IF;

  END IF;
END $$;


-- ==============================================================================
-- ETAPA 6 DE 6: 20260924200000_platform_admins_master_admin.sql
-- ==============================================================================

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

-- ==============================================================================
-- ETAPA 7: PROMOÇÃO INICIAL DO MASTER ADMIN DA PLATAFORMA
-- ==============================================================================
INSERT INTO public.platform_admins (user_id, created_at)
SELECT id, now()
FROM auth.users
WHERE email = 'serresalmeida@gmail.com'
ON CONFLICT (user_id) DO NOTHING;

COMMIT;
