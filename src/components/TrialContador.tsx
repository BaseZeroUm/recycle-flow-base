import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useSessao } from "@/hooks/use-sessao";
import { cn } from "@/lib/utils";
import { calcularStatusTrial, formatarTempoTrial, type InfoTrial } from "@/lib/trial";

export { calcularStatusTrial, formatarTempoTrial, type InfoTrial };

export function TrialContador() {
  const { data: sessao } = useSessao();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Se não há sessão, ou se já possui assinatura ativa, ou se não há data de trial definida, não exibe
  if (!sessao || sessao.assinaturaAtiva || !sessao.trialAte) return null;

  // Evita warning de variável não lida e força reavaliação no tick
  void tick;

  const status = calcularStatusTrial(sessao.trialAte);
  if (!status) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        status.expirado
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-primary/30 bg-primary/10 text-primary"
      )}
      title={status.texto}
    >
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden sm:inline">{status.texto}</span>
      <span className="sm:hidden">{status.textoCurto}</span>
    </div>
  );
}
