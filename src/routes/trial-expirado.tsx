import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { TrialExpiradoCard } from "@/components/TrialExpiradoCard";

export const Route = createFileRoute("/trial-expirado")({
  head: () => ({
    meta: [
      { title: "Seu período de teste terminou — Base 01" },
      {
        name: "description",
        content:
          "Você teve 1 dia de acesso gratuito. Para continuar usando o sistema, fale com a Base 01 e ative sua assinatura.",
      },
    ],
  }),
  component: TrialExpirado,
});

export default function TrialExpirado() {
  async function sair() {
    await supabase.auth.signOut({ scope: "global" });
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <TrialExpiradoCard onSair={sair} />
    </div>
  );
}

