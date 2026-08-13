"use client";

import { useState } from "react";
import {
  DEFAULT_LAYERS,
  FieldMap,
  LAYER_LABEL,
  MapLegend,
  type LayerId,
} from "@/components/FieldMap.tsx";
import type { ToastState } from "@/components/ui.tsx";
import { Copy, Crosshair, EyeOff, Layers, Lock } from "@/components/Icons.tsx";
import type { Actor } from "@/lib/policy.ts";
import type { Incident, LatLon } from "@/lib/domain.ts";
import { hasExactAccess } from "@/lib/selectors.ts";
import { coarsen, formatLatLon } from "@/lib/geo.ts";

export function MapScreen({
  incident,
  now,
  coords,
  accuracyM,
  locationState,
  onLocate,
  actor,
  onToast,
}: {
  incident?: Incident;
  now: number;
  coords: LatLon;
  accuracyM: number;
  locationState: string;
  onLocate: () => void;
  actor: Actor;
  onToast: (toast: ToastState) => void;
}) {
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({
    ...DEFAULT_LAYERS,
    alcance: Boolean(incident),
  });
  const [showLayers, setShowLayers] = useState(false);

  const exact = incident ? hasExactAccess(incident, actor.id, now) : true;
  const shown = incident ? incident.origin : coords;
  const cell = coarsen(shown, 1000);

  const copyCoords = async () => {
    // Copia exatamente o que está na tela — nunca a coordenada exata quando a
    // visibilidade está reduzida, senão o botão vira um jeito de furar a
    // própria proteção de privacidade que a tela ao lado explica.
    const text = exact
      ? `${shown.lat.toFixed(5)}, ${shown.lon.toFixed(5)}`
      : `${cell.lat.toFixed(3)}, ${cell.lon.toFixed(3)} (quadrante ~1 km)`;
    try {
      await navigator.clipboard.writeText(text);
      onToast({ message: "Coordenada copiada", detail: text });
    } catch {
      onToast({
        message: "Não foi possível copiar",
        tone: "warn",
        detail: text,
      });
    }
  };

  return (
    <section className="screen screen--map">
      <header className="screen__head screen__head--tight">
        <span className="eyebrow">Área monitorada</span>
        <h2>Mapa da operação</h2>
      </header>

      <div className="mapshell">
        <FieldMap
          incident={incident}
          realNow={now}
          layers={layers}
          masked={!exact}
          spanM={incident ? 6000 : 9000}
        />
        <button
          type="button"
          className="mapshell__layers"
          onClick={() => setShowLayers((open) => !open)}
          aria-expanded={showLayers}
          aria-label="Camadas do mapa"
        >
          <Layers size={17} />
        </button>
        {showLayers && (
          <div className="layerpanel">
            {(Object.keys(LAYER_LABEL) as LayerId[]).map((id) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={layers[id]}
                  onChange={(event) =>
                    setLayers((all) => ({ ...all, [id]: event.target.checked }))
                  }
                />
                <span>{LAYER_LABEL[id]}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <MapLegend compact />

      <div className="cardrow">
        <div className="coordcard">
          <div className="coordcard__head">
            <Crosshair size={17} />
            <div>
              <strong>
                {incident
                  ? "Coordenada da ocorrência"
                  : locationState === "gps"
                    ? "Posição do aparelho"
                    : "Ponto cadastrado do talhão"}
              </strong>
              <small className="num">
                {exact
                  ? formatLatLon(shown)
                  : `${formatLatLon(cell, true)} · quadrante de 1 km`}
              </small>
            </div>
            <div className="coordcard__actions">
              <button type="button" onClick={copyCoords} aria-label="Copiar coordenada">
                <Copy size={13} />
              </button>
              <button
                type="button"
                onClick={onLocate}
                disabled={locationState === "buscando"}
              >
                {locationState === "buscando" ? "…" : "GPS"}
              </button>
            </div>
          </div>
          <ul className="coordcard__grid">
            <li>
              <small>Precisão</small>
              <b className="num">± {accuracyM} m</b>
            </li>
            <li>
              <small>Origem</small>
              <b>{locationState === "gps" ? "GPS" : "Cadastro"}</b>
            </li>
            <li>
              <small>Visibilidade</small>
              <b>{exact ? "Exata" : "Reduzida"}</b>
            </li>
          </ul>
        </div>

        <div className="privacycard">
          <span className="privacycard__icon">
            {exact ? <Lock size={18} /> : <EyeOff size={18} />}
          </span>
          <div>
            <strong>
              {exact
                ? "Você vê a coordenada exata"
                : "A rede vê apenas o quadrante"}
            </strong>
            <p>
              Por padrão a localização circula arredondada para 1 km. A
              coordenada exata só é liberada a quem aceita a ocorrência, por
              tempo limitado, e cada liberação vira um registro assinado.
            </p>
          </div>
        </div>
      </div>

      <p className="mapnote">
        Cartografia própria a partir do cadastro da propriedade. Nenhuma
        coordenada é enviada a provedor de mapa de terceiros — o mapa funciona
        sem sinal.
      </p>
    </section>
  );
}
