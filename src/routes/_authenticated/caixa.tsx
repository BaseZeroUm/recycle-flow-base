import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpRight, ClipboardCheck, Printer, Unlock, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { brl, dateBR } from "@/lib/format";
import { imprimirRelatorio } from "@/lib/impressao";
import {
  aberturaDoDia,
  comSaldos,
  hojeISO,
  rotuloTipo,
  saldoAtual,
  useCaixaMovimentos,
  type CaixaMovimento,
} from "@/lib/caixa";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({
    meta: [
      { title: "Caixa — Base 01" },
      {
        name: "description",
        content: "Controle do dinheiro em espécie do depósito: abertura, compras, despesas, sangrias e conferência.",
      },
      { property: "og:title", content: "Caixa — Base 01" },
      {
        property: "og:description",
        content: "Controle do dinheiro em espécie do depósito: abertura, compras, despesas, sangrias e conferência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Caixa,
});

function Caixa() {
  const queryClient = useQueryClient();
  const { data: sessao } = useSessao();
  const { data: movs = [], isLoading } = useCaixaMovimentos(!!sessao);

  const [inicio, setInicio] = useState(hojeISO());
  const [fim, setFim] = useState(hojeISO());

  const [aberturaOpen, setAberturaOpen] = useState(false);
  const [saldoAbertura, setSaldoAbertura] = useState("");
  const [sangriaOpen, setSangriaOpen] = useState(false);
  const [sangriaValor, setSangriaValor] = useState("");
  const [sangriaMotivo, setSangriaMotivo] = useState("");
  const [conferenciaOpen, setConferenciaOpen] = useState(false);
  const [contado, setContado] = useState("");

  const saldo = useMemo(() => saldoAtual(movs), [movs]);
  const abertura = useMemo(() => aberturaDoDia(movs), [movs]);
  const linhas = useMemo(() => comSaldos(movs).reverse(), [movs]);

  const noPeriodo = useMemo(
    () => movs.filter((m) => m.data >= inicio && m.data <= fim),
    [movs, inicio, fim],
  );
  const somaTipo = (tipo: CaixaMovimento["tipo"]) =>
    noPeriodo.filter((m) => m.tipo === tipo).reduce((s, m) => s + Number(m.valor), 0);

  function abrirDialogAbertura() {
    setSaldoAbertura(String(saldo.toFixed(2)));
    setAberturaOpen(true);
  }

  const registrar = useMutation({
    mutationFn: async (payload: {
      tipo: CaixaMovimento["tipo"];
      valor: number;
      descricao: string | null;
      diferenca?: number | null;
    }) => {
      if (!sessao) throw new Error("Sessão inválida");
      const { error } = await supabase.from("caixa_movimentos").insert({
        empresa_id: sessao.empresaId,
        data: hojeISO(),
        tipo: payload.tipo,
        valor: payload.valor,
        descricao: payload.descricao,
        diferenca: payload.diferenca ?? null,
        criado_por: sessao.userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["caixa_movimentos"] });
    },
    onError: (e: Error) => toast.error("Erro ao registrar no caixa", { description: e.message }),
  });

  async function confirmarAbertura() {
    const valor = Number(saldoAbertura);
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error("Informe um saldo válido");
      return;
    }
    await registrar.mutateAsync({
      tipo: "abertura",
      valor,
      descricao: `Abertura confirmada por ${sessao?.nome ?? "usuário"}`,
    });
    toast.success("Caixa aberto para hoje");
    setAberturaOpen(false);
  }

  async function confirmarSangria() {
    const valor = Number(sangriaValor);
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!abertura) {
      toast.error("Abra o caixa do dia antes de registrar a sangria");
      return;
    }
    await registrar.mutateAsync({
      tipo: "sangria",
      valor,
      descricao: sangriaMotivo.trim() || "Sangria de caixa",
    });
    toast.success("Sangria registrada");
    setSangriaValor("");
    setSangriaMotivo("");
    setSangriaOpen(false);
  }

  async function confirmarConferencia() {
    const valor = Number(contado);
    if (!Number.isFinite(valor) || valor < 0) {
      toast.error("Informe o valor contado");
      return;
    }
    const diferenca = valor - saldo;
    await registrar.mutateAsync({
      tipo: "conferencia",
      valor,
      diferenca,
      descricao: `Contado ${brl(valor)} · sistema ${brl(saldo)} · diferença ${brl(diferenca)}`,
    });
    toast.success(
      diferenca === 0 ? "Conferência sem diferença" : `Diferença registrada: ${brl(diferenca)}`,
    );
    setContado("");
    setConferenciaOpen(false);
  }

  function origem(m: CaixaMovimento) {
    if (m.ticket_id) {
      return (
        <Link to="/estoque" className="text-primary underline-offset-2 hover:underline">
          Ver ticket
        </Link>
      );
    }
    if (m.lancamento_id) {
      return (
        <Link to="/financeiro" className="text-primary underline-offset-2 hover:underline">
          Ver despesa
        </Link>
      );
    }
    return <span className="text-muted-foreground">—</span>;
  }

  function imprimir() {
    const corpo = `
      <p>Saldo atual do caixa: <strong>${brl(saldo)}</strong> · período ${dateBR(inicio)} a ${dateBR(fim)}</p>
      <table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th class="r">Valor</th><th class="r">Saldo</th></tr></thead>
      <tbody>${
        linhas
          .filter(({ mov }) => mov.data >= inicio && mov.data <= fim)
          .map(
            ({ mov, saldo: s }) =>
              `<tr><td>${dateBR(mov.data)}</td><td>${rotuloTipo[mov.tipo]}</td><td>${
                mov.descricao ?? "—"
              }</td><td class="r">${brl(mov.valor)}</td><td class="r">${brl(s)}</td></tr>`,
          )
          .join("") || '<tr><td colspan="5">Nenhuma movimentação no período.</td></tr>'
      }</tbody></table>`;
    imprimirRelatorio({
      titulo: `${sessao?.empresaNome ?? "Empresa"} — Caixa`,
      nomeArquivo: "Caixa",
      corpo,
    });
  }

  if (!podeFinanceiro(sessao)) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
        <h1 className="text-lg font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas perfis Administrador e Financeiro acessam o caixa.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        titulo="Caixa"
        descricao="Controle do dinheiro em espécie do depósito — separado do módulo Fluxo de caixa."
        acoes={
          <>
            <Button size="sm" variant="outline" onClick={imprimir}>
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Button>
            <Dialog open={sangriaOpen} onOpenChange={setSangriaOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <ArrowUpRight className="h-4 w-4" /> Sangria
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar sangria</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Valor retirado</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={sangriaValor}
                      onChange={(e) => setSangriaValor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Input
                      placeholder="Ex.: depósito bancário"
                      value={sangriaMotivo}
                      onChange={(e) => setSangriaMotivo(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A sangria só move o dinheiro de lugar: não gera despesa no Financeiro.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="brand" onClick={confirmarSangria} disabled={registrar.isPending}>
                    Registrar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={conferenciaOpen} onOpenChange={setConferenciaOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <ClipboardCheck className="h-4 w-4" /> Conferência
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Conferência do dia</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Valor físico contado</Label>
                    <Input type="number" step="0.01" value={contado} onChange={(e) => setContado(e.target.value)} />
                  </div>
                  <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Saldo do sistema</span>
                      <strong>{brl(saldo)}</strong>
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span className="text-muted-foreground">Diferença</span>
                      <strong>{brl((Number(contado) || 0) - saldo)}</strong>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A conferência é apenas auditoria: não zera o caixa nem gera lançamento financeiro.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="brand" onClick={confirmarConferencia} disabled={registrar.isPending}>
                    Registrar conferência
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={aberturaOpen} onOpenChange={setAberturaOpen}>
              <DialogTrigger asChild>
                <Button variant="brand" onClick={abrirDialogAbertura}>
                  <Unlock className="h-4 w-4" /> {abertura ? "Reabrir / aportar" : "Abrir caixa do dia"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Abertura do dia</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Saldo confirmado em caixa</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={saldoAbertura}
                      onChange={(e) => setSaldoAbertura(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sugerido pelo saldo que ficou do dia anterior ({brl(saldo)}). Edite se houve aporte de
                    dinheiro novo no caixa.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="brand" onClick={confirmarAbertura} disabled={registrar.isPending}>
                    Confirmar abertura
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {!abertura && (
        <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          O caixa de hoje ainda não foi aberto. Enquanto isso, não é possível pagar tickets ou despesas em
          dinheiro.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard destaque label="Saldo atual do caixa" valor={brl(saldo)} detalhe={abertura ? "Caixa aberto hoje" : "Caixa fechado"} />
        <StatCard label="Compras em dinheiro" valor={brl(somaTipo("compra"))} detalhe="No período" />
        <StatCard label="Despesas pagas com caixa" valor={brl(somaTipo("despesa"))} detalhe="No período" />
        <StatCard label="Sangrias" valor={brl(somaTipo("sangria"))} detalhe="No período" />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
          <Wallet className="mb-2 h-4 w-4 text-muted-foreground" />
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-9" />
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  {isLoading ? "Carregando..." : "Nenhuma movimentação de caixa registrada."}
                </TableCell>
              </TableRow>
            )}
            {linhas.map(({ mov, saldo: s }) => (
              <TableRow key={mov.id}>
                <TableCell>{dateBR(mov.data)}</TableCell>
                <TableCell>
                  <Badge variant={mov.tipo === "abertura" || mov.tipo === "aporte" ? "secondary" : "outline"}>
                    {rotuloTipo[mov.tipo]}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[28rem] truncate">{mov.descricao ?? "—"}</TableCell>
                <TableCell className="text-right">{brl(mov.valor)}</TableCell>
                <TableCell className="text-right font-semibold">{brl(s)}</TableCell>
                <TableCell className="text-right">{origem(mov)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
