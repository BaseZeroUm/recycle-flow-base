import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Wine } from "lucide-react";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { FiltroPeriodo, hojeIso, inicioDoMesAtual } from "@/components/FiltroPeriodo";
import { brl, num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/adega/")({
  head: () => ({
    meta: [
      { title: "Painel da Adega — Base 01" },
      { name: "description", content: "Faturamento, vendas, margem e estoque da sua adega." },
      { property: "og:title", content: "Painel da Adega — Base 01" },
      { property: "og:description", content: "Faturamento, vendas, margem e estoque da sua adega." },
    ],
  }),
  component: PainelAdega,
});

/** Indicadores da Adega. Zerados até existirem as tabelas de vendas/produtos. */
interface KpisAdega {
  faturamento: number;
  vendas: number;
  lucroBruto: number;
  clientes: number;
  estoqueUnidades: number;
}

const KPIS_VAZIOS: KpisAdega = { faturamento: 0, vendas: 0, lucroBruto: 0, clientes: 0, estoqueUnidades: 0 };

function PainelAdega() {
  const [de, setDe] = useState(inicioDoMesAtual());
  const [ate, setAte] = useState(hojeIso());
  const k = KPIS_VAZIOS;
  const ticketMedio = k.vendas > 0 ? k.faturamento / k.vendas : 0;
  const margem = k.faturamento > 0 ? (k.lucroBruto / k.faturamento) * 100 : 0;

  return (
    <div>
      <PageHeader
        titulo="Painel"
        descricao="Visão geral das vendas, margem e estoque da sua adega."
        acoes={<FiltroPeriodo de={de} ate={ate} onChange={(d, a) => { setDe(d); setAte(a); }} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard destaque label="Faturamento do período" valor={brl(k.faturamento)} />
        <StatCard label="Número de vendas" valor={num(k.vendas, 0)} />
        <StatCard label="Ticket médio" valor={brl(ticketMedio)} />
        <StatCard label="Lucro bruto" valor={brl(k.lucroBruto)} />
        <StatCard label="Margem bruta" valor={`${num(margem, 1)}%`} />
        <StatCard label="Clientes atendidos" valor={num(k.clientes, 0)} />
        <StatCard label="Estoque total" valor={`${num(k.estoqueUnidades, 0)} un.`} />
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card p-10 text-center shadow-card">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wine className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="font-bold">Nenhuma venda registrada ainda</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Os indicadores serão preenchidos automaticamente assim que os módulos de vendas, produtos e estoque da Adega forem liberados.
        </p>
      </div>
    </div>
  );
}
