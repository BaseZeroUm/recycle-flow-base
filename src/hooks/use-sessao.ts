import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Papel = "admin" | "financeiro" | "operacional";

export interface Sessao {
  userId: string;
  email: string;
  nome: string;
  empresaId: string;
  empresaNome: string;
  papeis: Papel[];
  trialAte: string | null;
  assinaturaAtiva: boolean;
  acessoLiberado: boolean;
}

export function useSessao() {
  return useQuery<Sessao | null>({
    queryKey: ["sessao"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;

      const { data: perfil } = await supabase
        .from("profiles")
        .select("id, nome, email, empresa_id, empresas(razao_social, trial_ate, assinatura_ativa)")
        .eq("id", user.id)
        .maybeSingle();

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

      const empresa = perfil?.empresas as
        | { razao_social: string; trial_ate: string | null; assinatura_ativa: boolean }
        | null;
      const trialAte = empresa?.trial_ate ?? null;
      const assinaturaAtiva = empresa?.assinatura_ativa ?? false;
      const trialValido = !!trialAte && new Date(trialAte).getTime() > Date.now();

      return {
        userId: user.id,
        email: perfil?.email ?? user.email ?? "",
        nome: perfil?.nome ?? user.email ?? "",
        empresaId: perfil?.empresa_id ?? "",
        empresaNome: empresa?.razao_social ?? "Minha empresa",
        papeis: (roles ?? []).map((r) => r.role as Papel),
        trialAte,
        assinaturaAtiva,
        acessoLiberado: assinaturaAtiva || trialValido,
      };
    },
    staleTime: 60_000,
  });
}

export const podeFinanceiro = (s?: Sessao | null) =>
  !!s && (s.papeis.includes("admin") || s.papeis.includes("financeiro"));
export const ehAdmin = (s?: Sessao | null) => !!s && s.papeis.includes("admin");
