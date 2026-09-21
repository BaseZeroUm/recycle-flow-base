export interface InfoTrial {
  expirado: boolean;
  dias: number;
  horas: number;
  minutos: number;
  totalMs: number;
  texto: string;
  textoCurto: string;
}

const MS_MINUTO = 60 * 1000;
const MS_HORA = 60 * MS_MINUTO;
const MS_DIA = 24 * MS_HORA;

/**
 * Calcula e formata o tempo restante do período de teste gratuito (free trial).
 *
 * Regras:
 * 1. >= 1 dia (>= 24h): exibe em dias (ex: "5 dias restantes", "1 dia restante", ou com horas "2 dias e 4h restantes").
 * 2. < 1 dia (< 24h): exibe em horas e minutos (ex: "14h 32min restantes", "1 hora restante", "25 minutos restantes").
 * 3. <= 0: exibe estado expirado (ex: "Teste encerrado").
 */
export function calcularStatusTrial(
  trialAte: string | Date | null | undefined,
  agora: number = Date.now()
): InfoTrial | null {
  if (!trialAte) return null;

  const dataAlvo = typeof trialAte === "string" ? new Date(trialAte).getTime() : trialAte.getTime();
  if (Number.isNaN(dataAlvo)) return null;

  const totalMs = dataAlvo - agora;

  // 3. Se o tempo expirar (<= 0):
  if (totalMs <= 0) {
    return {
      expirado: true,
      dias: 0,
      horas: 0,
      minutos: 0,
      totalMs,
      texto: "Teste encerrado",
      textoCurto: "Teste encerrado",
    };
  }

  // 1. Se o tempo restante for maior ou igual a 1 dia (>= 24 horas):
  if (totalMs >= MS_DIA) {
    const dias = Math.floor(totalMs / MS_DIA);
    const horas = Math.floor((totalMs % MS_DIA) / MS_HORA);
    const minutos = Math.floor((totalMs % MS_HORA) / MS_MINUTO);

    const rotuloDia = dias === 1 ? "1 dia" : `${dias} dias`;
    const texto =
      horas > 0
        ? `${rotuloDia} e ${horas}h restantes`
        : `${rotuloDia} ${dias === 1 ? "restante" : "restantes"}`;

    const textoCurto = horas > 0 ? `${dias}d ${horas}h` : rotuloDia;

    return {
      expirado: false,
      dias,
      horas,
      minutos,
      totalMs,
      texto,
      textoCurto,
    };
  }

  // 2. Se o tempo restante for menor que 1 dia (< 24 horas):
  const horas = Math.floor(totalMs / MS_HORA);
  const minutos = Math.floor((totalMs % MS_HORA) / MS_MINUTO);

  if (horas >= 1) {
    const rotuloHora = `${horas}h`;
    const texto =
      minutos > 0
        ? `${rotuloHora} ${minutos}min restantes`
        : `${horas} ${horas === 1 ? "hora restante" : "horas restantes"}`;

    const textoCurto = minutos > 0 ? `${rotuloHora} ${minutos}min` : rotuloHora;

    return {
      expirado: false,
      dias: 0,
      horas,
      minutos,
      totalMs,
      texto,
      textoCurto,
    };
  }

  if (minutos >= 1) {
    const texto = minutos === 1 ? "1 minuto restante" : `${minutos} minutos restantes`;
    const textoCurto = `${minutos}min`;

    return {
      expirado: false,
      dias: 0,
      horas: 0,
      minutos,
      totalMs,
      texto,
      textoCurto,
    };
  }

  // Menos de 1 minuto restante mas ainda não expirado
  return {
    expirado: false,
    dias: 0,
    horas: 0,
    minutos: 0,
    totalMs,
    texto: "Menos de 1 minuto restante",
    textoCurto: "< 1min",
  };
}

export function formatarTempoTrial(
  trialAte: string | Date | null | undefined,
  agora: number = Date.now()
): string | null {
  const status = calcularStatusTrial(trialAte, agora);
  return status ? status.texto : null;
}
