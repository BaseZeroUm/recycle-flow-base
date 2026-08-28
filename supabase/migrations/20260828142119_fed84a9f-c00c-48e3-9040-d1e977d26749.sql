CREATE TABLE public.categorias_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_material TO authenticated;
GRANT ALL ON public.categorias_material TO service_role;

ALTER TABLE public.categorias_material ENABLE ROW LEVEL SECURITY;

CREATE POLICY categorias_material_all ON public.categorias_material
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());

CREATE TRIGGER t9 BEFORE UPDATE ON public.categorias_material
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE UNIQUE INDEX categorias_material_empresa_nome_idx
  ON public.categorias_material (empresa_id, lower(nome));

ALTER TABLE public.materiais
  ADD COLUMN categoria_material_id uuid REFERENCES public.categorias_material(id) ON DELETE SET NULL;

CREATE INDEX materiais_categoria_material_idx ON public.materiais (categoria_material_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid;
  v_plastico uuid;
  v_papel uuid;
  v_metal uuid;
  v_vidro uuid;
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