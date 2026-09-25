import { LogoFull } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { getLinkWhatsAppTrialExpirado } from "@/lib/trial";

export const WHATSAPP_TRIAL_EXPIRADO_URL = getLinkWhatsAppTrialExpirado();


export interface TrialExpiradoCardProps {
  onSair?: () => void | Promise<void>;
}

export function TrialExpiradoCard({ onSair }: TrialExpiradoCardProps) {
  return (
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
          <a
            href={WHATSAPP_TRIAL_EXPIRADO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Falar no WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href="/assinatura">Ver planos</a>
        </Button>
        {onSair && (
          <Button variant="ghost" onClick={onSair}>
            Sair
          </Button>
        )}
      </div>
    </div>
  );
}
