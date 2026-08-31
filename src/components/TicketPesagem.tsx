import { forwardRef } from "react";
import logoAsset from "@/assets/base01-logo-full.png.asset.json";
import { brl, dateBR, num } from "@/lib/format";
import type { Movimentacao } from "@/lib/dados";

export interface DadosTicket {
  mov: Movimentacao;
  materialNome: string;
  unidade: string;
  parceiroNome: string;
  empresaNome: string;
  empresaCnpj?: string | null;
  empresaTelefone?: string | null;
  responsavel?: string | null;
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dashed border-border py-1.5 text-sm">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="font-medium text-foreground">{valor}</span>
    </div>
  );
}

export const TicketPesagem = forwardRef<HTMLDivElement, { dados: DadosTicket }>(function TicketPesagem(
  { dados },
  ref,
) {
  const { mov, materialNome, unidade, parceiroNome, empresaNome } = dados;
  const entrada = mov.tipo === "entrada";

  return (
    <div ref={ref} className="w-full max-w-md bg-card p-6 text-foreground">
      <div className="flex items-center justify-between gap-4 border-b pb-4">
        <img src={logoAsset.url} alt="Base 01" className="h-10 w-auto" />
        <div className="text-right">
          <div className="text-sm font-semibold leading-tight">{empresaNome}</div>
          {dados.empresaCnpj && <div className="text-xs text-muted-foreground">CNPJ {dados.empresaCnpj}</div>}
          {dados.empresaTelefone && <div className="text-xs text-muted-foreground">{dados.empresaTelefone}</div>}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Ticket de pesagem</div>
          <div className="text-2xl font-bold">Nº {mov.numero_ticket ?? "—"}</div>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold uppercase">
          {entrada ? "Entrada · compra" : "Saída · venda"}
        </span>
      </div>

      <div className="mt-4">
        <Linha rotulo="Data" valor={dateBR(mov.data)} />
        <Linha rotulo={entrada ? "Fornecedor" : "Cliente"} valor={parceiroNome} />
        <Linha rotulo="Material" valor={materialNome} />
        {mov.veiculo_placa && <Linha rotulo="Veículo / placa" valor={mov.veiculo_placa} />}
        {mov.motorista && <Linha rotulo="Motorista" valor={mov.motorista} />}
        <Linha rotulo="Peso" valor={`${num(mov.quantidade)} ${unidade}`} />
        <Linha rotulo="Valor unitário" valor={`${brl(mov.valor_unitario)} / ${unidade}`} />
        {mov.observacoes && <Linha rotulo="Observações" valor={mov.observacoes} />}
        {dados.responsavel && <Linha rotulo="Responsável" valor={dados.responsavel} />}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-muted px-4 py-3">
        <span className="text-sm font-medium">Valor total</span>
        <span className="text-xl font-bold">{brl(mov.valor_total)}</span>
      </div>

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

export function textoWhatsApp(d: DadosTicket) {
  const { mov } = d;
  return [
    `*Ticket de pesagem nº ${mov.numero_ticket ?? ""}* — ${d.empresaNome}`,
    `${mov.tipo === "entrada" ? "Entrada (compra)" : "Saída (venda)"} · ${dateBR(mov.data)}`,
    `${mov.tipo === "entrada" ? "Fornecedor" : "Cliente"}: ${d.parceiroNome}`,
    `Material: ${d.materialNome}`,
    `Peso líquido: ${num(mov.quantidade)} ${d.unidade}`,
    `Valor unitário: ${brl(mov.valor_unitario)}`,
    `*Valor total: ${brl(mov.valor_total)}*`,
  ].join("\n");
}
