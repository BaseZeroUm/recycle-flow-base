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
    ALTER TABLE public.materiais ADD CONSTRAINT chk_materiais_unidade_len CHECK (unidade IS NULL OR char_length(unidade) <= 20);
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

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_lancamentos_observacoes_len') THEN
    ALTER TABLE public.lancamentos ADD CONSTRAINT chk_lancamentos_observacoes_len CHECK (observacoes IS NULL OR char_length(observacoes) <= 2000);
  END IF;

  -- 7. CAIXA MOVIMENTOS
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_caixa_movimentos_descricao_len') THEN
    ALTER TABLE public.caixa_movimentos ADD CONSTRAINT chk_caixa_movimentos_descricao_len CHECK (char_length(descricao) <= 500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_caixa_movimentos_observacoes_len') THEN
    ALTER TABLE public.caixa_movimentos ADD CONSTRAINT chk_caixa_movimentos_observacoes_len CHECK (observacoes IS NULL OR char_length(observacoes) <= 2000);
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

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_profiles_telefone_len') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT chk_profiles_telefone_len CHECK (telefone IS NULL OR char_length(telefone) <= 50);
  END IF;

END $$;
