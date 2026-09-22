# ♻️ Base 01: Recicle & Gerencie (`recycle-flow-base`)

> **Repositório Oficial:** [BaseZeroUm/recycle-flow-base](https://github.com/BaseZeroUm/recycle-flow-base)  
> **Editor no Lovable:** [Projeto Lovable](https://lovable.dev/projects/a00e5eff-1eaf-4b2c-9457-10761441ed82)  
> **Live App (Staging/Lovable):** [recycle-flow-base.lovable.app](https://recycle-flow-base.lovable.app)  
> **Domínio de Produção:** `reciclagem.basezeroum.com.br` (ou `app.basezeroum.com.br`)  
> **Stack Principal:** TanStack Start (SSR), React 19, TypeScript, Tailwind CSS v4, Supabase (Auth + PostgreSQL RLS Multi-Tenant)

---

## 📌 Visão Geral do Produto & Arquitetura

O **Base 01 Recicle & Gerencie** é um sistema web SaaS **multiempresa (multi-tenant)** projetado especificamente para a gestão operacional e financeira de empresas do setor de reciclagem, aparas e sucatas.

Além de sua função operacional primária, este projeto atua como o **Hub Central de Autenticação e Roteamento** do ecossistema Base Zero Um:
1. **Isolamento Total por Empresa (RLS):** Cada cliente possui sua empresa cadastrada (`empresa_id`) e só enxerga os seus próprios dados (materiais, clientes, fornecedores, estoque, balança e finanças).
2. **Login Centralizado Inteligente:** A rota `/auth` valida o usuário no Supabase Auth e, com base na `categoria` da empresa (`reciclagem`, `adega`, `admin`), direciona o usuário para o sistema correto.
3. **Sessão Unificada entre Subdomínios (SSO):** Utiliza cookies com escopo `.basezeroum.com.br`, permitindo que um usuário logado transite entre os sistemas sem refazer login.
4. **Controle de Período de Avaliação (Trial Engine):** Regras de expiração de teste gratuito (`trial_ate` e `assinatura_ativa`) com telas dedicadas de bloqueio e renovação (`/trial-expirado` e `/assinatura`).

---

## 🗺️ Matriz Geral de Configuração: Links, Fases e Dados a Captar

Abaixo está o guia detalhado de todos os serviços, links de painéis, dados que devem ser extraídos e onde devem ser inseridos:

| Fase | Serviço / Plataforma | Link Direto do Console / Painel | O Que Captar / Gerar Nesse Link | Onde Configurar no Projeto |
| :--- | :--- | :--- | :--- | :--- |
| **Fase 1** | **Lovable Editor** | [lovable.dev/projects/a00e5eff...](https://lovable.dev/projects/a00e5eff-1eaf-4b2c-9457-10761441ed82) | • Acesso de edição visual e prompts<br>• Variáveis de ambiente de deploy (Secrets) | Lovable Project Settings → Environment Variables |
| **Fase 1** | **GitHub** | [github.com/BaseZeroUm/recycle-flow-base](https://github.com/BaseZeroUm/recycle-flow-base) | • Clone do repositório remoto<br>• Token de Acesso / SSH | Ambiente de desenvolvimento local |
| **Fase 2** | **Supabase (API Settings)** | [supabase.com/dashboard/project/vqemjfcfeizgcnpihyve/settings/api](https://supabase.com/dashboard/project/vqemjfcfeizgcnpihyve/settings/api) | • `Project URL`<br>• `anon / publishable key`<br>• `service_role key` (privada) | `.env` e Lovable Secrets:<br>`SUPABASE_URL`<br>`SUPABASE_PUBLISHABLE_KEY`<br>`SUPABASE_SERVICE_ROLE_KEY` |
| **Fase 2** | **Supabase (SQL Editor)** | [supabase.com/dashboard/project/vqemjfcfeizgcnpihyve/sql](https://supabase.com/dashboard/project/vqemjfcfeizgcnpihyve/sql) | • Execução de schemas DDL<br>• Triggers de numeração de ticket de pesagem<br>• Políticas RLS por `empresa_id` | `supabase/migrations/` |
| **Fase 3** | **Supabase Auth (Settings)** | [supabase.com/dashboard/project/vqemjfcfeizgcnpihyve/auth/url-configuration](https://supabase.com/dashboard/project/vqemjfcfeizgcnpihyve/auth/url-configuration) | • `Site URL`: URL de produção<br>• `Redirect URLs`: URLs de retorno permitidas (ex: `http://localhost:5173/**`, `https://reciclagem.basezeroum.com.br/**`) | Painel do Supabase Auth > URL Configuration |
| **Fase 3** | **Templates de Email Auth** | [supabase.com/dashboard/project/vqemjfcfeizgcnpihyve/auth/templates](https://supabase.com/dashboard/project/vqemjfcfeizgcnpihyve/auth/templates) | • Link de redefinição de senha com fragmento `#type=recovery`<br>• Remetente de e-mail | Supabase Auth > Email Templates (Reset Password) |
| **Fase 4** | **DNS & Subdomínio** | Cloudflare / Registro.br / Vercel DNS | • Apontamento `CNAME` para `reciclagem.basezeroum.com.br`<br>• Configuração de SSL/TLS | Painel de DNS do domínio `basezeroum.com.br` |
| **Fase 5** | **Assinaturas & Checkout** | Gateway de Pagamento (Asaas, Stripe, etc.) | • Links de checkout dos planos (`Mensal`, `Trimestral`, `Anual`)<br>• Webhook para atualizar `assinatura_ativa = true` | `src/routes/assinatura.tsx` |
| **Fase 6** | **Operação & Impressão** | Configurações do Navegador / Sistema | • Formato de impressão de tickets (térmica de 80mm ou padrão A4) | `src/lib/impressao.ts` e tela `/estoque` |

---

## 🛠️ Detalhamento Passo a Passo por Fases

---

### 🔹 Fase 1: Conexão Lovable & Repositório GitHub

1. **Repositório GitHub:**
   - Link: [https://github.com/BaseZeroUm/recycle-flow-base](https://github.com/BaseZeroUm/recycle-flow-base)
2. **Sincronização com Lovable:**
   - Link do projeto: [https://lovable.dev/projects/a00e5eff-1eaf-4b2c-9457-10761441ed82](https://lovable.dev/projects/a00e5eff-1eaf-4b2c-9457-10761441ed82)
   - ⚠️ **ATENÇÃO CRÍTICA (Regra de Histórico Git):** Nunca reescreva o histórico do Git (`git push --force`, `rebase`, `amend` ou `squash` de commits já publicados). Isso quebra o rastreamento interno do Lovable e pode fazer você perder o histórico do projeto.

---

### 🔹 Fase 2: Banco de Dados & RLS Multi-Tenant (Supabase)

O banco de dados do sistema reside no projeto Supabase da aplicação:
* **Dashboard do Projeto:** `https://supabase.com/dashboard/project/vqemjfcfeizgcnpihyve`

#### 1. O que captar no painel:
Acesse **Project Settings** > **API**:
- `Project URL`: `https://vqemjfcfeizgcnpihyve.supabase.co`
- `Publishable / anon key`: `sb_publishable_S5GyyviR8rjNCvN4AJrTjA_LAF8XJOP`
- `service_role (secret)`: Token administrativo de backend.

#### 2. Tabelas e Isolamento por RLS:
Todas as tabelas de negócio possuem a coluna `empresa_id` e a função auxiliar `current_empresa_id()` para garantir que nenhum cliente visualize dados de outra empresa:

```sql
-- Função helper para recuperar a empresa do usuário autenticado
CREATE OR REPLACE FUNCTION public.current_empresa_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid();
$$;

-- Exemplo da política de segurança aplicada em todas as tabelas:
ALTER TABLE public.movimentacoes_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "movimentacoes_empresa" ON public.movimentacoes_estoque
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id())
  WITH CHECK (empresa_id = public.current_empresa_id());
```

#### 3. Numeração Sequencial Automática de Tickets:
Para evitar que tickets de pesagem colidam entre diferentes empresas, existe uma trigger dedicada (`t_numero_ticket`) que gera uma numeração sequencial iniciada em 1 para cada `empresa_id`:
```sql
CREATE OR REPLACE FUNCTION public.set_numero_ticket()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.numero_ticket IS NULL THEN
    SELECT COALESCE(MAX(numero_ticket), 0) + 1 INTO NEW.numero_ticket
    FROM public.movimentacoes_estoque
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END; $$;
```

---

### 🔹 Fase 3: Autenticação, Perfis e Redirecionamento de Senha

1. **Configuração de URLs no Supabase Auth:**
   - Acesse **Auth** > **URL Configuration**:
     - **Site URL:** `https://reciclagem.basezeroum.com.br` (ou `https://recycle-flow-base.lovable.app`)
     - **Redirect URLs:** Adicione:
       - `http://localhost:5173/**`
       - `https://reciclagem.basezeroum.com.br/**`
       - `https://recycle-flow-base.lovable.app/**`
2. **Fluxo de Recuperação de Senha:**
   - O e-mail de recuperação dispara um link com hash `#type=recovery`.
   - Ao acessar, a rota [auth.tsx](file:///c:/Users/brend/Desktop/Projetos%20Open%20Source/recycle-flow-base/src/routes/auth.tsx) intercepta esse evento e redireciona imediatamente para [redefinir-senha.tsx](file:///c:/Users/brend/Desktop/Projetos%20Open%20Source/recycle-flow-base/src/routes/redefinir-senha.tsx), onde a nova senha é validada pelo componente de requisitos de segurança.
3. **Perfis de Usuário (`user_roles`):**
   - **`admin`:** Acesso completo a cadastros, estoque, financeiro, DRE, fluxos de caixa e gestão de colaboradores.
   - **`financeiro`:** Lançamentos de contas a pagar/receber, conciliação bancária, DRE e relatórios.
   - **`operacional`:** Lançamentos de pesagem, tickets de balança, triagem/beneficiamento e saídas de estoque (sem acesso aos relatórios de faturamento e DRE).

---

### 🔹 Fase 4: Sessão Única (SSO) & Domínios do Ecossistema

Para que a experiência seja fluida entre a Landing Page (`basezeroum.com.br`), o SaaS de Reciclagem (`reciclagem.basezeroum.com.br`) e futuros módulos:
1. **Configuração de Cookies Compartilhados:**
   - Em [src/integrations/supabase/client.ts](file:///c:/Users/brend/Desktop/Projetos%20Open%20Source/recycle-flow-base/src/integrations/supabase/client.ts), os cookies de sessão são emitidos para `.basezeroum.com.br`.
2. **Roteamento Inteligente por Categoria:**
   - Após autenticar, o sistema consulta a coluna `categoria` da empresa:
     - `reciclagem`: direciona para `/painel`.
     - `adega`: redireciona para `https://adega.basezeroum.com.br`.
     - `admin`: redireciona para `https://admin.basezeroum.com.br`.

---

### 🔹 Fase 5: Gestão de Planos e Período de Teste (Trial Engine)

1. **Campos de Controle na Tabela `empresas`:**
   - `trial_ate` (timestamptz): Data limite do teste gratuito (geralmente 7 ou 14 dias após o cadastro).
   - `assinatura_ativa` (boolean): `true` se a empresa possui assinatura regular paga.
   - `plano` (text): Nome do plano contratado (`mensal`, `trimestral`, `anual`).
2. **Bloqueio Automático:**
   - Se `trial_ate` expirou e `assinatura_ativa = false`, o usuário é redirecionado para a rota `/trial-expirado`.
3. **Testes Automatizados de Trial:**
   - O projeto conta com testes unitários cobrindo as regras de trial:
   ```bash
   npm run test
   ```

---

### 🔹 Fase 6: Módulos Operacionais e Financeiros

1. **Balança e Estoque (`/estoque`):**
   - Registro de peso bruto, tara e cálculo automático de peso líquido.
   - Agrupamento de itens por `tickets` com vínculo ao fornecedor ou cliente.
   - Emissão e impressão de ticket térmico/comprovante com dados da empresa e motorista.
2. **Produção / Transformação (`/producao`):**
   - Lançamento de triagem e prensagem de fardos (consumo de sucata mista -> geração de material prensado).
3. **Caixa do Pátio (`/caixa`):**
   - Abertura de caixa diário, aportes de dinheiro para compra de material avulso de catadores, sangrias e conciliação de fechamento.
4. **Financeiro & DRE (`/financeiro`, `/fluxo-de-caixa`, `/dre`):**
   - Contas a pagar/receber com baixa por forma de pagamento (PIX, Dinheiro, Transferência).
   - DRE gerada em tempo real: Receita Bruta, Deduções, Custo do Material Vendido (CMV), Despesas Operacionais e Resultado Líquido.

---

## 💻 Ambiente de Desenvolvimento Local

### 1. Pré-requisitos
- **Node.js**: Versão 20+
- **npm** ou **bun**

### 2. Instalação e Execução
```bash
# 1. Clonar o repositório
git clone https://github.com/BaseZeroUm/recycle-flow-base.git
cd recycle-flow-base

# 2. Instalar dependências
npm install

# 3. Rodar em modo desenvolvimento
npm run dev

# 4. Rodar testes automatizados do motor de trial
npm run test
```

### 3. Variáveis de Ambiente (`.env`)

Crie o arquivo `.env` na raiz do projeto:

```env
# ============================================================
# Supabase Configuration
# ============================================================
SUPABASE_PROJECT_ID="vqemjfcfeizgcnpihyve"
SUPABASE_URL="https://vqemjfcfeizgcnpihyve.supabase.co"
SUPABASE_PUBLISHABLE_KEY="sb_publishable_S5GyyviR8rjNCvN4AJrTjA_LAF8XJOP"

# Chave secreta de serviço (apenas no ambiente seguro do servidor/Lovable)
SUPABASE_SERVICE_ROLE_KEY="sb_secret_SUA_CHAVE_SERVICE_ROLE_AQUI"

# Variáveis expostas no bundle do cliente Vite
VITE_SUPABASE_PROJECT_ID="vqemjfcfeizgcnpihyve"
VITE_SUPABASE_URL="https://vqemjfcfeizgcnpihyve.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_S5GyyviR8rjNCvN4AJrTjA_LAF8XJOP"
```

---

## 📂 Estrutura do Código-Fonte

```text
recycle-flow-base/
├── src/
│   ├── components/            # Componentes visuais (Modais de ticket, tabelas, cards)
│   ├── integrations/
│   │   └── supabase/          # Clientes do Supabase (com cookies .basezeroum.com.br)
│   ├── lib/
│   │   ├── caixa.ts           # Cálculos e validações de livro caixa
│   │   ├── impressao.ts       # Layout e utilitário de impressão de tickets de pesagem
│   │   ├── trial.ts           # Regras de negócio de período de teste e expiração
│   │   ├── trial.test.ts      # Testes automatizados do motor de trial
│   │   └── password-validator.ts # Validação de senhas fortes
│   └── routes/                # Rotas da aplicação (TanStack Router)
│       ├── _authenticated/    # Rotas protegidas (exigem login)
│       │   ├── painel.tsx     # Dashboard geral com cards de estoque e faturamento
│       │   ├── cadastros.tsx  # Materiais, Fornecedores, Clientes e Categorias
│       │   ├── estoque.tsx    # Balança, tickets de pesagem e saldo de materiais
│       │   ├── producao.tsx   # Triagem, enfardamento e transformação
│       │   ├── caixa.tsx      # Livro caixa do pátio (abertura, sangria, fechamento)
│       │   ├── financeiro.tsx # Contas a pagar e a receber
│       │   ├── fluxo-de-caixa.tsx # Entradas e saídas no tempo
│       │   ├── dre.tsx        # Demonstração do Resultado do Exercício
│       │   ├── empresa.tsx    # Dados da empresa, CNPJ e logo para o ticket
│       │   └── usuarios.tsx   # Gestão de usuários e permissões da equipe
│       ├── auth.tsx           # Tela de login, cadastro e roteador por segmento
│       ├── redefinir-senha.tsx# Alteração segura de senha
│       ├── assinatura.tsx     # Escolha e contratação de planos
│       └── trial-expirado.tsx # Tela de bloqueio quando o período gratuito acaba
├── supabase/
│   └── migrations/            # Scripts SQL (tabelas, triggers, RLS, enums)
└── AGENTS.md                  # Regras de convivência com o Lovable
```

---

## 🛡️ Políticas de Git e Lovable

- **Sincronia Automática:** O repositório está conectado ao Lovable. Qualquer alteração enviada para a branch `main` é refletida imediatamente no editor.
- **Histórico Intacto:** Nunca use comandos que alterem commits já enviados (`git push -f`, `rebase`).
