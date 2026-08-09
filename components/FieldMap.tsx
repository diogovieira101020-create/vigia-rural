"use client";

/**
 * Mapa operacional vetorial.
 *
 * Não é um mapa de rua com um alfinete em cima. O que decide um combate a
 * incêndio rural é outra coisa: onde estão os talhões e o que há plantado
 * neles, onde estão os aceiros, onde há água com acesso para caminhão, onde
 * moram pessoas, e para onde o vento está levando a frente.
 *
 * Por isso o mapa é desenhado a partir do próprio cadastro, em SVG:
 *  • funciona sem internet — nenhum tile é baixado;
 *  • nenhuma coordenada de propriedade vai para servidor de terceiro;
 *  • cada feição é um dado do domínio, clicável e explicável;
 *  • a projeção do fogo é o mesmo modelo que alimenta os números da tela.
 *
 * Projeção local equirretangular com origem no centro da vista — na escala de
 * uma propriedade o erro é irrelevante e o custo é uma multiplicação.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  compass,
  destination,
  distanceM,
  formatDistance,
  project,
  toRad,
  unproject,
  type LatLon,
} from "@/lib/geo.ts";
import { windToDeg } from "@/lib/fire.ts";
import { LEVEL_REACH } from "@/lib/policy.ts";
import type { Incident, Parcel } from "@/lib/domain.ts";
import {
  LINES,
  MAP_VIEW,
  ORGS,
  PARCELS,
  STRUCTURES,
  WATER,
  unitById,
} from "@/lib/scenario.ts";
import { front, projectionRings, unitPosition } from "@/lib/selectors.ts";
import { Drone, Drop, Truck, Tractor, Users } from "./Icons.tsx";

export type LayerId =
  | "talhoes"
  | "aceiros"
  | "agua"
  | "estruturas"
  | "vizinhos"
  | "projecao"
  | "alcance";

export const LAYER_LABEL: Record<LayerId, string> = {
  talhoes: "Talhões e cultura",
  aceiros: "Aceiros e estradas",
  agua: "Água disponível",
  estruturas: "Pessoas e estruturas",
  vizinhos: "Rede vizinha",
  projecao: "Projeção do fogo",
  alcance: "Raio de notificação",
};

export const DEFAULT_LAYERS: Record<LayerId, boolean> = {
  talhoes: true,
  aceiros: true,
  agua: true,
  estruturas: true,
  vizinhos: true,
  projecao: true,
  alcance: false,
};

const CROP_FILL: Record<Parcel["crop"], string> = {
  soja: "var(--map-soja)",
  milho: "var(--map-milho)",
  pastagem: "var(--map-pasto)",
  cerrado: "var(--map-cerrado)",
  algodao: "var(--map-soja)",
  colhido: "var(--map-colhido)",
};

type Viewport = { center: LatLon; spanM: number };

export type FieldMapProps = {
  incident?: Incident;
  realNow: number;
  center?: LatLon;
  spanM?: number;
  layers?: Record<LayerId, boolean>;
  interactive?: boolean;
  /** Centraliza na ocorrência ao montar e quando outra entra. */
  autoFocus?: boolean;
  /** Escala, rosa dos ventos e zoom. Desligue em mapas pequenos. */
  overlays?: boolean;
  /** Esconde a coordenada exata do foco (privacidade por padrão). */
  masked?: boolean;
  compactLabels?: boolean;
  className?: string;
  onPick?: (pick: { kind: string; id: string; name: string }) => void;
};

