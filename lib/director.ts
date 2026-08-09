/**
 * Condução da ocorrência simulada.
 *
 * A rede do outro lado não existe no evento — mas o comportamento dela é o
 * ponto da demonstração. Aqui ficam os eventos que um sistema real receberia
 * de terceiros: o vizinho que confirma, o satélite do INPE que valida o foco,
 * a brigada que assume, o recurso que chega.
 *
 * O roteiro é declarativo e idempotente: só uma aba (o `hostId` da ocorrência)
 * emite, e cada passo verifica no estado se já aconteceu. Reprocessar a lista
 * inteira a cada segundo não duplica nada.
 */

import { simElapsed, type Incident } from "./domain.ts";
import { arrivals } from "./selectors.ts";
import { orgById, personById, unitById, UNITS } from "./scenario.ts";
import type { Command } from "./store.ts";

type Step = {
  /** Segundo simulado em que o evento entra. */
  atSec: number;
  /** Já aconteceu? Evita reemissão. */
  done: (incident: Incident) => boolean;
  build: (incident: Incident, at: number) => Command[];
};

const SCRIPT: Step[] = [
  {
    atSec: 55,
    done: (i) => i.corroborations.some((c) => c.actorId === "p-josefa"),
    build: (incident, at) => {
      const josefa = personById("p-josefa");
      const org = orgById(josefa.orgId);
      return [
        {
          type: "corroborar",
          at,
          incidentId: incident.id,
          actorName: josefa.name,
          label: `${josefa.name} (${org.short}) confirmou coluna de fumaça a 4,3 km, a favor do vento.`,
          corroboration: {
            actorId: josefa.id,
            orgId: org.id,
            at: org.at,
            timestamp: at,
            source: "humano",
          },
        },
      ];
    },
  },
  {
    atSec: 75,
    done: (i) => i.level !== "suspeita",
    build: (incident, at) => [
      {
        type: "escalar",
        at,
        incidentId: incident.id,
        level: "confirmado",
        rationale:
          "Duas organizações independentes relataram o mesmo foco dentro da janela de 10 min.",
        actorId: "sistema",
        actorName: "Protocolo automático",
      },
    ],
  },
  {
    atSec: 140,
    done: (i) => i.corroborations.some((c) => c.source === "satelite"),
    build: (incident, at) => [
      {
        type: "corroborar",
        at,
        incidentId: incident.id,
        actorName: "INPE · Programa Queimadas",
        label:
          "Foco de calor detectado por satélite a 380 m da coordenada relatada.",
        corroboration: {
          actorId: "inpe-viirs",
          orgId: "inpe",
          at: incident.origin,
          timestamp: at,
          source: "satelite",
        },
      },
      {
        type: "escalar",
        at,
        incidentId: incident.id,
        level: "emergencia",
        rationale:
          "Quórum humano validado por foco de calor em satélite, em dia de risco muito alto.",
        actorId: "sistema",
        actorName: "Protocolo automático",
      },
    ],
  },
  {
    atSec: 175,
    done: (i) => Boolean(i.commandOrgId),
    build: (incident, at) => {
      const marina = personById("p-marina");
      const brigada = orgById("org-brigada");
      const pipa = unitById("u-vv-pipa");
      const drone = unitById("u-vv-drone");
      const etaFor = (id: string) => {
        const unit = unitById(id);
        const km =
          (haversineKm(unit.base, incident.origin) * 1.3) / unit.speedKmh;
        return km * 60 + (unit.kind === "drone" ? 1 : 4);
      };
      return [
        {
          type: "assumir",
          at,
          incidentId: incident.id,
          orgId: brigada.id,
          orgName: brigada.name,
          actorId: marina.id,
          actorName: marina.name,
        },
        {
          type: "liberar-local",
          at,
          incidentId: incident.id,
          actorId: marina.id,
          actorName: marina.name,
          orgId: brigada.id,
          ttlMin: 120,
        },
        {
          type: "despachar",
          at,
          incidentId: incident.id,
          unitId: drone.id,
          unitName: drone.name,
          etaMin: etaFor(drone.id),
          actorId: marina.id,
          actorName: marina.name,
        },
        {
          type: "despachar",
          at,
          incidentId: incident.id,
          unitId: pipa.id,
          unitName: pipa.name,
          etaMin: etaFor(pipa.id),
          waterSourceId: "w-acude",
          actorId: marina.id,
          actorName: marina.name,
        },
      ];
    },
  },
  {
    atSec: 260,
    done: (i) => i.dispatches.some((d) => d.unitId === "u-be-pipa"),
    build: (incident, at) => {
      const joao = personById("p-joao");
      const unit = unitById("u-be-pipa");
      return [
        {
          type: "despachar",
          at,
          incidentId: incident.id,
          unitId: unit.id,
          unitName: unit.name,
          etaMin:
            ((haversineKm(unit.base, incident.origin) * 1.3) / unit.speedKmh) *
              60 +
            4,
          waterSourceId: "w-poco",
          actorId: joao.id,
          actorName: joao.name,
        },
      ];
    },
  },
  {
    atSec: 330,
    done: (i) =>
      i.audit.some((e) => e.actorId === "p-carlos" && e.action === "local.exato-liberado"),
    build: (incident, at) => {
      const carlos = personById("p-carlos");
      return [
        {
          type: "liberar-local",
          at,
          incidentId: incident.id,
          actorId: carlos.id,
          actorName: carlos.name,
          orgId: carlos.orgId,
          ttlMin: 180,
        },
      ];
    },
  },
];

/** Distância aproximada em km — cópia local para o roteiro não puxar geo. */
function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Comandos pendentes para a ocorrência no instante atual.
 *
 * Conduz quem abriu a ocorrência. Se essa aba sumiu — fechada, recarregada,
 * trocada de rota no meio da apresentação —, a aba de menor identificador
 * entre as presentes assume, para a simulação não congelar no palco. O critério
 * é determinístico, então duas abas nunca assumem ao mesmo tempo.
 */
export function pendingCommands(
  incident: Incident,
  realNow: number,
  selfId: string,
  peerIds: string[] = [],
): Command[] {
  if (incident.status === "encerrado" || incident.status === "cancelado")
    return [];

  const hostPresent =
    incident.hostId === selfId || peerIds.includes(incident.hostId ?? "");
  if (hostPresent) {
    if (incident.hostId !== selfId) return [];
  } else {
    const candidates = [selfId, ...peerIds].sort();
    if (candidates[0] !== selfId) return [];
  }

  const elapsedSec = simElapsed(incident.clock, realNow) / 1000;
  const out: Command[] = [];

  for (const step of SCRIPT) {
    if (elapsedSec < step.atSec) break;
    if (step.done(incident)) continue;
    out.push(...step.build(incident, realNow));
  }

  for (const dispatch of arrivals(incident, realNow)) {
    const unit = UNITS.find((u) => u.id === dispatch.unitId);
    if (!unit) continue;
    out.push({
      type: "chegou",
      at: realNow,
      incidentId: incident.id,
      unitId: unit.id,
      unitName: unit.name,
    });
  }

  return out;
}
