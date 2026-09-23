import { Wine, Sparkles, Clock, ShieldCheck, ArrowRight, MessageCircle, BarChart3, Package, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdegaDashboardPlaceholder({
  empresaNome,
}: {
  empresaNome: string;
}) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Banner Principal com Ambient Glow */}
      <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-950/40 via-card to-background p-8 md:p-12 shadow-xl">
        <div className="absolute -right-20 -top-20 size-72 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 size-72 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-semibold text-purple-600 dark:text-purple-300">
            <Sparkles className="size-3.5 text-purple-500" />
            <span>Segmento Adega &amp; Bebidas</span>
            <span className="size-1 rounded-full bg-purple-400" />
            <span className="text-[11px] opacity-80">Em Breve</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-4xl lg:text-5xl">
            Olá, <span className="bg-gradient-to-r from-purple-600 via-rose-500 to-amber-500 bg-clip-text text-transparent">{empresaNome}</span>.
            <br />O módulo <span className="text-foreground">Adega</span> está em desenvolvimento.
          </h1>

          <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
            Estamos construindo uma plataforma sob medida para a gestão completa da sua adega:
            controle de rótulos, safras, garrafas em climatização, pedidos e degustações.
            Sua conta já está reservada com acesso prioritário.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              className="rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/25"
              onClick={() => {
                window.open("https://wa.me/5511999999999?text=Ol%C3%A1%2C+gostaria+de+saber+mais+sobre+o+m%C3%B3dulo+Adega+da+Base01", "_blank");
              }}
            >
              <MessageCircle className="mr-2 size-4" />
              Falar com o time de implantação
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
              <Clock className="size-4 text-purple-500" />
              <span>Previsão de liberação dos primeiros recursos em breve</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Recursos em Desenvolvimento */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground">O que você terá no módulo Adega</h2>
          <p className="text-sm text-muted-foreground">
            Funcionalidades planejadas exclusivamente para as necessidades do seu segmento.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="group rounded-2xl border border-border/80 bg-card p-5 shadow-card transition-all hover:border-purple-500/40 hover:shadow-lg">
            <div className="flex size-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <Wine className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">Safras &amp; Rótulos</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Catálogo detalhado por safra, vinícola, tipo de uva, teor alcoólico e pontuações de sommelier.
            </p>
          </div>

          <div className="group rounded-2xl border border-border/80 bg-card p-5 shadow-card transition-all hover:border-purple-500/40 hover:shadow-lg">
            <div className="flex size-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <Package className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">Estoque Climatizado</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Rastreamento de garrafas, caixas fechadas, barris e controle de perdas por quebra ou validade.
            </p>
          </div>

          <div className="group rounded-2xl border border-border/80 bg-card p-5 shadow-card transition-all hover:border-purple-500/40 hover:shadow-lg">
            <div className="flex size-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <BookOpen className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">Degustação &amp; PDV</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Registro ágil de fichas de degustação, eventos na adega e faturamento no balcão em tempo real.
            </p>
          </div>

          <div className="group rounded-2xl border border-border/80 bg-card p-5 shadow-card transition-all hover:border-purple-500/40 hover:shadow-lg">
            <div className="flex size-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
              <BarChart3 className="size-5" />
            </div>
            <h3 className="mt-4 font-semibold text-foreground">DRE &amp; Lucratividade</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Análise de margem de lucro por rótulo, giro de estoque e projeção de receita especializada.
            </p>
          </div>
        </div>
      </div>

      {/* Nota de Segurança e Suporte */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-border bg-muted/40 p-5 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Ambiente seguro e configurado</p>
            <p className="text-xs text-muted-foreground">
              Sua conta já está ativada com todas as permissões no sistema Base 01.
            </p>
          </div>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <span>Dúvidas ou sugestões de recursos? Entre em contato pelo suporte.</span>
        </div>
      </div>
    </div>
  );
}