export function FieldMap({
  incident,
  realNow,
  center = MAP_VIEW.center,
  spanM = MAP_VIEW.spanM,
  layers = DEFAULT_LAYERS,
  interactive = true,
  autoFocus = true,
  overlays = true,
  masked = false,
  compactLabels = false,
  className,
  onPick,
}: FieldMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 900, h: 620 });
  const [view, setView] = useState<Viewport>(() =>
    incident && autoFocus
      ? { center: incident.origin, spanM }
      : { center, spanM },
  );
  const dragRef = useRef<{ x: number; y: number; center: LatLon } | null>(null);

  // Recentraliza quando a ocorrência muda de identidade, não a cada tique.
  // Ajuste de estado durante a renderização (e não em efeito): o React
  // reprocessa antes de pintar, sem o quadro intermediário com a vista antiga.
  const incidentId = incident?.id;
  const [lastIncidentId, setLastIncidentId] = useState(incidentId);
  if (incidentId !== lastIncidentId) {
    setLastIncidentId(incidentId);
    if (incident && autoFocus) setView({ center: incident.origin, spanM });
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0)
        setSize({ w: Math.round(width), h: Math.round(height) });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const scale = size.w / view.spanM; // px por metro
  const toXY = useCallback(
    (p: LatLon) => {
      const m = project(p, view.center);
      return { x: size.w / 2 + m.x * scale, y: size.h / 2 - m.y * scale };
    },
    [view.center, scale, size.w, size.h],
  );
  // Marcador fora do quadro ainda desenha o rótulo, que então encosta na borda
  // ou colide com as sobreposições. Recorta antes de desenhar.
  const inFrame = useCallback(
    (p: LatLon, pad = 30) => {
      const { x, y } = (() => {
        const m = project(p, view.center);
        return { x: size.w / 2 + m.x * scale, y: size.h / 2 - m.y * scale };
      })();
      return x > pad && x < size.w - pad && y > pad && y < size.h - pad;
    },
    [view.center, scale, size.w, size.h],
  );

  const path = useCallback(
    (ring: LatLon[], close = true) => {
      if (!ring.length) return "";
      const d = ring
        .map((p, i) => {
          const { x, y } = toXY(p);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ");
      return close ? `${d} Z` : d;
    },
    [toXY],
  );

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      center: view.center,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (event.clientX - drag.x) / scale;
    const dy = (event.clientY - drag.y) / scale;
    setView((v) => ({
      ...v,
      center: unproject({ x: -dx, y: dy }, drag.center),
    }));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const zoomBy = (factor: number) =>
    setView((v) => ({
      ...v,
      spanM: Math.min(24_000, Math.max(900, v.spanM * factor)),
    }));

  const onWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    if (!interactive) return;
    zoomBy(event.deltaY > 0 ? 1.12 : 0.89);
  };

  // ---------------------------------------------------------------- fogo --

  const fireView = useMemo(
    () => (incident ? front(incident, realNow) : null),
    [incident, realNow],
  );
  // Só desenha a projeção que cabe na vista. Um anel de 60 min com vento forte
  // sai da tela e vira um risco diagonal sem significado — pior que não mostrar.
  const rings = useMemo(() => {
    if (!incident || !layers.projecao) return [];
    const limit = view.spanM * 0.55;
    return projectionRings(incident, realNow, [10, 20, 30]).filter((ring) =>
      ring.ring.every((p) => distanceM(incident.origin, p) < limit),
    );
  }, [incident, realNow, layers.projecao, view.spanM]);

  const headingDeg = incident ? windToDeg(incident.weather) : 0;
  const originXY = incident ? toXY(incident.origin) : null;

  // Barra de escala: escolhe a distância "redonda" mais próxima de 90 px.
  const scaleBar = useMemo(() => {
    const target = 90 / scale;
    const nice = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000];
    const meters = nice.find((n) => n >= target) ?? 10000;
    return { meters, px: meters * scale };
  }, [scale]);

  const labelSize = compactLabels ? 9 : 11;

  return (
    <div className={`fmap${className ? ` ${className}` : ""}`} ref={hostRef}>
      <svg
        className="fmap__svg"
        width={size.w}
        height={size.h}
        viewBox={`0 0 ${size.w} ${size.h}`}
        role="img"
        aria-label="Mapa operacional da área monitorada"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        onWheel={onWheel}
        style={{ cursor: interactive ? "grab" : "default" }}
      >
        <defs>
          <pattern
            id="fmap-stubble"
            width="7"
            height="7"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(38)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="7"
              stroke="var(--map-road)"
              strokeWidth="1"
              opacity="0.45"
            />
          </pattern>
          <radialGradient id="fmap-fire" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--ember)" stopOpacity="0.72" />
            <stop offset="70%" stopColor="var(--ember)" stopOpacity="0.42" />
            <stop offset="100%" stopColor="var(--ember)" stopOpacity="0.18" />
          </radialGradient>
          <filter id="fmap-soft" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <rect width={size.w} height={size.h} fill="var(--map-ground)" />

        {/* Talhões ------------------------------------------------------- */}
        {layers.talhoes &&
          PARCELS.map((parcel) => (
            <g
              key={parcel.id}
              className="fmap__parcel"
              onClick={() =>
                onPick?.({ kind: "talhao", id: parcel.id, name: parcel.name })
              }
            >
              <path
                d={path(parcel.ring)}
                fill={CROP_FILL[parcel.crop]}
                stroke="var(--map-road)"
                strokeWidth="0.75"
                strokeOpacity="0.7"
              />
              {parcel.crop === "colhido" && (
                <path d={path(parcel.ring)} fill="url(#fmap-stubble)" />
              )}
            </g>
          ))}

        {/* Água ---------------------------------------------------------- */}
        {layers.agua &&
          WATER.map((water) => {
            const { x, y } = toXY(water.at);
            if (water.kind === "rio") {
              const line = [
                destination(water.at, 10, 1400),
                water.at,
                destination(water.at, 190, 1600),
              ];
              return (
                <path
                  key={water.id}
                  d={path(line, false)}
                  fill="none"
                  stroke="var(--map-water)"
                  strokeWidth={Math.max(2, 26 * scale)}
                  strokeLinecap="round"
                />
              );
            }
            const r = Math.max(
              4,
              Math.sqrt(water.volumeM3) * 1.9 * scale + 3,
            );
            return (
              <g
                key={water.id}
                onClick={() =>
                  onPick?.({ kind: "agua", id: water.id, name: water.name })
                }
              >
                <ellipse
                  cx={x}
                  cy={y}
                  rx={r * 1.25}
                  ry={r * 0.8}
                  fill="var(--map-water)"
                  stroke="var(--azure)"
                  strokeWidth="0.8"
                  strokeOpacity="0.5"
                />
              </g>
            );
          })}

        {/* Estradas e aceiros -------------------------------------------- */}
        {layers.aceiros &&
          LINES.map((line) => {
            const isAceiro = line.kind === "aceiro";
            const width =
              line.kind === "rodovia"
                ? 4
                : isAceiro
                  ? Math.max(2.5, (line.widthM ?? 6) * scale)
                  : 2;
            return (
              <path
                key={line.id}
                d={path(line.path, false)}
                fill="none"
                stroke={isAceiro ? "var(--map-aceiro)" : "var(--map-road)"}
                strokeWidth={width}
                strokeLinecap="round"
                strokeDasharray={isAceiro ? undefined : undefined}
                opacity={isAceiro ? 0.95 : 0.8}
              />
            );
          })}

        {/* Raio de notificação ------------------------------------------- */}
        {incident && layers.alcance && originXY && (
          <g className="fmap__reach">
            {/* O círculo só aparece quando cabe: metade de um arco gigante lê
                como risco solto atravessando o mapa, não como alcance. */}
            {LEVEL_REACH[incident.level].radiusKm * 1000 * scale <
              Math.min(size.w, size.h) / 2 && (
              <circle
                cx={originXY.x}
                cy={originXY.y}
                r={LEVEL_REACH[incident.level].radiusKm * 1000 * scale}
                fill="none"
                stroke="var(--azure)"
                strokeWidth="1.2"
                strokeDasharray="5 6"
                opacity="0.65"
              />
            )}
            <path
              d={sectorPath(
                originXY,
                LEVEL_REACH[incident.level].downwindKm * 1000 * scale,
                headingDeg,
                45,
              )}
              fill="var(--azure)"
              fillOpacity="0.07"
              stroke="var(--azure)"
              strokeWidth="1"
              strokeDasharray="4 5"
              opacity="0.7"
            />
          </g>
        )}

        {/* Projeção futura ----------------------------------------------- */}
        {rings.map((ring, index) => (
          <path
            key={ring.minutes}
            d={path(ring.ring)}
            fill="none"
            stroke="var(--ember)"
            strokeWidth="1.4"
            strokeDasharray={index === 0 ? "6 4" : index === 1 ? "3 5" : "2 6"}
            opacity={0.62 - index * 0.16}
          />
        ))}

        {/* Frente de fogo ------------------------------------------------- */}
        {incident && fireView && fireView.semiMajorM > 0 && (
          <g className="fmap__fire">
            <path
              d={path(fireView.ring)}
              fill="url(#fmap-fire)"
              filter="url(#fmap-soft)"
              opacity="0.75"
            />
            <path
              d={path(fireView.ring)}
              fill="var(--ember)"
              fillOpacity="0.26"
              stroke="var(--ember)"
              strokeWidth="1.8"
            />
          </g>
        )}

        {/* Estruturas ----------------------------------------------------- */}
        {layers.estruturas &&
          STRUCTURES.filter((s) => inFrame(s.at)).map((structure) => {
            const { x, y } = toXY(structure.at);
            return (
              <g
                key={structure.id}
                className="fmap__poi"
                onClick={() =>
                  onPick?.({
                    kind: "estrutura",
                    id: structure.id,
                    name: structure.name,
                  })
                }
              >
                <rect
                  x={x - 7}
                  y={y - 7}
                  width="14"
                  height="14"
                  rx="4"
                  fill="var(--surface)"
                  stroke={
                    structure.critical ? "var(--amber)" : "var(--line-strong)"
                  }
                  strokeWidth="1.6"
                />
                <circle
                  cx={x}
                  cy={y}
                  r="2.4"
                  fill={structure.critical ? "var(--amber)" : "var(--muted)"}
                />
                {/* Acima do marcador: embaixo colidiria com o nome da
                    organização, que é onde a maioria dos rótulos já está. */}
                {structure.occupancy > 20 && (
                  <text
                    x={x}
                    y={y - 13}
                    className="fmap__label fmap__label--warn"
                    fontSize={labelSize}
                    textAnchor="middle"
                  >
                    {structure.occupancy} pessoas
                  </text>
                )}
              </g>
            );
          })}

        {/* Rede vizinha --------------------------------------------------- */}
        {layers.vizinhos &&
          ORGS.filter((o) => inFrame(o.at, 46)).map((org) => {
            const { x, y } = toXY(org.at);
            const color =
              org.kind === "brigada"
                ? "var(--amber)"
                : org.kind === "orgao"
                  ? "var(--azure)"
                  : "var(--brand)";
            return (
              <g
                key={org.id}
                className="fmap__poi"
                onClick={() =>
                  onPick?.({ kind: "org", id: org.id, name: org.name })
                }
              >
                <circle
                  cx={x}
                  cy={y}
                  r="9"
                  fill="var(--surface)"
                  stroke={color}
                  strokeWidth="2"
                />
                <text
                  x={x}
                  y={y + 3.4}
                  fontSize="8.5"
                  fontWeight="700"
                  textAnchor="middle"
                  fill={color}
                >
                  {org.initials}
                </text>
                <text
                  x={x}
                  y={y + 22}
                  className="fmap__label"
                  fontSize={labelSize}
                  textAnchor="middle"
                >
                  {org.short}
                </text>
              </g>
            );
          })}

        {/* Recursos a caminho --------------------------------------------- */}
        {incident?.dispatches.map((dispatch) => {
          const unit = unitById(dispatch.unitId);
          const position = unitPosition(incident, dispatch, realNow);
          const { x, y } = toXY(position.at);
          const base = toXY(unit.base);
          return (
            <g key={dispatch.unitId} className="fmap__unit">
              <line
                x1={base.x}
                y1={base.y}
                x2={x}
                y2={y}
                stroke="var(--amber)"
                strokeWidth="1.2"
                strokeDasharray="3 4"
                opacity="0.5"
              />
              <circle
                cx={x}
                cy={y}
                r="8"
                fill="var(--amber)"
                stroke="var(--surface)"
                strokeWidth="2"
              />
              <text
                x={x}
                y={y - 13}
                className="fmap__label"
                fontSize={labelSize}
                textAnchor="middle"
              >
                {position.arrived
                  ? "no local"
                  : `${Math.max(1, Math.round(dispatch.etaMin * (1 - position.progress)))} min`}
              </text>
            </g>
          );
        })}

        {/* Foco ----------------------------------------------------------- */}
        {incident && originXY && (
          <g className="fmap__origin">
            {masked ? (
              <circle
                cx={originXY.x}
                cy={originXY.y}
                r={Math.max(18, 500 * scale)}
                fill="var(--ember)"
                fillOpacity="0.16"
                stroke="var(--ember)"
                strokeWidth="1.4"
                strokeDasharray="4 4"
              />
            ) : (
              <>
                <circle
                  cx={originXY.x}
                  cy={originXY.y}
                  r="14"
                  fill="var(--ember)"
                  fillOpacity="0.18"
                  className="fmap__origin-halo"
                />
                <circle
                  cx={originXY.x}
                  cy={originXY.y}
                  r="5.5"
                  fill="var(--ember)"
                  stroke="#fff"
                  strokeWidth="2"
                />
              </>
            )}
            {/* Vetor do vento a partir do foco */}
            <g opacity="0.9">
              <line
                x1={originXY.x}
                y1={originXY.y}
                x2={toXY(destination(incident.origin, headingDeg, view.spanM * 0.13)).x}
                y2={toXY(destination(incident.origin, headingDeg, view.spanM * 0.13)).y}
                stroke="var(--ember)"
                strokeWidth="2"
                strokeDasharray="7 5"
              />
            </g>
          </g>
        )}
      </svg>

      {/* Sobreposições em HTML: mais legíveis e acessíveis que texto em SVG */}
      {overlays && (
        <div className="fmap__scale" aria-hidden>
          <span style={{ width: `${scaleBar.px}px` }} />
          {formatDistance(scaleBar.meters)}
        </div>
      )}

      {overlays && incident && (
        <div className="fmap__wind">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden>
            <circle
              cx="17"
              cy="17"
              r="14"
              fill="none"
              stroke="var(--line)"
              strokeWidth="1"
            />
            <text
              x="17"
              y="7.5"
              fontSize="7"
              fontWeight="700"
              textAnchor="middle"
              fill="var(--faint)"
            >
              N
            </text>
            {/* A seta aponta para onde o fogo caminha, não de onde o vento vem:
                é a leitura que interessa a quem precisa sair da frente. */}
            <g transform={`rotate(${headingDeg} 17 17)`}>
              <path d="M17 8 L20.6 24 L17 21 L13.4 24 Z" fill="var(--ember)" />
            </g>
          </svg>
          <div>
            <b className="num">{incident.weather.windKmh} km/h</b>
            <span>de {compass(incident.weather.windFromDeg)}</span>
          </div>
        </div>
      )}

      {overlays && interactive && (
        <div className="fmap__zoom">
          <button
            type="button"
            onClick={() => zoomBy(0.72)}
            aria-label="Aproximar"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomBy(1.38)}
            aria-label="Afastar"
          >
            −
          </button>
        </div>
      )}
    </div>
  );
}

