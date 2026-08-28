import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { brl, monthKey, monthLabel } from "@/lib/format";
import { useLancamentos } from "@/lib/dados";
import { podeFinanceiro, useSessao } from "@/hooks/use-sessao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/fluxo-de-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de caixa — Base 01" },
      { name: "description", content: "Entradas, saídas e saldo acumulado mês a mês." },
      { property: "og:title", content: "Fluxo de caixa — Base 01" },
      { property: "og:description", content: "Entradas, saídas e saldo acumulado mês a mês." },
    ],
  }),
  component: Fluxo,
});

function Fluxo() {
  const [meses, setMeses] = useState("6");
  const [base, setBase] = useState<"pago" | "previsto">("pago");
  const { data: sessao } = useSessao();
  const autorizado = podeFinanceiro(sessao);
  const { data: lancs = [] } = useLancamentos(autorizado);

  const limite = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - (Number(meses) - 1));
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, [meses]);

  const linhas = useMemo(() => {
    const mapa = new Map<string, { mes: string; entradas: number; saidas: number }>();
    lancs.forEach((l) => {
      const dataRef = base === "pago" ? l.data_pagamento : l.data_vencimento;
      if (!dataRef || dataRef < limite) return;
      if (base === "pago" && l.status !== "pago") return;
      const k = monthKey(dataRef);
      const item = mapa.get(k) ?? { mes: k, entradas: 0, saidas: 0 };
      if (l.tipo === "receita") item.entradas += Number(l.valor);
      else item.saidas += Number(l.valor);
      mapa.set(k, item);
    });
    let acumulado = 0;
    return [...mapa.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((x) => {
        const saldo = x.entradas - x.saidas;
        acumulado += saldo;
        return { ...x, label: monthLabel(x.mes), saldo, acumulado };
      });
  }, [lancs, limite, base]);

  if (!autorizado) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas perfis Administrador e Financeiro acessam esta área.
        </p>
      </div>
    );
  }

  const entradas = linhas.reduce((s, l) => s + l.entradas, 0);
  const saidas = linhas.reduce((s, l) => s + l.saidas, 0);

  return (
    <div>
      <PageHeader
        titulo="Fluxo de caixa"
        descricao="Entradas, saídas e saldo acumulado por mês."
        acoes={
          <>
            <Select value={base} onValueChange={(v) => setBase(v as "pago" | "previsto")}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pago">Realizado</SelectItem>
                <SelectItem value="previsto">Previsto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={meses} onValueChange={setMeses}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard destaque label="Entradas" valor={brl(entradas)} />
        <StatCard label="Saídas" valor={brl(saidas)} />
        <StatCard label="Saldo do período" valor={brl(entradas - saidas)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Entradas x saídas
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={linhas}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} width={70} tickFormatter={(v) => brl(v).replace("R$", "")} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Legend />
              <Bar dataKey="entradas" name="Entradas" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Saldo acumulado
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={linhas}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} width={70} tickFormatter={(v) => brl(v).replace("R$", "")} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Area
                type="monotone"
                dataKey="acumulado"
                name="Acumulado"
                stroke="var(--chart-1)"
                fill="var(--chart-1)"
                fillOpacity={0.18}
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Saídas</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Acumulado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum movimento no período.
                </TableCell>
              </TableRow>
            )}
            {linhas.map((l) => (
              <TableRow key={l.mes}>
                <TableCell className="font-medium">{l.label}</TableCell>
                <TableCell className="text-right">{brl(l.entradas)}</TableCell>
                <TableCell className="text-right">{brl(l.saidas)}</TableCell>
                <TableCell className="text-right">{brl(l.saldo)}</TableCell>
                <TableCell className="text-right font-semibold">{brl(l.acumulado)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
