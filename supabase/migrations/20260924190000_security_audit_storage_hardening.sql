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

    -- 1. Habilitar e forçar RLS nas tabelas do storage
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
      EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
      EXECUTE 'ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
      EXECUTE 'ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY';
      EXECUTE 'ALTER TABLE storage.buckets FORCE ROW LEVEL SECURITY';
    END IF;

    -- 2. Revogar privilégios diretos da role 'anon' no storage
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA storage FROM anon';
    EXECUTE 'REVOKE ALL ON ALL ROUTINES IN SCHEMA storage FROM anon';

    -- 3. Remover policies permissivas perigosas conhecidas (caso tenham sido criadas via dashboard)
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public Access') THEN
      EXECUTE 'DROP POLICY "Public Access" ON storage.objects';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow All') THEN
      EXECUTE 'DROP POLICY "Allow All" ON storage.objects';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload') THEN
      EXECUTE 'DROP POLICY "Authenticated users can upload" ON storage.objects';
    END IF;

    -- 4. Criar política defensiva base para isolamento multi-tenant por empresa_id
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
