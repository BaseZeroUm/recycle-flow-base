-- ==============================================================================
-- MIGRATION: 20260925150000_prevent_duplicate_emails.sql
-- OBJETIVO: Impedir e-mails duplicados em public.profiles e no processo de cadastro
-- ==============================================================================

-- 1. Normalização de e-mails existentes em public.profiles
UPDATE public.profiles
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL AND email <> LOWER(TRIM(email));

-- 1.1 Resiliência contra duplicatas prévias: desambigua registros duplicados antigos mantendo o mais recente intacto
WITH duplicados AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(email)) ORDER BY created_at DESC) as rn
  FROM public.profiles
  WHERE email IS NOT NULL
)
UPDATE public.profiles p
SET email = p.email || '_dup_' || substr(p.id::text, 1, 8)
FROM duplicados d
WHERE p.id = d.id AND d.rn > 1;

-- 2. Índice único case-insensitive e sem espaços em public.profiles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_uidx
  ON public.profiles (LOWER(TRIM(email)));

-- 3. Constraint de integridade de formato de e-mail em public.profiles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_not_empty;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_email_not_empty
  CHECK (length(trim(email)) >= 5 AND position('@' in email) > 1 AND position('.' in email) > position('@' in email));

-- 4. Função segura (RPC) para verificar previamente se um e-mail já está cadastrado
CREATE OR REPLACE FUNCTION public.verificar_email_cadastrado(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_normalized text;
  v_exists boolean := false;
BEGIN
  v_normalized := LOWER(TRIM(p_email));
  IF v_normalized IS NULL OR v_normalized = '' THEN
    RETURN false;
  END IF;

  -- 1. Checagem em public.profiles
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(TRIM(email)) = v_normalized
  ) INTO v_exists;

  IF v_exists THEN
    RETURN true;
  END IF;

  -- 2. Checagem em auth.users (caso o perfil ainda não tenha sido gerado ou esteja em confirmação)
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM auth.users WHERE LOWER(TRIM(email)) = v_normalized
    ) INTO v_exists;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback silencioso se auth.users não for acessível na role de execução
    v_exists := false;
  END;

  RETURN COALESCE(v_exists, false);
END;
$$;

REVOKE ALL ON FUNCTION public.verificar_email_cadastrado(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verificar_email_cadastrado(text) TO anon, authenticated, service_role;

-- 5. Atualização do trigger handle_new_user com normalização e checagem defensiva
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
  v_normalized_email text;
BEGIN
  v_normalized_email := LOWER(TRIM(NEW.email));

  -- Impede criação se já houver perfil com o mesmo e-mail normalizado
  IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(TRIM(email)) = v_normalized_email) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS: Este e-mail já está cadastrado.';
  END IF;

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
  VALUES (
    NEW.id,
    v_empresa,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'nome',''), v_normalized_email),
    v_normalized_email
  );

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

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
