/**
 * Controle de acesso e protocolo de escalonamento.
 *
 * O risco real de uma rede de alerta não é o alerta que não sai — é o alerta
 * falso que sai. Se a rede toca por qualquer motivo, as pessoas desligam a
 * notificação, e aí o alerta verdadeiro também não chega. Por isso a
 * autorização aqui é dupla:
 *
 *  - RBAC: o que cada papel pode fazer.
 *  - ABAC: onde ele pode fazer (território) e sob quais condições
 *    (reputação, quórum, corroboração).
 *
 * Tudo é função pura: a mesma decisão pode ser reexecutada no servidor,
 * auditada e explicada para o usuário ("por que eu não posso acionar?").
 */

import { distanceM, type LatLon } from "./geo.ts";

// ---------------------------------------------------------------------------
// Papéis
// ---------------------------------------------------------------------------

export type Role =
  | "operador"
  | "produtor"
  | "brigadista"
  | "coordenador"
  | "autoridade";

export const ROLE_LABEL: Record<Role, string> = {
  operador: "Colaborador verificado",
  produtor: "Responsável habilitado",
  brigadista: "Brigadista credenciado",
  coordenador: "Coordenação de brigada",
  autoridade: "Autoridade pública",
};

export type Action =
  | "alerta:suspeita"
  | "alerta:corroborar"
  | "alerta:confirmar"
  | "alerta:emergencia"
  | "alerta:assumir"
  | "alerta:controlar"
  | "alerta:encerrar"
  | "alerta:cancelar"
  | "local:exato"
  | "rede:gerenciar"
  | "auditoria:ler";

/** Alcance territorial em que cada papel opera. */
export type Scope =
  | { kind: "propriedade"; propertyIds: string[] }
  | { kind: "raio"; center: LatLon; radiusKm: number }
  | { kind: "regional" };

const MATRIX: Record<Role, Action[]> = {
  operador: ["alerta:suspeita", "alerta:corroborar"],
  produtor: [
    "alerta:suspeita",
    "alerta:corroborar",
    "alerta:confirmar",
    "alerta:controlar",
    "alerta:cancelar",
    "local:exato",
    "rede:gerenciar",
    "auditoria:ler",
  ],
  brigadista: [
    "alerta:suspeita",
    "alerta:corroborar",
    "alerta:confirmar",
    "alerta:assumir",
    "alerta:controlar",
    "local:exato",
  ],
  coordenador: [
    "alerta:suspeita",
    "alerta:corroborar",
    "alerta:confirmar",
    "alerta:emergencia",
    "alerta:assumir",
    "alerta:controlar",
    "alerta:encerrar",
    "alerta:cancelar",
    "local:exato",
    "rede:gerenciar",
    "auditoria:ler",
  ],
  autoridade: [
    "alerta:suspeita",
    "alerta:corroborar",
    "alerta:confirmar",
    "alerta:emergencia",
    "alerta:assumir",
    "alerta:controlar",
    "alerta:encerrar",
    "alerta:cancelar",
    "local:exato",
    "auditoria:ler",
  ],
};

export type Actor = {
  id: string;
  name: string;
  orgId: string;
  role: Role;
  scope: Scope;
  /** Identidade verificada (documento + vínculo com a propriedade/órgão). */
  verified: boolean;
  /** 0–100. Cai a cada alarme falso confirmado, sobe a cada alerta procedente. */
  reputation: number;
};

export type Decision =
  | { allowed: true }
  | { allowed: false; reason: string; hint?: string };

const ALLOW: Decision = { allowed: true };
const deny = (reason: string, hint?: string): Decision => ({
  allowed: false,
  reason,
  hint,
});

/** O ator está territorialmente habilitado a agir sobre esse ponto? */
export function withinScope(
  actor: Actor,
  at: LatLon,
  propertyId?: string,
): boolean {
  const scope = actor.scope;
  if (scope.kind === "regional") return true;
  if (scope.kind === "raio")
    return distanceM(scope.center, at) <= scope.radiusKm * 1000;
  return propertyId ? scope.propertyIds.includes(propertyId) : false;
}

