export const brl = (v: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v ?? 0));

export const num = (v: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(
    Number(v ?? 0),
  );

export const dateBR = (v: string | null | undefined) =>
  v ? new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR") : "—";

export const monthKey = (v: string) => v.slice(0, 7);

export const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${m}/${y.slice(2)}`;
};

export function periodoRange(meses: number) {
  const fim = new Date();
  const inicio = new Date(fim.getFullYear(), fim.getMonth() - (meses - 1), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { inicio: iso(inicio), fim: iso(fim) };
}
