import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Minus, Plus, Printer, Search, Share2, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { brl, dateBR, num } from "@/lib/format";
import {
  calcularSaldos,
  useCategoriasMaterial,
  useMateriais,
  useMovimentacoes,
  useParceiros,
  type Movimentacao,
} from "@/lib/dados";
import { podeFinanceiro, useSessao } from "@/hooks/use-sessao";
import { aberturaDoDia, saldoAtual, useCaixaMovimentos } from "@/lib/caixa";
import { TicketPesagem, textoWhatsApp, type DadosTicket } from "@/components/TicketPesagem";
import { TicketAgrupado, textoWhatsAppAgrupado } from "@/components/TicketAgrupado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque e pesagem — Base 01" },
      {
        name: "description",
        content: "Registre a movimentação na balança, emita o ticket e acompanhe o saldo de materiais.",
      },
      { property: "og:title", content: "Estoque e pesagem — Base 01" },
      {
        property: "og:description",
        content: "Registre a movimentação na balança, emita o ticket e acompanhe o saldo de materiais.",
      },
    ],
  }),
  component: Estoque,
});

// Tipos para itens do carrinho
type ItemCarrinho = {
  id: string;
  materialId: string;
  categoriaMaterialId: string;
  pesoBruto: string;
  liquidoManual: string;
  preco: string;
};

function gerarId() {
  return Math.random().toString(36).slice(2);
}

