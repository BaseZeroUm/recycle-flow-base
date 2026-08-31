import { toast } from "sonner";

const ESTILO = `
  body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#111;margin:24px}
  h1{font-size:18px;margin:0 0 4px}
  h2{font-size:14px;margin:20px 0 6px}
  p{font-size:12px;color:#555;margin:0 0 16px}
  table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px}
  th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f3f4f6}
  .r{text-align:right}
  tfoot td{font-weight:700;border-top:2px solid #111}
  .neg{color:#b91c1c}
  @page{size:A4;margin:14mm}
`;

/** Abre uma janela de impressão A4 (o usuário pode salvar como PDF no diálogo do navegador). */
export function imprimirRelatorio({
  titulo,
  subtitulo,
  corpo,
  nomeArquivo,
}: {
  titulo: string;
  subtitulo?: string;
  corpo: string;
  nomeArquivo?: string;
}) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
    <title>${nomeArquivo ?? titulo}-${new Date().toISOString().slice(0, 10)}</title>
    <style>${ESTILO}</style></head><body>
    <h1>${titulo}</h1>
    <p>${subtitulo ?? `Emitido em ${new Date().toLocaleString("pt-BR")}`}</p>
    ${corpo}
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
