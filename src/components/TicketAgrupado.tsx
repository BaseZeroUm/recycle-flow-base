import { forwardRef } from "react";
import logoAsset from "@/assets/base01-logo-full.png.asset.json";
import { brl, dateBR, num } from "@/lib/format";
import type { DadosTicket } from "./TicketPesagem";

interface TicketAgrupadoProps {
  dados: DadosTicket[];
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-border py-1.5 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="font-medium text-foreground">{valor}</span>
    </div>
  );
}

export const TicketAgrupado = forwardRef<HTMLDivElement, TicketAgrupadoProps>(function TicketAgrupado(
  { dados },
  ref,
) {
  const primeiro = dados[0];
  if (!primeiro) return null;

  const mov = primeiro.mov;
  const entrada = mov.tipo === "entrada";
  const totalGeral = dados.reduce((s, d) => s + Number(d.mov.valor_total), 0);
  const pesoTotal = dados.reduce((s, d) => s + Number(d.mov.quantidade), 0);
  const unidade = primeiro.unidade;

  return (
    <div ref={ref} className="w-full max-w-md bg-card p-6 text-foreground">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4 border-b pb-4">
        <img src={logoAsset.url} alt="Base 01" className="h-10 w-auto" />
        <div className="text-right">
          <div className="text-sm font-semibold leading-tight">{primeiro.empresaNome}</div>
          {primeiro.empresaCnpj && (
            <div className="text-xs text-muted-foreground">CNPJ {primeiro.empresaCnpj}</div>
          )}
          {primeiro.empresaTelefone && (
            <div className="text-xs text-muted-foreground">{primeiro.empresaTelefone}</div>
          )}
        </div>
      </div>

      {/* Identificação do ticket */}
      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Ticket de pesagem</div>
          <div className="text-2xl font-bold">Nº {mov.numero_ticket ?? "—"}</div>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase">
          {entrada ? "Entrada · compra" : "Saída · venda"}
        </span>
      </div>

      {/* Dados gerais */}
      <div className="mt-4">
        <Linha rotulo="Data" valor={dateBR(mov.data)} />
        <Linha rotulo={entrada ? "Fornecedor" : "Cliente"} valor={primeiro.parceiroNome} />
        {mov.veiculo_placa && <Linha rotulo="Veículo / placa" valor={mov.veiculo_placa} />}
        {mov.motorista && <Linha rotulo="Motorista" valor={mov.motorista} />}
        {primeiro.responsavel && <Linha rotulo="Responsável" valor={primeiro.responsavel} />}
      </div>

      {/* Tabela de itens */}
      <div className="mt-4 overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Material</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Peso ({unidade})</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Unitário</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((d, i) => (
              <tr key={i} className="border-b border-dashed last:border-0">
                <td className="px-3 py-2">{d.materialNome}</td>
                <td className="px-3 py-2 text-right">{num(d.mov.quantidade)}</td>
                <td className="px-3 py-2 text-right">{brl(d.mov.valor_unitario)}</td>
                <td className="px-3 py-2 text-right font-medium">{brl(d.mov.valor_total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30">
              <td className="px-3 py-2 font-semibold">Total geral</td>
              <td className="px-3 py-2 text-right font-semibold">{num(pesoTotal)}</td>
              <td colSpan={2} className="px-3 py-2 text-right text-base font-bold">
                {brl(totalGeral)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Observações */}
      {mov.observacoes && (
        <div className="mt-3 text-sm text-muted-foreground italic">Obs: {mov.observacoes}</div>
      )}

      {/* Total em destaque */}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
        <span className="text-sm font-medium">Valor total</span>
        <span className="text-xl font-bold">{brl(totalGeral)}</span>
      </div>

      {/* Assinaturas */}
      <div className="mt-6 grid grid-cols-2 gap-6 text-center text-[10px] text-muted-foreground">
        <div className="border-t pt-1">Assinatura {entrada ? "fornecedor" : "cliente"}</div>
        <div className="border-t pt-1">Assinatura responsável</div>
      </div>

      <div className="mt-4 text-center text-[10px] text-muted-foreground">
        Documento gerado por Base 01 · Decide Beyond
      </div>
    </div>
  );
});

export function textoWhatsAppAgrupado(dados: DadosTicket[]): string {
  if (!dados.length) return "";
  const primeiro = dados[0];
  const mov = primeiro.mov;
  const entrada = mov.tipo === "entrada";
  const totalGeral = dados.reduce((s, d) => s + Number(d.mov.valor_total), 0);
  const pesoTotal = dados.reduce((s, d) => s + Number(d.mov.quantidade), 0);
  const unidade = primeiro.unidade;

  const cabecalho = [
    `*Ticket de pesagem nº ${mov.numero_ticket ?? ""}* — ${primeiro.empresaNome}`,
    `${entrada ? "Entrada (compra)" : "Saída (venda)"} · ${dateBR(mov.data)}`,
    `${entrada ? "Fornecedor" : "Cliente"}: ${primeiro.parceiroNome}`,
    "",
  ].join("\n");

  const itens = dados.map((d) => `• ${d.materialNome}: ${num(d.mov.quantidade)} ${unidade} × ${brl(d.mov.valor_unitario)} = *${brl(d.mov.valor_total)}*`).join("\n");

  const rodape = [
    "",
    `*Total: ${brl(totalGeral)}* (${num(pesoTotal)} ${unidade} em ${dados.length} item(ns))`,
    "",
    "Documento gerado por Base 01 · Decide Beyond",
  ].join("\n");

  return cabecalho + itens + rodape;
}
