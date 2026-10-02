-- ==============================================================================
-- MIGRATION: 20261002160000_setup_adega_segment.sql
-- CONFIGURAÇÃO E CONEXÃO DO MÓDULO ADEGA NO BANCO DE DADOS (SUPABASE)
--
-- OBJETIVO:
-- 1. Expandir o enum unidade_medida para suportar bebidas e produtos de adega
--    ('un', 'garrafa', 'lata', 'fardo', 'cx', 'dose', 'l').
-- 2. Atualizar handle_new_user() para inicializar categorias e catálogo de produtos
--    personalizados quando a empresa pertencer ao segmento 'adega'.
-- 3. Procedure/Script auxiliar para popular categorias e catálogo padrão nas
--    empresas de adega já existentes que ainda não possuem produtos cadastrados.
-- ==============================================================================

-- 1. EXPANSÃO DO ENUM DE UNIDADES DE MEDIDA (BEBIDAS E PRODUTOS DE ADEGA)
DO $$
BEGIN
  ALTER TYPE public.unidade_medida ADD VALUE IF NOT EXISTS 'un';
  ALTER TYPE public.unidade_medida ADD VALUE IF NOT EXISTS 'garrafa';
  ALTER TYPE public.unidade_medida ADD VALUE IF NOT EXISTS 'lata';
  ALTER TYPE public.unidade_medida ADD VALUE IF NOT EXISTS 'fardo';
  ALTER TYPE public.unidade_medida ADD VALUE IF NOT EXISTS 'cx';
  ALTER TYPE public.unidade_medida ADD VALUE IF NOT EXISTS 'dose';
  ALTER TYPE public.unidade_medida ADD VALUE IF NOT EXISTS 'l';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. ATUALIZAR TRIGGER FUNCTION handle_new_user() PARA ADEGA E RECICLAGEM
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_empresa uuid;
  v_cat1 uuid;
  v_cat2 uuid;
  v_cat3 uuid;
  v_cat4 uuid;
  v_cat5 uuid;
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

  -- Categorias e produtos conforme o segmento
  IF v_categoria = 'adega' THEN
    -- Categorias de Despesa da Adega
    INSERT INTO public.categorias_despesa (empresa_id, nome, grupo) VALUES
      (v_empresa, 'Bebidas e Mercadorias', 'operacional'),
      (v_empresa, 'Operacional e Loja', 'operacional'),
      (v_empresa, 'Funcionários e Atendimento', 'folha'),
      (v_empresa, 'Impostos e Maquininhas', 'impostos'),
      (v_empresa, 'Marketing e Divulgação', 'administrativa'),
      (v_empresa, 'Despesas Financeiras', 'financeira');

    -- Categorias de Produtos da Adega
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Vinhos') RETURNING id INTO v_cat1;
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Cervejas') RETURNING id INTO v_cat2;
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Destilados') RETURNING id INTO v_cat3;
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Não Alcoólicos') RETURNING id INTO v_cat4;
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Gelo e Carvão') RETURNING id INTO v_cat5;

    -- Produtos Iniciais da Adega
    INSERT INTO public.materiais (empresa_id, nome, unidade, preco_compra, preco_venda, categoria_material_id) VALUES
      (v_empresa, 'Vinho Tinto Cabernet 750ml', 'un', 32.00, 65.00, v_cat1),
      (v_empresa, 'Vinho Branco Sauvignon Blanc 750ml', 'un', 28.00, 58.00, v_cat1),
      (v_empresa, 'Cerveja Heineken Long Neck 330ml', 'un', 5.50, 11.00, v_cat2),
      (v_empresa, 'Cerveja Corona Extra 330ml', 'un', 5.80, 12.00, v_cat2),
      (v_empresa, 'Cerveja Spaten Lata 350ml', 'un', 3.20, 6.50, v_cat2),
      (v_empresa, 'Whisky Red Label 1L', 'un', 75.00, 139.00, v_cat3),
      (v_empresa, 'Gin Tanqueray London Dry 750ml', 'un', 78.00, 145.00, v_cat3),
      (v_empresa, 'Vodka Absolut 750ml', 'un', 58.00, 109.00, v_cat3),
      (v_empresa, 'Energético Red Bull 250ml', 'un', 6.20, 13.00, v_cat4),
      (v_empresa, 'Refrigerante Coca-Cola Lata 350ml', 'un', 2.80, 6.00, v_cat4),
      (v_empresa, 'Água Mineral sem Gás 500ml', 'un', 1.30, 4.00, v_cat4),
      (v_empresa, 'Gelo em Cubos 5kg', 'un', 8.00, 18.00, v_cat5);

  ELSE
    -- Categorias de Despesa da Reciclagem (Padrão)
    INSERT INTO public.categorias_despesa (empresa_id, nome, grupo) VALUES
      (v_empresa, 'Administrativa', 'administrativa'),
      (v_empresa, 'Operacional', 'operacional'),
      (v_empresa, 'Frota', 'frota'),
      (v_empresa, 'Folha de pagamento', 'folha'),
      (v_empresa, 'Impostos', 'impostos'),
      (v_empresa, 'Despesas financeiras', 'financeira');

    -- Categorias de Materiais da Reciclagem
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Plástico') RETURNING id INTO v_cat1;
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Papel') RETURNING id INTO v_cat2;
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Metal') RETURNING id INTO v_cat3;
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Vidro') RETURNING id INTO v_cat4;
    INSERT INTO public.categorias_material (empresa_id, nome) VALUES (v_empresa, 'Outros') RETURNING id INTO v_cat5;

    -- Materiais Iniciais da Reciclagem
    INSERT INTO public.materiais (empresa_id, nome, unidade, preco_compra, preco_venda, categoria_material_id) VALUES
      (v_empresa, 'PET', 'kg', 1.20, 2.40, v_cat1),
      (v_empresa, 'PEAD', 'kg', 1.00, 2.00, v_cat1),
      (v_empresa, 'PP', 'kg', 0.90, 1.80, v_cat1),
      (v_empresa, 'Papelão', 'kg', 0.45, 0.90, v_cat2),
      (v_empresa, 'Alumínio', 'kg', 5.50, 8.20, v_cat3),
      (v_empresa, 'Metal ferroso', 'kg', 0.60, 1.10, v_cat3),
      (v_empresa, 'Vidro', 'kg', 0.15, 0.35, v_cat4);
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. INICIALIZAR CATÁLOGO EM EMPRESAS DE ADEGA EXISTENTES QUE ESTEJAM SEM PRODUTOS
DO $$
DECLARE
  r RECORD;
  v_c1 uuid;
  v_c2 uuid;
  v_c3 uuid;
  v_c4 uuid;
  v_c5 uuid;