function Estoque() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const { data: materiais = [] } = useMateriais();
  const { data: categoriasMaterial = [] } = useCategoriasMaterial();
  const { data: movs = [] } = useMovimentacoes();
  const { data: fornecedores = [] } = useParceiros("fornecedores");
  const { data: clientes = [] } = useParceiros("clientes");
  const { data: empresa } = useQuery({
    queryKey: ["empresa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [parceiroId, setParceiroId] = useState("");
  const [novoParceiro, setNovoParceiro] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const [busca, setBusca] = useState("");
  const [ticketAberto, setTicketAberto] = useState<Movimentacao[] | null>(null);

  // Estado do carrinho
  const [itens, setItens] = useState<ItemCarrinho[]>([
    {
      id: gerarId(),
      materialId: "",
      categoriaMaterialId: "todas",
      pesoBruto: "",
      liquidoManual: "",
      preco: "",
    },
  ]);

  const ticketRef = useRef<HTMLDivElement>(null);
  const parceiros = tipo === "entrada" ? fornecedores : clientes;
  const saldos = calcularSaldos(materiais, movs);

  // Calcula líquido e total por item
  function calcItem(item: ItemCarrinho) {
    const material = materiais.find((m) => m.id === item.materialId);
    const liquido =
      item.liquidoManual !== ""
        ? Number(item.liquidoManual) || 0
        : Math.max(Number(item.pesoBruto) || 0, 0);
    const total = liquido * (Number(item.preco) || 0);
    return { liquido, total, unidade: material?.unidade ?? "kg" };
  }

  const totalGeral = itens.reduce((soma, item) => soma + calcItem(item).total, 0);
  const pesoTotal = itens.reduce((soma, item) => soma + calcItem(item).liquido, 0);

  // Selecionar categoria de um item
  function selecionarCategoriaItem(itemId: string, catId: string) {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        // Se mudou categoria, limpa material
        if (catId !== "todas") {
          const m = materiais.find((x) => x.id === item.materialId);
          if (m && m.categoria_material_id !== catId) {
            return { ...item, categoriaMaterialId: catId, materialId: "", preco: "" };
          }
        }
        return { ...item, categoriaMaterialId: catId };
      }),
    );
  }

  // Selecionar material de um item
  function selecionarMaterialItem(itemId: string, matId: string) {
    setItens((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const m = materiais.find((x) => x.id === matId);
        return {
          ...item,
          materialId: matId,
          preco: m ? String(tipo === "entrada" ? m.preco_compra : m.preco_venda) : item.preco,
        };
      }),
    );
  }

  // Atualizar campo de um item
  function atualizarItem(itemId: string, campo: keyof ItemCarrinho, valor: string) {
    setItens((prev) => prev.map((item) => (item.id === itemId ? { ...item, [campo]: valor } : item)));
  }

  // Adicionar item ao carrinho
  function adicionarItem() {
    setItens((prev) => [
      ...prev,
      {
        id: gerarId(),
        materialId: "",
        categoriaMaterialId: "todas",
        pesoBruto: "",
        liquidoManual: "",
        preco: "",
      },
    ]);
  }

  // Remover item do carrinho
  function removerItem(itemId: string) {
    setItens((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== itemId);
    });
  }

  function trocarTipo(t: "entrada" | "saida") {
    setTipo(t);
    setParceiroId("");
    setItens((prev) =>
      prev.map((item) => {
        const m = materiais.find((x) => x.id === item.materialId);
        return {
          ...item,
          preco: m ? String(t === "entrada" ? m.preco_compra : m.preco_venda) : item.preco,
        };
      }),
    );
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sessão inválida");
      const itensValidos = itens.filter((item) => {
        const { liquido } = calcItem(item);
        return item.materialId && liquido > 0;
      });
      if (itensValidos.length === 0) throw new Error("Adicione pelo menos um material com peso");

      let parceiro = parceiroId || null;
      if (!parceiro && novoParceiro.trim()) {
        const tabela = tipo === "entrada" ? "fornecedores" : "clientes";
        const { data: criado, error: erroP } = await supabase
          .from(tabela)
          .insert({ empresa_id: sessao.empresaId, nome: novoParceiro.trim() })
          .select("id")
          .single();
        if (erroP) throw erroP;
        parceiro = criado.id;
        queryClient.invalidateQueries({ queryKey: [tabela] });
      }

      // Cria UM ticket que agrupa todos os itens
      const { data: ticket, error: erroTicket } = await supabase
        .from("tickets")
        .insert({
          empresa_id: sessao.empresaId,
          tipo,
          data,
          fornecedor_id: tipo === "entrada" ? parceiro : null,
          cliente_id: tipo === "saida" ? parceiro : null,
          observacoes: observacoes || null,
          responsavel: sessao.nome ?? null,
          criado_por: sessao.userId,
        })
        .select("*")
        .single();
      if (erroTicket) throw erroTicket;

      const movsCriadas: Movimentacao[] = [];
      for (const item of itensValidos) {
        const { liquido, total } = calcItem(item);
        const material = materiais.find((m) => m.id === item.materialId);

        const { data: mov, error } = await supabase
          .from("movimentacoes_estoque")
          .insert({
            empresa_id: sessao.empresaId,
            tipo,
            material_id: item.materialId,
            fornecedor_id: tipo === "entrada" ? parceiro : null,
            cliente_id: tipo === "saida" ? parceiro : null,
            quantidade: liquido,
            peso_bruto: item.pesoBruto === "" ? null : Number(item.pesoBruto),
            valor_unitario: Number(item.preco) || 0,
            valor_total: total,
            data,
            observacoes: observacoes || null,
            ticket_id: ticket.id,
            criado_por: sessao.userId,
          })
          .select("*")
          .single();
        if (error) throw error;
        movsCriadas.push(mov as Movimentacao);

        if (podeFinanceiro(sessao) && total > 0) {
          const { error: erroLanc } = await supabase.from("lancamentos").insert({
            empresa_id: sessao.empresaId,
            tipo: tipo === "entrada" ? "despesa" : "receita",
            descricao: `Ticket ${ticket.numero_ticket} · ${tipo === "entrada" ? "Compra" : "Venda"} de ${material?.nome ?? "Material"}`,
            valor: total,
            data_vencimento: data,
            status: "pendente",
            movimentacao_id: mov.id,
            criado_por: sessao.userId,
          });
          if (erroLanc) throw erroLanc;
        }
      }
      return { ticket, movsCriadas };
    },
    onSuccess: ({ ticket, movsCriadas }) => {
      toast.success(`${movsCriadas.length} item(ns) registrado(s) · ticket nº ${ticket.numero_ticket}`);
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      setAberto(false);
      setItens([
        {
          id: gerarId(),
          materialId: "",
          categoriaMaterialId: "todas",
          pesoBruto: "",
          liquidoManual: "",
          preco: "",
        },
      ]);
      setObservacoes("");
      setNovoParceiro("");
      setTicketAberto(movsCriadas);
    },
    onError: (e: Error) => toast.error("Erro ao registrar", { description: e.message }),
  });

  // Abre o ticket com todos os itens agrupados (mesmo ticket_id)
  function abrirTicket(m: Movimentacao) {
    const irmaos = m.ticket_id ? movs.filter((x) => x.ticket_id === m.ticket_id) : [m];
    setTicketAberto(irmaos.length > 0 ? irmaos : [m]);
  }

  function nomeParceiro(m: Movimentacao) {
    const id = m.tipo === "entrada" ? m.fornecedor_id : m.cliente_id;
    const lista = m.tipo === "entrada" ? fornecedores : clientes;
    return lista.find((p) => p.id === id)?.nome ?? "Não informado";
  }

  const dadosTicket: DadosTicket[] | null =
    ticketAberto
      ? ticketAberto.map((mov) => ({
          mov,
          materialNome: materiais.find((m) => m.id === mov.material_id)?.nome ?? "—",
          unidade: materiais.find((m) => m.id === mov.material_id)?.unidade ?? "kg",
          parceiroNome: nomeParceiro(mov),
          empresaNome: empresa?.razao_social ?? sessao?.empresaNome ?? "Empresa",
          empresaCnpj: empresa?.cnpj ?? null,
          empresaTelefone: empresa?.telefone ?? null,
          responsavel: sessao?.nome ?? null,
        }))
      : null;

  async function gerarImagem() {
    if (!ticketRef.current) return null;
    const dataUrl = await toPng(ticketRef.current, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
    const blob = await (await fetch(dataUrl)).blob();
    return { dataUrl, blob };
  }

  async function baixar() {
    try {
      const img = await gerarImagem();
      if (!img || !dadosTicket) return;
      const a = document.createElement("a");
      a.href = img.dataUrl;
      a.download = `ticket-${dadosTicket[0]?.mov.numero_ticket ?? ""}.png`;
      a.click();
    } catch (e) {
      toast.error("Não foi possível gerar a imagem", { description: (e as Error).message });
    }
  }

  async function compartilhar() {
    if (!dadosTicket) return;
    const texto = textoWhatsAppAgrupado(dadosTicket);
    try {
      const img = await gerarImagem();
      const arquivo = img
        ? new File([img.blob], `ticket-${dadosTicket[0]?.mov.numero_ticket ?? ""}.png`, { type: "image/png" })
        : null;
      if (arquivo && navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], text: texto, title: "Ticket de pesagem" });
        return;
      }
    } catch {
      /* segue para o fallback */
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return movs;
    return movs.filter((m) => {
      const mat = materiais.find((x) => x.id === m.material_id)?.nome ?? "";
      return (
        String(m.numero_ticket ?? "").includes(termo) ||
        mat.toLowerCase().includes(termo) ||
        nomeParceiro(m).toLowerCase().includes(termo) ||
        dateBR(m.data).includes(termo)
      );
    });
  }, [busca, movs, materiais, fornecedores, clientes]);

  function imprimirLista() {
    const linhas = filtrados
      .map((m) => {
        const mat = materiais.find((x) => x.id === m.material_id)?.nome ?? "—";
        return `<tr><td>#${m.numero_ticket ?? "—"}</td><td>${dateBR(m.data)}</td><td>${
          m.tipo === "entrada" ? "Entrada" : "Saída"
        }</td><td>${mat}</td><td>${nomeParceiro(m)}</td><td class="r">${num(m.quantidade)}</td><td class="r">${brl(
          m.valor_total,
        )}</td></tr>`;
      })
      .join("");
    const totalValor = filtrados.reduce((s2, m) => s2 + Number(m.valor_total), 0);
    const totalPeso = filtrados.reduce((s2, m) => s2 + Number(m.quantidade), 0);
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Movimentacoes-${new Date().toISOString().slice(0, 10)}</title>
      <style>
        body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#111;margin:24px}
        h1{font-size:18px;margin:0 0 4px}
        p{font-size:12px;color:#555;margin:0 0 16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f3f4f6}
        .r{text-align:right}
        tfoot td{font-weight:700;border-top:2px solid #111}
        @page{size:A4;margin:14mm}
      </style></head><body>
      <h1>${empresa?.razao_social ?? sessao?.empresaNome ?? "Empresa"} — Movimentações e tickets</h1>
      <p>Emitido em ${new Date().toLocaleString("pt-BR")}${busca ? ` · filtro: "${busca}"` : ""}</p>
      <table><thead><tr><th>Ticket</th><th>Data</th><th>Tipo</th><th>Material</th><th>Fornecedor / cliente</th><th class="r">Peso líq.</th><th class="r">Valor</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="7">Nenhuma movimentação.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="5">Total (${filtrados.length})</td><td class="r">${num(totalPeso)}</td><td class="r">${brl(
        totalValor,
      )}</td></tr></tfoot></table>
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`;
    const w = window.open("", "_blank", "noopener,width=900,height=700");
    if (!w) {
      toast.error("Permita pop-ups para gerar o PDF");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  const valorEstoque = saldos.reduce((s, x) => s + x.valorEstoque, 0);
  const qtdEstoque = saldos.reduce((s, x) => s + Math.max(x.saldoQtd, 0), 0);

  return (
    <div>
      <PageHeader
        titulo="Estoque e pesagem"
        descricao="Lance a movimentação na balança: o ticket sai na hora e o saldo é atualizado."
        acoes={
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger asChild>
              <Button variant="brand">
                <Plus className="h-4 w-4" /> Nova movimentação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ticket de pesagem</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Operação</Label>
                    <Select value={tipo} onValueChange={(v) => trocarTipo(v as "entrada" | "saida")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada (compra/coleta)</SelectItem>
                        <SelectItem value="saida">Saída (venda)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{tipo === "entrada" ? "Fornecedor" : "Cliente"}</Label>
                  <Select value={parceiroId} onValueChange={setParceiroId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (ou cadastre abaixo)" />
                    </SelectTrigger>
                    <SelectContent>
                      {parceiros.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!parceiroId && (
                    <Input
                      placeholder={`Cadastro rápido: nome do ${tipo === "entrada" ? "fornecedor" : "cliente"}`}
                      value={novoParceiro}
                      onChange={(e) => setNovoParceiro(e.target.value)}
                    />
                  )}
                </div>

                {/* Itens do carrinho */}
                <div className="space-y-3">
                  {itens.map((item, idx) => {
                    const material = materiais.find((m) => m.id === item.materialId);
                    const { liquido, total } = calcItem(item);
                    const materiaisFiltrados =
                      item.categoriaMaterialId === "todas"
                        ? materiais
                        : materiais.filter((m) => m.categoria_material_id === item.categoriaMaterialId);

                    return (
                      <div key={item.id} className="rounded-xl border bg-muted/40 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Item {idx + 1}
                          </span>
                          {itens.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-destructive hover:text-destructive"
                              onClick={() => removerItem(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Categoria</Label>
                            <Select
                              value={item.categoriaMaterialId}
                              onValueChange={(v) => selecionarCategoriaItem(item.id, v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Todas" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todas">Todas</SelectItem>
                                {categoriasMaterial.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Material</Label>
                            <Select
                              value={item.materialId}
                              onValueChange={(v) => selecionarMaterialItem(item.id, v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {materiaisFiltrados.map((m) => (
                                  <SelectItem key={m.id} value={m.id}>
                                    {m.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-2">
                            <Label className="text-xs">Peso ({material?.unidade ?? "kg"})</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0"
                              value={item.pesoBruto}
                              onChange={(e) => atualizarItem(item.id, "pesoBruto", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Ajuste (opcional)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={String(liquido)}
                              value={item.liquidoManual}
                              onChange={(e) => atualizarItem(item.id, "liquidoManual", e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Valor unit. (R$/{material?.unidade ?? "kg"})</Label>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0,00"
                              value={item.preco}
                              onChange={(e) => atualizarItem(item.id, "preco", e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end text-sm">
                          <span>
                            <strong>{num(liquido)}</strong> {material?.unidade ?? "kg"} × {brl(Number(item.preco) || 0)} ={" "}
                            <strong className="text-base">{brl(total)}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  <Button variant="outline" size="sm" onClick={adicionarItem} className="w-full">
                    <Plus className="h-4 w-4" /> Adicionar mais um item
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>

                <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total do ticket</span>
                    <span className="text-xl font-bold">{brl(totalGeral)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                    <span>Peso líquido total</span>
                    <span>
                      {num(pesoTotal)} {materiais.find((m) => m.id === itens[0]?.materialId)?.unidade ?? "kg"}
                    </span>
                  </div>
                  {podeFinanceiro(sessao) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Gera estoque e lançamento{itens.length > 1 ? "s" : ""}{tipo === "entrada" ? " a pagar" : " a receber"} para cada item — todos no mesmo ticket.
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="brand" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                  {itens.length > 1 ? `Registrar ${itens.length} itens num ticket` : "Registrar e emitir ticket"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard destaque label="Saldo total" valor={`${num(qtdEstoque)} kg`} />
        <StatCard label="Valor em estoque" valor={brl(valorEstoque)} detalhe="Custo médio de compra" />
        <StatCard label="Movimentações / tickets" valor={num(movs.length, 0)} />
      </div>

      <Tabs defaultValue="movs" className="mt-6">
        <TabsList>
          <TabsTrigger value="movs">Movimentações e tickets</TabsTrigger>
          <TabsTrigger value="saldo">Saldo por material</TabsTrigger>
        </TabsList>

        <TabsContent value="movs" className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="border-0 shadow-none focus-visible:ring-0"
                placeholder="Buscar por número, material, fornecedor/cliente ou data"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <Button size="sm" variant="outline" onClick={imprimirLista} className="shrink-0">
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead>Fornecedor / cliente</TableHead>
                  <TableHead className="text-right">Peso líq.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma movimentação registrada.
                    </TableCell>
                  </TableRow>
                )}
                {filtrados.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-semibold">#{m.numero_ticket ?? "—"}</TableCell>
                    <TableCell>{dateBR(m.data)}</TableCell>
                    <TableCell>
                      <Badge variant={m.tipo === "entrada" ? "secondary" : "default"}>
                        {m.tipo === "entrada" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell>{materiais.find((x) => x.id === m.material_id)?.nome ?? "—"}</TableCell>
                    <TableCell>{nomeParceiro(m)}</TableCell>
                    <TableCell className="text-right">{num(m.quantidade)}</TableCell>
                    <TableCell className="text-right">{brl(m.valor_total)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => abrirTicket(m)}>
                        <TicketIcon className="h-4 w-4" /> Ticket
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="saldo" className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Custo médio</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {saldos.map((s) => (
                  <TableRow key={s.material.id}>
                    <TableCell className="font-medium">{s.material.nome}</TableCell>
                    <TableCell className="text-right">{num(s.entradaQtd)}</TableCell>
                    <TableCell className="text-right">{num(s.saidaQtd)}</TableCell>
                    <TableCell className="text-right font-semibold">{num(s.saldoQtd)}</TableCell>
                    <TableCell className="text-right">{brl(s.custoMedio)}</TableCell>
                    <TableCell className="text-right">{brl(s.valorEstoque)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!ticketAberto} onOpenChange={(o) => !o && setTicketAberto(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ticket nº {ticketAberto?.[0]?.numero_ticket ?? ""} gerado</DialogTitle>
          </DialogHeader>
          {dadosTicket && (
            <div className="flex justify-center">
              <TicketAgrupado ref={ticketRef} dados={dadosTicket} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={baixar}>
              <Download className="h-4 w-4" /> Baixar PNG
            </Button>
            <Button variant="brand" onClick={compartilhar}>
              <Share2 className="h-4 w-4" /> Enviar por WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
