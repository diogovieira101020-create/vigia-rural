/**
 * Modelos de comportamento do fogo.
 *
 * Duas famílias, ambas publicadas e verificáveis — o objetivo é que a projeção
 * mostrada na tela possa ser defendida por um agrônomo, não que ela seja
 * "bonita":
 *
 *  1. Propagação em pastagem/cerrado aberto — CSIRO Grassland Fire Spread
 *     Meter (Cheney, Gould & Catchpole, 1998), com geometria elíptica de
 *     Alexander (1985).
 *  2. Risco diário — Fórmula de Monte Alegre estendida, FMA+ (Soares, 1972;
 *     Nunes, Soares & Batista, 2006), o índice de referência no Brasil.
 *
 * IMPORTANTE: são modelos simplificados, calibrados para vegetação herbácea.
 * Servem para priorizar a resposta, não para substituir avaliação de campo.
 * O produto sempre exibe a projeção como faixa de incerteza.
 *
 * Módulo puro e sem dependências externas.
 */

import { clamp, destination, project, type LatLon } from "./geo.ts";

// ---------------------------------------------------------------------------
// Condições ambientais
// ---------------------------------------------------------------------------

export type Weather = {
  /** Temperatura do ar em °C. */
  tempC: number;
  /** Umidade relativa do ar em %. */
  humidity: number;
  /** Velocidade do vento a 10 m em km/h. */
  windKmh: number;
  /** Direção DE ONDE o vento sopra, em graus do norte (convenção meteorológica). */
  windFromDeg: number;
  /** Grau de curamento da vegetação em % (quanto do material fino está seco). */
  curing: number;
  /** Dias desde a última chuva significativa. */
  daysSinceRain: number;
};

/** Direção PARA ONDE o fogo é empurrado (azimute de propagação). */
export const windToDeg = (w: Pick<Weather, "windFromDeg">) =>
  (w.windFromDeg + 180) % 360;

/**
 * Umidade do material fino morto (%), estimada por temperatura e UR.
 * Relação empírica australiana para pastagem exposta ao sol durante o dia.
 */
export function fineFuelMoisture(tempC: number, humidity: number): number {
  return clamp(9.58 - 0.205 * tempC + 0.138 * humidity, 1, 40);
}

/** Coeficiente de umidade Φm do modelo CSIRO. */
export function moistureCoefficient(moisture: number, windKmh: number): number {
  if (moisture >= 20) return 0; // acima disso a pastagem não sustenta propagação
  if (moisture < 12) return Math.exp(-0.108 * moisture);
  return windKmh < 10
    ? Math.max(0, 0.684 - 0.0342 * moisture)
    : Math.max(0, 0.547 - 0.0228 * moisture);
}

/** Coeficiente de curamento Φc do modelo CSIRO. */
export function curingCoefficient(curing: number): number {
  return 1.12 / (1 + 59.2 * Math.exp(-0.124 * (clamp(curing, 0, 100) - 50)));
}

// ---------------------------------------------------------------------------
// Propagação
// ---------------------------------------------------------------------------

export type SpreadModel = {
  /** Velocidade da cabeça do fogo, m/min. */
  headRosMMin: number;
  /** Velocidade da retaguarda (contra o vento), m/min. */
  backRosMMin: number;
  /** Razão comprimento/largura da elipse. */
  lengthToBreadth: number;
  /** Azimute de propagação da cabeça, graus do norte. */
  headingDeg: number;
  /** Umidade do material fino usada no cálculo, %. */
  fuelMoisture: number;
};

/**
 * Taxa de propagação em pastagem — CSIRO Grassland Fire Spread Meter.
 * Retorna a cabeça, a retaguarda e a geometria da elipse.
 */
