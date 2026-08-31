import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { brl, monthLabel, num } from "@/lib/format";
import {
  calcularSaldos,
  useMateriais,
  useMovimentacoes,
  useParceiros,
  type Movimentacao,
} from "@/lib/dados";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/producao")({
  head: () => ({
    meta: [
      { title: "Produção — Base 01" },
      {
        name: "description",
        content: "Volume processado, entrada x saída, giro de estoque e margem por material.",
      },
      { property: "og:title", content: "Produção — Base 01" },
      {
        property: "og:description",
        content: "Análise operacional da reciclagem a partir dos tickets de pesagem.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Producao,
});

const iso = (d: Date) => d.toISOString().slice(0, 10);

function semanaKey(data: string) {
  const d = new Date(`${data}T00:00:00`);
  const dia = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dia);
  return iso(d);
}

function semanaLabel(key: string) {
  const [, m = "", dd = ""] = key.split("-");
  return `${dd}/${m}`;
}

function Producao() {
  const [periodo, setPeriodo] = useState("mes");
  const [materialId, setMaterialId] = useState("todos");
  const hoje = iso(new Date());
  const [de, setDe] = useState(hoje);
  const [ate, setAte] = useState(hoje);

  const { data: materiais = [] } = useMateriais(true);
  const { data: movs = [] } = useMovimentacoes();
  const { data: fornecedores = [] } = useParceiros("fornecedores");
  const { data: clientes = [] } = useParceiros("clientes");

  const intervalo = useMemo(() => {
    const fim = new Date();
    const inicio = new Date();
    if (periodo === "semana") inicio.setDate(inicio.getDate() - 6);
    else if (periodo === "mes") inicio.setDate(inicio.getDate() - 29);
    else if (periodo === "trimestre") inicio.setDate(inicio.getDate() - 89);
    else return { inicio: de, fim: ate };
    return { inicio: iso(inicio), fim: iso(fim) };
  }, [periodo, de, ate]);

  const nomeMaterial = (id: string) => materiais.find((m) => m.id === id)?.nome ?? "Material";

  const filtrados = useMemo(
    () =>
      movs.filter(
        (m) =>
          m.data >= intervalo.inicio &&
          m.data <= intervalo.fim &&
          (materialId === "todos" || m.material_id === materialId),
      ),
    [movs, intervalo, materialId],
  );

  const soma = (lista: Movimentacao[], campo: "quantidade" | "valor_total") =>
    lista.reduce((s, m) => s + Number(m[campo]), 0);

  const entradas = filtrados.filter((m) => m.tipo === "entrada");
  const saidas = filtrados.filter((m) => m.tipo === "saida");
  const pesoEntrada = soma(entradas, "quantidade");
  const pesoSaida = soma(saidas, "quantidade");
  const diferenca = pesoEntrada - pesoSaida;

  const dias = Math.max(
    1,
    Math.round(
      (new Date(`${intervalo.fim}T00:00:00`).getTime() -
        new Date(`${intervalo.inicio}T00:00:00`).getTime()) /
        86_400_000,
    ) + 1,
  );

  // 1. Volume processado por semana e por mês (peso de saída)
  const [agrupamento, setAgrupamento] = useState<"semana" | "mes">("semana");
  const serieVolume = useMemo(() => {
    const mapa = new Map<string, { chave: string; entrada: number; saida: number }>();
    filtrados.forEach((m) => {
      const k = agrupamento === "semana" ? semanaKey(m.data) : m.data.slice(0, 7);
      const atual = mapa.get(k) ?? { chave: k, entrada: 0, saida: 0 };
      if (m.tipo === "entrada") atual.entrada += Number(m.quantidade);
      else atual.saida += Number(m.quantidade);
      mapa.set(k, atual);
    });
    return [...mapa.values()]
      .sort((a, b) => a.chave.localeCompare(b.chave))
      .map((x) => ({
        ...x,
        label: agrupamento === "semana" ? semanaLabel(x.chave) : monthLabel(x.chave),
      }));
  }, [filtrados, agrupamento]);

  // 2. Entrada x saída por material
  const porMaterial = useMemo(() => {
    const mapa = new Map<
      string,
      { id: string; nome: string; entrada: number; saida: number; compras: number; vendas: number }
    >();
    filtrados.forEach((m) => {
      const atual =
        mapa.get(m.material_id) ??
        { id: m.material_id, nome: nomeMaterial(m.material_id), entrada: 0, saida: 0, compras: 0, vendas: 0 };
      if (m.tipo === "entrada") {
        atual.entrada += Number(m.quantidade);
        atual.compras += Number(m.valor_total);
      } else {
        atual.saida += Number(m.quantidade);
        atual.vendas += Number(m.valor_total);
      }
      mapa.set(m.material_id, atual);
    });
    return [...mapa.values()].sort((a, b) => b.entrada + b.saida - (a.entrada + a.saida));
  }, [filtrados, materiais]);

  // 3. Giro de estoque por material
  const saldos = useMemo(() => calcularSaldos(materiais, movs), [materiais, movs]);
  const giro = useMemo(
    () =>
      porMaterial.map((m) => {
        const saldo = saldos.find((s) => s.material.id === m.id);
        const saldoAtual = Math.max(saldo?.saldoQtd ?? 0, 0);
        const saldoMedio = Math.max((saldoAtual + (saldoAtual + m.saida - m.entrada)) / 2, 0);
        const porDia = m.saida / dias;
        return {
          ...m,
          saldoAtual,
          diasGiro: porDia > 0 ? saldoMedio / porDia : null,
        };
      }),
    [porMaterial, saldos, dias],
  );

  // 4. Ranking por margem
  const margens = useMemo(
    () =>
      porMaterial
        .map((m) => {
          const precoCompra = m.entrada > 0 ? m.compras / m.entrada : 0;
          const precoVenda = m.saida > 0 ? m.vendas / m.saida : 0;
          const margem = precoVenda && precoCompra ? precoVenda - precoCompra : precoVenda - precoCompra;
          const percentual = precoCompra > 0 ? (margem / precoCompra) * 100 : null;
          return { ...m, precoCompra, precoVenda, margem, percentual };
        })
        .filter((m) => m.precoVenda > 0 || m.precoCompra > 0)
        .sort((a, b) => b.margem - a.margem),
    [porMaterial],
  );

  // 5. Concentração de parceiros
  const ranking = (tipo: "entrada" | "saida") => {
    const campo = tipo === "entrada" ? "fornecedor_id" : "cliente_id";
    const lista = tipo === "entrada" ? fornecedores : clientes;
    const mapa = new Map<string, number>();
    filtrados
      .filter((m) => m.tipo === tipo)
      .forEach((m) => {
        const id = (m[campo] as string | null) ?? "sem";
        mapa.set(id, (mapa.get(id) ?? 0) + Number(m.quantidade));
      });
    const total = [...mapa.values()].reduce((s, v) => s + v, 0);
    return {
      total,
      itens: [...mapa.entries()]
        .map(([id, peso]) => ({
          nome: lista.find((p) => p.id === id)?.nome ?? "Sem cadastro",
          peso,
          share: total > 0 ? (peso / total) * 100 : 0,
        }))
        .sort((a, b) => b.peso - a.peso)
        .slice(0, 5),
    };
  };
  const topFornecedores = useMemo(() => ranking("entrada"), [filtrados, fornecedores]);
  const topClientes = useMemo(() => ranking("saida"), [filtrados, clientes]);

  // 6. Impacto acumulado (histórico completo)
  const impacto = useMemo(() => {
    const mapa = new Map<string, number>();
    movs
      .filter((m) => m.tipo === "saida")
      .forEach((m) => mapa.set(m.material_id, (mapa.get(m.material_id) ?? 0) + Number(m.quantidade)));
    const itens = [...mapa.entries()]
      .map(([id, kg]) => ({ nome: nomeMaterial(id), toneladas: kg / 1000 }))
      .sort((a, b) => b.toneladas - a.toneladas);
    return { itens, total: itens.reduce((s, x) => s + x.toneladas, 0) };
  }, [movs, materiais]);

  const TendenciaIcone = diferenca > 0 ? ArrowUpRight : diferenca < 0 ? ArrowDownRight : Minus;
  const tendenciaTexto =
    diferenca > 0
      ? "Estoque acumulando: comprando mais do que vende"
      : diferenca < 0
        ? "Estoque reduzindo: vendendo mais rápido do que compra"
        : "Entrada e saída equilibradas";

  return (
    <div>
      <PageHeader
        titulo="Produção"
        descricao="Análise operacional derivada automaticamente dos tickets de pesagem."
      />

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-card">
        <div className="grid gap-1.5">
          <Label className="text-xs">Período</Label>
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Últimos 7 dias</SelectItem>
              <SelectItem value="mes">Últimos 30 dias</SelectItem>
              <SelectItem value="trimestre">Últimos 90 dias</SelectItem>
              <SelectItem value="personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {periodo === "personalizado" && (
          <>
            <div className="grid gap-1.5">
              <Label className="text-xs">De</Label>
              <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
            </div>
          </>
        )}
        <div className="grid gap-1.5">
          <Label className="text-xs">Material</Label>
          <Select value={materialId} onValueChange={setMaterialId}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os materiais</SelectItem>
              {materiais.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Agrupar por</Label>
          <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as "semana" | "mes")}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Semana</SelectItem>
              <SelectItem value="mes">Mês</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard destaque label="Volume processado (saída)" valor={`${num(pesoSaida)} kg`} detalhe={`${num(pesoSaida / dias)} kg/dia`} />
        <StatCard label="Entrada (compra)" valor={`${num(pesoEntrada)} kg`} detalhe={`${entradas.length} tickets`} />
        <StatCard label="Saída (venda)" valor={`${num(pesoSaida)} kg`} detalhe={`${saidas.length} tickets`} />
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Entrada − Saída
          </span>
          <div
            className={`mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight ${
              diferenca > 0 ? "text-amber-600" : diferenca < 0 ? "text-emerald-600" : ""
            }`}
          >
            <TendenciaIcone className="h-6 w-6" />
            {num(diferenca)} kg
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{tendenciaTexto}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-sm font-bold">Entrada x Saída no período</h2>
          <p className="mb-4 text-xs text-muted-foreground">Peso comprado x peso vendido por {agrupamento}.</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieVolume}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => `${num(v)} kg`} />
                <Legend />
                <Bar dataKey="entrada" name="Entrada" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saida" name="Saída" fill="hsl(var(--chart-2))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <h2 className="text-sm font-bold">Volume processado</h2>
          <p className="mb-4 text-xs text-muted-foreground">Peso de saída (material processado e vendido).</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieVolume}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => `${num(v)} kg`} />
                <Line type="monotone" dataKey="saida" name="Processado" stroke="hsl(var(--chart-2))" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="p-5 pb-3">
          <h2 className="text-sm font-bold">Entrada x saída e giro por material</h2>
          <p className="text-xs text-muted-foreground">
            Giro aproximado: saldo médio de estoque ÷ volume médio processado por dia.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-2 text-left">Material</th>
                <th className="px-5 py-2 text-right">Entrada (kg)</th>
                <th className="px-5 py-2 text-right">Saída (kg)</th>
                <th className="px-5 py-2 text-right">Diferença</th>
                <th className="px-5 py-2 text-right">Saldo atual</th>
                <th className="px-5 py-2 text-right">Giro (dias)</th>
              </tr>
            </thead>
            <tbody>
              {giro.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-5 py-2.5 font-medium">{m.nome}</td>
                  <td className="px-5 py-2.5 text-right">{num(m.entrada)}</td>
                  <td className="px-5 py-2.5 text-right">{num(m.saida)}</td>
                  <td
                    className={`px-5 py-2.5 text-right ${
                      m.entrada - m.saida > 0 ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {num(m.entrada - m.saida)}
                  </td>
                  <td className="px-5 py-2.5 text-right">{num(m.saldoAtual)}</td>
                  <td className="px-5 py-2.5 text-right">
                    {m.diasGiro === null ? "—" : `${num(m.diasGiro, 1)} d`}
                  </td>
                </tr>
              ))}
              {!giro.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                    Nenhuma movimentação no período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="p-5 pb-3">
          <h2 className="text-sm font-bold">Ranking de materiais por margem</h2>
          <p className="text-xs text-muted-foreground">
            Preço médio de venda menos preço médio de compra por kg no período.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-2 text-left">Material</th>
                <th className="px-5 py-2 text-right">Compra médio/kg</th>
                <th className="px-5 py-2 text-right">Venda médio/kg</th>
                <th className="px-5 py-2 text-right">Margem/kg</th>
                <th className="px-5 py-2 text-right">Margem %</th>
              </tr>
            </thead>
            <tbody>
              {margens.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="px-5 py-2.5 font-medium">{m.nome}</td>
                  <td className="px-5 py-2.5 text-right">{brl(m.precoCompra)}</td>
                  <td className="px-5 py-2.5 text-right">{brl(m.precoVenda)}</td>
                  <td
                    className={`px-5 py-2.5 text-right font-semibold ${
                      m.margem >= 0 ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {brl(m.margem)}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {m.percentual === null ? "—" : `${num(m.percentual, 1)}%`}
                  </td>
                </tr>
              ))}
              {!margens.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    Sem dados de compra e venda no período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {[
          { titulo: "Top 5 fornecedores", dados: topFornecedores, sufixo: "do peso comprado" },
          { titulo: "Top 5 clientes", dados: topClientes, sufixo: "do peso vendido" },
        ].map((bloco) => (
          <div key={bloco.titulo} className="rounded-2xl border bg-card p-5 shadow-card">
            <h2 className="text-sm font-bold">{bloco.titulo}</h2>
            <p className="mb-4 text-xs text-muted-foreground">Concentração por volume movimentado no período.</p>
            <div className="grid gap-3">
              {bloco.dados.itens.map((i) => (
                <div key={i.nome}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{i.nome}</span>
                    <span className="text-muted-foreground">
                      {num(i.peso)} kg · {num(i.share, 1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-brand-gradient" style={{ width: `${i.share}%` }} />
                  </div>
                </div>
              ))}
              {!bloco.dados.itens.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">Sem dados no período.</p>
              )}
              {bloco.dados.itens.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Os 5 maiores representam {num(bloco.dados.itens.reduce((s, i) => s + i.share, 0), 1)}%{" "}
                  {bloco.sufixo}.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold">Impacto acumulado</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            destaque
            label="Total reciclado"
            valor={`${num(impacto.total, 2)} t`}
            detalhe="Desde o início da operação"
          />
          {impacto.itens.slice(0, 7).map((i) => (
            <StatCard key={i.nome} label={i.nome} valor={`${num(i.toneladas, 2)} t`} detalhe="Acumulado" />
          ))}
        </div>
      </div>
    </div>
  );
}
