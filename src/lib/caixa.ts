import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CaixaTipo = "abertura" | "aporte" | "compra" | "despesa" | "sangria" | "conferencia";

export interface CaixaMovimento {
  id: string;
  empresa_id: string;
  data: string;
  tipo: CaixaTipo;
  valor: number;
  descricao: string | null;
  ticket_id: string | null;
  lancamento_id: string | null;
  diferenca: number | null;
  created_at: string;
}

export const hojeISO = (): string => new Date().toISOString().slice(0, 10);

export const rotuloTipo: Record<CaixaTipo, string> = {
  abertura: "Abertura do dia",
  aporte: "Aporte",
  compra: "Compra em dinheiro",
  despesa: "Despesa em dinheiro",
  sangria: "Sangria",
  conferencia: "Conferência",
};

/** Efeito de cada tipo sobre o saldo: abertura redefine, aporte soma, saídas subtraem. */
export function aplicarMovimento(saldoAnterior: number, m: CaixaMovimento): number {
  const valor = Number(m.valor) || 0;
  switch (m.tipo) {
    case "abertura":
      return valor;
    case "aporte":
      return saldoAnterior + valor;
    case "compra":
    case "despesa":
    case "sangria":
      return saldoAnterior - valor;
    case "conferencia":
    default:
      return saldoAnterior;
  }
}

/** Movimentos em ordem cronológica com o saldo resultante de cada um. */
export function comSaldos(movs: CaixaMovimento[]): { mov: CaixaMovimento; saldo: number }[] {
  const asc = [...movs].sort((a, b) => a.created_at.localeCompare(b.created_at));
  let saldo = 0;
  return asc.map((mov) => {
    saldo = aplicarMovimento(saldo, mov);
    return { mov, saldo };
  });
}

export function saldoAtual(movs: CaixaMovimento[]): number {
  const linhas = comSaldos(movs);
  return linhas.length ? (linhas[linhas.length - 1]?.saldo ?? 0) : 0;
}

export function aberturaDoDia(movs: CaixaMovimento[], dia = hojeISO()): CaixaMovimento | null {
  return movs.find((m) => m.tipo === "abertura" && m.data === dia) ?? null;
}

export function useCaixaMovimentos(habilitado = true) {
  return useQuery<CaixaMovimento[]>({
    queryKey: ["caixa_movimentos"],
    enabled: habilitado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caixa_movimentos")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as CaixaMovimento[];
    },
  });
}
