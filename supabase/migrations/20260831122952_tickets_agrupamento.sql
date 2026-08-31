-- Cria tabela de tickets para agrupar múltiplos itens de pesagem num mesmo documento.
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero_ticket SERIAL UNIQUE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  data TEXT NOT NULL,
  fornecedor_id UUID,
  cliente_id UUID,
  veiculo_placa TEXT,
  motorista TEXT,
  observacoes TEXT,
  responsavel TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário da empresa vê os tickets
CREATE POLICY "tickets_select" ON tickets FOR SELECT USING (
  empresa_id IN (SELECT empresa_id FROM empresas WHERE id = empresa_id)
);

-- Inserção via trigger/função da aplicação
CREATE POLICY "tickets_insert" ON tickets FOR INSERT WITH CHECK (true);

-- Adiciona ticket_id às movimentações existentes (valor null = ticket legado)
ALTER TABLE movimentacoes_estoque ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;
