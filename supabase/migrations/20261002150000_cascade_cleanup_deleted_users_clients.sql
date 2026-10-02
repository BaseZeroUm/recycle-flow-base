-- ==============================================================================
-- MIGRATION: 20261002150000_cascade_cleanup_deleted_users_clients.sql
-- SINCRONIZAÇÃO E INTEGRIDADE DE EXCLUSÃO DE CLIENTES / USUÁRIOS NO BANCO
-- 
-- OBJETIVO:
-- 1. Quando um usuário ou cliente for excluído DIRETAMENTE no banco de dados
--    (em auth.users ou public.empresas), ele NÃO deve mais aparecer no painel admin.
-- 2. Limpar registros órfãos residuais de testes anteriores.
-- 3. Configurar ON DELETE CASCADE entre auth.users, public.profiles e public.empresas.
-- 4. Criar trigger para remoção de empresa órfã quando o único usuário for deletado.
-- 5. MANTER A POLÍTICA LGPD (5 ANOS): A desativação de conta via painel admin continua
--    sendo um soft-delete (ativo = false, desativado_em = now(), exclusao_programada_para),
--    preservando os dados no banco durante o prazo legal de 5 anos.
-- ==============================================================================

BEGIN;

-- 1. LIMPEZA DE DADOS ÓRFÃOS EXISTENTES (CLIENTES / USUÁRIOS TESTE JÁ DELETADOS NO BANCO)
-- 1.1 Remove perfis de usuários que foram deletados de auth.users mas ficaram órfãos em profiles
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- 1.2 Remove papéis órfãos que porventura não tenham sido removidos
DELETE FROM public.user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 1.3 Remove atividades órfãs
DELETE FROM public.user_activity_daily
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 1.4 Remove perfis vinculados a empresas que já foram deletadas
DELETE FROM public.profiles
WHERE empresa_id IS NOT NULL 
  AND empresa_id NOT IN (SELECT id FROM public.empresas);

-- 1.5 Remove empresas que ficaram órfãs (sem nenhum perfil/usuário vinculado)
-- Exceto empresas do sistema/admin
DELETE FROM public.empresas e
WHERE e.categoria <> 'admin'
  AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.empresa_id = e.id);

-- 2. INTEGRIDADE REFERENCIAL: PROFILES -> AUTH.USERS (ON DELETE CASCADE)
-- Garante que se o admin/desenvolvedor excluir um usuário em auth.users, o profile é excluído automaticamente
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS fk_profiles_auth_users,
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_auth_users
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. INTEGRIDADE REFERENCIAL: PROFILES -> EMPRESAS (ON DELETE CASCADE)
-- Se uma empresa cliente for excluída diretamente no banco, seus perfis associados são removidos em cascata
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_empresa_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

-- 4. TRIGGER: LIMPEZA DE EMPRESA ÓRFÃ AO EXCLUIR O PERFIL / USUÁRIO TESTE
-- Quando um usuário de teste for deletado em auth.users, o cascade acima deleta seu profile.
-- Se a empresa cliente não possuir mais nenhum outro usuário vinculado e não for categoria 'admin',
-- ela também é limpa automaticamente para não poluir o painel de administração.
CREATE OR REPLACE FUNCTION public.handle_profile_deleted_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.empresa_id IS NOT NULL THEN
    -- Verifica se ainda resta algum perfil ativo para a mesma empresa
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE empresa_id = OLD.empresa_id AND id <> OLD.id
    ) THEN
      -- Se não há mais usuários e a empresa não é administrativa master, remove a empresa
      DELETE FROM public.empresas 
      WHERE id = OLD.empresa_id 
        AND categoria <> 'admin';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_orphan_empresa ON public.profiles;
CREATE TRIGGER trg_cleanup_orphan_empresa
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_deleted_cleanup();

COMMIT;
