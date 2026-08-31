import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useSessao } from "@/hooks/use-sessao";

function restante(ate: string) {
  const ms = new Date(ate).getTime() - Date.now();
  if (ms <= 0) return null;
  const horas = Math.floor(ms / 3_600_000);
  const minutos = Math.floor((ms % 3_600_000) / 60_000);
  return { horas, minutos };
}

export function TrialContador() {
  const { data: sessao } = useSessao();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!sessao || sessao.assinaturaAtiva || !sessao.trialAte) return null;
  const r = restante(sessao.trialAte);
  void tick;
  if (!r) return null;

  const texto =
    r.horas > 0
      ? `Você tem mais ${r.horas}h ${r.minutos}min grátis`
      : `Você tem mais ${r.minutos}min grátis`;

  return (
    <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
      <Clock className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{texto}</span>
      <span className="sm:hidden">{r.horas > 0 ? `${r.horas}h grátis` : `${r.minutos}min`}</span>
    </div>
  );
}
