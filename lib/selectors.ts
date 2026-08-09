/**
 * Leituras derivadas da ocorrência.
 *
 * Nada aqui guarda estado: são projeções do incidente + tempo simulado. É o
 * que a Central mostra no mapa, o que o app do produtor mostra como "o fogo
 * chega em X minutos" e o que a auditoria reconstrói depois.
 */

import {
  bearingDeg,
  destination,
  distanceM,
  lerp,
  pointInPolygon,
  project,
  type LatLon,
} from "./geo.ts";
import {
  fireFront,
  frontPolygon,
  spreadModel,
  timeToReachMin,
  type FireFront,
  type SpreadModel,
} from "./fire.ts";
import {
  buildNotifyPlan,
  LEVEL_REACH,
  type NotifyPlan,
  type NotifyTarget,
} from "./policy.ts";
import {
  simElapsed,
  type Dispatch,
  type Incident,
  type Parcel,
  type ResponseUnit,
  type Structure,
  type WaterSource,
} from "./domain.ts";
import {
  ORGS,
  PARCELS,
  STRUCTURES,
  UNITS,
  WATER,
  orgById,
  unitById,
} from "./scenario.ts";

/** Minutos simulados desde a abertura da ocorrência. */
export const elapsedMin = (incident: Incident, realNow: number) =>
  simElapsed(incident.clock, realNow) / 60_000;

export const model = (incident: Incident): SpreadModel =>
  spreadModel(incident.weather);

export type FrontView = FireFront & { ring: LatLon[]; model: SpreadModel };

/** Geometria do fogo no instante atual, pronta para desenhar. */
export function front(incident: Incident, realNow: number): FrontView {
  const m = model(incident);
  const minutes = elapsedMin(incident, realNow);
  return {
    ...fireFront(m, minutes),
    ring: frontPolygon(incident.origin, m, minutes),
    model: m,
  };
}

/** Anéis de projeção futura — a faixa de incerteza mostrada no mapa. */
export function projectionRings(
  incident: Incident,
  realNow: number,
  horizonsMin: number[] = [15, 30, 60],
): { minutes: number; ring: LatLon[]; areaHa: number }[] {
  const m = model(incident);
  const now = elapsedMin(incident, realNow);
  return horizonsMin.map((h) => ({
    minutes: h,
    ring: frontPolygon(incident.origin, m, now + h),
    areaHa: fireFront(m, now + h).areaHa,
  }));
}

// ---------------------------------------------------------------------------
// O que está no caminho
// ---------------------------------------------------------------------------

export type Threat = {
  id: string;
  name: string;
  kind: "estrutura" | "talhao" | "vizinho";
  at: LatLon;
  /** Minutos até a frente alcançar, contados a partir de agora. */
  etaMin: number | null;
  distanceM: number;
  people: number;
  critical: boolean;
  detail: string;
};

const parcelCenter = (parcel: Parcel): LatLon => {
  const lat =
    parcel.ring.reduce((sum, p) => sum + p.lat, 0) / parcel.ring.length;
  const lon =
    parcel.ring.reduce((sum, p) => sum + p.lon, 0) / parcel.ring.length;
  return { lat, lon };
};

/**
 * Ativos ordenados por urgência real: quem o fogo alcança primeiro, não quem
 * está mais perto em linha reta. Vento manda mais que distância.
 */
export function threats(incident: Incident, realNow: number): Threat[] {
  const m = model(incident);
  const now = elapsedMin(incident, realNow);
  const out: Threat[] = [];

  const push = (
    id: string,
    name: string,
    kind: Threat["kind"],
    at: LatLon,
    people: number,
    critical: boolean,
    detail: string,
  ) => {
    const absolute = timeToReachMin(incident.origin, m, at);
    out.push({
      id,
      name,
      kind,
      at,
      etaMin: absolute === null ? null : Math.max(0, absolute - now),
      distanceM: distanceM(incident.origin, at),
      people,
      critical,
      detail,
    });
  };

  for (const s of STRUCTURES)
    push(
      s.id,
      s.name,
      "estrutura",
      s.at,
      s.occupancy,
      s.critical,
      orgById(s.orgId).short,
    );

  for (const p of PARCELS)
    if (p.id !== incident.parcelId)
      push(p.id, p.name, "talhao", parcelCenter(p), 0, false, p.crop);

  for (const o of ORGS)
    if (o.kind === "propriedade" && o.id !== incident.reporter.orgId)
      push(o.id, o.name, "vizinho", o.at, 0, false, o.detail);

  return out
    .filter((t) => t.etaMin !== null && t.etaMin < 240)
    .sort((a, b) => (a.etaMin ?? 1e9) - (b.etaMin ?? 1e9));
}

/** Talhão que contém um ponto, quando houver. */
export function parcelAt(point: LatLon): Parcel | undefined {
  return PARCELS.find((p) =>
    pointInPolygon(
      project(point, p.ring[0]),
      p.ring.map((v) => project(v, p.ring[0])),
    ),
  );
}

// ---------------------------------------------------------------------------
// Quem é avisado
// ---------------------------------------------------------------------------

/**
 * Alvos externos da notificação.
 *
 * A organização que abriu a ocorrência fica de fora: quem está lá já sabe do
 * fogo, e contá-la como "vizinho avisado" infla o alcance com uma linha que
 * não representa ninguém novo mobilizado.
 */
