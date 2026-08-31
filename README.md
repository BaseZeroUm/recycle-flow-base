# Base 01: Recicle & Gerencie

Especificação — Sistema de Gestão para Empresas de Reciclagem (Base 01)

Documento pronto para colar no Lovable como prompt inicial de construção do projeto. Ajuste as seções marcadas com [AJUSTAR] conforme a necessidade real do negócio.

1. Visão geral do produto

Construir um sistema web (SaaS multiempresa) chamado Base 01, para gestão operacional e financeira de empresas do setor de reciclagem. Cada empresa cliente possui sua própria conta, com login e senha próprios, e enxerga apenas os seus dados (isolamento total entre empresas — multi-tenant).

O sistema deve permitir:

Cadastro e login de empresas (contas) e de usuários dentro de cada empresa, com perfis de acesso distintos.

Lançamento de receitas e despesas (financeiro).

Controle de estoque de materiais recicláveis (entrada por compra/coleta, saída por venda).

Dashboards de análise: faturamento, estoque, indicadores operacionais.

Fluxo de caixa.

DRE (Demonstração do Resultado do Exercício) gerada automaticamente a partir dos lançamentos.

Identidade visual da marca Base 01 aplicada em toda a interface.

2. Identidade visual — Base 01

Já existe o logo oficial da marca (anexar os arquivos de imagem ao prompt do Lovable). Ele consiste em um ícone geométrico abstrato (padrão tipo "01"/circuito) com gradiente de azul para verde-água, disponível em:

versão ícone isolado, para fundo claro;

versão ícone isolado, para fundo escuro;

versão ícone + nome "01"/"Base 01" por extenso, para fundo claro;

versão ícone + nome, para fundo escuro.

Usar essa identidade como base para todo o design system do sistema:

