import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BarChart3, Boxes, Factory, LineChart, Wallet } from "lucide-react";
import { LogoFull } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Base 01 — Gestão para empresas de reciclagem" },
      {
        name: "description",
        content:
          "Controle de estoque de recicláveis, receitas e despesas, fluxo de caixa e DRE automática para PMEs de reciclagem.",
      },
      { property: "og:title", content: "Base 01 — Gestão para empresas de reciclagem" },
      {
        property: "og:description",
        content: "Estoque, financeiro, fluxo de caixa e DRE automática numa só base.",
      },
    ],
  }),
  component: Index,
});

const modulos = [
  { icon: Boxes, titulo: "Estoque", texto: "Entrada por compra e coleta, saída por venda, saldo por material." },
  { icon: Wallet, titulo: "Financeiro", texto: "Receitas, despesas, contas a pagar e a receber com vencimentos." },
  { icon: LineChart, titulo: "Fluxo de caixa", texto: "Entradas, saídas, saldo acumulado e projeção do que está por vir." },
  { icon: BarChart3, titulo: "DRE automática", texto: "Da receita bruta ao lucro líquido, gerada dos seus lançamentos." },
  { icon: Factory, titulo: "Produção", texto: "Entrada × saída, giro de estoque, margem por material e impacto reciclado." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <LogoFull />
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to="/assinatura">Assinatura</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="pt-10 pb-16 md:pt-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Base 01 → gestão para reciclagem
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.05] md:text-6xl">
            Toda decisão{" "}
            <span className="text-brand-gradient">precisa de uma base.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Estoque de recicláveis, financeiro, fluxo de caixa e DRE numa plataforma só — feita para o
            tamanho da sua operação.
          </p>
          <div className="mt-9">
            <Button asChild size="lg" variant="brand">
              <Link to="/auth">
                Criar conta da minha empresa <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {modulos.map((m) => (
            <div key={m.titulo} className="rounded-2xl border bg-card p-6 shadow-card">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient">
                <m.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h2 className="mt-4 text-base font-bold">{m.titulo}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{m.texto}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
