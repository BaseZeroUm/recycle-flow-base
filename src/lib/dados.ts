import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Material {
  id: string;
  nome: string;
  unidade: "kg" | "ton";
  preco_compra: number;
  preco_venda: number;
  ativo: boolean;
}

export interface Parceiro {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
}

export interface Categoria {
  id: string;
  nome: string;
  grupo: "operacional" | "administrativa" | "frota" | "folha" | "impostos" | "financeira";
}

export interface Movimentacao {
  id: string;
  tipo: "entrada" | "saida";
  material_id: string;
  fornecedor_id: string | null;
  cliente_id: string | null;
  quantidade: number;
  valor_total: number;
  data: string;
  observacoes: string | null;
  numero_ticket: number | null;
  peso_bruto: number | null;
  tara: number | null;
  valor_unitario: number;
  veiculo_placa: string | null;
  motorista: string | null;
  created_at?: string;
}

export interface Lancamento {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  categoria_id: string | null;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  status: "pendente" | "pago" | "atrasado";
  imposto: boolean;
}

export function useMateriais() {
  return useQuery<Material[]>({
    queryKey: ["materiais"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materiais").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Material[];
    },
  });
}

export function useParceiros(tabela: "fornecedores" | "clientes") {
  return useQuery<Parceiro[]>({
    queryKey: [tabela],
    queryFn: async () => {
      const { data, error } = await supabase.from(tabela).select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Parceiro[];
    },
  });
}

export function useCategorias() {
  return useQuery<Categoria[]>({
    queryKey: ["categorias_despesa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias_despesa").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Categoria[];
    },
  });
}

export function useMovimentacoes() {
  return useQuery<Movimentacao[]>({
    queryKey: ["movimentacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes_estoque")
        .select("*")
        .order("data", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Movimentacao[];
    },
  });
}

export function useLancamentos(habilitado = true) {
  return useQuery<Lancamento[]>({
    queryKey: ["lancamentos"],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lancamentos")
        .select("*")
        .order("data_vencimento", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Lancamento[];
    },
  });
}

export interface SaldoMaterial {
  material: Material;
  entradaQtd: number;
  saidaQtd: number;
  saldoQtd: number;
  custoMedio: number;
  valorEstoque: number;
  compras: number;
  vendas: number;
}

export function calcularSaldos(materiais: Material[], movs: Movimentacao[]): SaldoMaterial[] {
  return materiais.map((material) => {
    const doMaterial = movs.filter((m) => m.material_id === material.id);
    const entradas = doMaterial.filter((m) => m.tipo === "entrada");
    const saidas = doMaterial.filter((m) => m.tipo === "saida");
    const entradaQtd = entradas.reduce((s, m) => s + Number(m.quantidade), 0);
    const saidaQtd = saidas.reduce((s, m) => s + Number(m.quantidade), 0);
    const compras = entradas.reduce((s, m) => s + Number(m.valor_total), 0);
    const vendas = saidas.reduce((s, m) => s + Number(m.valor_total), 0);
    const custoMedio = entradaQtd > 0 ? compras / entradaQtd : Number(material.preco_compra);
    const saldoQtd = entradaQtd - saidaQtd;
    return {
      material,
      entradaQtd,
      saidaQtd,
      saldoQtd,
      custoMedio,
      valorEstoque: Math.max(saldoQtd, 0) * custoMedio,
      compras,
      vendas,
    };
  });
}
