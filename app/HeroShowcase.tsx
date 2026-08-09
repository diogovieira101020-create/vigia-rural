"use client";

/**
 * Mapa da abertura.
 *
 * Roda um ciclo curto do cenário padrão — a frente de fogo cresce com o vento,
 * a projeção se abre, o ciclo reinicia. Serve como demonstração silenciosa:
 * quem chega na página entende em cinco segundos que o produto é sobre
 * geografia e tempo, não sobre um botão vermelho.
 */

import { useMemo } from "react";
import { FieldMap } from "@/components/FieldMap.tsx";
import { useTicker } from "@/lib/bus.ts";
import { newClock, type Incident } from "@/lib/domain.ts";
import { DEMO_ORIGIN, DEMO_WEATHER, MAP_VIEW } from "@/lib/scenario.ts";

const CYCLE_MS = 26_000;
const SCALE = 26;

/** Instante fixo: o mapa mostra tempo simulado, não a hora do relógio. */
const EPOCH = 1_700_000_000_000;

export function HeroShowcase() {
  const now = useTicker(1000);
  // `useTicker` devolve 0 até a montagem — antes disso não há ciclo a mostrar,
  // o que também evita divergência entre servidor e cliente na hidratação.
  const phase = now === 0 ? null : now % CYCLE_MS;

  const incident: Incident | undefined = useMemo(() => {
    if (phase === null) return undefined;
    return {
      id: "hero",
      code: "VR-2026-0001",
      level: "emergencia",
      status: "em_atendimento",
      origin: DEMO_ORIGIN,
      accuracyM: 9,
      parcelId: "t-05",
      evidence: "chamas",
      reporter: {
        actorId: "p-joao",
        name: "João Martins",
        orgId: "org-boa-esperanca",
        role: "produtor",
      },
      openedAt: EPOCH,
      updatedAt: EPOCH,
      weather: DEMO_WEATHER,
      corroborations: [],
      dispatches: [],
      audit: [],
      exactGrants: [],
      clock: { ...newClock(EPOCH, SCALE), anchorSim: phase * SCALE },
      drill: true,
    };
  }, [phase]);

  return (
    <div className="heromap" aria-hidden>
      <FieldMap
        incident={incident}
        realNow={EPOCH}
        center={MAP_VIEW.center}
        spanM={7600}
        interactive={false}
        autoFocus={false}
        compactLabels
      />
      <span className="heromap__fade" />
    </div>
  );
}
