-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'financeiro', 'operacional');
CREATE TYPE public.unidade_medida AS ENUM ('kg', 'ton');
CREATE TYPE public.tipo_movimentacao AS ENUM ('entrada', 'saida');
CREATE TYPE public.tipo_lancamento AS ENUM ('receita', 'despesa');
CREATE TYPE public.status_lancamento AS ENUM ('pendente', 'pago', 'atrasado');
CREATE TYPE public.grupo_despesa AS ENUM ('operacional', 'administrativa', 'frota', 'folha', 'impostos', 'financeira');

-- UPDATED AT
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- EMPRESAS
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  telefone text,
  email text,
  endereco text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- HELPERS
CREATE OR REPLACE FUNCTION public.current_empresa_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.can_finance() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro');
$$;

-- CADASTROS
CREATE TABLE public.materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  unidade public.unidade_medida NOT NULL DEFAULT 'kg',
  preco_compra numeric(14,2) NOT NULL DEFAULT 0,
  preco_venda numeric(14,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  documento text,
  telefone text,
  email text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  documento text,
  telefone text,
  email text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.categorias_despesa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  grupo public.grupo_despesa NOT NULL DEFAULT 'operacional',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ESTOQUE
CREATE TABLE public.movimentacoes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo public.tipo_movimentacao NOT NULL,
  material_id uuid NOT NULL REFERENCES public.materiais(id) ON DELETE RESTRICT,
  fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  quantidade numeric(14,3) NOT NULL,
  valor_total numeric(14,2) NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT current_date,
  observacoes text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FINANCEIRO
CREATE TABLE public.lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo public.tipo_lancamento NOT NULL,
  descricao text NOT NULL,
  categoria_id uuid REFERENCES public.categorias_despesa(id) ON DELETE SET NULL,
  movimentacao_id uuid REFERENCES public.movimentacoes_estoque(id) ON DELETE SET NULL,
  valor numeric(14,2) NOT NULL,
  data_vencimento date NOT NULL DEFAULT current_date,
  data_pagamento date,
  forma_pagamento text,
  status public.status_lancamento NOT NULL DEFAULT 'pendente',
  imposto boolean NOT NULL DEFAULT false,
  anexo_url text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- TRIGGERS updated_at
CREATE TRIGGER t1 BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t2 BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t3 BEFORE UPDATE ON public.materiais FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t4 BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t5 BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t6 BEFORE UPDATE ON public.categorias_despesa FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t7 BEFORE UPDATE ON public.movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER t8 BEFORE UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fornecedores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_despesa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movimentacoes_estoque TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos TO authenticated;
GRANT ALL ON public.empresas, public.profiles, public.user_roles, public.materiais, public.fornecedores, public.clientes, public.categorias_despesa, public.movimentacoes_estoque, public.lancamentos TO service_role;

-- RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias_despesa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_select" ON public.empresas FOR SELECT TO authenticated USING (id = public.current_empresa_id());
CREATE POLICY "empresa_update" ON public.empresas FOR UPDATE TO authenticated USING (id = public.current_empresa_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (id = public.current_empresa_id());

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (empresa_id = public.current_empresa_id());
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(),'admin'))) WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "roles_select" ON public.user_roles FOR SELECT TO authenticated USING (empresa_id = public.current_empresa_id());
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(),'admin')) WITH CHECK (empresa_id = public.current_empresa_id() AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "materiais_all" ON public.materiais FOR ALL TO authenticated USING (empresa_id = public.current_empresa_id()) WITH CHECK (empresa_id = public.current_empresa_id());
CREATE POLICY "fornecedores_all" ON public.fornecedores FOR ALL TO authenticated USING (empresa_id = public.current_empresa_id()) WITH CHECK (empresa_id = public.current_empresa_id());
CREATE POLICY "clientes_all" ON public.clientes FOR ALL TO authenticated USING (empresa_id = public.current_empresa_id()) WITH CHECK (empresa_id = public.current_empresa_id());
CREATE POLICY "categorias_all" ON public.categorias_despesa FOR ALL TO authenticated USING (empresa_id = public.current_empresa_id()) WITH CHECK (empresa_id = public.current_empresa_id());
CREATE POLICY "movimentacoes_all" ON public.movimentacoes_estoque FOR ALL TO authenticated USING (empresa_id = public.current_empresa_id()) WITH CHECK (empresa_id = public.current_empresa_id());

CREATE POLICY "lancamentos_all" ON public.lancamentos FOR ALL TO authenticated USING (empresa_id = public.current_empresa_id() AND public.can_finance()) WITH CHECK (empresa_id = public.current_empresa_id() AND public.can_finance());

-- SIGNUP: cria empresa + perfil + papel admin
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_empresa uuid;
BEGIN
  INSERT INTO public.empresas (razao_social, cnpj, telefone)
  VALUES (
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'empresa_nome',''), 'Minha Empresa'),
    NEW.raw_user_meta_data->>'empresa_cnpj',
    NEW.raw_user_meta_data->>'telefone'
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

  INSERT INTO public.materiais (empresa_id, nome, unidade, preco_compra, preco_venda) VALUES
    (v_empresa,'Papelão','kg',0.45,0.90),
    (v_empresa,'PET','kg',1.20,2.40),
    (v_empresa,'Alumínio','kg',5.50,8.20),
    (v_empresa,'Vidro','kg',0.15,0.35),
    (v_empresa,'Metal ferroso','kg',0.60,1.10);

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();