/**
 * Decisão de autorização, com motivo legível.
 * O motivo aparece na interface: nunca desabilitamos um botão sem explicar.
 */
export function can(
  actor: Actor,
  action: Action,
  context: { at?: LatLon; propertyId?: string } = {},
): Decision {
  if (!actor.verified)
    return deny(
      "Identidade ainda não verificada",
      "Conclua a verificação de documento e vínculo para agir na rede.",
    );

  if (!MATRIX[actor.role].includes(action))
    return deny(
      `${ROLE_LABEL[actor.role]} não tem essa atribuição`,
      "Registre uma suspeita — ela chega a quem pode acionar.",
    );

  if (context.at && !withinScope(actor, context.at, context.propertyId))
    return deny(
      "Fora do seu território de atuação",
      "Você só aciona dentro da área sob sua responsabilidade.",
    );

  if (action === "alerta:emergencia" && actor.reputation < 40)
    return deny(
      "Reputação abaixo do mínimo para escalonamento amplo",
      "Alertas improcedentes recentes reduziram seu limite. Um coordenador pode escalar.",
    );

  return ALLOW;
}

// ---------------------------------------------------------------------------
// Protocolo de escalonamento — "duas chaves"
// ---------------------------------------------------------------------------

export type AlertLevel = "suspeita" | "confirmado" | "emergencia";

export const LEVEL_LABEL: Record<AlertLevel, string> = {
  suspeita: "Suspeita",
  confirmado: "Confirmado",
  emergencia: "Emergência",
};

/** Raio de notificação e canais liberados por nível. */
export const LEVEL_REACH: Record<
  AlertLevel,
  { radiusKm: number; downwindKm: number; channels: string[] }
> = {
  suspeita: { radiusKm: 3, downwindKm: 4, channels: ["app"] },
  confirmado: { radiusKm: 8, downwindKm: 15, channels: ["app", "sms"] },
  emergencia: {
    radiusKm: 15,
    downwindKm: 30,
    channels: ["app", "sms", "voz", "órgãos"],
  },
};

export type Corroboration = {
  actorId: string;
  orgId: string;
  at: LatLon;
  /** ms desde a época. */
  timestamp: number;
  source: "humano" | "satelite" | "sensor";
};

export type EscalationInput = {
  actor: Actor;
  origin: LatLon;
  propertyId?: string;
  corroborations: Corroboration[];
  /** ms desde a época — instante da avaliação. */
  now: number;
  /** Índice FMA+ do dia; risco alto reduz a barreira para escalar. */
  riskIndex: number;
};

export type Escalation = {
  level: AlertLevel;
  /** Explicação curta de por que esse nível foi atingido. */
  rationale: string;
  /** Corroborações independentes válidas (organizações distintas). */
  independentSources: number;
  /** O que ainda falta para o próximo nível, se houver. */
  nextStep?: string;
};

/** Janela e distância que tornam duas observações "a mesma ocorrência". */
export const QUORUM_WINDOW_MS = 10 * 60 * 1000;
export const QUORUM_RADIUS_M = 1_500;

/**
 * Corroborações que contam: janela de tempo, proximidade e — o ponto crítico —
 * organizações distintas. Cinco pessoas da mesma fazenda são uma fonte só.
 */
export function independentCorroborations(input: EscalationInput): number {
  const orgs = new Set<string>();
  for (const c of input.corroborations) {
    if (input.now - c.timestamp > QUORUM_WINDOW_MS) continue;
    if (distanceM(input.origin, c.at) > QUORUM_RADIUS_M) continue;
    orgs.add(c.source === "humano" ? c.orgId : `auto:${c.source}`);
  }
  return orgs.size;
}

/**
 * Nível resultante do protocolo. Um humano nunca "escolhe" emergência: ele
 * fornece evidência, e a regra — a mesma para todo mundo — decide.
 */
