import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { brl, dateBR } from "@/lib/format";
import { imprimirRelatorio } from "@/lib/impressao";
import { useCategorias, useLancamentos } from "@/lib/dados";
import { podeFinanceiro, useSessao } from "@/hooks/use-sessao";
import { aberturaDoDia, saldoAtual, useCaixaMovimentos } from "@/lib/caixa";
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

export const Route = createFileRoute("/_authenticated/financeiro")({
  head: () => ({
    meta: [
      { title: "Financeiro — Base 01" },
      { name: "description", content: "Contas a pagar, a receber e baixas de pagamento." },
      { property: "og:title", content: "Financeiro — Base 01" },
      { property: "og:description", content: "Contas a pagar, a receber e baixas de pagamento." },
    ],
  }),
  component: Financeiro,
});

function Financeiro() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const autorizado = podeFinanceiro(sessao);
  const { data: lancs = [] } = useLancamentos(autorizado);
  const { data: categorias = [] } = useCategorias();

  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"receita" | "despesa">("despesa");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [vencimento, setVencimento] = useState(new Date().toISOString().slice(0, 10));
  const [imposto, setImposto] = useState("nao");

  const criar = useMutation({
    mutationFn: async () => {
      if (!sessao) throw new Error("Sessão inválida");
      const { error } = await supabase.from("lancamentos").insert({
        empresa_id: sessao.empresaId,
        tipo,
        descricao,
        valor: Number(valor),
        categoria_id: tipo === "despesa" ? categoriaId || null : null,
        data_vencimento: vencimento,
        imposto: imposto === "sim",
        status: "pendente",
        criado_por: sessao.userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento criado");
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
      setAberto(false);
      setDescricao("");
      setValor("");
    },
    onError: (e: Error) => toast.error("Erro ao salvar", { description: e.message }),
  });

  const baixar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lancamentos")
        .update({ status: "pago", data_pagamento: new Date().toISOString().slice(0, 10) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Baixa registrada");
      queryClient.invalidateQueries({ queryKey: ["lancamentos"] });
    },
    onError: (e: Error) => toast.error("Erro na baixa", { description: e.message }),
  });

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

  const hoje = new Date().toISOString().slice(0, 10);
  const receitas = lancs.filter((l) => l.tipo === "receita");
  const despesas = lancs.filter((l) => l.tipo === "despesa");
  const aReceber = receitas.filter((l) => l.status !== "pago").reduce((s, l) => s + Number(l.valor), 0);
  const aPagar = despesas.filter((l) => l.status !== "pago").reduce((s, l) => s + Number(l.valor), 0);
  const atrasados = lancs.filter((l) => l.status !== "pago" && l.data_vencimento < hoje);

  function statusBadge(l: (typeof lancs)[number]) {
    if (l.status === "pago") return <Badge variant="secondary">Pago</Badge>;
    if (l.data_vencimento < hoje) return <Badge variant="destructive">Atrasado</Badge>;
    return <Badge variant="outline">Pendente</Badge>;
  }

  function statusTexto(l: (typeof lancs)[number]) {
    if (l.status === "pago") return "Pago";
    if (l.data_vencimento < hoje) return "Atrasado";
    return "Pendente";
  }

  function imprimir() {
    const tabelaHtml = (lista: typeof lancs, tituloAba: string) => {
      const linhas = lista
        .map(
          (l) =>
            `<tr><td>${dateBR(l.data_vencimento)}</td><td>${l.descricao}</td><td>${
              categorias.find((c) => c.id === l.categoria_id)?.nome ?? "—"
            }</td><td>${statusTexto(l)}</td><td class="r">${brl(l.valor)}</td></tr>`,
        )
        .join("");
      const total = lista.reduce((s, l) => s + Number(l.valor), 0);
      return `<h2>${tituloAba}</h2>
        <table><thead><tr><th>Vencimento</th><th>Descrição</th><th>Categoria</th><th>Status</th><th class="r">Valor</th></tr></thead>
        <tbody>${linhas || '<tr><td colspan="5">Nenhum lançamento.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="4">Total (${lista.length})</td><td class="r">${brl(total)}</td></tr></tfoot></table>`;
    };
    imprimirRelatorio({
      titulo: `${sessao?.empresaNome ?? "Empresa"} — Financeiro`,
      nomeArquivo: "Financeiro",
      corpo: tabelaHtml(despesas, "Contas a pagar") + tabelaHtml(receitas, "Contas a receber"),
    });
  }

  function tabela(lista: typeof lancs) {
    return (
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimento</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum lançamento.
                </TableCell>
              </TableRow>
            )}
            {lista.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{dateBR(l.data_vencimento)}</TableCell>
                <TableCell className="font-medium">{l.descricao}</TableCell>
                <TableCell>{categorias.find((c) => c.id === l.categoria_id)?.nome ?? "—"}</TableCell>
                <TableCell>{statusBadge(l)}</TableCell>
                <TableCell className="text-right">{brl(l.valor)}</TableCell>
                <TableCell className="text-right">
                  {l.status !== "pago" && (
                    <Button size="sm" variant="ghost" onClick={() => baixar.mutate(l.id)}>
                      <Check className="h-4 w-4" /> Baixar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        titulo="Financeiro"
        descricao="Contas a pagar e a receber, com baixa de pagamento."
        acoes={
          <>
            <Button size="sm" variant="outline" onClick={imprimir} className="shrink-0">
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
            <Dialog open={aberto} onOpenChange={setAberto}>
              <DialogTrigger asChild>
                <Button variant="brand">
                  <Plus className="h-4 w-4" /> Novo lançamento
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo lançamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={tipo} onValueChange={(v) => setTipo(v as "receita" | "despesa")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="despesa">Despesa</SelectItem>
                        <SelectItem value="receita">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimento</Label>
                    <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
                  </div>
                  {tipo === "despesa" && (
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select value={categoriaId} onValueChange={setCategoriaId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {tipo === "despesa" && (
                  <div className="space-y-2">
                    <Label>É imposto?</Label>
                    <Select value={imposto} onValueChange={setImposto}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao">Não</SelectItem>
                        <SelectItem value="sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="brand" onClick={() => criar.mutate()} disabled={criar.isPending}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard destaque label="A receber" valor={brl(aReceber)} />
        <StatCard label="A pagar" valor={brl(aPagar)} />
        <StatCard label="Em atraso" valor={brl(atrasados.reduce((s, l) => s + Number(l.valor), 0))} detalhe={`${atrasados.length} título(s)`} />
      </div>

      <Tabs defaultValue="pagar" className="mt-6">
        <TabsList>
          <TabsTrigger value="pagar">Contas a pagar</TabsTrigger>
          <TabsTrigger value="receber">Contas a receber</TabsTrigger>
        </TabsList>
        <TabsContent value="pagar" className="mt-4">
          {tabela(despesas)}
        </TabsContent>
        <TabsContent value="receber" className="mt-4">
          {tabela(receitas)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
