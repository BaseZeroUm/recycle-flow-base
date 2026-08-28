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
        .select("id, nome, email, empresa_id, empresas(razao_social)")
        .eq("id", user.id)
        .maybeSingle();

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);

      return {
        userId: user.id,
        email: perfil?.email ?? user.email ?? "",
        nome: perfil?.nome ?? user.email ?? "",
        empresaId: perfil?.empresa_id ?? "",
        empresaNome:
          (perfil?.empresas as { razao_social: string } | null)?.razao_social ?? "Minha empresa",
        papeis: (roles ?? []).map((r) => r.role as Papel),
      };
    },
    staleTime: 60_000,
  });
}

export const podeFinanceiro = (s?: Sessao | null) =>
  !!s && (s.papeis.includes("admin") || s.papeis.includes("financeiro"));
export const ehAdmin = (s?: Sessao | null) => !!s && s.papeis.includes("admin");