Paleta principal: gradiente azul → verde-água do logo (aprox. azul #4FA8DE/#4EC3E0 a verde-menta #7FD1A8/#8FD9B4), aplicado em elementos de destaque (botões primários, gráficos, ícone ativo do menu, cabeçalhos de cards).

Fundo claro (tema padrão): branco/cinza muito claro, com o logo na versão "fundo claro".

Fundo escuro (opcional, dark mode): cinza-grafite/azul-marinho escuro, com o logo na versão "fundo escuro".

Cores neutras de apoio: cinza-grafite para texto, cinza-claro para bordas/divisores.

Tipografia: sans-serif moderna e legível (ex: Inter, Manrope), combinando com o estilo geométrico e limpo do ícone.

Estilo geral: interface limpa, tipo SaaS de gestão (dashboards com cards, gráficos, tabelas), usando o gradiente do logo com moderação — como acento, não em fundos inteiros — para manter legibilidade.

Aplicação do logo: ícone isolado no topo do menu lateral (colapsado) e favicon; versão com nome completo na tela de login e no cabeçalho quando o menu está expandido.

3. Modelo de acesso e multiempresa (multi-tenant)

O sistema é multiempresa (multi-tenant): várias empresas de reciclagem usam o mesmo sistema Base 01, mas cada uma tem seus dados completamente isolados (nenhuma empresa vê dados de outra).

Cada empresa possui uma conta própria, criada via cadastro (nome da empresa, CNPJ, dados de contato, responsável).

Dentro de cada empresa, podem existir múltiplos usuários, cada um com login e senha próprios, vinculados àquela empresa.

Autenticação: e-mail + senha, com opção de recuperação de senha.

[AJUSTAR] Definir se haverá um painel de "super admin" (da Base 01) para gerenciar todas as empresas clientes (ativar/desativar contas, ver métricas de uso, suporte).

3.1 Perfis de usuário (papéis) dentro de cada empresa

Perfil Permissões Admin (dono/gestor) Acesso total: cadastros, financeiro, estoque, dashboards, DRE, gestão de usuários da própria empresa Financeiro Lançamento de receitas/despesas, fluxo de caixa, DRE, relatórios financeiros — sem acesso a gestão de usuários Operacional Lançamento de entrada/saída de estoque (pesagem, compra, venda de material), sem acesso a dados financeiros sensíveis

[AJUSTAR] Caso o negócio precise de perfis diferentes ou de permissões mais granulares (por exemplo, acesso somente-leitura para investidores/contador), detalhar aqui.

4. Módulos do sistema

4.1 Cadastros básicos

Empresa: dados da empresa (razão social, CNPJ, endereço, contato).

Usuários: nome, e-mail, senha, perfil de acesso, status (ativo/inativo).

Materiais recicláveis: cadastro de tipos de material (ex: papelão, PET, plástico misto, alumínio, vidro, metal ferroso, sucata eletrônica etc.), unidade de medida (kg/ton), preço médio de compra e venda.

Fornecedores/Coletores: catadores, cooperativas, empresas parceiras que fornecem material.

Clientes/Compradores: indústrias e recicladoras que compram o material processado.

Categorias de despesa: categorias para classificar despesas (operacional, administrativa, frota, folha, impostos etc.), usadas na DRE.

4.2 Estoque

Registro de entrada de material (compra/coleta): fornecedor, tipo de material, peso/quantidade, valor pago, data.

Registro de saída de material (venda): cliente comprador, tipo de material, peso/quantidade, valor recebido, data.

Saldo de estoque atual por tipo de material (quantidade e valor).

Histórico de movimentações por material/período.

Alertas de estoque baixo ou parado [AJUSTAR — opcional].

4.3 Financeiro — Lançamento de despesas e receitas

Tela de lançamento de despesas: descrição, categoria, valor, data de vencimento, data de pagamento, forma de pagamento, status (pendente/pago/atrasado), anexo de comprovante/nota.

Tela de lançamento de receitas: vinculadas às vendas de material (podem ser geradas automaticamente a partir do módulo de estoque/saída) ou lançadas manualmente (outras receitas).

Contas a pagar e a receber, com visão de vencimentos.

[AJUSTAR] Definir se haverá integração com emissão de nota fiscal, boleto ou PIX, ou se por ora é só controle manual.

4.4 Fluxo de caixa

Visão consolidada de entradas e saídas por período (diário, semanal, mensal).

Saldo acumulado de caixa.

Projeção de fluxo de caixa futuro com base em contas a pagar/receber já lançadas.

Filtros por período, categoria e forma de pagamento.

4.5 DRE (Demonstração do Resultado do Exercício)

Gerada automaticamente a partir dos lançamentos financeiros, estruturada como:

(+) Receita Bruta (vendas de material reciclável + outras receitas)
(-) Deduções/Impostos sobre venda
(=) Receita Líquida
(-) Custo do material vendido (CMV — baseado no custo de aquisição do material)
(=) Lucro Bruto
(-) Despesas Operacionais (por categoria: administrativa, frota, folha, etc.)
(=) Resultado Operacional (EBITDA simplificado)
(-) Despesas Financeiras
(=) Lucro/Prejuízo Líquido


Filtros por período (mês, trimestre, ano) e comparação entre períodos.

Exportação em PDF/Excel [AJUSTAR — opcional].

4.6 Dashboards de análise

Painel inicial (home) com cards e gráficos:

Faturamento: receita total no período, evolução mensal (gráfico de linha/barra), comparação com período anterior.

Estoque: quantidade total em estoque por tipo de material, valor total em estoque, materiais com maior giro.

Financeiro: saldo de caixa atual, contas a pagar/receber em aberto, despesas por categoria (gráfico de pizza).

Operacional: volume comprado x vendido por período, ticket médio por material.

Filtros gerais por período em todos os dashboards.

5. Fluxo operacional do negócio (contexto para o Lovable entender o domínio)

A empresa de reciclagem:

Compra/coleta material reciclável de fornecedores/catadores/cooperativas, pesando e classificando por tipo de material → gera entrada de estoque e, opcionalmente, despesa/pagamento ao fornecedor.

Processa/separa o material (fora do escopo do sistema, por ora).

Vende o material processado para indústrias/recicladoras → gera saída de estoque e receita.

Todas as movimentações alimentam o fluxo de caixa e a DRE automaticamente.

[AJUSTAR] Se o negócio também cobra por serviço de coleta (sem necessariamente "comprar" o material), incluir um módulo adicional de "Serviços/Coleta" com faturamento por contrato ou por chamada de coleta.

6. Requisitos técnicos e não funcionais

Aplicação web responsiva (desktop e mobile/tablet, já que operação de pátio pode usar tablet para pesagem).

Autenticação segura por empresa (multi-tenant com isolamento de dados).

Banco de dados relacional com estrutura preparada para multiempresa (cada registro vinculado a um empresa_id).

Permissões por perfil de usuário aplicadas em todas as telas e ações.

Histórico/auditoria básica de lançamentos (quem lançou, quando).

Interface em português (pt-BR), formatos de data e moeda brasileiros (R$).

7. Roadmap sugerido (para construção incremental no Lovable)

MVP: autenticação multiempresa + cadastros básicos + lançamento de despesas/receitas + fluxo de caixa simples.

Fase 2: módulo de estoque completo (entrada/saída por material) + dashboards de faturamento e estoque.

Fase 3: DRE automatizada + dashboards operacionais avançados + exportações.

Fase 4 [AJUSTAR — opcional]: integrações (nota fiscal, PIX/boleto), app mobile para pesagem em campo, painel de super admin da Base 01.

8. Pontos em aberto para você definir antes/durante a construção

Confirmar se o modelo é realmente multi-tenant SaaS (várias empresas no mesmo sistema) ou uma única empresa multiusuário.

Confirmar se o negócio envolve apenas compra/venda de material, prestação de serviço de coleta, ou ambos.

Definir os perfis de usuário exatos e suas permissões.

Definir se é necessária integração fiscal (NF-e) ou meios de pagamento (PIX/boleto) desde o início.

9. Arquivos de logo para anexar no Lovable

Ao colar este prompt no Lovable, anexe também os 4 arquivos de logo enviados (ícone isolado claro/escuro, ícone + nome claro/escuro), indicando que devem ser usados como logo oficial do sistema — ícone isolado no menu lateral colapsado/favicon, versão com nome na tela de login e cabeçalho.


estou enviando prints do meu site, para voce ver nossa identidade visual e replicar

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://recycle-flow-base.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a00e5eff-1eaf-4b2c-9457-10761441ed82).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
