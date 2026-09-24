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

-- 4. FORÇAR RLS ESTRIBADO (FORCE ROW LEVEL SECURITY) EM TODAS AS TABELAS
ALTER TABLE public.empresas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;
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
