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
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Lightbulb,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  calcularSaldos,
  useCategorias,
  useLancamentos,
  useMateriais,
  useMovimentacoes,
  useParceiros,
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
  const [de, setDe] = useState(inicioDoMesAtual());
  const [ate, setAte] = useState(hojeIso());
  const { data: sessao } = useSessao();
  const financeiro = podeFinanceiro(sessao);
  const { data: materiais = [] } = useMateriais();
  const { data: movs = [] } = useMovimentacoes();
  const { data: lancs = [] } = useLancamentos(financeiro);
  const { data: categorias = [] } = useCategorias();
  const { data: fornecedores = [] } = useParceiros("fornecedores");
  const { data: clientes = [] } = useParceiros("clientes");

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

  // ============= Insights automáticos =============
  const insights = useMemo(() => {
    const lista: { tipo: "bom" | "ruim" | "neutro"; icone: "tendencia" | "alerta" | "ideia" | "parceiros"; titulo: string; texto: string }[] = [];
    const hoje = new Date().toISOString().slice(0, 10);

    // Margem por material (período): venda - custo médio de compra
    const margens = new Map<string, { nome: string; lucro: number; receita: number }>();
    materiais.forEach((mat) => {
      const mvs = movsPeriodo.filter((m) => m.material_id === mat.id);
      const qtdE = mvs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.quantidade), 0);
      const valE = mvs.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor_total), 0);
      const qtdS = mvs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Number(m.quantidade), 0);
      const valS = mvs.filter((m) => m.tipo === "saida").reduce((s, m) => s + Number(m.valor_total), 0);
      if (qtdS === 0) return;
      const custoMedio = qtdE > 0 ? valE / qtdE : 0;
      const lucro = valS - custoMedio * qtdS;
      margens.set(mat.id, { nome: mat.nome, lucro, receita: valS });
    });
    const ranking = [...margens.values()].sort((a, b) => b.lucro - a.lucro);
    const destaque = ranking[0];
    const pior = ranking.filter((r) => r.receita > 0).at(-1);
    if (financeiro && destaque && destaque.lucro > 0) {
      lista.push({
        tipo: "bom",
        icone: "ideia",
        titulo: "Material mais lucrativo",
        texto: `${destaque.nome} gerou ${brl(destaque.lucro)} de lucro no período.`,
      });
    }
    if (financeiro && pior && pior.lucro < 0 && ranking.length > 1) {
      lista.push({
        tipo: "ruim",
        icone: "alerta",
        titulo: "Margem negativa",
        texto: `${pior.nome} está sendo vendido abaixo do custo médio (${brl(pior.lucro)}). Revise o preço.`,
      });
    }

    // Tendência de receita: mês atual vs anterior
    if (financeiro) {
      const chaveAtual = monthKey(hoje);
      const anterior = new Date();
      anterior.setMonth(anterior.getMonth() - 1);
      const chaveAnterior = monthKey(anterior.toISOString().slice(0, 10));
      const rec = (k: string) =>
        lancs.filter((l) => l.tipo === "receita" && monthKey(l.data_vencimento) === k).reduce((s, l) => s + Number(l.valor), 0);
      const atual = rec(chaveAtual);
      const antes = rec(chaveAnterior);
      if (antes > 0) {
        const variacao = ((atual - antes) / antes) * 100;
        lista.push({
          tipo: variacao >= 0 ? "bom" : "ruim",
          icone: "tendencia",
          titulo: "Tendência de faturamento",
          texto: `Este mês ${variacao >= 0 ? "cresceu" : "caiu"} ${Math.abs(variacao).toFixed(0)}% em relação ao mês passado (${brl(antes)} → ${brl(atual)}).`,
        });
      }
    }

    // Top cliente e fornecedor do período
    const porParceiro = (campo: "cliente_id" | "fornecedor_id", tipo: "saida" | "entrada") => {
      const mapa = new Map<string, number>();
      movsPeriodo
        .filter((m) => m.tipo === tipo && m[campo])
        .forEach((m) => mapa.set(m[campo]!, (mapa.get(m[campo]!) ?? 0) + Number(m.valor_total)));
      return [...mapa.entries()].sort((a, b) => b[1] - a[1])[0];
    };
    const topCliente = porParceiro("cliente_id", "saida");
    const topFornecedor = porParceiro("fornecedor_id", "entrada");
    if (topCliente) {
      const nome = clientes.find((c) => c.id === topCliente[0])?.nome ?? "—";
      lista.push({ tipo: "neutro", icone: "parceiros", titulo: "Cliente em destaque", texto: `${nome} representa ${brl(topCliente[1])} em vendas no período.` });
    }
    if (topFornecedor) {
      const nome = fornecedores.find((f) => f.id === topFornecedor[0])?.nome ?? "—";
      lista.push({ tipo: "neutro", icone: "parceiros", titulo: "Principal fornecedor", texto: `${nome} respondeu por ${brl(topFornecedor[1])} em compras no período.` });
    }

    // Alerta: contas atrasadas
    if (financeiro) {
      const atrasados = lancs.filter((l) => l.status !== "pago" && l.data_vencimento < hoje);
      const totalAtraso = atrasados.reduce((s, l) => s + Number(l.valor), 0);
      if (atrasados.length > 0) {
        lista.push({
          tipo: "ruim",
          icone: "alerta",
          titulo: "Contas atrasadas",
          texto: `${atrasados.length} lançamento(s) vencidos somando ${brl(totalAtraso)}.`,
        });
      }
    }

    // Alerta: estoque parado (saldo sem saída no período)
    const parados = saldos.filter(
      (s) =>
        s.saldoQtd > 0 &&
        !movsPeriodo.some((m) => m.material_id === s.material.id && m.tipo === "saida"),
    );
    if (parados.length > 0) {
      lista.push({
        tipo: "neutro",
        icone: "ideia",
        titulo: "Estoque parado",
        texto: `${parados.map((p) => p.material.nome).slice(0, 3).join(", ")}${parados.length > 3 ? " e outros" : ""} sem saída no período.`,
      });
    }

    return lista.slice(0, 6);
  }, [financeiro, materiais, movsPeriodo, lancs, saldos, clientes, fornecedores]);

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
        descricao="Visão geral do negócio com insights gerados a partir dos seus dados."
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

      {insights.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {insights.map((ins) => (
            <InsightCard key={ins.titulo} insight={ins} />
          ))}
        </div>
      )}

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

type Insight = {
  tipo: "bom" | "ruim" | "neutro";
  icone: "tendencia" | "alerta" | "ideia" | "parceiros";
  titulo: string;
  texto: string;
};

function InsightCard({ insight }: { insight: Insight }) {
  const Icone =
    insight.icone === "alerta"
      ? AlertTriangle
      : insight.icone === "ideia"
        ? Lightbulb
        : insight.icone === "parceiros"
          ? Users
          : insight.tipo === "ruim"
            ? TrendingDown
            : TrendingUp;
  const corIcone =
    insight.tipo === "bom"
      ? "bg-success/10 text-success"
      : insight.tipo === "ruim"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary/10 text-primary";
  const Seta = insight.tipo === "bom" ? ArrowUpRight : insight.tipo === "ruim" ? ArrowDownRight : null;

  return (
    <div className="flex gap-3 rounded-2xl border bg-card p-4 shadow-card">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${corIcone}`}>
        <Icone className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-sm font-bold">
          {insight.titulo}
          {Seta && <Seta className="h-3.5 w-3.5" />}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{insight.texto}</p>
      </div>
    </div>
  );
}
