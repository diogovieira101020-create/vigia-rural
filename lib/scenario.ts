/**
 * Cenário de demonstração — Fazenda Boa Esperança, Uruçuí (PI), MATOPIBA.
 *
 * Os dados são fictícios, mas a geometria é coerente: talhões de tamanho
 * plausível, aceiros nos limites, açude a oeste, sede e galpão de combustível
 * a leste, e vizinhos a distâncias reais de estrada de terra. É isso que
 * permite que os cálculos de propagação e de tempo de resposta produzam
 * números defensáveis em vez de números bonitos.
 */

import type { LatLon } from "./geo.ts";
import type { DayObservation, Weather } from "./fire.ts";
import type {
  MapLine,
  Org,
  Parcel,
  Person,
  ResponseUnit,
  Structure,
  WaterSource,
} from "./domain.ts";

export const REGION = {
  city: "Uruçuí",
  state: "PI",
  biome: "Cerrado / MATOPIBA",
  center: { lat: -7.234, lon: -44.548 } as LatLon,
};

/** Retângulo de talhão a partir dos limites — norte, sul, oeste, leste. */
const rect = (n: number, s: number, w: number, e: number): LatLon[] => [
  { lat: n, lon: w },
  { lat: n, lon: e },
  { lat: s, lon: e },
  { lat: s, lon: w },
];

// ---------------------------------------------------------------------------
// Organizações e pessoas
// ---------------------------------------------------------------------------

export const ORGS: Org[] = [
  {
    id: "org-boa-esperanca",
    name: "Fazenda Boa Esperança",
    short: "Boa Esperança",
    initials: "BE",
    kind: "propriedade",
    at: { lat: -7.24, lon: -44.54 },
    accent: "verde",
    registry: "CAR PI-2205706-3F81…",
    detail: "1.480 ha · soja, milho e pastagem",
  },
  {
    id: "org-santa-luzia",
    name: "Fazenda Santa Luzia",
    short: "Santa Luzia",
    initials: "SL",
    kind: "propriedade",
    at: { lat: -7.2165, lon: -44.531 },
    accent: "areia",
    registry: "CAR PI-2205706-9A22…",
    detail: "por 2,4 km de estrada vicinal",
  },
  {
    id: "org-tres-irmaos",
    name: "Fazenda Três Irmãos",
    short: "Três Irmãos",
    initials: "TI",
    kind: "propriedade",
    at: { lat: -7.231, lon: -44.5905 },
    accent: "areia",
    registry: "CAR PI-2205706-5C07…",
    detail: "divisa oeste, além do riacho",
  },
  {
    id: "org-bela-vista",
    name: "Sítio Bela Vista",
    short: "Bela Vista",
    initials: "BV",
    kind: "propriedade",
    at: { lat: -7.2585, lon: -44.559 },
    accent: "areia",
    registry: "CAR PI-2205706-1D45…",
    detail: "agricultura familiar · 62 ha",
  },
  {
    id: "org-assentamento",
    name: "Assentamento Nova Esperança",
    short: "Nova Esperança",
    initials: "NE",
    kind: "propriedade",
    at: { lat: -7.266, lon: -44.533 },
    accent: "areia",
    registry: "INCRA PA-0271…",
    detail: "34 famílias · escola municipal",
  },
  {
    id: "org-brigada",
    name: "Brigada Vale Verde",
    short: "Brigada Vale Verde",
    initials: "VV",
    kind: "brigada",
    at: { lat: -7.2105, lon: -44.5735 },
    accent: "ambar",
    registry: "Brigada privada credenciada nº 118/2025",
    detail: "8 brigadistas · pipa 6.000 L · UTV",
  },
  {
    id: "org-defesa-civil",
    name: "Defesa Civil de Uruçuí",
    short: "Defesa Civil",
    initials: "DC",
    kind: "orgao",
    at: { lat: -7.2295, lon: -44.504 },
    accent: "azul",
    registry: "COMPDEC · Decreto Municipal 41/2023",
    detail: "plantão 24 h · coordenação municipal",
  },
  {
    id: "org-bombeiros",
    name: "3º Pelotão · Corpo de Bombeiros",
    short: "Bombeiros",
    initials: "CB",
    kind: "orgao",
    at: { lat: -7.232, lon: -44.498 },
    accent: "brasa",
    registry: "CBMPI · integração via protocolo estadual",
    detail: "ABT 3.000 L · atendimento regional",
  },
];

export const orgById = (id: string) =>
  ORGS.find((o) => o.id === id) ?? ORGS[0];

