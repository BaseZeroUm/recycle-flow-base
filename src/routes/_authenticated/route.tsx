import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TrialGate } from "@/components/TrialGate";
import { ehRotaAdega, ehRotaComum, normalizarSegmento, rotaInicial } from "@/lib/segmento";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Validação de conta ativa e empresa ativa
    const { data: perfil, error: perfilError } = await supabase
      .from("profiles")
      .select("id, ativo, desativado_em, empresa_id, empresas(id, ativa, categoria)")
      .eq("id", data.user.id)
      .maybeSingle();

    if (perfilError || !perfil) {
      await supabase.auth.signOut({ scope: "global" });
      throw redirect({ to: "/auth" });
    }

    if (perfil.ativo === false || perfil.desativado_em) {
      await supabase.auth.signOut({ scope: "global" });
      throw redirect({ to: "/auth", search: { erro: "desativada" } });
    }

    const empresa = perfil.empresas as { id: string; ativa: boolean; categoria: string } | null;
    if (empresa && empresa.ativa === false) {
      await supabase.auth.signOut({ scope: "global" });
      throw redirect({ to: "/auth", search: { erro: "suspensa" } });
    }

    // Proteção por segmento: cada empresa só acessa as rotas do seu módulo
    const segmento = normalizarSegmento(empresa?.categoria);
    const path = location.pathname;
    if (!ehRotaComum(path)) {
      const rotaAdega = ehRotaAdega(path);
      if (segmento === "adega" && !rotaAdega) throw redirect({ to: rotaInicial("adega") });
      if (segmento === "reciclagem" && rotaAdega) throw redirect({ to: rotaInicial("reciclagem") });
    }

    return { user: data.user, perfil, segmento };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <TrialGate>
        <Outlet />
      </TrialGate>
    </AppShell>
  );
}
