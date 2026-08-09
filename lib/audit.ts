/**
 * Trilha de auditoria encadeada por hash.
 *
 * Cada evento carrega o hash do evento anterior. Alterar ou remover um registro
 * antigo quebra todos os hashes seguintes — a adulteração deixa de ser
 * invisível. É o mesmo princípio de um log append-only assinado, mas leve o
 * bastante para rodar no próprio dispositivo e ser verificado ao vivo.
 *
 * Isso importa fora da tela: a ocorrência vira prova. Laudo de seguradora,
 * comprovação de resposta para o órgão ambiental e apuração de alarme falso
 * dependem de um registro que ninguém possa reescrever depois do fato.
 *
 * Em produção o último hash de cada janela é assinado pelo servidor e
 * carimbado no tempo; aqui a cadeia já é íntegra e verificável.
 */

export type AuditAction =
  | "alerta.aberto"
  | "alerta.corroborado"
  | "alerta.escalado"
  | "alerta.assumido"
  | "alerta.recurso-despachado"
  | "alerta.recurso-chegou"
  | "alerta.controlado"
  | "alerta.encerrado"
  | "alerta.cancelado"
  | "pessoa.em-seguranca"
  | "local.exato-liberado"
  | "local.exato-revogado"
  | "acesso.negado"
  | "seguranca.limite-atingido";

export type AuditEvent = {
  seq: number;
  /** ms desde a época. */
  ts: number;
  actorId: string;
  actorName: string;
  action: AuditAction;
  /** Descrição curta em português, exibida na linha do tempo. */
  summary: string;
  /** Dados estruturados do evento. Nunca contém coordenada exata sem escopo. */
  payload: Record<string, string | number | boolean | null>;
};

export type SealedRecord = AuditEvent & {
  prevHash: string;
  hash: string;
};

export const GENESIS_HASH = "0".repeat(64);

/**
 * Serialização canônica: chaves ordenadas, sem espaços.
 * Sem isso, dois runtimes podem produzir hashes diferentes para o mesmo evento.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`)
    .join(",")}}`;
}

const encoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Hash de um evento dado o hash anterior. */
export function hashEvent(
  event: AuditEvent,
  prevHash: string,
): Promise<string> {
  return sha256Hex(`${prevHash}|${canonicalize(event)}`);
}

/** Encadeia uma lista de eventos ordenados por `seq`. */
export async function sealChain(events: AuditEvent[]): Promise<SealedRecord[]> {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const sealed: SealedRecord[] = [];
  let prevHash = GENESIS_HASH;
  for (const event of ordered) {
    const hash = await hashEvent(event, prevHash);
    sealed.push({ ...event, prevHash, hash });
    prevHash = hash;
  }
  return sealed;
}

export type ChainVerdict = {
  valid: boolean;
  checked: number;
  /** `seq` do primeiro registro inconsistente, quando houver. */
  brokenAtSeq?: number;
  reason?: string;
};

/** Reexecuta a cadeia e aponta o primeiro elo rompido. */
export async function verifyChain(
  records: SealedRecord[],
): Promise<ChainVerdict> {
  let prevHash = GENESIS_HASH;
  for (const record of records) {
    if (record.prevHash !== prevHash)
      return {
        valid: false,
        checked: records.length,
        brokenAtSeq: record.seq,
        reason: "Elo anterior não confere — registro inserido ou removido.",
      };
    // Reconstrói o evento campo a campo: recalcular a partir de um `rest`
    // deixaria passar qualquer chave nova acrescentada ao registro selado.
    const event: AuditEvent = {
      seq: record.seq,
      ts: record.ts,
      actorId: record.actorId,
      actorName: record.actorName,
      action: record.action,
      summary: record.summary,
      payload: record.payload,
    };
    const expected = await hashEvent(event, prevHash);
    if (expected !== record.hash)
      return {
        valid: false,
        checked: records.length,
        brokenAtSeq: record.seq,
        reason: "Conteúdo do registro foi alterado após a gravação.",
      };
    prevHash = record.hash;
  }
  return { valid: true, checked: records.length };
}

/** Forma curta do hash para exibição: `a1b2c3…d4e5f6`. */
export function shortHash(hash: string): string {
  return hash.length <= 14 ? hash : `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}
