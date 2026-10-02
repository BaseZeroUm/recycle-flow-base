import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Wine,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { FiltroPeriodo, hojeIso, inicioDoMesAtual } from "@/components/FiltroPeriodo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, num } from "@/lib/format";
import {
  calcularSaldos,
  useCategoriasMaterial,
  useLancamentos,
  useMateriais,
  useMovimentacoes,
  useParceiros,
  type Material,
} from "@/lib/dados";
import { podeFinanceiro, useSessao } from "@/hooks/use-sessao";
import { supabase } from "@/integrations/supabase/client";
import { sanitizarMensagemErro } from "@/lib/tratamento-erro";

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

const CORES_GRAFICO = ["#7c3aed", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#6366f1"];

export function PainelAdega() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const financeiro = podeFinanceiro(sessao);

  const [de, setDe] = useState(inicioDoMesAtual());
  const [ate, setAte] = useState(hojeIso());

  // Diálogo de Nova Venda
  const [dialogVendaAberto, setDialogVendaAberto] = useState(false);
  const [vendaMaterialId, setVendaMaterialId] = useState("");
  const [vendaQtd, setVendaQtd] = useState("1");
  const [vendaPreco, setVendaPreco] = useState("");
  const [vendaFormaPagamento, setVendaFormaPagamento] = useState("pix");
  const [vendaClienteId, setVendaClienteId] = useState("");
  const [vendaData, setVendaData] = useState(hojeIso());
  const [vendaObs, setVendaObs] = useState("");

  // Dados do Supabase
  const { data: materiais = [], isLoading: carregandoMateriais } = useMateriais(true);
  const { data: movs = [], isLoading: carregandoMovs } = useMovimentacoes();
  const { data: lancs = [] } = useLancamentos(financeiro);
  const { data: categoriasMaterial = [] } = useCategoriasMaterial();
  const { data: clientes = [] } = useParceiros("clientes");

  // Mapas auxiliares
  const materiaisById = useMemo(
    () => new Map<string, Material>(materiais.map((m) => [m.id, m])),
    [materiais],
  );

  const categoriasById = useMemo(
    () => new Map(categoriasMaterial.map((c) => [c.id, c.nome])),
    [categoriasMaterial],
  );

  const clientesById = useMemo(
    () => new Map(clientes.map((c) => [c.id, c.nome])),
    [clientes],
  );

  // Filtro por período
  const movsPeriodo = useMemo(
    () => movs.filter((m) => m.data >= de && m.data <= ate),
    [movs, de, ate],
  );

  const lancsPeriodo = useMemo(
    () => lancs.filter((l) => l.data_vencimento >= de && l.data_vencimento <= ate),
    [lancs, de, ate],
  );

  // Vendas / Saídas do período
  const vendasPeriodo = useMemo(
    () => movsPeriodo.filter((m) => m.tipo === "saida"),
    [movsPeriodo],
  );

  // Saldos de estoque
  const saldos = useMemo(() => calcularSaldos(materiais, movs), [materiais, movs]);
  const saldosById = useMemo(
    () => new Map(saldos.map((s) => [s.material.id, s])),
    [saldos],
  );

  // Cálculos dos KPIs
  const faturamentoVendas = useMemo(
    () => vendasPeriodo.reduce((acc, v) => acc + Number(v.valor_total || 0), 0),
    [vendasPeriodo],
  );

  const receitasFinanceiras = useMemo(
    () =>
      lancsPeriodo
        .filter((l) => l.tipo === "receita")
        .reduce((acc, l) => acc + Number(l.valor || 0), 0),
    [lancsPeriodo],
  );

  // Faturamento real: prioriza saídas registradas, com fallback para receitas
  const faturamento = faturamentoVendas > 0 ? faturamentoVendas : receitasFinanceiras;
  const totalVendas = vendasPeriodo.length > 0 ? vendasPeriodo.length : lancsPeriodo.filter((l) => l.tipo === "receita").length;
  const ticketMedio = totalVendas > 0 ? faturamento / totalVendas : 0;

  // Custo das mercadorias vendidas (CMV) para cálculo do Lucro Bruto
  const custoMercadoriasVendidas = useMemo(() => {
    return vendasPeriodo.reduce((acc, v) => {
      const mat = materiaisById.get(v.material_id);
      const custoUnitario = Number(mat?.preco_compra ?? 0);
      return acc + custoUnitario * Number(v.quantidade || 0);
    }, 0);
  }, [vendasPeriodo, materiaisById]);

  const lucroBruto = useMemo(() => {
    if (faturamento <= 0) return 0;
    if (custoMercadoriasVendidas > 0) return Math.max(0, faturamento - custoMercadoriasVendidas);
    const despesas = lancsPeriodo
      .filter((l) => l.tipo === "despesa")
      .reduce((s, l) => s + Number(l.valor || 0), 0);
    return Math.max(0, faturamento - despesas);
  }, [faturamento, custoMercadoriasVendidas, lancsPeriodo]);

  const margemBruta = faturamento > 0 ? (lucroBruto / faturamento) * 100 : 0;

  // Clientes únicos atendidos
  const clientesAtendidos = useMemo(() => {
    const clientesComVenda = new Set(
      vendasPeriodo.map((v) => v.cliente_id).filter((c): c is string => Boolean(c)),
    );
    return clientesComVenda.size > 0 ? clientesComVenda.size : clientes.filter((c) => c.ativo).length;
  }, [vendasPeriodo, clientes]);

  // Estoque total em unidades
  const estoqueUnidades = useMemo(
    () => saldos.reduce((acc, s) => acc + Math.max(0, s.saldoQtd), 0),
    [saldos],
  );

  const valorEstoqueTotal = useMemo(
    () => saldos.reduce((acc, s) => acc + s.valorEstoque, 0),
    [saldos],
  );

  // Evolução Diária de Vendas
  const dadosGraficoEvolucao = useMemo(() => {
    const mapa = new Map<string, { data: string; faturamento: number; vendas: number }>();
    vendasPeriodo.forEach((v) => {
      const chave = v.data;
      const atual = mapa.get(chave) ?? { data: chave, faturamento: 0, vendas: 0 };
      atual.faturamento += Number(v.valor_total || 0);
      atual.vendas += 1;
      mapa.set(chave, atual);
    });

    return Array.from(mapa.values())
      .sort((a, b) => a.data.localeCompare(b.data))
      .map((d) => {
        const [, m, dia] = d.data.split("-");
        return {
          ...d,
          label: `${dia}/${m}`,
        };
      });
  }, [vendasPeriodo]);

  // Vendas por Categoria de Bebida
  const dadosGraficoCategoria = useMemo(() => {
    const mapa = new Map<string, number>();
    vendasPeriodo.forEach((v) => {
      const mat = materiaisById.get(v.material_id);
      const catNome = mat?.categoria_material_id
        ? categoriasById.get(mat.categoria_material_id) ?? "Outros"
        : "Geral";
      mapa.set(catNome, (mapa.get(catNome) ?? 0) + Number(v.valor_total || 0));
    });

    return Array.from(mapa.entries()).map(([categoria, valor]) => ({
      categoria,
      valor,
    }));
  }, [vendasPeriodo, materiaisById, categoriasById]);

  // Top 5 Produtos Mais Vendidos
  const topProdutos = useMemo(() => {
    const mapa = new Map<string, { materialId: string; qtd: number; total: number }>();
    vendasPeriodo.forEach((v) => {
      const atual = mapa.get(v.material_id) ?? {
        materialId: v.material_id,
        qtd: 0,
        total: 0,
      };
      atual.qtd += Number(v.quantidade || 0);
      atual.total += Number(v.valor_total || 0);
      mapa.set(v.material_id, atual);
    });

    return Array.from(mapa.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((item) => {
        const mat = materiaisById.get(item.materialId);
        const catNome = mat?.categoria_material_id
          ? categoriasById.get(mat.categoria_material_id) ?? "Bebidas"
          : "Bebidas";
        return {
          id: item.materialId,
          nome: mat?.nome ?? "Produto não identificado",
          unidade: mat?.unidade ?? "un",
          categoria: catNome,
          quantidade: item.qtd,
          total: item.total,
        };
      });
  }, [vendasPeriodo, materiaisById, categoriasById]);

  // Alerta de Estoque Crítico (Produtos zerados ou com <= 5 unidades)
  const produtosEstoqueBaixo = useMemo(() => {
    return saldos
      .filter((s) => s.material.ativo && s.saldoQtd <= 5)
      .sort((a, b) => a.saldoQtd - b.saldoQtd)
      .slice(0, 5);
  }, [saldos]);

  // Invalidação de queries
  const invalidarQueries = () => {
    void queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
    void queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
    void queryClient.invalidateQueries({ queryKey: ["materiais"] });
    void queryClient.invalidateQueries({ queryKey: ["caixa_movimentos"] });
  };

  // Mutation: Registrar Nova Venda
  const registrarVendaMutation = useMutation({
    mutationFn: async () => {
      if (!sessao?.empresaId) throw new Error("Empresa não identificada.");
      if (!vendaMaterialId) throw new Error("Selecione um produto.");
      const qtdNum = Number(vendaQtd);
      if (!qtdNum || qtdNum <= 0) throw new Error("Informe uma quantidade válida.");
      const precoNum = Number(vendaPreco);
      if (Number.isNaN(precoNum) || precoNum < 0) throw new Error("Informe um preço unitário válido.");

      const mat = materiaisById.get(vendaMaterialId);
      const totalVenda = qtdNum * precoNum;

      // 1. Registra a saída no estoque
      const { data: movCriada, error: movError } = await supabase
        .from("movimentacoes_estoque")
        .insert({
          empresa_id: sessao.empresaId,
          tipo: "saida",
          material_id: vendaMaterialId,
          quantidade: qtdNum,
          valor_unitario: precoNum,
          valor_total: totalVenda,
          data: vendaData,
          cliente_id: vendaClienteId ? vendaClienteId : null,
          observacoes: vendaObs.trim() ? vendaObs.trim() : `Venda no balcão - ${mat?.nome ?? "Bebidas"}`,
          criado_por: sessao.userId,
        })
        .select("id")
        .single();

      if (movError) throw movError;

      // 2. Registra o faturamento financeiro (Receita)
      const formaLabel =
        vendaFormaPagamento === "pix"
          ? "PIX"
          : vendaFormaPagamento === "cartao_credito"
          ? "Cartão de Crédito"
          : vendaFormaPagamento === "cartao_debito"
          ? "Cartão de Débito"
          : vendaFormaPagamento === "dinheiro"
          ? "Dinheiro"
          : "A Prazo";

      const statusLancamento = vendaFormaPagamento === "prazo" ? "pendente" : "pago";

      const { error: lancError } = await supabase.from("lancamentos").insert({
        empresa_id: sessao.empresaId,
        tipo: "receita",
        descricao: `Venda Adega: ${mat?.nome ?? "Item"} (${qtdNum} ${mat?.unidade ?? "un"})`,
        valor: totalVenda,
        data_vencimento: vendaData,
        data_pagamento: statusLancamento === "pago" ? vendaData : null,
        forma_pagamento: formaLabel,
        status: statusLancamento,
        movimentacao_id: movCriada?.id ?? null,
      });

      if (lancError) throw lancError;
    },
    onSuccess: () => {
      toast.success("Venda registrada com sucesso no banco de dados!");
      setDialogVendaAberto(false);
      setVendaMaterialId("");
      setVendaQtd("1");
      setVendaPreco("");
      setVendaClienteId("");
      setVendaObs("");
      invalidarQueries();
    },
    onError: (e: Error) => {
      toast.error(`Falha ao registrar venda: ${sanitizarMensagemErro(e)}`);
    },
  });

  // Mutation: Inicializar Catálogo de Exemplo da Adega
  const carregarCatalogoMutation = useMutation({
    mutationFn: async () => {
      if (!sessao?.empresaId) throw new Error("Empresa não identificada.");

      // Cria categorias
      const { data: catVinho } = await supabase
        .from("categorias_material")
        .insert({ empresa_id: sessao.empresaId, nome: "Vinhos" })
        .select("id")
        .single();

      const { data: catCerveja } = await supabase
        .from("categorias_material")
        .insert({ empresa_id: sessao.empresaId, nome: "Cervejas" })
        .select("id")
        .single();

      const { data: catDestilado } = await supabase
        .from("categorias_material")
        .insert({ empresa_id: sessao.empresaId, nome: "Destilados" })
        .select("id")
        .single();

      const { data: catNaoAlcool } = await supabase
        .from("categorias_material")
        .insert({ empresa_id: sessao.empresaId, nome: "Não Alcoólicos" })
        .select("id")
        .single();

      const { data: catGelo } = await supabase
        .from("categorias_material")
        .insert({ empresa_id: sessao.empresaId, nome: "Gelo e Carvão" })
        .select("id")
        .single();

      // Produtos
      const produtosIniciais = [
        { nome: "Vinho Tinto Cabernet Sauvignon 750ml", preco_compra: 32.0, preco_venda: 65.0, cat: catVinho?.id },
        { nome: "Vinho Branco Sauvignon Blanc 750ml", preco_compra: 28.0, preco_venda: 58.0, cat: catVinho?.id },
        { nome: "Cerveja Heineken Long Neck 330ml", preco_compra: 5.5, preco_venda: 11.0, cat: catCerveja?.id },
        { nome: "Cerveja Corona Extra 330ml", preco_compra: 5.8, preco_venda: 12.0, cat: catCerveja?.id },
        { nome: "Cerveja Spaten Lata 350ml", preco_compra: 3.2, preco_venda: 6.5, cat: catCerveja?.id },
        { nome: "Whisky Red Label 1L", preco_compra: 75.0, preco_venda: 139.0, cat: catDestilado?.id },
        { nome: "Gin Tanqueray London Dry 750ml", preco_compra: 78.0, preco_venda: 145.0, cat: catDestilado?.id },
        { nome: "Vodka Absolut 750ml", preco_compra: 58.0, preco_venda: 109.0, cat: catDestilado?.id },
        { nome: "Energético Red Bull 250ml", preco_compra: 6.2, preco_venda: 13.0, cat: catNaoAlcool?.id },
        { nome: "Refrigerante Coca-Cola Lata 350ml", preco_compra: 2.8, preco_venda: 6.0, cat: catNaoAlcool?.id },
        { nome: "Água Mineral sem Gás 500ml", preco_compra: 1.3, preco_venda: 4.0, cat: catNaoAlcool?.id },
        { nome: "Gelo em Cubos 5kg", preco_compra: 8.0, preco_venda: 18.0, cat: catGelo?.id },
      ];

      for (const p of produtosIniciais) {
        await supabase.from("materiais").insert({
          empresa_id: sessao.empresaId,
          nome: p.nome,
          preco_compra: p.preco_compra,
          preco_venda: p.preco_venda,
          categoria_material_id: p.cat ?? null,
          unidade: "un" as any,
          ativo: true,
        });
      }
    },
    onSuccess: () => {
      toast.success("Catálogo inicial da Adega cadastrado com sucesso!");
      void queryClient.invalidateQueries({ queryKey: ["materiais"] });
      void queryClient.invalidateQueries({ queryKey: ["categorias_material"] });
    },
    onError: (e: Error) => {
      toast.error(`Falha ao inicializar catálogo: ${sanitizarMensagemErro(e)}`);
    },
  });

  const abrirDialogVenda = (materialIdPadrao?: string) => {
    if (materialIdPadrao) {
      setVendaMaterialId(materialIdPadrao);
      const m = materiaisById.get(materialIdPadrao);
      if (m) setVendaPreco(String(m.preco_venda || ""));
    } else if (materiais.length > 0 && !vendaMaterialId) {
      const primeiro = materiais[0];
      setVendaMaterialId(primeiro.id);
      setVendaPreco(String(primeiro.preco_venda || ""));
    }
    setDialogVendaAberto(true);
  };

  const handleSelectProduto = (id: string) => {
    setVendaMaterialId(id);
    const m = materiaisById.get(id);
    if (m) {
      setVendaPreco(String(m.preco_venda || ""));
    }
  };

  const vendaMaterialSelecionado = materiaisById.get(vendaMaterialId);
  const vendaSaldoSelecionado = saldosById.get(vendaMaterialId)?.saldoQtd ?? 0;
  const vendaSubtotal = (Number(vendaQtd) || 0) * (Number(vendaPreco) || 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho Principal */}
      <PageHeader
        titulo="Painel da Adega"
        descricao="Gestão de vendas, rentabilidade e estoque de bebidas em tempo real."
        acoes={
          <div className="flex flex-wrap items-center gap-3">
            <FiltroPeriodo de={de} ate={ate} onChange={(d, a) => { setDe(d); setAte(a); }} />
            <Button
              className="gap-2 rounded-xl shadow-sm"
              onClick={() => abrirDialogVenda()}
              disabled={materiais.length === 0}
            >
              <ShoppingCart className="size-4" />
              Nova Venda
            </Button>
          </div>
        }
      />

      {/* Banner de Inicialização se a adega ainda não possui produtos cadastrados */}
      {materiais.length === 0 && !carregandoMateriais && (
        <Card className="flex flex-col items-center justify-between gap-4 border-primary/30 bg-primary/5 p-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Configurar catálogo inicial da Adega</p>
              <p className="text-xs text-muted-foreground">
                Sua adega ainda não possui produtos cadastrados. Clique para carregar automaticamente o catálogo com vinhos, cervejas e destilados.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="rounded-xl shrink-0"
            disabled={carregarCatalogoMutation.isPending}
            onClick={() => carregarCatalogoMutation.mutate()}
          >
            <Wine className="size-4" />
            {carregarCatalogoMutation.isPending ? "Carregando..." : "Carregar Catálogo Inicial"}
          </Button>
        </Card>
      )}

      {/* Grade de KPIs Principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          destaque
          label="Faturamento do período"
          valor={brl(faturamento)}
          subtexto={vendasPeriodo.length > 0 ? `${totalVendas} transações realizadas` : "Sem vendas no período"}
        />
        <StatCard
          label="Número de vendas"
          valor={num(totalVendas, 0)}
          subtexto="Pedidos no período"
        />
        <StatCard
          label="Ticket médio"
          valor={brl(ticketMedio)}
          subtexto="Média por venda"
        />
        <StatCard
          label="Lucro bruto"
          valor={brl(lucroBruto)}
          subtexto={`Margem de ${num(margemBruta, 1)}%`}
        />
        <StatCard
          label="Margem bruta"
          valor={`${num(margemBruta, 1)}%`}
          subtexto="Rentabilidade operacional"
        />
        <StatCard
          label="Clientes atendidos"
          valor={num(clientesAtendidos, 0)}
          subtexto="Compradores únicos"
        />
        <StatCard
          label="Estoque total"
          valor={`${num(estoqueUnidades, 0)} un.`}
          subtexto={`Valor total: ${brl(valorEstoqueTotal)}`}
        />
        <StatCard
          label="Produtos cadastrados"
          valor={num(materiais.length, 0)}
          subtexto={`${produtosEstoqueBaixo.length} com estoque crítico`}
        />
      </div>

      {/* Gráficos e Desempenho Visual */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gráfico 1: Evolução Diária */}
        <Card className="shadow-card col-span-1 flex flex-col rounded-3xl border-border p-6 lg:col-span-2">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h2 className="text-base font-semibold">Faturamento diário</h2>
              <p className="text-xs text-muted-foreground">Volume de vendas registradas dia a dia</p>
            </div>
            <Badge variant="outline" className="gap-1 rounded-xl text-xs font-normal">
              <TrendingUp className="size-3 text-primary" />
              {dadosGraficoEvolucao.length} dias com vendas
            </Badge>
          </div>

          <div className="h-72 w-full pt-4">
            {dadosGraficoEvolucao.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <Wine className="size-8 opacity-25" />
                <p className="mt-2 text-xs">Nenhum faturamento registrado no período selecionado.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGraficoEvolucao} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `R$${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(val: any) => [brl(Number(val)), "Faturamento"]}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Bar dataKey="faturamento" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Gráfico 2: Vendas por Categoria */}
        <Card className="shadow-card flex flex-col rounded-3xl border-border p-6">
          <div className="pb-4">
            <h2 className="text-base font-semibold">Vendas por categoria</h2>
            <p className="text-xs text-muted-foreground">Distribuição da receita por tipo de bebida</p>
          </div>

          <div className="h-72 w-full pt-4">
            {dadosGraficoCategoria.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <Boxes className="size-8 opacity-25" />
                <p className="mt-2 text-xs">Nenhuma venda por categoria no período.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGraficoCategoria} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.2} />
                  <XAxis type="number" tickFormatter={(v) => `R$${v}`} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="categoria" width={90} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: any) => [brl(Number(val)), "Total"]} />
                  <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                    {dadosGraficoCategoria.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CORES_GRAFICO[index % CORES_GRAFICO.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Seção Operacional: Top Produtos e Alertas de Estoque */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top 5 Produtos Mais Vendidos */}
        <Card className="shadow-card overflow-hidden rounded-3xl border-border">
          <div className="border-b border-border p-5">
            <h2 className="text-base font-semibold text-foreground">Top 5 bebidas mais vendidas</h2>
            <p className="text-xs text-muted-foreground">Produtos com maior volume de faturamento no período</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Qtd. vendida</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProdutos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                      Nenhuma venda registrada no período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  topProdutos.map((prod, index) => (
                    <TableRow key={prod.id}>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          <span>{prod.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="rounded-lg font-normal">
                          {prod.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {num(prod.quantidade, 0)} {prod.unidade}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {brl(prod.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Alerta de Estoque Crítico */}
        <Card className="shadow-card overflow-hidden rounded-3xl border-border">
          <div className="border-b border-border p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Alerta de reposição de estoque</h2>
                <p className="text-xs text-muted-foreground">Bebidas com estoque zerado ou em nível crítico (≤ 5 un.)</p>
              </div>
              <Badge variant="destructive" className="rounded-xl text-xs">
                {produtosEstoqueBaixo.length} itens
              </Badge>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Bebida</TableHead>
                  <TableHead className="text-center">Estoque atual</TableHead>
                  <TableHead className="text-center">Situação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtosEstoqueBaixo.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="size-5" />
                        <span>Todos os produtos com estoque saudável!</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  produtosEstoqueBaixo.map((s) => (
                    <TableRow key={s.material.id}>
                      <TableCell className="font-medium text-foreground">
                        <p>{s.material.nome}</p>
                        <p className="text-xs text-muted-foreground">Custo: {brl(s.material.preco_compra)}</p>
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        <span className={s.saldoQtd <= 0 ? "text-destructive" : "text-amber-600"}>
                          {num(s.saldoQtd, 0)} {s.material.unidade}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {s.saldoQtd <= 0 ? (
                          <Badge variant="destructive" className="rounded-lg text-[10px]">
                            Esgotado
                          </Badge>
                        ) : (
                          <Badge className="rounded-lg bg-amber-500/15 text-[10px] text-amber-700 hover:bg-amber-500/20">
                            Estoque Baixo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-xs text-primary"
                          onClick={() => abrirDialogVenda(s.material.id)}
                        >
                          Lançar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Histórico Recente de Vendas no Período */}
      <Card className="shadow-card overflow-hidden rounded-3xl border-border">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Últimas vendas do período</h2>
            <p className="text-xs text-muted-foreground">Histórico de saídas de mercadorias registradas no Supabase</p>
          </div>
          <Badge variant="secondary" className="rounded-xl text-xs font-normal">
            {vendasPeriodo.length} vendas registradas
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">Quantidade</TableHead>
                <TableHead className="text-right">Preço Un.</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendasPeriodo.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Wine className="size-6 opacity-30" />
                      <p className="text-sm font-medium">Nenhuma venda registrada no período</p>
                      <p className="text-xs text-muted-foreground">
                        Utilize o botão &quot;Nova Venda&quot; no topo da página para registrar a saída de bebidas.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                vendasPeriodo.slice(0, 10).map((v) => {
                  const mat = materiaisById.get(v.material_id);
                  const nomeCliente = v.cliente_id ? clientesById.get(v.cliente_id) ?? "Cliente Balcão" : "Cliente Balcão";
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(`${v.data}T12:00:00`).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        {mat?.nome ?? "Item da Adega"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {nomeCliente}
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        {num(v.quantidade, 0)} {mat?.unidade ?? "un"}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {brl(v.valor_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-foreground">
                        {brl(v.valor_total)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Diálogo / Modal de Nova Venda */}
      <Dialog open={dialogVendaAberto} onOpenChange={setDialogVendaAberto}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="size-5 text-primary" />
              Registrar Nova Venda
            </DialogTitle>
            <DialogDescription>
              Lance a saída de produto e o recebimento financeiro da Adega no banco de dados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Produto */}
            <div className="space-y-1.5">
              <Label htmlFor="produto">Produto / Bebida</Label>
              <Select value={vendaMaterialId} onValueChange={handleSelectProduto}>
                <SelectTrigger id="produto" className="rounded-xl">
                  <SelectValue placeholder="Selecione a bebida..." />
                </SelectTrigger>
                <SelectContent>
                  {materiais.map((m) => {
                    const saldoDisp = saldosById.get(m.id)?.saldoQtd ?? 0;
                    return (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nome} ({brl(m.preco_venda)} | Est: {num(saldoDisp, 0)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {vendaMaterialSelecionado && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Estoque disponível: {num(vendaSaldoSelecionado, 0)} {vendaMaterialSelecionado.unidade}</span>
                  <span>Custo: {brl(vendaMaterialSelecionado.preco_compra)}</span>
                </div>
              )}
            </div>

            {/* Quantidade e Preço Unitário */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qtd">Quantidade</Label>
                <Input
                  id="qtd"
                  type="number"
                  min="1"
                  step="1"
                  value={vendaQtd}
                  onChange={(e) => setVendaQtd(e.target.value)}
                  className="rounded-xl"
                  placeholder="1"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="preco">Preço Unitário (R$)</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  value={vendaPreco}
                  onChange={(e) => setVendaPreco(e.target.value)}
                  className="rounded-xl"
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Total Calculado */}
            <div className="flex items-center justify-between rounded-2xl bg-muted/50 p-3">
              <span className="text-xs text-muted-foreground font-medium">Total da Venda</span>
              <span className="text-lg font-bold text-primary">{brl(vendaSubtotal)}</span>
            </div>

            {/* Forma de Pagamento e Data */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="forma">Forma de Pagamento</Label>
                <Select value={vendaFormaPagamento} onValueChange={setVendaFormaPagamento}>
                  <SelectTrigger id="forma" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                    <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="prazo">A Prazo / Fiado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="data">Data da Venda</Label>
                <Input
                  id="data"
                  type="date"
                  value={vendaData}
                  onChange={(e) => setVendaData(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Cliente Opcional */}
            <div className="space-y-1.5">
              <Label htmlFor="cliente">Cliente (Opcional)</Label>
              <Select value={vendaClienteId} onValueChange={setVendaClienteId}>
                <SelectTrigger id="cliente" className="rounded-xl">
                  <SelectValue placeholder="Cliente Balcão (Não identificado)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balcao">Cliente Balcão</SelectItem>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {c.telefone ? `(${c.telefone})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label htmlFor="obs">Observações (Opcional)</Label>
              <Input
                id="obs"
                value={vendaObs}
                onChange={(e) => setVendaObs(e.target.value)}
                placeholder="Ex: Mesa 4, delivery, comanda..."
                className="rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setDialogVendaAberto(false)}
            >
              Cancelar
            </Button>
            <Button
              className="gap-2 rounded-xl"
              disabled={registrarVendaMutation.isPending || !vendaMaterialId}
              onClick={() => registrarVendaMutation.mutate()}
            >
              <CheckCircle2 className="size-4" />
              {registrarVendaMutation.isPending ? "Gravando..." : "Confirmar Venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
