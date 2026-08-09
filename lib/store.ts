/**
 * Estado da ocorrência como sequência de comandos.
 *
 * Nada é alterado no lugar: cada comando gera um novo estado e um registro de
 * auditoria. Isso dá três coisas de graça — a Central e o app convergem para o
 * mesmo estado, a linha do tempo é o próprio log, e o laudo pós-ocorrência é
 * uma projeção do que já está gravado.
 */

import type { AuditAction, AuditEvent } from "./audit.ts";
import {
  newClock,
  rescale,
  type AppState,
  type Corroboration,
  type Dispatch,
  type Evidence,
  type Incident,
  type IncidentStatus,
  type Outcome,
} from "./domain.ts";
import type { AlertLevel } from "./policy.ts";
import type { LatLon } from "./geo.ts";
import type { Weather } from "./fire.ts";

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

export type Command =
  | {
      type: "abrir";
      at: number;
      incidentId: string;
      code: string;
      hostId: string;
      origin: LatLon;
      accuracyM: number;
      parcelId?: string;
      evidence: Evidence;
      note?: string;
      level: AlertLevel;
      rationale: string;
      weather: Weather;
      reporter: Incident["reporter"];
      drill: boolean;
    }
  | {
      type: "corroborar";
      at: number;
      incidentId: string;
      corroboration: Corroboration;
      actorName: string;
      label: string;
    }
  | {
      type: "escalar";
      at: number;
      incidentId: string;
      level: AlertLevel;
      rationale: string;
      actorId: string;
      actorName: string;
    }
  | {
      type: "assumir";
      at: number;
      incidentId: string;
      orgId: string;
      orgName: string;
      actorId: string;
      actorName: string;
    }
  | {
      type: "despachar";
      at: number;
      incidentId: string;
      unitId: string;
      unitName: string;
      etaMin: number;
      waterSourceId?: string;
      actorId: string;
      actorName: string;
    }
  | {
      type: "chegou";
      at: number;
      incidentId: string;
      unitId: string;
      unitName: string;
    }
  | {
      type: "status";
      at: number;
      incidentId: string;
      status: IncidentStatus;
      actorId: string;
      actorName: string;
      outcome?: Outcome;
      reason?: string;
    }
  | {
      type: "liberar-local";
      at: number;
      incidentId: string;
      actorId: string;
      actorName: string;
      orgId: string;
      ttlMin: number;
    }
  | {
      type: "seguranca";
      at: number;
      incidentId: string;
      actorId: string;
      actorName: string;
      orgName: string;
    }
  | {
      type: "negado";
      at: number;
      incidentId: string;
      actorId: string;
      actorName: string;
      action: string;
      reason: string;
    }
  | { type: "escala"; at: number; incidentId: string; scale: number }
  | { type: "limpar"; at: number };

// ---------------------------------------------------------------------------
// Redutor
// ---------------------------------------------------------------------------

type AuditInput = {
  action: AuditAction;
  actorId: string;
  actorName: string;
  summary: string;
  payload?: AuditEvent["payload"];
};

function withAudit(
  state: AppState,
  incident: Incident,
  at: number,
  entry: AuditInput,
): { incident: Incident; seq: number } {
  const seq = state.seq + 1;
  const event: AuditEvent = {
    seq,
    ts: at,
    actorId: entry.actorId,
    actorName: entry.actorName,
    action: entry.action,
    summary: entry.summary,
    payload: entry.payload ?? {},
  };
  return {
    incident: { ...incident, audit: [...incident.audit, event], updatedAt: at },
    seq,
  };
}

function replace(state: AppState, incident: Incident, seq: number): AppState {
  return {
    version: state.version + 1,
    seq,
    incidents: state.incidents.map((i) =>
      i.id === incident.id ? incident : i,
    ),
  };
}