export const PEOPLE: Person[] = [
  {
    id: "p-joao",
    name: "João Martins",
    initials: "JM",
    orgId: "org-boa-esperanca",
    role: "produtor",
    reputation: 92,
    verified: true,
    verifiedBy: "CPF + CAR da propriedade + selfie com prova de vida",
  },
  {
    id: "p-antonio",
    name: "Antônio Ribeiro",
    initials: "AR",
    orgId: "org-boa-esperanca",
    role: "operador",
    reputation: 78,
    verified: true,
    verifiedBy: "Vínculo empregatício confirmado pelo responsável",
  },
  {
    id: "p-marina",
    name: "Marina Alves",
    initials: "MA",
    orgId: "org-brigada",
    role: "coordenador",
    reputation: 96,
    verified: true,
    verifiedBy: "Registro de brigada + certificação de combate a incêndio",
  },
  {
    id: "p-carlos",
    name: "Carlos Nunes",
    initials: "CN",
    orgId: "org-defesa-civil",
    role: "autoridade",
    reputation: 99,
    verified: true,
    verifiedBy: "Credencial funcional COMPDEC validada pelo município",
  },
  {
    id: "p-josefa",
    name: "Josefa Lima",
    initials: "JL",
    orgId: "org-santa-luzia",
    role: "produtor",
    reputation: 88,
    verified: true,
    verifiedBy: "CPF + CAR da propriedade",
  },
];

export const personById = (id: string) =>
  PEOPLE.find((p) => p.id === id) ?? PEOPLE[0];

// ---------------------------------------------------------------------------
// Território
// ---------------------------------------------------------------------------

export const PARCELS: Parcel[] = [
  {
    id: "t-01",
    name: "Talhão Norte A",
    crop: "soja",
    orgId: "org-boa-esperanca",
    ring: rect(-7.221, -7.2285, -44.5605, -44.549),
    curing: 35,
  },
  {
    id: "t-02",
    name: "Talhão Norte B",
    crop: "soja",
    orgId: "org-boa-esperanca",
    ring: rect(-7.221, -7.2285, -44.5475, -44.5355),
    curing: 35,
  },
  {
    id: "t-03",
    name: "Talhão Centro A",
    crop: "milho",
    orgId: "org-boa-esperanca",
    ring: rect(-7.23, -7.2375, -44.5605, -44.549),
    curing: 55,
  },
  {
    id: "t-04",
    name: "Talhão Centro B",
    crop: "colhido",
    orgId: "org-boa-esperanca",
    ring: rect(-7.23, -7.2375, -44.5475, -44.5355),
    curing: 95,
  },
  {
    id: "t-05",
    name: "Pasto Sul",
    crop: "pastagem",
    orgId: "org-boa-esperanca",
    ring: rect(-7.239, -7.248, -44.562, -44.545),
    curing: 92,
  },
  {
    // Faixa contínua na divisa oeste, acompanhando o riacho — é assim que a
    // reserva legal costuma ser averbada no CAR, e não como um bloco solto.
    id: "t-rl",
    name: "Reserva Legal do Riacho",
    crop: "cerrado",
    orgId: "org-boa-esperanca",
    ring: rect(-7.221, -7.248, -44.575, -44.5618),
    curing: 70,
  },
];

export const parcelById = (id?: string) =>
  PARCELS.find((p) => p.id === id);

export const CROP_LABEL: Record<Parcel["crop"], string> = {
  soja: "Soja em enchimento de grão",
  milho: "Milho safrinha",
  pastagem: "Pastagem seca",
  cerrado: "Cerrado nativo · reserva legal",
  algodao: "Algodão",
  colhido: "Restolho pós-colheita",
};

export const WATER: WaterSource[] = [
  {
    id: "w-acude",
    name: "Açude Grande",
    kind: "acude",
    at: { lat: -7.2425, lon: -44.5598 },
    volumeM3: 18_000,
    truckAccess: true,
  },
  {
    id: "w-riacho",
    name: "Riacho do Meio",
    kind: "rio",
    at: { lat: -7.2345, lon: -44.5688 },
    volumeM3: 4_000,
    truckAccess: false,
  },
  {
    id: "w-poco",
    name: "Poço da sede",
    kind: "poco",
    at: { lat: -7.2405, lon: -44.5395 },
    volumeM3: 60,
    truckAccess: true,
  },
  {
    id: "w-caixa",
    name: "Caixa d'água Norte",
    kind: "caixa",
    at: { lat: -7.2255, lon: -44.548 },
    volumeM3: 30,
    truckAccess: true,
  },
];