BEGIN
  FOR r IN SELECT id FROM public.empresas WHERE categoria = 'adega' LOOP
    -- Se a empresa de adega ainda não possui materiais/produtos cadastrados
    IF NOT EXISTS (SELECT 1 FROM public.materiais WHERE empresa_id = r.id) THEN
      -- Cria categorias se não existirem
      SELECT id INTO v_c1 FROM public.categorias_material WHERE empresa_id = r.id AND nome = 'Vinhos' LIMIT 1;
      IF v_c1 IS NULL THEN
        INSERT INTO public.categorias_material (empresa_id, nome) VALUES (r.id, 'Vinhos') RETURNING id INTO v_c1;
      END IF;

      SELECT id INTO v_c2 FROM public.categorias_material WHERE empresa_id = r.id AND nome = 'Cervejas' LIMIT 1;
      IF v_c2 IS NULL THEN
        INSERT INTO public.categorias_material (empresa_id, nome) VALUES (r.id, 'Cervejas') RETURNING id INTO v_c2;
      END IF;

      SELECT id INTO v_c3 FROM public.categorias_material WHERE empresa_id = r.id AND nome = 'Destilados' LIMIT 1;
      IF v_c3 IS NULL THEN
        INSERT INTO public.categorias_material (empresa_id, nome) VALUES (r.id, 'Destilados') RETURNING id INTO v_c3;
      END IF;

      SELECT id INTO v_c4 FROM public.categorias_material WHERE empresa_id = r.id AND nome = 'Não Alcoólicos' LIMIT 1;
      IF v_c4 IS NULL THEN
        INSERT INTO public.categorias_material (empresa_id, nome) VALUES (r.id, 'Não Alcoólicos') RETURNING id INTO v_c4;
      END IF;

      SELECT id INTO v_c5 FROM public.categorias_material WHERE empresa_id = r.id AND nome = 'Gelo e Carvão' LIMIT 1;
      IF v_c5 IS NULL THEN
        INSERT INTO public.categorias_material (empresa_id, nome) VALUES (r.id, 'Gelo e Carvão') RETURNING id INTO v_c5;
      END IF;

      -- Produtos de Bebidas Iniciais
      INSERT INTO public.materiais (empresa_id, nome, unidade, preco_compra, preco_venda, categoria_material_id) VALUES
        (r.id, 'Vinho Tinto Cabernet 750ml', 'un', 32.00, 65.00, v_c1),
        (r.id, 'Vinho Branco Sauvignon Blanc 750ml', 'un', 28.00, 58.00, v_c1),
        (r.id, 'Cerveja Heineken Long Neck 330ml', 'un', 5.50, 11.00, v_c2),
        (r.id, 'Cerveja Corona Extra 330ml', 'un', 5.80, 12.00, v_c2),
        (r.id, 'Cerveja Spaten Lata 350ml', 'un', 3.20, 6.50, v_c2),
        (r.id, 'Whisky Red Label 1L', 'un', 75.00, 139.00, v_c3),
        (r.id, 'Gin Tanqueray London Dry 750ml', 'un', 78.00, 145.00, v_c3),
        (r.id, 'Vodka Absolut 750ml', 'un', 58.00, 109.00, v_c3),
        (r.id, 'Energético Red Bull 250ml', 'un', 6.20, 13.00, v_c4),
        (r.id, 'Refrigerante Coca-Cola Lata 350ml', 'un', 2.80, 6.00, v_c4),
        (r.id, 'Água Mineral sem Gás 500ml', 'un', 1.30, 4.00, v_c4),
        (r.id, 'Gelo em Cubos 5kg', 'un', 8.00, 18.00, v_c5);
    END IF;
  END LOOP;
END $$;
