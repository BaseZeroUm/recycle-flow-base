import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/hooks/use-sessao";
import { TrialExpiradoCard, WHATSAPP_TRIAL_EXPIRADO_URL } from "@/components/TrialExpiradoCard";

export { WHATSAPP_TRIAL_EXPIRADO_URL };

export function TrialGate({ children }: { children: ReactNode }) {
  const { data: sessao, isLoading } = useSessao();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (isLoading || !sessao) return <>{children}</>;
  if (sessao.acessoLiberado) return <>{children}</>;

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut({ scope: "global" });
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    } else {
      navigate({ to: "/auth", replace: true });
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <TrialExpiradoCard onSair={sair} />
    </div>
  );
}