export const WATER_LABEL: Record<WaterSource["kind"], string> = {
  acude: "Açude",
  poco: "Poço",
  rio: "Curso d'água",
  caixa: "Reservatório",
};

export const STRUCTURES: Structure[] = [
  {
    id: "s-sede",
    name: "Sede da fazenda",
    kind: "sede",
    at: { lat: -7.24, lon: -44.54 },
    orgId: "org-boa-esperanca",
    occupancy: 6,
    critical: false,
  },
  {
    id: "s-galpao",
    name: "Galpão de máquinas e combustível",
    kind: "galpao",
    at: { lat: -7.2412, lon: -44.5385 },
    orgId: "org-boa-esperanca",
    occupancy: 3,
    critical: true,
  },
  {
    id: "s-silo",
    name: "Armazém de grãos",
    kind: "silo",
    at: { lat: -7.2392, lon: -44.5378 },
    orgId: "org-boa-esperanca",
    occupancy: 2,
    critical: true,
  },
  {
    id: "s-casas",
    name: "Casas dos colaboradores",
    kind: "casa",
    at: { lat: -7.2415, lon: -44.5418 },
    orgId: "org-boa-esperanca",
    occupancy: 9,
    critical: true,
  },
  {
    id: "s-escola",
    name: "Escola Municipal do Campo",
    kind: "escola",
    at: { lat: -7.264, lon: -44.536 },
    orgId: "org-assentamento",
    occupancy: 82,
    critical: true,
  },
];

export const STRUCTURE_LABEL: Record<Structure["kind"], string> = {
  sede: "Sede",
  galpao: "Galpão",
  silo: "Armazém",
  curral: "Curral",
  casa: "Moradias",
  escola: "Escola",
};

export const LINES: MapLine[] = [
  {
    id: "l-pi247",
    name: "PI-247",
    kind: "rodovia",
    path: [
      { lat: -7.2, lon: -44.522 },
      { lat: -7.235, lon: -44.518 },
      { lat: -7.27, lon: -44.524 },
    ],
  },
  {
    id: "l-vicinal-acesso",
    name: "Vicinal do Buriti",
    kind: "vicinal",
    path: [
      { lat: -7.235, lon: -44.518 },
      { lat: -7.238, lon: -44.53 },
      { lat: -7.24, lon: -44.54 },
    ],
  },
  {
    id: "l-vicinal-interna",
    name: "Carreador central",
    kind: "vicinal",
    path: [
      { lat: -7.24, lon: -44.54 },
      { lat: -7.2382, lon: -44.5482 },
      { lat: -7.221, lon: -44.5482 },
    ],
  },
  {
    id: "l-vicinal-acude",
    name: "Acesso ao açude",
    kind: "vicinal",
    path: [
      { lat: -7.2382, lon: -44.5482 },
      { lat: -7.2425, lon: -44.5598 },
    ],
  },
  {
    id: "l-aceiro-n",
    name: "Aceiro perimetral norte",
    kind: "aceiro",
    widthM: 10,
    path: [
      { lat: -7.2203, lon: -44.5612 },
      { lat: -7.2203, lon: -44.5348 },
    ],
  },
  {
    id: "l-aceiro-c",
    name: "Aceiro divisor central",
    kind: "aceiro",
    widthM: 6,
    path: [
      { lat: -7.2292, lon: -44.5612 },
      { lat: -7.2292, lon: -44.5348 },
    ],
  },
  {
    id: "l-aceiro-s",
    name: "Aceiro do Pasto Sul",
    kind: "aceiro",
    widthM: 6,
    path: [
      { lat: -7.2383, lon: -44.5628 },
      { lat: -7.2383, lon: -44.5348 },
    ],
  },
  {
    id: "l-aceiro-o",
    name: "Aceiro oeste da reserva",
    kind: "aceiro",
    widthM: 10,
    path: [
      { lat: -7.2203, lon: -44.5618 },
      { lat: -7.2486, lon: -44.5618 },
    ],
  },
];

