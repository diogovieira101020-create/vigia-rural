/**
 * Modelo de domínio do Vigia Rural.
 *
 * Um só arquivo de tipos compartilhado pelo app do produtor, pela Central de
 * Operações e pelos testes. O estado é derivado de eventos: o que se guarda é
 * o que aconteceu, não a foto do momento — é isso que torna a ocorrência
 * auditável e reconstruível depois.
 */

import type { LatLon } from "./geo.ts";
import type { Weather } from "./fire.ts";
import type { AuditEvent } from "./audit.ts";
import type { Actor, AlertLevel, Corroboration, Role } from "./policy.ts";

export type { LatLon } from "./geo.ts";
export type { Weather } from "./fire.ts";
export type { Actor, AlertLevel, Corroboration, Role } from "./policy.ts";

// ---------------------------------------------------------------------------
// Cadastro
// ---------------------------------------------------------------------------

export type Accent = "verde" | "ambar" | "azul" | "areia" | "brasa";

export type OrgKind = "propriedade" | "brigada" | "orgao";

export type Org = {
  id: string;
  name: string;
  short: string;
  initials: string;
  kind: OrgKind;
  /** Sede / base operacional. */
  at: LatLon;
  accent: Accent;
  /** CAR para propriedades, CNPJ/registro para brigadas e órgãos. */
  registry: string;
  detail: string;
};

export type Person = {
  id: string;
  name: string;
  initials: string;
  orgId: string;
  role: Role;
  reputation: number;
  verified: boolean;
  /** Como a identidade foi comprovada — aparece no perfil. */
  verifiedBy: string;
};

// ---------------------------------------------------------------------------
// Território
// ---------------------------------------------------------------------------

export type Crop =
  | "soja"
  | "milho"
  | "pastagem"
  | "cerrado"
  | "algodao"
  | "colhido";

export type Parcel = {
  id: string;
  name: string;
  crop: Crop;
  orgId: string;
  ring: LatLon[];
  /** Material fino disponível — influencia a leitura de risco do talhão. */
  curing: number;
};

export type WaterKind = "acude" | "poco" | "rio" | "caixa";

export type WaterSource = {
  id: string;
  name: string;
  kind: WaterKind;
  at: LatLon;
  /** Volume aproveitável em m³. */
  volumeM3: number;
  /** Acesso para caminhão-pipa. */
  truckAccess: boolean;
};

export type StructureKind =
  | "sede"
  | "galpao"
  | "silo"
  | "curral"
  | "casa"
  | "escola";

export type Structure = {
  id: string;
  name: string;
  kind: StructureKind;
  at: LatLon;
  orgId: string;
  /** Pessoas normalmente presentes — define prioridade de evacuação. */
  occupancy: number;
  critical: boolean;
};

export type LineKind = "rodovia" | "vicinal" | "aceiro" | "cerca";

export type MapLine = {
  id: string;
  name: string;
  kind: LineKind;
  path: LatLon[];
  /** Largura em metros — aceiro estreito não segura fogo de cabeça. */
  widthM?: number;
};

export type UnitKind = "abt" | "pipa" | "trator" | "equipe" | "drone";

export type ResponseUnit = {
  id: string;
  name: string;
  orgId: string;
  kind: UnitKind;
  base: LatLon;
  /** Água embarcada em litros. */
  waterL: number;
  crew: number;
  /** Velocidade média realista em estrada de terra. */
  speedKmh: number;
  ready: boolean;
};

// ---------------------------------------------------------------------------
// Ocorrência
// ---------------------------------------------------------------------------

export type Evidence = "chamas" | "fumaca" | "cheiro" | "satelite";

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  chamas: "Chamas visíveis",
  fumaca: "Coluna de fumaça",
  cheiro: "Cheiro de queimado",
  satelite: "Foco de calor por satélite",
};

export type IncidentStatus =
  | "aberto"
  | "em_atendimento"
  | "controlado"
  | "encerrado"
  | "cancelado";

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  aberto: "Aberto",
  em_atendimento: "Em atendimento",
  controlado: "Controlado",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

export type DispatchStatus = "acionado" | "a_caminho" | "no_local" | "liberado";

export type Dispatch = {
  unitId: string;
  status: DispatchStatus;
  /** ms desde a época. */
  dispatchedAt: number;
  etaMin: number;
  /** Fonte de água atribuída ao reabastecimento. */
  waterSourceId?: string;
};

export type Outcome = "procedente" | "improcedente" | "inconclusivo";

/**
 * Relógio da ocorrência.
 *
 * O incêndio evolui em minutos, mas uma demonstração precisa caber em uma
 * conversa. O relógio separa tempo real de tempo simulado com uma âncora, de
 * modo que acelerar não distorce o histórico já registrado — e todas as telas
 * abertas leem exatamente o mesmo instante.
 */
export type Clock = {
  /** Multiplicador do tempo simulado. */
  scale: number;
  /** Instante real da última mudança de escala, ms. */
  anchorReal: number;
  /** Tempo simulado decorrido nesse instante, ms. */
  anchorSim: number;
};

export const newClock = (now: number, scale = 6): Clock => ({
  scale,
  anchorReal: now,
  anchorSim: 0,
});

/** Tempo simulado decorrido desde a abertura, em ms. */
export const simElapsed = (clock: Clock, realNow: number) =>
  Math.max(0, clock.anchorSim + (realNow - clock.anchorReal) * clock.scale);

export const rescale = (
  clock: Clock,
  realNow: number,
  scale: number,
): Clock => ({
  scale,
  anchorReal: realNow,
  anchorSim: simElapsed(clock, realNow),
});

export type Incident = {
  id: string;
  /** Código operacional legível: VR-2026-0142. */
  code: string;
  level: AlertLevel;
  status: IncidentStatus;
  origin: LatLon;
  accuracyM: number;
  parcelId?: string;
  evidence: Evidence;
  note?: string;
  reporter: { actorId: string; name: string; orgId: string; role: Role };
  openedAt: number;
  updatedAt: number;
  weather: Weather;
  corroborations: Corroboration[];
  dispatches: Dispatch[];
  audit: AuditEvent[];
  /** Quem recebeu acesso à coordenada exata e até quando (ms). */
  exactGrants: { actorId: string; orgId: string; until: number }[];
  /** Organização que assumiu o comando da ocorrência. */
  commandOrgId?: string;
  outcome?: Outcome;
  clock: Clock;
  /** Aba que está conduzindo a simulação, para não duplicar eventos. */
  hostId?: string;
  /** Marca a ocorrência como demonstração — nunca sai do dispositivo. */
  drill: boolean;
};

export type AppState = {
  version: number;
  seq: number;
  incidents: Incident[];
};

export const EMPTY_STATE: AppState = { version: 0, seq: 0, incidents: [] };

export const activeIncidents = (state: AppState) =>
  state.incidents.filter(
    (i) => i.status !== "encerrado" && i.status !== "cancelado",
  );

export const findIncident = (state: AppState, id: string) =>
  state.incidents.find((i) => i.id === id);

/** Sessão em uso: pessoa + organização + ator de autorização. */
export type Session = {
  person: Person;
  org: Org;
  actor: Actor;
};
