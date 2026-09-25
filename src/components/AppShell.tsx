import type { ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Scale,
  Wallet,
  LineChart,
  Factory,
  ShoppingCart,
  Package,
  Warehouse,
  Truck,
  Users,
  PieChart,
  Settings,
} from "lucide-react";
import { useRouteContext } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { LogoFull, LogoIcon } from "@/components/Logo";
import { ehAdmin, podeFinanceiro, useSessao } from "@/hooks/use-sessao";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { TrialContador } from "@/components/TrialContador";

type Item = {
  title: string;
  url: string;
  icon: typeof Boxes;
  acesso: "todos" | "financeiro" | "admin";
  /** Ainda não disponível: aparece no menu sem link. */
  emBreve?: boolean;
};

const breve = (title: string, icon: typeof Boxes, acesso: Item["acesso"] = "todos"): Item => ({
  title,
  url: `#${title}`,
  icon,
  acesso,
  emBreve: true,
});

const gruposAdega: { label: string; itens: Item[] }[] = [
  { label: "Análise", itens: [{ title: "Painel", url: "/adega", icon: LayoutDashboard, acesso: "todos" }, breve("Analytics", PieChart)] },
  { label: "Vendas", itens: [breve("PDV / Nova venda", ShoppingCart), breve("Vendas", ShoppingCart), breve("Comandas", FileSpreadsheet), breve("Mesas", LayoutDashboard)] },
  { label: "Produtos", itens: [breve("Produtos", Package), breve("Categorias", Boxes), breve("Fichas técnicas", FileSpreadsheet)] },
  { label: "Estoque", itens: [breve("Estoque", Warehouse), breve("Movimentações", Boxes), breve("Inventário", BarChart3), breve("Perdas", Boxes)] },
  { label: "Compras", itens: [breve("Compras", Truck), breve("Fornecedores", Truck)] },
  {
    label: "Financeiro",
    itens: [
      breve("Caixa", Banknote, "financeiro"),
      breve("Contas a pagar", Wallet, "financeiro"),
      breve("Contas a receber", Wallet, "financeiro"),
      breve("Fluxo de caixa", LineChart, "financeiro"),
      breve("DRE", FileSpreadsheet, "financeiro"),
    ],
  },
  { label: "Clientes", itens: [breve("Clientes", Users), breve("CRM", Users)] },
  { label: "Configurações", itens: [{ title: "Empresa", url: "/empresa", icon: Settings, acesso: "todos" }] },
];

const grupos: { label: string; itens: Item[] }[] = [
  {
    label: "Análise",
    itens: [
      { title: "Painel", url: "/painel", icon: LayoutDashboard, acesso: "todos" },
      { title: "Fluxo de caixa", url: "/fluxo-de-caixa", icon: LineChart, acesso: "financeiro" },
      { title: "DRE", url: "/dre", icon: FileSpreadsheet, acesso: "financeiro" },
      { title: "Produção", url: "/producao", icon: Factory, acesso: "todos" },
    ],
  },
  {
    label: "Operação",
    itens: [
      { title: "Estoque e pesagem", url: "/estoque", icon: Scale, acesso: "todos" },
      { title: "Caixa", url: "/caixa", icon: Banknote, acesso: "financeiro" },
      { title: "Financeiro", url: "/financeiro", icon: Wallet, acesso: "financeiro" },
    ],
  },
  {
    label: "Cadastros",
    itens: [
      { title: "Cadastros", url: "/cadastros", icon: BarChart3, acesso: "todos" },
      { title: "Empresa", url: "/empresa", icon: Building2, acesso: "todos" },
    ],
  },
];

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { data: sessao } = useSessao();
  const { segmento } = useRouteContext({ from: "/_authenticated" });
  const menu = segmento === "adega" ? gruposAdega : grupos;

  const visivel = (item: Item) =>
    item.acesso === "todos" ||
    (item.acesso === "financeiro" && podeFinanceiro(sessao)) ||
    (item.acesso === "admin" && ehAdmin(sessao));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex h-16 items-center px-3">
          {collapsed ? <LogoIcon className="h-8 w-8" /> : <LogoFull />}
        </div>
        {menu.map((g) => {
          const itens = g.itens.filter(visivel);
          if (!itens.length) return null;
          return (
            <SidebarGroup key={g.label}>
              <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {itens.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      {item.emBreve ? (
                        <SidebarMenuButton aria-disabled="true" disabled className="cursor-not-allowed opacity-60" tooltip={`${item.title} (em breve)`}>
                          <item.icon className="h-4 w-4" />
                          {!collapsed && (
                            <span className="flex flex-1 items-center justify-between gap-2">
                              {item.title}
                              <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                            </span>
                          )}
                        </SidebarMenuButton>
                      ) : (
                      <SidebarMenuButton asChild isActive={path === item.url}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: sessao } = useSessao();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut({ scope: "global" });
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    } else {
      navigate({ to: "/auth", replace: true });
    }
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden sm:block">
                <div className="text-sm font-semibold leading-tight">{sessao?.empresaNome}</div>
                <div className="text-xs text-muted-foreground">
                  {sessao?.nome} · {sessao?.papeis.join(", ") || "sem papel"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrialContador />
              <Button variant="ghost" size="sm" onClick={sair}>
                <LogOut className="h-4 w-4" /> Sair
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
