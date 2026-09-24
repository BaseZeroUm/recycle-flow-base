import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { LogoFull } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/trial-expirado")({
  head: () => ({
    meta: [
      { title: "Período de teste expirado — Base 01" },
      {
        name: "description",
        content: "Seu período de teste gratuito expirou. Escolha um plano para continuar.",
      },
    ],
  }),
  component: TrialExpirado,
});

export default function TrialExpirado() {
  async function sair() {
    await supabase.auth.signOut({ scope: "global" });
    window.location.href = "/auth";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-3xl border bg-card p-8 text-center shadow-card">
        <div className="mb-6 flex justify-center">
          <LogoFull />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Seu período de teste expirou</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Seus 30 dias de teste grátis chegaram ao fim. Para continuar gerenciando sua operação sem
          interrupções, escolha um plano.
        </p>
        <div className="space-y-3">
          <Button asChild variant="brand" className="w-full py-3">
            <a href="https://basezeroum.com.br/#planos">Escolher um Plano</a>
          </Button>
          <button
            type="button"
            onClick={sair}
            className="block w-full py-2 px-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
}
