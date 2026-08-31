import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  Check,
  Factory,
  LineChart,
  MessageCircle,
  Scale,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import { LogoFull } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura mensal — Base 01" },
      {
        name: "description",
        content:
          "Plano mensal Base 01: estoque e pesagem com ticket, financeiro, fluxo de caixa e DRE para empresas de reciclagem. Feche pelo WhatsApp.",
      },
      { property: "og:title", content: "Assinatura mensal — Base 01" },
      {
        property: "og:description",
        content:
          "Gestão completa para empresas de reciclagem. Assinatura mensal, sem fidelidade. Fale conosco no WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Assinatura,
});

const WHATSAPP_URL =
  "https://wa.me/5511911380734?text=" +
  encodeURIComponent("Olá! Quero assinar o Base 01 para minha empresa de reciclagem.");

const incluido = [
  { icon: Scale, titulo: "Estoque e pesagem", texto: "Registro de peso, saldo por material e custo médio." },
  { icon: Ticket, titulo: "Ticket de pesagem", texto: "Número sequencial, exportação em PNG e envio por WhatsApp." },
  { icon: Boxes, titulo: "Materiais e categorias", texto: "Cadastre os materiais que trabalha, com categorias próprias." },
  { icon: Wallet, titulo: "Financeiro", texto: "Contas a pagar e a receber geradas direto da pesagem." },
  { icon: LineChart, titulo: "Fluxo de caixa", texto: "Realizado e previsto, com saldo acumulado e projeção." },
  { icon: BarChart3, titulo: "DRE automática", texto: "Da receita bruta ao lucro líquido, sem planilha." },
  { icon: Users, titulo: "Equipe com perfis", texto: "Administrador, Financeiro e Operacional, cada um com seu acesso." },
];

function Assinatura() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/">
          <LogoFull />
        </Link>
        <Button asChild size="sm" variant="outline">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <section className="pt-10 pb-12 text-center md:pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Base 01 → assinatura mensal
          </p>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold leading-[1.05] md:text-5xl">
            Um plano. <span className="text-brand-gradient">Tudo incluso.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Assinatura mensal, sem fidelidade e sem taxa de implantação. Cancele quando quiser.
          </p>
        </section>

        <section className="rounded-3xl border bg-card p-8 shadow-card md:p-10">
          <h2 className="text-xl font-bold">O que está incluso</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {incluido.map((item) => (
              <div key={item.titulo} className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient">
                  <item.icon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <p className="font-semibold">{item.titulo}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.texto}</p>
                </div>
              </div>
            ))}
          </div>

          <ul className="mt-8 space-y-2 border-t pt-6 text-sm text-muted-foreground">
            {[
              "Usuários ilimitados",
              "Suporte por WhatsApp",
              "Atualizações e novos módulos sem custo extra",
              "Seus dados protegidos por empresa — ninguém vê além da sua equipe",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" /> {t}
              </li>
            ))}
          </ul>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-2 rounded-2xl border bg-background p-6 text-center">
              <p className="text-sm text-muted-foreground">Mensal</p>
              <p className="text-4xl font-extrabold">
                R$300<span className="text-base font-medium text-muted-foreground">/mês</span>
              </p>
              <p className="text-xs text-muted-foreground">Cancele quando quiser.</p>
            </div>
            <div className="relative flex flex-col items-center gap-2 rounded-2xl border bg-background p-6 text-center">
              <span className="absolute -top-3 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                Melhor custo
              </span>
              <p className="text-sm text-muted-foreground">Trimestral</p>
              <p className="text-4xl font-extrabold">
                R$200<span className="text-base font-medium text-muted-foreground">/mês</span>
              </p>
              <p className="text-xs text-muted-foreground">R$600 a cada 3 meses.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-muted/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Valores e condições são fechados direto com a gente — rápido e sem burocracia.
            </p>
            <Button asChild size="lg" variant="brand">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5" /> Chamar no WhatsApp
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">+55 (11) 91138-0734</p>
          </div>
        </section>
      </main>
    </div>
  );
}