/** Setor circular a partir de um ponto, usado no cone a favor do vento. */
function sectorPath(
  origin: { x: number; y: number },
  radius: number,
  headingDeg: number,
  halfAngleDeg: number,
): string {
  const a1 = toRad(headingDeg - halfAngleDeg - 90);
  const a2 = toRad(headingDeg + halfAngleDeg - 90);
  const p1 = {
    x: origin.x + radius * Math.cos(a1),
    y: origin.y + radius * Math.sin(a1),
  };
  const p2 = {
    x: origin.x + radius * Math.cos(a2),
    y: origin.y + radius * Math.sin(a2),
  };
  return `M${origin.x} ${origin.y} L${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`;
}

/** Legenda das camadas — usada na Central e na aba Mapa do app. */
export function MapLegend({ compact = false }: { compact?: boolean }) {
  const items: { color: string; label: string; icon?: React.ReactNode }[] = [
    { color: "var(--map-soja)", label: "Soja" },
    { color: "var(--map-milho)", label: "Milho" },
    { color: "var(--map-pasto)", label: "Pastagem seca" },
    { color: "var(--map-cerrado)", label: "Reserva legal" },
    { color: "var(--map-water)", label: "Água" },
    { color: "var(--map-aceiro)", label: "Aceiro" },
    { color: "var(--ember)", label: "Frente de fogo" },
  ];
  return (
    <ul className={`maplegend${compact ? " maplegend--compact" : ""}`}>
      {items.map((item) => (
        <li key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Ícone correspondente ao tipo de recurso, reutilizado em listas. */
export function UnitIcon({ kind, size = 18 }: { kind: string; size?: number }) {
  if (kind === "drone") return <Drone size={size} />;
  if (kind === "trator") return <Tractor size={size} />;
  if (kind === "equipe") return <Users size={size} />;
  if (kind === "pipa" || kind === "abt") return <Truck size={size} />;
  return <Drop size={size} />;
}
