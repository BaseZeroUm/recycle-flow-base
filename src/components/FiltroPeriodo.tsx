import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function inicioDoMesAtual(): string {
  const d = new Date();
  d.setDate(1);
  return isoLocal(d);
}

export function hojeIso(): string {
  return isoLocal(new Date());
}

export function periodoLabel(de: string, ate: string): string {
  const fmt = (iso: string) => {
    const [y, m, dd] = iso.split("-");
    return `${dd}/${m}/${y}`;
  };
  return `${fmt(de)} a ${fmt(ate)}`;
}

interface Props {
  de: string;
  ate: string;
  onChange: (de: string, ate: string) => void;
}

export function FiltroPeriodo({ de, ate, onChange }: Props) {
  const atalho = (dias: number | "mes") => {
    const fim = new Date();
    const inicio = new Date();
    if (dias === "mes") inicio.setDate(1);
    else inicio.setDate(inicio.getDate() - (dias - 1));
    onChange(isoLocal(inicio), isoLocal(fim));
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label className="text-xs">De</Label>
        <Input
          type="date"
          value={de}
          max={ate}
          onChange={(e) => e.target.value && onChange(e.target.value, ate)}
          className="w-40"
        />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Até</Label>
        <Input
          type="date"
          value={ate}
          min={de}
          onChange={(e) => e.target.value && onChange(de, e.target.value)}
          className="w-40"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={() => atalho("mes")}>
          Este mês
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => atalho(30)}>
          30 dias
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => atalho(90)}>
          90 dias
        </Button>
      </div>
    </div>
  );
}