/** Aplica um comando. Comandos desconhecidos ou inválidos não alteram nada. */
export function reduce(state: AppState, command: Command): AppState {
  if (command.type === "limpar")
    return { version: state.version + 1, seq: 0, incidents: [] };

  if (command.type === "abrir") {
    if (state.incidents.some((i) => i.id === command.incidentId)) return state;
    const seq = state.seq + 1;
    const incident: Incident = {
      id: command.incidentId,
      code: command.code,
      level: command.level,
      status: "aberto",
      origin: command.origin,
      accuracyM: command.accuracyM,
      parcelId: command.parcelId,
      evidence: command.evidence,
      note: command.note,
      reporter: command.reporter,
      openedAt: command.at,
      updatedAt: command.at,
      weather: command.weather,
      corroborations: [
        {
          actorId: command.reporter.actorId,
          orgId: command.reporter.orgId,
          at: command.origin,
          timestamp: command.at,
          source: "humano",
        },
      ],
      dispatches: [],
      audit: [
        {
          seq,
          ts: command.at,
          actorId: command.reporter.actorId,
          actorName: command.reporter.name,
          action: "alerta.aberto",
          summary: `${command.reporter.name} abriu a ocorrência ${command.code} (${command.level}).`,
          payload: {
            evidencia: command.evidence,
            nivel: command.level,
            criterio: command.rationale,
            precisaoM: command.accuracyM,
            simulado: command.drill,
          },
        },
      ],
      exactGrants: [],
      clock: newClock(command.at),
      hostId: command.hostId,
      drill: command.drill,
    };
    return {
      version: state.version + 1,
      seq,
      incidents: [incident, ...state.incidents],
    };
  }

  const target = state.incidents.find((i) => i.id === command.incidentId);
  if (!target) return state;

  switch (command.type) {
    case "corroborar": {
      const already = target.corroborations.some(
        (c) =>
          c.actorId === command.corroboration.actorId &&
          c.source === command.corroboration.source,
      );
      if (already) return state;
      const withCorroboration: Incident = {
        ...target,
        corroborations: [...target.corroborations, command.corroboration],
      };
      const { incident, seq } = withAudit(state, withCorroboration, command.at, {
        action: "alerta.corroborado",
        actorId: command.corroboration.actorId,
        actorName: command.actorName,
        summary: command.label,
        payload: {
          fonte: command.corroboration.source,
          organizacao: command.corroboration.orgId,
        },
      });
      return replace(state, incident, seq);
    }

    case "escalar": {
      const order: AlertLevel[] = ["suspeita", "confirmado", "emergencia"];
      if (order.indexOf(command.level) <= order.indexOf(target.level))
        return state;
      const { incident, seq } = withAudit(
        state,
        { ...target, level: command.level },
        command.at,
        {
          action: "alerta.escalado",
          actorId: command.actorId,
          actorName: command.actorName,
          summary: `Nível elevado para ${command.level}. ${command.rationale}`,
          payload: { nivel: command.level, criterio: command.rationale },
        },
      );
      return replace(state, incident, seq);
    }

    case "assumir": {
      if (target.commandOrgId === command.orgId) return state;
      const { incident, seq } = withAudit(
        state,
        {
          ...target,
          commandOrgId: command.orgId,
          status: target.status === "aberto" ? "em_atendimento" : target.status,
        },
        command.at,
        {
          action: "alerta.assumido",
          actorId: command.actorId,
          actorName: command.actorName,
          summary: `${command.orgName} assumiu o comando da ocorrência.`,
          payload: { organizacao: command.orgId },
        },
      );
      return replace(state, incident, seq);
    }

    case "despachar": {
      if (target.dispatches.some((d) => d.unitId === command.unitId))
        return state;
      const dispatch: Dispatch = {
        unitId: command.unitId,
        status: "a_caminho",
        dispatchedAt: command.at,
        etaMin: command.etaMin,
        waterSourceId: command.waterSourceId,
      };
      const { incident, seq } = withAudit(
        state,
        {
          ...target,
          dispatches: [...target.dispatches, dispatch],
          status: target.status === "aberto" ? "em_atendimento" : target.status,
        },
        command.at,
        {
          action: "alerta.recurso-despachado",
          actorId: command.actorId,
          actorName: command.actorName,
          summary: `${command.unitName} despachada · chegada estimada em ${Math.round(command.etaMin)} min.`,
          payload: { recurso: command.unitId, etaMin: Math.round(command.etaMin) },
        },
      );
      return replace(state, incident, seq);
    }

    case "chegou": {
      const dispatch = target.dispatches.find(
        (d) => d.unitId === command.unitId,
      );
      if (!dispatch || dispatch.status === "no_local") return state;
      const { incident, seq } = withAudit(
        state,
        {
          ...target,
          dispatches: target.dispatches.map((d) =>
            d.unitId === command.unitId
              ? { ...d, status: "no_local" as const }
              : d,
          ),
        },
        command.at,
        {
          action: "alerta.recurso-chegou",
          actorId: command.unitId,
          actorName: command.unitName,
          summary: `${command.unitName} chegou ao local.`,
          payload: { recurso: command.unitId },
        },
      );
      return replace(state, incident, seq);
    }

    case "status": {
      if (target.status === command.status) return state;
      const action: AuditAction =
        command.status === "controlado"
          ? "alerta.controlado"
          : command.status === "encerrado"
            ? "alerta.encerrado"
            : command.status === "cancelado"
              ? "alerta.cancelado"
              : "alerta.assumido";
      const { incident, seq } = withAudit(
        state,
        { ...target, status: command.status, outcome: command.outcome ?? target.outcome },
        command.at,
        {
          action,
          actorId: command.actorId,
          actorName: command.actorName,
          summary:
            command.reason ??
            `Ocorrência marcada como ${command.status.replace("_", " ")}.`,
          payload: {
            status: command.status,
            desfecho: command.outcome ?? null,
          },
        },
      );
      return replace(state, incident, seq);
    }

    case "liberar-local": {
      const until = command.at + command.ttlMin * 60_000;
      const grants = [
        ...target.exactGrants.filter((g) => g.actorId !== command.actorId),
        { actorId: command.actorId, orgId: command.orgId, until },
      ];
      const { incident, seq } = withAudit(
        state,
        { ...target, exactGrants: grants },
        command.at,
        {
          action: "local.exato-liberado",
          actorId: command.actorId,
          actorName: command.actorName,
          summary: `Coordenada exata liberada para ${command.actorName} por ${command.ttlMin} min.`,
          payload: { organizacao: command.orgId, validadeMin: command.ttlMin },
        },
      );
      return replace(state, incident, seq);
    }

    case "seguranca": {
      if (
        target.audit.some(
          (e) =>
            e.action === "pessoa.em-seguranca" && e.actorId === command.actorId,
        )
      )
        return state;
      const { incident, seq } = withAudit(state, target, command.at, {
        action: "pessoa.em-seguranca",
        actorId: command.actorId,
        actorName: command.actorName,
        summary: `${command.actorName} (${command.orgName}) confirmou estar em local seguro.`,
      });
      return replace(state, incident, seq);
    }

    case "negado": {
      const { incident, seq } = withAudit(state, target, command.at, {
        action: "acesso.negado",
        actorId: command.actorId,
        actorName: command.actorName,
        summary: `Ação "${command.action}" negada: ${command.reason}`,
        payload: { acao: command.action, motivo: command.reason },
      });
      return replace(state, incident, seq);
    }

    case "escala": {
      const clock = rescale(target.clock, command.at, command.scale);
      return replace(state, { ...target, clock }, state.seq);
    }

    default:
      return state;
  }
}

/** Aplica uma sequência de comandos, útil em testes e no replay do log. */
export function reduceAll(state: AppState, commands: Command[]): AppState {
  return commands.reduce(reduce, state);
}

/** Código operacional sequencial e legível: VR-2026-0042. */
export function nextCode(state: AppState, year: number): string {
  const n = state.incidents.length + 1;
  return `VR-${year}-${String(n).padStart(4, "0")}`;
}