export function evaluateEscalation(input: EscalationInput): Escalation {
  const sources = independentCorroborations(input);
  const role = input.actor.role;
  const hasSatellite = input.corroborations.some((c) => c.source === "satelite");
  const riskBoost = input.riskIndex > 20;

  const canEmergency = can(input.actor, "alerta:emergencia", {
    at: input.origin,
    propertyId: input.propertyId,
  }).allowed;
  const canConfirm = can(input.actor, "alerta:confirmar", {
    at: input.origin,
    propertyId: input.propertyId,
  }).allowed;

  if (canEmergency && (sources >= 2 || hasSatellite))
    return {
      level: "emergencia",
      rationale: hasSatellite
        ? "Autoridade competente com validação de foco por satélite."
        : "Autoridade competente com duas fontes independentes.",
      independentSources: sources,
    };

  if (sources >= 2 && (riskBoost || hasSatellite))
    return {
      level: "emergencia",
      rationale: riskBoost
        ? "Quórum de duas fontes independentes em dia de risco muito alto."
        : "Quórum humano confirmado por foco de calor em satélite.",
      independentSources: sources,
    };

  if (canConfirm || sources >= 2)
    return {
      level: "confirmado",
      rationale: canConfirm
        ? `${ROLE_LABEL[role]} declarou fogo ativo com evidência visual.`
        : "Duas organizações distintas relataram o mesmo foco.",
      independentSources: sources,
      nextStep:
        "Emergência regional exige coordenação de brigada, autoridade ou validação por satélite.",
    };

  return {
    level: "suspeita",
    rationale:
      "Relato individual sem corroboração — a rede imediata é avisada sem sirene.",
    independentSources: sources,
    nextStep: "Uma segunda organização confirmando eleva para nível Confirmado.",
  };
}

/**
 * Quem deve ser notificado, em que ordem.
 *
 * A ordem importa: primeiro quem está no caminho do fogo, depois quem apaga,
 * depois quem coordena. Notificar todo mundo de uma vez ao mesmo tempo é o
 * mesmo que não notificar ninguém.
 */
export type NotifyTarget = {
  id: string;
  name: string;
  at: LatLon;
  kind: "vizinho" | "brigada" | "autoridade" | "interno";
};

export type NotifyPlan = {
  target: NotifyTarget;
  distanceM: number;
  /** Está no setor a favor do vento? */
  downwind: boolean;
  /** Ordem de disparo: 1 é primeiro. */
  wave: 1 | 2 | 3;
  channels: string[];
  reason: string;
};

export function buildNotifyPlan(
  level: AlertLevel,
  origin: LatLon,
  headingDeg: number,
  targets: NotifyTarget[],
  bearingOf: (a: LatLon, b: LatLon) => number,
): NotifyPlan[] {
  const reach = LEVEL_REACH[level];
  const plans: NotifyPlan[] = [];

  for (const target of targets) {
    const dist = distanceM(origin, target.at);
    const bearing = bearingOf(origin, target.at);
    const delta = Math.abs(((((headingDeg - bearing) % 360) + 540) % 360) - 180);
    const downwind = delta <= 45;
    const limit =
      (downwind ? reach.downwindKm : reach.radiusKm) * 1000;
    if (dist > limit) continue;

    // As ondas separam papéis, não proximidade: quem precisa sair do caminho,
    // quem vem apagar, quem coordena. Uma brigada a favor do vento continua
    // sendo recurso de combate — o risco dela aparece na marca `downwind`, e
    // não promovendo a base dela a "evacuar primeiro".
    let wave: 1 | 2 | 3 = 3;
    let reason = "Dentro do raio de notificação do nível.";
    if (target.kind === "brigada") {
      wave = 2;
      reason = downwind
        ? "Recurso de combate — e a base está no setor a favor do vento."
        : "Recurso de combate disponível para despacho.";
    } else if (target.kind === "autoridade") {
      wave = level === "emergencia" ? 2 : 3;
      reason = "Coordenação pública da ocorrência.";
    } else if (downwind) {
      wave = 1;
      reason = "No setor a favor do vento — o fogo caminha nessa direção.";
    } else {
      reason = "No raio do alerta, mas fora da linha do vento.";
    }

    plans.push({
      target,
      distanceM: dist,
      downwind,
      wave,
      channels: reach.channels,
      reason,
    });
  }

  return plans.sort((a, b) => a.wave - b.wave || a.distanceM - b.distanceM);
}
