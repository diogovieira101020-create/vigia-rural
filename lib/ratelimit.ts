/**
 * Contenção de abuso: balde de fichas (token bucket) + carência pós-alerta.
 *
 * Uma rede de emergência é um alvo óbvio para trote e para uso hostil — alguém
 * pode disparar alertas em cadeia para esvaziar uma região ou para exaurir a
 * brigada. O limite não pode ser "N por minuto" e pronto: a carência precisa
 * crescer com o alcance do alerta e cair com a reputação do autor.
 *
 * Funções puras com o tempo injetado — testáveis e reexecutáveis no servidor.
 */

import { clamp } from "./geo.ts";

export type Bucket = {
  /** Fichas disponíveis. */
  tokens: number;
  /** Instante da última recarga, em ms. */
  updatedAt: number;
};

export type Limit = {
  /** Máximo de fichas acumuláveis. */
  capacity: number;
  /** Fichas recuperadas por minuto. */
  refillPerMin: number;
};

/** Limites por ação. Escalar custa muito mais caro do que relatar. */
export const LIMITS = {
  "alerta:suspeita": { capacity: 3, refillPerMin: 1 / 5 },
  "alerta:confirmar": { capacity: 2, refillPerMin: 1 / 15 },
  "alerta:emergencia": { capacity: 1, refillPerMin: 1 / 30 },
  "local:exato": { capacity: 20, refillPerMin: 2 },
} satisfies Record<string, Limit>;

export type LimitedAction = keyof typeof LIMITS;

export function newBucket(limit: Limit, now: number): Bucket {
  return { tokens: limit.capacity, updatedAt: now };
}

function refill(bucket: Bucket, limit: Limit, now: number): Bucket {
  const elapsedMin = Math.max(0, now - bucket.updatedAt) / 60_000;
  return {
    tokens: Math.min(limit.capacity, bucket.tokens + elapsedMin * limit.refillPerMin),
    updatedAt: now,
  };
}

export type ConsumeResult = {
  allowed: boolean;
  bucket: Bucket;
  /** Espera até a próxima ficha, em ms. 0 quando permitido. */
  retryAfterMs: number;
  /** Fichas restantes, arredondadas para baixo. */
  remaining: number;
};

/** Tenta gastar uma ficha. Nunca lança: devolve o novo estado do balde. */
export function consume(
  bucket: Bucket,
  limit: Limit,
  now: number,
  cost = 1,
): ConsumeResult {
  const filled = refill(bucket, limit, now);
  if (filled.tokens >= cost) {
    const next = { tokens: filled.tokens - cost, updatedAt: now };
    return {
      allowed: true,
      bucket: next,
      retryAfterMs: 0,
      remaining: Math.floor(next.tokens),
    };
  }
  const missing = cost - filled.tokens;
  return {
    allowed: false,
    bucket: filled,
    retryAfterMs: Math.ceil((missing / limit.refillPerMin) * 60_000),
    remaining: 0,
  };
}

/**
 * Carência após um alerta amplo: quanto mais gente o alerta mobilizou, mais
 * tempo até o mesmo autor poder mobilizar de novo. Reputação alta encurta;
 * histórico ruim alonga.
 */
export function cooldownMs(
  peopleNotified: number,
  reputation: number,
): number {
  const base = clamp(peopleNotified, 0, 500) * 900; // 0,9 s por pessoa avisada
  const factor = clamp(1.8 - reputation / 100, 0.4, 1.8);
  return Math.round(clamp(base * factor, 60_000, 45 * 60_000));
}

/**
 * Ajuste de reputação após o desfecho da ocorrência.
 * Alarme falso pesa mais que acerto: é assim que a rede se protege sem
 * precisar de moderação humana em tempo real.
 */
export function reputationAfter(
  current: number,
  outcome: "procedente" | "improcedente" | "inconclusivo",
): number {
  const delta =
    outcome === "procedente" ? 4 : outcome === "improcedente" ? -22 : 0;
  return clamp(Math.round(current + delta), 0, 100);
}

/** Formata a espera restante: "aguarde 3 min", "aguarde 45 s". */
export function formatRetry(ms: number): string {
  if (ms <= 0) return "disponível";
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 90) return `aguarde ${seconds} s`;
  return `aguarde ${Math.ceil(seconds / 60)} min`;
}
