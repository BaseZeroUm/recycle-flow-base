import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Plus, Search, Share2, Ticket as TicketIcon } from "lucide-react";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { brl, dateBR, num } from "@/lib/format";
import { calcularSaldos, useMateriais, useMovimentacoes, useParceiros, type Movimentacao } from "@/lib/dados";
import { podeFinanceiro, useSessao } from "@/hooks/use-sessao";
import { TicketPesagem, textoWhatsApp, type DadosTicket } from "@/components/TicketPesagem";
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

function Estoque() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const { data: materiais = [] } = useMateriais();
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
  const [materialId, setMaterialId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [novoParceiro, setNovoParceiro] = useState("");
  const [pesoBruto, setPesoBruto] = useState("");
  const [tara, setTara] = useState("");
  const [liquidoManual, setLiquidoManual] = useState("");
  const [preco, setPreco] = useState("");
  const [placa, setPlaca] = useState("");
  const [motorista, setMotorista] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");
  const [busca, setBusca] = useState("");
  const [ticketAberto, setTicketAberto] = useState<Movimentacao | null>(null);

  const ticketRef = useRef<HTMLDivElement>(null);
  const parceiros = tipo === "entrada" ? fornecedores : clientes;
  const material = materiais.find((m) => m.id === materialId);
  const saldos = calcularSaldos(materiais, movs);

  const liquido =
    liquidoManual !== ""
      ? Number(liquidoManual) || 0
      : Math.max((Number(pesoBruto) || 0) - (Number(tara) || 0), 0);
  const total = liquido * (Number(preco) || 0);

  function selecionarMaterial(id: string) {
    setMaterialId(id);
    const m = materiais.find((x) => x.id === id);
    if (m) setPreco(String(tipo === "entrada" ? m.preco_compra : m.preco_venda));
  }

  function trocarTipo(t: "entrada" | "saida") {
    setTipo(t);
    setParceiroId("");
    const m = materiais.find((x) => x.id === materialId);
    if (m) setPreco(String(t === "entrada" ? m.preco_compra : m.preco_venda));
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sessão inválida");
      if (!materialId) throw new Error("Selecione o material");
      if (liquido <= 0) throw new Error("Informe o peso líquido");

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

      const { data: mov, error } = await supabase
        .from("movimentacoes_estoque")
        .insert({
          empresa_id: sessao.empresaId,
          tipo,
          material_id: materialId,
          fornecedor_id: tipo === "entrada" ? parceiro : null,
          cliente_id: tipo === "saida" ? parceiro : null,
          quantidade: liquido,
          peso_bruto: pesoBruto === "" ? null : Number(pesoBruto),
          tara: tara === "" ? null : Number(tara),
          valor_unitario: Number(preco) || 0,
          valor_total: total,
          veiculo_placa: placa || null,
          motorista: motorista || null,
          data,
          observacoes: observacoes || null,
          criado_por: sessao.userId,
        })
        .select("*")
        .single();
      if (error) throw error;

      if (podeFinanceiro(sessao) && total > 0) {
        const nomeMaterial = material?.nome ?? "Material";
        const { error: erroLanc } = await supabase.from("lancamentos").insert({
          empresa_id: sessao.empresaId,
          tipo: tipo === "entrada" ? "despesa" : "receita",
          descricao: `Ticket ${mov.numero_ticket} · ${tipo === "entrada" ? "Compra" : "Venda"} de ${nomeMaterial}`,
          valor: total,
          data_vencimento: data,
          status: "pendente",
          movimentacao_id: mov.id,
          criado_por: sessao.userId,
        });
        if (erroLanc) throw erroLanc;
      }
      return mov as Movimentacao;
    },
    onSuccess: (mov) => {
      toast.success(`Movimentação registrada · ticket nº ${mov.numero_ticket}`);
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      setAberto(false);
      setPesoBruto("");
      setTara("");
      setLiquidoManual("");
      setPlaca("");
      setMotorista("");
      setObservacoes("");
      setNovoParceiro("");
      setTicketAberto(mov);
    },
    onError: (e: Error) => toast.error("Erro ao registrar", { description: e.message }),
  });

  function nomeParceiro(m: Movimentacao) {
    const id = m.tipo === "entrada" ? m.fornecedor_id : m.cliente_id;
    const lista = m.tipo === "entrada" ? fornecedores : clientes;
    return lista.find((p) => p.id === id)?.nome ?? "Não informado";
  }

  const dadosTicket: DadosTicket | null = ticketAberto
    ? {
        mov: ticketAberto,
        materialNome: materiais.find((m) => m.id === ticketAberto.material_id)?.nome ?? "—",
        unidade: materiais.find((m) => m.id === ticketAberto.material_id)?.unidade ?? "kg",
        parceiroNome: nomeParceiro(ticketAberto),
        empresaNome: empresa?.razao_social ?? sessao?.empresaNome ?? "Empresa",
        empresaCnpj: empresa?.cnpj ?? null,
        empresaTelefone: empresa?.telefone ?? null,
        responsavel: sessao?.nome ?? null,
      }
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
      a.download = `ticket-${dadosTicket.mov.numero_ticket}.png`;
      a.click();
    } catch (e) {
      toast.error("Não foi possível gerar a imagem", { description: (e as Error).message });
    }
  }

  async function compartilhar() {
    if (!dadosTicket) return;
    const texto = textoWhatsApp(dadosTicket);
    try {
      const img = await gerarImagem();
      const arquivo = img
        ? new File([img.blob], `ticket-${dadosTicket.mov.numero_ticket}.png`, { type: "image/png" })
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
                <DialogTitle>Nova movimentação (ticket de pesagem)</DialogTitle>
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
                  <Label>Material</Label>
                  <Select value={materialId} onValueChange={selecionarMaterial}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {materiais.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Veículo / placa</Label>
                    <Input value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC-1D23" />
                  </div>
                  <div className="space-y-2">
                    <Label>Motorista</Label>
                    <Input value={motorista} onChange={(e) => setMotorista(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Peso bruto ({material?.unidade ?? "kg"})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pesoBruto}
                      onChange={(e) => setPesoBruto(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tara ({material?.unidade ?? "kg"})</Label>
                    <Input type="number" step="0.01" value={tara} onChange={(e) => setTara(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Peso líquido (opcional)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={num(liquido)}
                      value={liquidoManual}
                      onChange={(e) => setLiquidoManual(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor unitário (R$/{material?.unidade ?? "kg"})</Label>
                    <Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>

                <div className="rounded-xl bg-muted px-4 py-3 text-sm">
                  Peso líquido: <strong>{num(liquido)}</strong> {material?.unidade ?? "kg"} · Total:{" "}
                  <strong>{brl(total)}</strong>
                  {podeFinanceiro(sessao) && (
                    <span className="ml-2 text-muted-foreground">
                      · gera estoque e lançamento {tipo === "entrada" ? "a pagar" : "a receber"}
                    </span>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="brand" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                  Registrar e emitir ticket
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
                      <Button size="sm" variant="ghost" onClick={() => setTicketAberto(m)}>
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
            <DialogTitle>Ticket nº {ticketAberto?.numero_ticket ?? ""}</DialogTitle>
          </DialogHeader>
          {dadosTicket && (
            <div className="flex justify-center">
              <TicketPesagem ref={ticketRef} dados={dadosTicket} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={baixar}>
              <Download className="h-4 w-4" /> Baixar imagem
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
