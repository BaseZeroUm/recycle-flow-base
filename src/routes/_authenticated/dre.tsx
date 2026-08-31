import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { brl } from "@/lib/format";
import { imprimirRelatorio } from "@/lib/impressao";
import { calcularSaldos, useCategorias, useLancamentos, useMateriais, useMovimentacoes } from "@/lib/dados";
import { podeFinanceiro, useSessao } from "@/hooks/use-sessao";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/dre")({
  head: () => ({
    meta: [
      { title: "DRE — Base 01" },
      { name: "description", content: "Demonstrativo de resultado automático da sua operação." },
      { property: "og:title", content: "DRE — Base 01" },
      { property: "og:description", content: "Demonstrativo de resultado automático da sua operação." },
    ],
  }),
  component: Dre,
});

export function linhaClasse(destaque?: boolean) {
  return destaque
    ? "flex items-center justify-between border-t px-5 py-3 font-bold"
    : "flex items-center justify-between px-5 py-2.5 text-sm";
}

function Dre() {
  const [meses, setMeses] = useState("6");
  const { data: sessao } = useSessao();
  const autorizado = podeFinanceiro(sessao);
  const { data: lancs = [] } = useLancamentos(autorizado);
  const { data: categorias = [] } = useCategorias();
  const { data: materiais = [] } = useMateriais();
  const { data: movs = [] } = useMovimentacoes();

  const limite = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - (Number(meses) - 1));
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }, [meses]);

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

  const noPeriodo = lancs.filter((l) => l.data_vencimento >= limite);
  const receitaBruta = noPeriodo.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const impostos = noPeriodo.filter((l) => l.tipo === "despesa" && l.imposto).reduce((s, l) => s + Number(l.valor), 0);
  const receitaLiquida = receitaBruta - impostos;

  const saldos = calcularSaldos(materiais, movs);
  const cmv = movs
    .filter((m) => m.tipo === "saida" && m.data >= limite)
    .reduce((s, m) => {
      const custo = saldos.find((x) => x.material.id === m.material_id)?.custoMedio ?? 0;
      return s + Number(m.quantidade) * custo;
    }, 0);

  const lucroBruto = receitaLiquida - cmv;

  const porGrupo = (grupo: string) =>
    noPeriodo
      .filter((l) => {
        if (l.tipo !== "despesa" || l.imposto) return false;
        return categorias.find((c) => c.id === l.categoria_id)?.grupo === grupo;
      })
      .reduce((s, l) => s + Number(l.valor), 0);

  const operacional = porGrupo("operacional");
  const administrativa = porGrupo("administrativa");
  const frota = porGrupo("frota");
  const folha = porGrupo("folha");
  const financeira = porGrupo("financeira");
  const semCategoria = noPeriodo
    .filter((l) => l.tipo === "despesa" && !l.imposto && !l.categoria_id)
    .reduce((s, l) => s + Number(l.valor), 0);

  const despesasOperacionais = operacional + administrativa + frota + folha + semCategoria;
  const resultadoOperacional = lucroBruto - despesasOperacionais;
  const resultadoLiquido = resultadoOperacional - financeira;
  const margem = receitaBruta > 0 ? (resultadoLiquido / receitaBruta) * 100 : 0;

  const linhas: { label: string; valor: number; destaque?: boolean }[] = [
    { label: "Receita bruta de vendas", valor: receitaBruta },
    { label: "(–) Impostos sobre vendas", valor: -impostos },
    { label: "= Receita líquida", valor: receitaLiquida, destaque: true },
    { label: "(–) CMV (custo do material vendido)", valor: -cmv },
    { label: "= Lucro bruto", valor: lucroBruto, destaque: true },
    { label: "(–) Despesas operacionais", valor: -operacional },
    { label: "(–) Despesas administrativas", valor: -administrativa },
    { label: "(–) Frota", valor: -frota },
    { label: "(–) Folha de pagamento", valor: -folha },
    { label: "(–) Outras despesas", valor: -semCategoria },
    { label: "= Resultado operacional", valor: resultadoOperacional, destaque: true },
    { label: "(–) Despesas financeiras", valor: -financeira },
    { label: "= Resultado líquido", valor: resultadoLiquido, destaque: true },
  ];

  function imprimir() {
    const corpo = `<table><tbody>${linhas
      .map(
        (l) =>
          `<tr${l.destaque ? ' style="font-weight:700;border-top:2px solid #111"' : ""}><td>${l.label}</td><td class="r">${brl(l.valor)}</td></tr>`,
      )
      .join("")}</tbody>
      <tfoot><tr><td>Margem líquida</td><td class="r">${margem.toFixed(1)}%</td></tr></tfoot></table>`;
    imprimirRelatorio({
      titulo: `${sessao?.empresaNome ?? "Empresa"} — DRE`,
      nomeArquivo: "DRE",
      subtitulo: `Período: últimos ${meses} mês(es) · emitido em ${new Date().toLocaleString("pt-BR")}`,
      corpo,
    });
  }

  return (
    <div>
      <PageHeader
        titulo="DRE"
        descricao="Demonstrativo de resultado gerado a partir dos lançamentos e do estoque."
        acoes={
          <>
            <Button size="sm" variant="outline" onClick={imprimir} className="shrink-0">
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
            <Select value={meses} onValueChange={setMeses}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Mês atual</SelectItem>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard destaque label="Receita bruta" valor={brl(receitaBruta)} />
        <StatCard label="Lucro bruto" valor={brl(lucroBruto)} detalhe={`CMV ${brl(cmv)}`} />
        <StatCard label="Resultado líquido" valor={brl(resultadoLiquido)} detalhe={`Margem ${margem.toFixed(1)}%`} />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card py-2 shadow-card">
        {linhas.map((l) => (
          <div key={l.label} className={linhaClasse(l.destaque)}>
            <span>{l.label}</span>
            <span className={l.valor < 0 ? "text-muted-foreground" : ""}>{brl(l.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
