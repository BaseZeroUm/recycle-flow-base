import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { LogoFull } from "@/components/Logo";

const WHATSAPP =
  "https://wa.me/5511911380734?text=" +
  encodeURIComponent("Olá! Meu teste do Base 01 Reciclagem terminou, quero assinar.");

export function TrialGate({ children }: { children: ReactNode }) {
  const { data: sessao, isLoading } = useSessao();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (isLoading || !sessao) return <>{children}</>;
  if (sessao.acessoLiberado) return <>{children}</>;

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <LogoFull className="h-10" />
        </div>
        <h1 className="text-xl font-bold">Seu período de teste terminou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você teve 1 dia de acesso gratuito. Para continuar usando o sistema, fale com a Base 01 e
          ative sua assinatura.
        </p>
        <div className="mt-6 grid gap-3">
          <Button asChild variant="brand">
            <a href={WHATSAPP} target="_blank" rel="noreferrer">
              Falar no WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href="/assinatura">Ver planos</a>
          </Button>
          <Button variant="ghost" onClick={sair}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
