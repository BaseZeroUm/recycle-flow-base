import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { TrialGate } from "@/components/TrialGate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Validação de conta ativa e empresa ativa
    const { data: perfil, error: perfilError } = await supabase
      .from("profiles")
      .select("id, ativo, desativado_em, empresa_id, empresas(id, ativa)")
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

    const empresa = perfil.empresas as { id: string; ativa: boolean } | null;
    if (empresa && empresa.ativa === false) {
      await supabase.auth.signOut({ scope: "global" });
      throw redirect({ to: "/auth", search: { erro: "suspensa" } });
    }

    return { user: data.user, perfil };
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

