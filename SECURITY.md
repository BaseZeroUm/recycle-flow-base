# Política de Segurança e Resposta a Incidentes — Base Zero Um

## 1. Notificação de Vulnerabilidades

A segurança da plataforma e dos dados de nossos clientes é prioridade crítica.
Caso identifique uma potencial vulnerabilidade ou incidente de segurança:

* **Contato de Segurança:** `seguranca@basezeroum.com.br`
* **Prazo de Resposta Inicial:** Até 24 horas úteis.
* **Política de Divulgação Coordenada:** Solicitamos que não divulgue detalhes da vulnerabilidade publicamente antes que a equipe técnica implemente e confirme a correção em produção.

---

## 2. Procedimentos Operacionais de Resposta a Incidentes (Runbook)

### 2.1 Revogação Imediata de Acesso e Sessões (Comprometimento de Conta)
Se uma conta de usuário ou administrador for comprometida:

1. **Desativação Imediata via Banco ou Painel Admin:**
   ```sql
   UPDATE public.profiles
   SET ativo = false,
       desativado_em = now(),
       desativado_motivo = 'Suspeita de comprometimento de credenciais / Incidente de Segurança'
   WHERE id = '<USER_UUID>';
   ```
2. **Invalidação Global de Sessões no Supabase Auth:**
   * No console do Supabase (`Authentication -> Users`), selecione o usuário e acione `Sign out user` / `Revoke session`.
   * O guard `useSessao` / `useSessaoAdmin` no frontend detectará `ativo = false` na próxima requisição e forçará `supabase.auth.signOut({ scope: 'global' })`.

### 2.2 Bloqueio Emergencial de Tenant / Empresa
Se uma empresa inteira precisar ser suspensa por fraude ou violação:
```sql
UPDATE public.empresas
SET ativa = false,
    updated_at = now()
WHERE id = '<EMPRESA_UUID>';
```
Todas as requisições atreladas a esse `empresa_id` serão rejeitadas pelas policies de Row Level Security (RLS) e o login será bloqueado com `TrialGate` / redirecionamento forçado.

### 2.3 Rotação Emergencial de Segredos e Chaves
Em caso de suspeita de vazamento de segredos:

1. **`VITE_SUPABASE_ANON_KEY` / `JWT_SECRET`:**
   * Acessar o Dashboard do Supabase -> Settings -> API.
   * Executar a rotação de `JWT Secret` e `Anon Key`.
   * Atualizar as variáveis de ambiente na Vercel (`Settings -> Environment Variables`) e acionar Redeploy imediato.
2. **`SUPABASE_SERVICE_ROLE_KEY`:**
   * Realizar rotação imediata no painel do Supabase. A `service_role` **nunca** deve ser incluída no frontend.

---

## 3. Política de Backup e Continuidade de Negócios (DRP)

* **Backups Automáticos (Point-in-Time Recovery):** O banco de dados PostgreSQL é gerenciado via Supabase com backups diários automáticos e retenção de WAL (Write-Ahead Logging) para restauração pontual.
* **Isolamento de Backups:** Não é permitido salvar arquivos de dump (`.sql`, `.dump`, `.bak`) dentro do repositório Git ou em buckets públicos de armazenamento.
* **Auditoria de Integridade:** As migrações de schema DDL são versionadas estritamente sob `supabase/migrations/` e revisadas antes da aplicação em produção.
