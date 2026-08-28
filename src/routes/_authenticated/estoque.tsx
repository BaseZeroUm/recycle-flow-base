import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { brl, dateBR, num } from "@/lib/format";
import { calcularSaldos, useMateriais, useMovimentacoes, useParceiros } from "@/lib/dados";
import { podeFinanceiro, useSessao } from "@/hooks/use-sessao";
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
      { title: "Estoque — Base 01" },
      { name: "description", content: "Entradas, saídas e saldo de materiais recicláveis." },
      { property: "og:title", content: "Estoque — Base 01" },
      { property: "og:description", content: "Entradas, saídas e saldo de materiais recicláveis." },
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

  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [materialId, setMaterialId] = useState("");
  const [parceiroId, setParceiroId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [preco, setPreco] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [observacoes, setObservacoes] = useState("");

  const saldos = calcularSaldos(materiais, movs);
  const material = materiais.find((m) => m.id === materialId);
  const total = (Number(quantidade) || 0) * (Number(preco) || 0);

  function selecionarMaterial(id: string) {
    setMaterialId(id);
    const m = materiais.find((x) => x.id === id);
    if (m) setPreco(String(tipo === "entrada" ? m.preco_compra : m.preco_venda));
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sessão inválida");
      if (!materialId) throw new Error("Selecione o material");
      const valorTotal = total;
      const { data: mov, error } = await supabase
        .from("movimentacoes_estoque")
        .insert({
          empresa_id: sessao.empresaId,
          tipo,
          material_id: materialId,
          fornecedor_id: tipo === "entrada" ? parceiroId || null : null,
          cliente_id: tipo === "saida" ? parceiroId || null : null,
          quantidade: Number(quantidade),
          valor_total: valorTotal,
          data,
          observacoes: observacoes || null,
          criado_por: sessao.userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (podeFinanceiro(sessao) && valorTotal > 0) {
        const nomeMaterial = materiais.find((m) => m.id === materialId)?.nome ?? "Material";
        const { error: erroLanc } = await supabase.from("lancamentos").insert({
          empresa_id: sessao.empresaId,
          tipo: tipo === "entrada" ? "despesa" : "receita",
          descricao: `${tipo === "entrada" ? "Compra" : "Venda"} de ${nomeMaterial}`,
          valor: valorTotal,
          data_vencimento: data,
          status: "pendente",
          movimentacao_id: mov.id,
          criado_por: sessao.userId,
        });
        if (erroLanc) throw erroLanc;
      }
    },
    onSuccess: () => {
      toast.success("Movimentação registrada");
      queryClient.invalidateQueries({ queryKey: ["movimentacoes"] });
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      setAberto(false);
      setQuantidade("");
      setObservacoes("");
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const parceiros = tipo === "entrada" ? fornecedores : clientes;
  const valorEstoque = saldos.reduce((s, x) => s + x.valorEstoque, 0);
  const qtdEstoque = saldos.reduce((s, x) => s + Math.max(x.saldoQtd, 0), 0);

  return (
    <div>
      <PageHeader
        titulo="Estoque"
        descricao="Registre compras e vendas de material e acompanhe o saldo."
        acoes={
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger asChild>
              <Button variant="brand">
                <Plus className="h-4 w-4" /> Nova movimentação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova movimentação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={tipo} onValueChange={(v) => setTipo(v as "entrada" | "saida")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada (compra)</SelectItem>
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
                      <SelectValue placeholder="Opcional" />
                    </SelectTrigger>
                    <SelectContent>
                      {parceiros.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Quantidade ({material?.unidade ?? "kg"})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço unitário</Label>
                    <Input type="number" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>
                <div className="rounded-xl bg-muted px-4 py-3 text-sm">
                  Total: <strong>{brl(total)}</strong>
                  {podeFinanceiro(sessao) && (
                    <span className="ml-2 text-muted-foreground">
                      · gera lançamento {tipo === "entrada" ? "a pagar" : "a receber"}
                    </span>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="brand" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                  Registrar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard destaque label="Saldo total" valor={`${num(qtdEstoque)} kg`} />
        <StatCard label="Valor em estoque" valor={brl(valorEstoque)} detalhe="Custo médio de compra" />
        <StatCard label="Movimentações" valor={num(movs.length, 0)} />
      </div>

      <Tabs defaultValue="saldo" className="mt-6">
        <TabsList>
          <TabsTrigger value="saldo">Saldo por material</TabsTrigger>
          <TabsTrigger value="movs">Movimentações</TabsTrigger>
        </TabsList>

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

        <TabsContent value="movs" className="mt-4">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma movimentação registrada.
                    </TableCell>
                  </TableRow>
                )}
                {movs.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{dateBR(m.data)}</TableCell>
                    <TableCell>
                      <Badge variant={m.tipo === "entrada" ? "secondary" : "default"}>
                        {m.tipo === "entrada" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell>{materiais.find((x) => x.id === m.material_id)?.nome ?? "—"}</TableCell>
                    <TableCell className="text-right">{num(m.quantidade)}</TableCell>
                    <TableCell className="text-right">{brl(m.valor_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
