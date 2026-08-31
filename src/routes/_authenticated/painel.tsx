import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { brl, monthKey, monthLabel, num } from "@/lib/format";
import {
  calcularSaldos,
  useCategorias,
  useLancamentos,
  useMateriais,
  useMovimentacoes,
} from "@/lib/dados";
import { podeFinanceiro, useSessao } from "@/hooks/use-sessao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => ({
    meta: [
      { title: "Painel — Base 01" },
      { name: "description", content: "Faturamento, estoque e indicadores da sua operação." },
      { property: "og:title", content: "Painel — Base 01" },
      { property: "og:description", content: "Faturamento, estoque e indicadores da sua operação." },
    ],
  }),
  component: Painel,
});

function Painel() {
  const [meses, setMeses] = useState("6");
  const { data: sessao } = useSessao();
  const financeiro = podeFinanceiro(sessao);
  const { data: materiais = [] } = useMateriais();
  const { data: movs = [] } = useMovimentacoes();
  const { data: lancs = [] } = useLancamentos(financeiro);
  const { data: categorias = [] } = useCategorias();

  const limite = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - (Number(meses) - 1));
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, [meses]);

  const movsPeriodo = movs.filter((m) => m.data >= limite);
  const lancsPeriodo = lancs.filter((l) => l.data_vencimento >= limite);

  const saldos = calcularSaldos(materiais, movs);
  const valorEstoque = saldos.reduce((s, x) => s + x.valorEstoque, 0);
  const qtdEstoque = saldos.reduce((s, x) => s + Math.max(x.saldoQtd, 0), 0);

  const receita = lancsPeriodo.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const despesa = lancsPeriodo.filter((l) => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0);
  const aReceber = lancs
    .filter((l) => l.tipo === "receita" && l.status !== "pago")
    .reduce((s, l) => s + Number(l.valor), 0);
  const aPagar = lancs
    .filter((l) => l.tipo === "despesa" && l.status !== "pago")
    .reduce((s, l) => s + Number(l.valor), 0);
  const caixa = lancs
    .filter((l) => l.status === "pago")
    .reduce((s, l) => s + (l.tipo === "receita" ? Number(l.valor) : -Number(l.valor)), 0);

  const serieFaturamento = useMemo(() => {
    const mapa = new Map<string, { mes: string; receita: number; despesa: number }>();
    lancsPeriodo.forEach((l) => {
      const k = monthKey(l.data_vencimento);
      const item = mapa.get(k) ?? { mes: k, receita: 0, despesa: 0 };
      if (l.tipo === "receita") item.receita += Number(l.valor);
      else item.despesa += Number(l.valor);
      mapa.set(k, item);
    });
    return [...mapa.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((x) => ({ ...x, mes: monthLabel(x.mes) }));
  }, [lancsPeriodo]);

  const serieVolume = useMemo(() => {
    const mapa = new Map<string, { mes: string; comprado: number; vendido: number }>();
    movsPeriodo.forEach((m) => {
      const k = monthKey(m.data);
      const item = mapa.get(k) ?? { mes: k, comprado: 0, vendido: 0 };
      if (m.tipo === "entrada") item.comprado += Number(m.quantidade);
      else item.vendido += Number(m.quantidade);
      mapa.set(k, item);
    });
    return [...mapa.values()]
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map((x) => ({ ...x, mes: monthLabel(x.mes) }));
  }, [movsPeriodo]);

  const despesaPorCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    lancsPeriodo
      .filter((l) => l.tipo === "despesa")
      .forEach((l) => {
        const nome = categorias.find((c) => c.id === l.categoria_id)?.nome ?? "Sem categoria";
        mapa.set(nome, (mapa.get(nome) ?? 0) + Number(l.valor));
      });
    return [...mapa.entries()].map(([nome, valor]) => ({ nome, valor }));
  }, [lancsPeriodo, categorias]);

  const cores = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];

  return (
    <div>
      <PageHeader
        titulo="Painel"
        descricao="Visão geral do faturamento, do estoque e da operação."
        acoes={
          <Select value={meses} onValueChange={setMeses}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Este mês</SelectItem>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Últimos 12 meses</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {financeiro && <StatCard destaque label="Receita no período" valor={brl(receita)} detalhe={`Despesas: ${brl(despesa)}`} />}
        {financeiro && <StatCard label="Saldo de caixa" valor={brl(caixa)} detalhe="Lançamentos já pagos" />}
        <StatCard label="Estoque atual" valor={`${num(qtdEstoque)} kg`} detalhe={`Valor: ${brl(valorEstoque)}`} />
        {financeiro ? (
          <StatCard label="Em aberto" valor={brl(aReceber - aPagar)} detalhe={`A receber ${brl(aReceber)} · A pagar ${brl(aPagar)}`} />
        ) : (
          <StatCard label="Materiais cadastrados" valor={num(materiais.length, 0)} />
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {financeiro && (
          <Card titulo="Faturamento x despesas">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={serieFaturamento}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mes" fontSize={12} />
                <YAxis fontSize={12} width={70} tickFormatter={(v) => brl(v).replace("R$", "")} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Legend />
                <Line type="monotone" dataKey="receita" name="Receita" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="despesa" name="Despesa" stroke="var(--chart-4)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card titulo="Volume comprado x vendido (kg)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={serieVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" fontSize={12} />
              <YAxis fontSize={12} width={60} />
              <Tooltip formatter={(v: number) => `${num(v)} kg`} />
              <Legend />
              <Bar dataKey="comprado" name="Comprado" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="vendido" name="Vendido" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card titulo="Estoque por material">
          <div className="space-y-3">
            {saldos.filter((s) => s.saldoQtd !== 0).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
            )}
            {saldos
              .filter((s) => s.saldoQtd !== 0)
              .sort((a, b) => b.valorEstoque - a.valorEstoque)
              .map((s) => (
                <div key={s.material.id} className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium">{s.material.nome}</span>
                  <span className="text-muted-foreground">
                    {num(s.saldoQtd)} {s.material.unidade} · {brl(s.valorEstoque)}
                  </span>
                </div>
              ))}
          </div>
        </Card>

        {financeiro && (
          <Card titulo="Despesas por categoria">
            {despesaPorCategoria.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem despesas no período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={despesaPorCategoria} dataKey="valor" nameKey="nome" innerRadius={55} outerRadius={95}>
                    {despesaPorCategoria.map((_, i) => (
                      <Cell key={i} fill={cores[i % cores.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => brl(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
      {children}
    </div>
  );
}
