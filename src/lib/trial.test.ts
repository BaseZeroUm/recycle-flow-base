import test from "node:test";
import assert from "node:assert/strict";
import { calcularStatusTrial, formatarTempoTrial } from "./trial.ts";

test("deve retornar null para valores nulos, vazios ou inválidos", () => {
  assert.equal(calcularStatusTrial(null), null);
  assert.equal(calcularStatusTrial(undefined), null);
  assert.equal(calcularStatusTrial("data-invalida"), null);
  assert.equal(formatarTempoTrial(null), null);
});

test("deve retornar estado expirado quando o tempo for <= 0", () => {
  const agora = 1_000_000_000;

  // Exatamente no momento
  const statusZero = calcularStatusTrial(new Date(agora).toISOString(), agora);
  assert.equal(statusZero?.expirado, true);
  assert.equal(statusZero?.texto, "Teste encerrado");
  assert.equal(statusZero?.textoCurto, "Teste encerrado");

  // Passado
  const statusPassado = calcularStatusTrial(new Date(agora - 5000).toISOString(), agora);
  assert.equal(statusPassado?.expirado, true);
  assert.equal(statusPassado?.texto, "Teste encerrado");
});

test("deve formatar corretamente para tempo >= 1 dia (>= 24h)", () => {
  const agora = 1_000_000_000;
  const HORA = 3_600_000;
  const DIA = 24 * HORA;

  // Exatamente 1 dia (singular)
  const status1Dia = calcularStatusTrial(new Date(agora + DIA).toISOString(), agora);
  assert.equal(status1Dia?.expirado, false);
  assert.equal(status1Dia?.dias, 1);
  assert.equal(status1Dia?.horas, 0);
  assert.equal(status1Dia?.texto, "1 dia restante");
  assert.equal(status1Dia?.textoCurto, "1 dia");

  // 1 dia e 4 horas
  const status1Dia4h = calcularStatusTrial(new Date(agora + DIA + 4 * HORA).toISOString(), agora);
  assert.equal(status1Dia4h?.dias, 1);
  assert.equal(status1Dia4h?.horas, 4);
  assert.equal(status1Dia4h?.texto, "1 dia e 4h restantes");
  assert.equal(status1Dia4h?.textoCurto, "1d 4h");

  // Exatamente 5 dias (plural)
  const status5Dias = calcularStatusTrial(new Date(agora + 5 * DIA).toISOString(), agora);
  assert.equal(status5Dias?.dias, 5);
  assert.equal(status5Dias?.horas, 0);
  assert.equal(status5Dias?.texto, "5 dias restantes");
  assert.equal(status5Dias?.textoCurto, "5 dias");

  // 2 dias e 10 horas
  const status2Dias10h = calcularStatusTrial(new Date(agora + 2 * DIA + 10 * HORA).toISOString(), agora);
  assert.equal(status2Dias10h?.dias, 2);
  assert.equal(status2Dias10h?.horas, 10);
  assert.equal(status2Dias10h?.texto, "2 dias e 10h restantes");
  assert.equal(status2Dias10h?.textoCurto, "2d 10h");
});

test("deve formatar corretamente para tempo < 1 dia (< 24h)", () => {
  const agora = 1_000_000_000;
  const MIN = 60_000;
  const HORA = 60 * MIN;

  // 14 horas e 32 minutos (exemplo da especificação)
  const status14h32m = calcularStatusTrial(new Date(agora + 14 * HORA + 32 * MIN).toISOString(), agora);
  assert.equal(status14h32m?.dias, 0);
  assert.equal(status14h32m?.horas, 14);
  assert.equal(status14h32m?.minutos, 32);
  assert.equal(status14h32m?.texto, "14h 32min restantes");
  assert.equal(status14h32m?.textoCurto, "14h 32min");

  // 1 hora exata (singular)
  const status1h = calcularStatusTrial(new Date(agora + 1 * HORA).toISOString(), agora);
  assert.equal(status1h?.horas, 1);
  assert.equal(status1h?.minutos, 0);
  assert.equal(status1h?.texto, "1 hora restante");
  assert.equal(status1h?.textoCurto, "1h");

  // 5 horas exatas (plural)
  const status5h = calcularStatusTrial(new Date(agora + 5 * HORA).toISOString(), agora);
  assert.equal(status5h?.horas, 5);
  assert.equal(status5h?.minutos, 0);
  assert.equal(status5h?.texto, "5 horas restantes");
  assert.equal(status5h?.textoCurto, "5h");

  // Menos de 1 hora: 1 minuto (singular)
  const status1m = calcularStatusTrial(new Date(agora + 1 * MIN).toISOString(), agora);
  assert.equal(status1m?.horas, 0);
  assert.equal(status1m?.minutos, 1);
  assert.equal(status1m?.texto, "1 minuto restante");
  assert.equal(status1m?.textoCurto, "1min");

  // Menos de 1 hora: 25 minutos (plural)
  const status25m = calcularStatusTrial(new Date(agora + 25 * MIN).toISOString(), agora);
  assert.equal(status25m?.horas, 0);
  assert.equal(status25m?.minutos, 25);
  assert.equal(status25m?.texto, "25 minutos restantes");
  assert.equal(status25m?.textoCurto, "25min");

  // Menos de 1 minuto (ex: 30 segundos)
  const status30s = calcularStatusTrial(new Date(agora + 30_000).toISOString(), agora);
  assert.equal(status30s?.expirado, false);
  assert.equal(status30s?.texto, "Menos de 1 minuto restante");
  assert.equal(status30s?.textoCurto, "< 1min");
});