const notifyTargets = (exceptOrgId?: string): NotifyTarget[] => [
  ...ORGS.filter((o) => o.kind === "propriedade" && o.id !== exceptOrgId).map(
    (o) => ({
      id: o.id,
      name: o.name,
      at: o.at,
      kind: "vizinho" as const,
    }),
  ),
  ...ORGS.filter((o) => o.kind === "brigada").map((o) => ({
    id: o.id,
    name: o.name,
    at: o.at,
    kind: "brigada" as const,
  })),
  ...ORGS.filter((o) => o.kind === "orgao").map((o) => ({
    id: o.id,
    name: o.name,
    at: o.at,
    kind: "autoridade" as const,
  })),
];

export function notifyPlan(incident: Incident): NotifyPlan[] {
  return buildNotifyPlan(
    incident.level,
    incident.origin,
    model(incident).headingDeg,
    notifyTargets(incident.reporter.orgId),
    bearingDeg,
  );
}

/** Estimativa de pessoas alcançadas — usada no limite anti-abuso. */
export function peopleReached(incident: Incident): number {
  const orgs = new Set(notifyPlan(incident).map((p) => p.target.id));
  let total = 0;
  for (const id of orgs) {
    const org = orgById(id);
    total += org.kind === "propriedade" ? 6 : org.kind === "brigada" ? 8 : 12;
  }
  for (const s of STRUCTURES)
    if (distanceM(incident.origin, s.at) <= LEVEL_REACH[incident.level].radiusKm * 1000)
      total += s.occupancy;
  return total;
}

// ---------------------------------------------------------------------------
// Recursos
// ---------------------------------------------------------------------------

export type UnitOption = {
  unit: ResponseUnit;
  distanceM: number;
  etaMin: number;
  /** Fonte de água mais próxima do fogo com acesso para o veículo. */
  water?: WaterSource;
  /** Minutos de trabalho contínuo com a água embarcada (≈ 400 L/min). */
  autonomyMin: number;
  dispatched?: Dispatch;
  reason: string;
};

const FLOW_L_PER_MIN = 400;

/**
 * Ordena recursos por tempo de chegada, não por proximidade: um trator a 2 km
 * em estrada ruim chega depois de um caminhão a 6 km em vicinal boa.
 */
export function unitOptions(incident: Incident): UnitOption[] {
  return UNITS.map((unit) => {
    const dist = distanceM(unit.base, incident.origin);
    // Fator de sinuosidade da malha rural: estrada real é ~30 % mais longa.
    const roadM = dist * 1.3;
    const etaMin = (roadM / 1000 / unit.speedKmh) * 60 + (unit.kind === "drone" ? 1 : 4);
    const water = WATER.filter(
      (w) => w.truckAccess || unit.kind === "equipe" || unit.kind === "drone",
    ).sort(
      (a, b) =>
        distanceM(a.at, incident.origin) - distanceM(b.at, incident.origin),
    )[0];
    return {
      unit,
      distanceM: roadM,
      etaMin,
      water,
      autonomyMin: unit.waterL / FLOW_L_PER_MIN,
      dispatched: incident.dispatches.find((d) => d.unitId === unit.id),
      reason:
        unit.kind === "drone"
          ? "Confirma o perímetro antes da equipe entrar."
          : unit.waterL >= 3000
            ? "Volume suficiente para atacar a cabeça do fogo."
            : "Apoio de flanco e proteção de estruturas.",
    };
  }).sort((a, b) => a.etaMin - b.etaMin);
}

/** Posição interpolada de um recurso a caminho, para animar no mapa. */
export function unitPosition(
  incident: Incident,
  dispatch: Dispatch,
  realNow: number,
): { at: LatLon; progress: number; arrived: boolean } {
  const unit = unitById(dispatch.unitId);
  const dispatchSimMs =
    (dispatch.dispatchedAt - incident.openedAt) * incident.clock.scale;
  const elapsed = simElapsed(incident.clock, realNow) - dispatchSimMs;
  const progress = Math.min(1, Math.max(0, elapsed / (dispatch.etaMin * 60_000)));
  const bearing = bearingDeg(unit.base, incident.origin);
  const total = distanceM(unit.base, incident.origin);
  return {
    at: destination(unit.base, bearing, lerp(0, total, progress)),
    progress,
    arrived: progress >= 1,
  };
}

/** Recursos que já deveriam ter chegado segundo o tempo simulado. */
export function arrivals(incident: Incident, realNow: number): Dispatch[] {
  return incident.dispatches.filter(
    (d) =>
      d.status === "a_caminho" &&
      unitPosition(incident, d, realNow).arrived,
  );
}

// ---------------------------------------------------------------------------
// Privacidade de localização
// ---------------------------------------------------------------------------

/** O ator vê a coordenada exata agora? */
export function hasExactAccess(
  incident: Incident,
  actorId: string,
  now: number,
): boolean {
  if (incident.reporter.actorId === actorId) return true;
  return incident.exactGrants.some(
    (g) => g.actorId === actorId && g.until > now,
  );
}

/** Concessões vivas, para exibir no painel de segurança. */
export function activeGrants(incident: Incident, now: number) {
  return incident.exactGrants.filter((g) => g.until > now);
}

export const structureById = (id: string): Structure | undefined =>
  STRUCTURES.find((s) => s.id === id);
