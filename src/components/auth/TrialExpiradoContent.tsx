import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSessao } from "@/hooks/use-sessao";
import { LogoFull } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getLinkWhatsAppTrialExpirado } from "@/lib/trial";

export interface TrialExpiradoContentProps {
  onSair?: () => void | Promise<void>;
  empresaNomeFallback?: string;
}

export function TrialExpiradoContent({
  onSair,
  empresaNomeFallback,
}: TrialExpiradoContentProps) {
  const { data: sessao } = useSessao();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Tratamento defensivo com fallbacks múltiplos para o nome da empresa
  const empresaIdentificador =
    empresaNomeFallback ||
    sessao?.empresaNome ||
    "sua conta";

  async function handleSair() {
    if (onSair) {
      try {
        await onSair();
        return;
      } catch (err) {
        console.warn("[TrialExpiradoContent] Erro no onSair personalizado:", err);
      }
    }

    try {
      await queryClient.cancelQueries().catch(() => {});
      queryClient.clear();
      await supabase.auth.signOut({ scope: "global" }).catch(() => {});
    } catch (err) {
      console.warn("[TrialExpiradoContent] Erro ao deslogar:", err);
    } finally {
      if (typeof window !== "undefined") {
        window.location.href = "/auth";
      } else {
        navigate({ to: "/auth", replace: true });
      }
    }
  }

  const whatsappUrl = getLinkWhatsAppTrialExpirado();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mb-6 flex justify-center">
          <LogoFull className="h-10" />
        </div>
        <h1 className="text-xl font-bold">Seu período de teste terminou</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O período de 1 dia de teste gratuito para{" "}
          <strong className="font-semibold text-foreground">{empresaIdentificador}</strong>{" "}
          terminou. Para continuar usando o sistema, fale com a Base 01 e ative sua assinatura.
        </p>
        <div className="mt-6 grid gap-3">
          <Button asChild variant="brand" className="w-full">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              Falar no WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href="/assinatura">Ver planos</a>
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleSair}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}
