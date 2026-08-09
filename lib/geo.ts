/**
 * Geodésia mínima para operação em escala de propriedade rural (< 50 km).
 *
 * Nessa escala uma projeção equirretangular local (plano tangente) tem erro
 * desprezível (< 0,1 %) e evita carregar uma biblioteca de projeção inteira em
 * um dispositivo que pode estar em 2G no meio do talhão.
 *
 * Módulo puro e sem dependências: é testado isoladamente em `tests/`.
 */

export type LatLon = { lat: number; lon: number };
export type Point = { x: number; y: number };

/** Raio médio da Terra em metros (IUGG). */
export const EARTH_RADIUS_M = 6_371_008.8;

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Limita um valor ao intervalo [min, max]. */
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Interpolação linear. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Distância em metros pela fórmula de haversine.
 * Precisa o suficiente para roteamento de resposta (erro < 0,5 %).
 */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Azimute inicial de `a` para `b`, em graus a partir do norte (0–360). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Ponto a `distM` metros de `origin` no azimute `bearing` (graus do norte). */
export function destination(
  origin: LatLon,
  bearing: number,
  distM: number,
): LatLon {
  const delta = distM / EARTH_RADIUS_M;
  const theta = toRad(bearing);
  const lat1 = toRad(origin.lat);
  const lon1 = toRad(origin.lon);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(delta) +
      Math.cos(lat1) * Math.sin(delta) * Math.cos(theta),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(lat1),
      Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: toDeg(lat2), lon: ((toDeg(lon2) + 540) % 360) - 180 };
}

/**
 * Projeta lat/lon para metros no plano local, com origem em `ref`.
 * x cresce para leste, y cresce para o norte.
 */
export function project(p: LatLon, ref: LatLon): Point {
  const mPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const mPerDegLon = mPerDegLat * Math.cos(toRad(ref.lat));
  return { x: (p.lon - ref.lon) * mPerDegLon, y: (p.lat - ref.lat) * mPerDegLat };
}

/** Inverso de `project`. */
export function unproject(p: Point, ref: LatLon): LatLon {
  const mPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const mPerDegLon = mPerDegLat * Math.cos(toRad(ref.lat));
  return { lat: ref.lat + p.y / mPerDegLat, lon: ref.lon + p.x / mPerDegLon };
}

/** Área de um polígono projetado, em m², pela fórmula do laço (shoelace). */
export function polygonAreaM2(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Área de um polígono geográfico em hectares. */
export function polygonAreaHa(ring: LatLon[]): number {
  if (ring.length < 3) return 0;
  const ref = ring[0];
  return polygonAreaM2(ring.map((p) => project(p, ref))) / 10_000;
}

/** Ponto dentro de polígono (ray casting) no espaço projetado. */
export function pointInPolygon(p: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Diferença angular assinada entre dois azimutes, em [-180, 180].
 * Usada para saber se um vizinho está a favor ou contra o vento.
 */
export function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "L", "ESE", "SE", "SSE",
  "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO",
] as const;

/** Rosa dos ventos em português (L = leste, O = oeste). */
export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/** Distância legível: "820 m", "1,2 km", "14 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1).replace(".", ",") : Math.round(km)} km`;
}

/** Área legível em hectares. */
export function formatHa(hectares: number): string {
  if (hectares < 10) return `${hectares.toFixed(1).replace(".", ",")} ha`;
  return `${Math.round(hectares).toLocaleString("pt-BR")} ha`;
}

/** Duração legível a partir de segundos: "00:42", "12:07", "1h 04". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Reduz a precisão de uma coordenada para um "quadrante" de ~`cellM` metros.
 *
 * É a base da privacidade de localização: a rede vê o quadrante, não a
 * coordenada exata. `precisionLabel` documenta o que foi divulgado.
 */
export function coarsen(p: LatLon, cellM = 1000): LatLon & { cellM: number } {
  const mPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const stepLat = cellM / mPerDegLat;
  const lat = Math.round(p.lat / stepLat) * stepLat;
  // O passo em longitude vem da latitude JÁ arredondada. Usar a latitude de
  // entrada faria dois pontos da mesma célula caírem em valores diferentes —
  // e um quadrante instável deixa de proteger a coordenada que ele esconde.
  const mPerDegLon = mPerDegLat * Math.cos(toRad(lat));
  const stepLon = cellM / mPerDegLon;
  return { lat, lon: Math.round(p.lon / stepLon) * stepLon, cellM };
}

/** Formata coordenada com máscara opcional (privacidade). */
export function formatLatLon(p: LatLon, masked = false): string {
  const f = (v: number) => (masked ? `${v.toFixed(2)}•••` : v.toFixed(5));
  return `${f(p.lat)}, ${f(p.lon)}`;
}