export function spreadModel(weather: Weather): SpreadModel {
  const u = Math.max(0, weather.windKmh);
  const moisture = fineFuelMoisture(weather.tempC, weather.humidity);
  const phiM = moistureCoefficient(moisture, u);
  const phiC = curingCoefficient(weather.curing);

  // km/h no modelo original
  const baseKmh =
    u < 5 ? 0.054 + 0.269 * u : 1.4 + 0.838 * Math.pow(u - 5, 0.844);
  const headKmh = baseKmh * phiM * phiC;
  const headRosMMin = (headKmh * 1000) / 60;

  // Razão comprimento/largura para incêndio em pastagem (Cheney et al.).
  const lengthToBreadth = clamp(u > 1 ? 1.1 * Math.pow(u, 0.464) : 1, 1, 8);

  // Relação elíptica clássica entre cabeça e retaguarda (Alexander, 1985).
  const lb = lengthToBreadth;
  const ratio = (lb - Math.sqrt(Math.max(0, lb * lb - 1))) /
    (lb + Math.sqrt(Math.max(0, lb * lb - 1)));

  return {
    headRosMMin,
    backRosMMin: headRosMMin * ratio,
    lengthToBreadth,
    headingDeg: windToDeg(weather),
    fuelMoisture: moisture,
  };
}

export type FireFront = {
  /** Semi-eixo maior, m. */
  semiMajorM: number;
  /** Semi-eixo menor, m. */
  semiMinorM: number;
  /** Deslocamento do centro da elipse em relação à ignição, m. */
  centerOffsetM: number;
  /** Área queimada, hectares. */
  areaHa: number;
  /** Perímetro do fogo, m. */
  perimeterM: number;
  /** Distância percorrida pela cabeça, m. */
  headDistanceM: number;
};

/** Geometria do incêndio após `minutes` minutos de propagação livre. */
export function fireFront(model: SpreadModel, minutes: number): FireFront {
  const t = Math.max(0, minutes);
  const head = model.headRosMMin * t;
  const back = model.backRosMMin * t;
  const semiMajorM = (head + back) / 2;
  const semiMinorM = semiMajorM / model.lengthToBreadth;
  const centerOffsetM = (head - back) / 2;
  const areaM2 = Math.PI * semiMajorM * semiMinorM;
  // Aproximação de Ramanujan para o perímetro da elipse.
  const a = semiMajorM;
  const b = semiMinorM;
  const perimeterM =
    a + b > 0
      ? Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
      : 0;
  return {
    semiMajorM,
    semiMinorM,
    centerOffsetM,
    areaHa: areaM2 / 10_000,
    perimeterM,
    headDistanceM: head,
  };
}

/** Polígono geográfico do perímetro do fogo, pronto para desenhar no mapa. */
export function frontPolygon(
  origin: LatLon,
  model: SpreadModel,
  minutes: number,
  steps = 48,
): LatLon[] {
  const front = fireFront(model, minutes);
  if (front.semiMajorM <= 0) return [];
  const ring: LatLon[] = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    // Coordenadas locais: u ao longo do vento, v transversal.
    const u = front.centerOffsetM + front.semiMajorM * Math.cos(theta);
    const v = front.semiMinorM * Math.sin(theta);
    const dist = Math.hypot(u, v);
    const bearing = model.headingDeg + (Math.atan2(v, u) * 180) / Math.PI;
    ring.push(destination(origin, bearing, dist));
  }
  return ring;
}

/**
 * Tempo, em minutos, até a frente de fogo alcançar `target`.
 * Retorna `null` quando o alvo está fora do eixo de propagação plausível
 * (modelo não propaga) ou quando o fogo nunca o alcança.
 *
 * Como a elipse cresce linearmente no tempo, o instante de chegada sai de uma
 * equação do segundo grau em t.
 */