export const UNITS: ResponseUnit[] = [
  {
    id: "u-vv-pipa",
    name: "Pipa Vale Verde",
    orgId: "org-brigada",
    kind: "pipa",
    base: { lat: -7.2105, lon: -44.5735 },
    waterL: 6_000,
    crew: 4,
    speedKmh: 38,
    ready: true,
  },
  {
    id: "u-vv-utv",
    name: "Equipe de abafadores",
    orgId: "org-brigada",
    kind: "equipe",
    base: { lat: -7.2105, lon: -44.5735 },
    waterL: 200,
    crew: 5,
    speedKmh: 32,
    ready: true,
  },
  {
    id: "u-vv-drone",
    name: "Drone de reconhecimento",
    orgId: "org-brigada",
    kind: "drone",
    base: { lat: -7.2105, lon: -44.5735 },
    waterL: 0,
    crew: 1,
    speedKmh: 55,
    ready: true,
  },
  {
    id: "u-be-pipa",
    name: "Pipa da fazenda",
    orgId: "org-boa-esperanca",
    kind: "pipa",
    base: { lat: -7.2412, lon: -44.5385 },
    waterL: 4_000,
    crew: 2,
    speedKmh: 26,
    ready: true,
  },
  {
    id: "u-sl-trator",
    name: "Trator-tanque Santa Luzia",
    orgId: "org-santa-luzia",
    kind: "trator",
    base: { lat: -7.2165, lon: -44.531 },
    waterL: 2_500,
    crew: 2,
    speedKmh: 20,
    ready: true,
  },
  {
    id: "u-cb-abt",
    name: "ABT-01 Bombeiros",
    orgId: "org-bombeiros",
    kind: "abt",
    base: { lat: -7.232, lon: -44.498 },
    waterL: 3_000,
    crew: 5,
    speedKmh: 48,
    ready: true,
  },
];

export const unitById = (id: string) =>
  UNITS.find((u) => u.id === id) ?? UNITS[0];

export const UNIT_LABEL: Record<ResponseUnit["kind"], string> = {
  abt: "Auto-bomba tanque",
  pipa: "Caminhão-pipa",
  trator: "Trator-tanque",
  equipe: "Equipe de solo",
  drone: "Drone",
};

// ---------------------------------------------------------------------------
// Condições do dia da demonstração
// ---------------------------------------------------------------------------

/** Tarde crítica de setembro: fim da estiagem, vento de sudoeste. */
export const DEMO_WEATHER: Weather = {
  tempC: 36,
  humidity: 21,
  windKmh: 24,
  windFromDeg: 215,
  curing: 92,
  daysSinceRain: 13,
};

/** Série de 14 dias que alimenta o índice FMA+ exibido no app. */
export const RISK_SERIES: DayObservation[] = [
  { humidity13h: 68, windMs: 2.1, rainMm: 18.4 },
  { humidity13h: 55, windMs: 2.8, rainMm: 0 },
  { humidity13h: 48, windMs: 3.4, rainMm: 0 },
  { humidity13h: 44, windMs: 3.9, rainMm: 0 },
  { humidity13h: 41, windMs: 4.2, rainMm: 0.8 },
  { humidity13h: 38, windMs: 4.6, rainMm: 0 },
  { humidity13h: 35, windMs: 5.1, rainMm: 0 },
  { humidity13h: 33, windMs: 5.4, rainMm: 0 },
  { humidity13h: 30, windMs: 5.8, rainMm: 0 },
  { humidity13h: 28, windMs: 6.0, rainMm: 0 },
  { humidity13h: 26, windMs: 6.2, rainMm: 0 },
  { humidity13h: 24, windMs: 6.4, rainMm: 0 },
  { humidity13h: 22, windMs: 6.6, rainMm: 0 },
  { humidity13h: 21, windMs: 6.7, rainMm: 0 },
];

/** Ponto de ignição usado quando a demonstração roda sem GPS real. */
export const DEMO_ORIGIN: LatLon = { lat: -7.2445, lon: -44.5585 };

/** Enquadramento inicial do mapa. */
export const MAP_VIEW = {
  center: { lat: -7.2345, lon: -44.5475 } as LatLon,
  /** Largura visível em metros. */
  spanM: 9_000,
};

/** Perfis oferecidos no seletor de sessão da demonstração. */
export const DEMO_SESSIONS: { personId: string; label: string; blurb: string }[] =
  [
    {
      personId: "p-joao",
      label: "Produtor",
      blurb: "Responsável habilitado pela Boa Esperança",
    },
    {
      personId: "p-antonio",
      label: "Colaborador",
      blurb: "Tratorista verificado — só registra suspeita",
    },
    {
      personId: "p-marina",
      label: "Brigada",
      blurb: "Coordenação da Brigada Vale Verde",
    },
    {
      personId: "p-carlos",
      label: "Autoridade",
      blurb: "Defesa Civil de Uruçuí, plantão",
    },
  ];
