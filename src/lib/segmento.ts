/**
 * Segmentos do Base 01. A fonte da verdade é `empresas.categoria` (tenant),
 * protegida por RLS e por trigger que impede o cliente de alterá-la.
 * O hostname é apenas uma dica de contexto (ex.: adega.basezeroum.com.br),
 * nunca concede acesso.
 */
export type Segmento = "reciclagem" | "adega";

export const SEGMENTOS: readonly Segmento[] = ["reciclagem", "adega"] as const;

export function normalizarSegmento(valor: unknown): Segmento {
  const v = typeof valor === "string" ? valor.toLowerCase().trim() : "";
  return v === "adega" ? "adega" : "reciclagem";
}

/** Rota inicial de cada segmento. Reciclagem mantém /painel (comportamento atual). */
export function rotaInicial(segmento: Segmento): "/painel" | "/adega" {
  return segmento === "adega" ? "/adega" : "/painel";
}

/** Rotas exclusivas da Adega. Tudo fora delas (e das rotas comuns) é Reciclagem. */
export function ehRotaAdega(pathname: string): boolean {
  return pathname === "/adega" || pathname.startsWith("/adega/");
}

/** Rotas acessíveis a qualquer segmento dentro da área logada. */
const ROTAS_COMUNS = ["/empresa", "/usuarios"];
export function ehRotaComum(pathname: string): boolean {
  return ROTAS_COMUNS.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Segmento sugerido pelo hostname (preparado para subdomínios futuros). */
export function segmentoPorHost(hostname: string): Segmento | null {
  const h = hostname.toLowerCase();
  if (h.startsWith("adega.")) return "adega";
  if (h.startsWith("reciclagem.")) return "reciclagem";
  return null;
}