export function timeToReachMin(
  origin: LatLon,
  model: SpreadModel,
  target: LatLon,
): number | null {
  if (model.headRosMMin <= 0) return null;

  const p = project(target, origin);
  // Rotaciona para o referencial do vento: u = a favor, v = transversal.
  const rad = (model.headingDeg * Math.PI) / 180;
  const u = p.x * Math.sin(rad) + p.y * Math.cos(rad);
  const v = p.x * Math.cos(rad) - p.y * Math.sin(rad);

  const A = (model.headRosMMin + model.backRosMMin) / 2; // semi-eixo por minuto
  const B = A / model.lengthToBreadth;
  const C = (model.headRosMMin - model.backRosMMin) / 2; // deslocamento por minuto

  const qa = (C * C) / (A * A) - 1; // sempre < 0
  const qb = (-2 * u * C) / (A * A);
  const qc = (u * u) / (A * A) + (v * v) / (B * B);

  const disc = qb * qb - 4 * qa * qc;
  if (disc < 0) return null;
  const sqrt = Math.sqrt(disc);
  const roots = [(-qb + sqrt) / (2 * qa), (-qb - sqrt) / (2 * qa)].filter(
    (t) => t > 0 && Number.isFinite(t),
  );
  if (!roots.length) return null;
  return Math.min(...roots);
}

// ---------------------------------------------------------------------------
// Risco diário — Fórmula de Monte Alegre estendida (FMA+)
// ---------------------------------------------------------------------------

export type RiskClass = "nulo" | "pequeno" | "medio" | "alto" | "muito-alto";

export type DailyRisk = {
  index: number;
  klass: RiskClass;
  label: string;
  /** 0–1, para barras e arcos. */
  ratio: number;
  advice: string;
};

const RISK_LABEL: Record<RiskClass, string> = {
  nulo: "Nulo",
  pequeno: "Pequeno",
  medio: "Médio",
  alto: "Alto",
  "muito-alto": "Muito alto",
};

const RISK_ADVICE: Record<RiskClass, string> = {
  nulo: "Condição estável. Rotina normal de campo.",
  pequeno: "Atenção comum. Mantenha aceiros limpos.",
  medio: "Evite queima controlada e solda a céu aberto.",
  alto: "Suspenda operações com faísca. Brigada em prontidão.",
  "muito-alto": "Janela crítica. Equipe e água posicionadas desde já.",
};

/** Classifica o índice FMA+ nas faixas oficiais. */
export function classifyRisk(index: number): RiskClass {
  if (index <= 1) return "nulo";
  if (index <= 3) return "pequeno";
  if (index <= 8) return "medio";
  if (index <= 20) return "alto";
  return "muito-alto";
}

/**
 * Fator de abatimento do índice conforme a chuva do dia (mm), segundo as
 * restrições da Fórmula de Monte Alegre.
 */
export function rainAbatement(rainMm: number): number {
  if (rainMm < 2.5) return 1; // sem alteração
  if (rainMm < 5) return 0.7;
  if (rainMm < 10) return 0.4;
  if (rainMm <= 12.9) return 0.2;
  return 0; // zera o índice
}

export type DayObservation = {
  /** Umidade relativa às 13 h, %. */
  humidity13h: number;
  /** Vento às 13 h, m/s. */
  windMs: number;
  /** Chuva acumulada no dia, mm. */
  rainMm: number;
};

/**
 * Índice FMA+ acumulado para uma série de dias (mais antigo primeiro).
 * FMA+ = Σ (100 / H) · e^(0,04·v), com abatimento por chuva.
 */
export function monteAlegrePlus(days: DayObservation[]): number {
  let index = 0;
  for (const day of days) {
    index *= rainAbatement(day.rainMm);
    if (day.rainMm > 12.9) continue;
    const h = clamp(day.humidity13h, 1, 100);
    index += (100 / h) * Math.exp(0.04 * Math.max(0, day.windMs));
  }
  return index;
}

/** Empacota o índice com rótulo, proporção e recomendação operacional. */
export function dailyRisk(days: DayObservation[]): DailyRisk {
  const index = monteAlegrePlus(days);
  const klass = classifyRisk(index);
  return {
    index,
    klass,
    label: RISK_LABEL[klass],
    ratio: clamp(index / 30, 0, 1),
    advice: RISK_ADVICE[klass],
  };
}
