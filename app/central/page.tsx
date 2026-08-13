"use client";

/**
 * Central de Operações — a versão de mesa.
 *
 * Não é o app do produtor esticado. É outro trabalho: aqui alguém acompanha
 * várias ocorrências ao mesmo tempo, decide para onde mandar o caminhão e
 * responde por isso depois. Por isso o layout é de três painéis fixos (fila,
 * mapa, decisão), o tema é escuro para turno longo, e todo número que aparece
 * está a um clique da justificativa.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ThemeScope } from "@/components/ThemeScope.tsx";
import { Wordmark } from "@/components/Brand.tsx";
import {
  DEFAULT_LAYERS,
  FieldMap,
  LAYER_LABEL,
  MapLegend,
  type LayerId,
} from "@/components/FieldMap.tsx";
import { Toast, type ToastState } from "@/components/ui.tsx";
import {
  Activity,
  Alert,
  Check,
  Flame,
  Layers,
  Radio,
  Shield,
  Wind,
} from "@/components/Icons.tsx";
import { compass, formatClock, formatHa } from "@/lib/geo.ts";
import { dailyRisk, windToDeg } from "@/lib/fire.ts";
import { LEVEL_LABEL, type Actor } from "@/lib/policy.ts";
import { simElapsed, type Incident } from "@/lib/domain.ts";
import {
  DEMO_ORIGIN,
  DEMO_WEATHER,
  RISK_SERIES,
  orgById,
  parcelById,
  personById,
} from "@/lib/scenario.ts";
import { useTicker, useVigiaBus } from "@/lib/bus.ts";
import { nextCode } from "@/lib/store.ts";
import { pendingCommands } from "@/lib/director.ts";
import { elapsedMin, front } from "@/lib/selectors.ts";
import { IncidentQueue } from "./IncidentQueue.tsx";
import { DetailPanel } from "./DetailPanel.tsx";
import "./central.css";

const SPEEDS = [1, 6, 20];

const OPERATORS = ["p-marina", "p-carlos"] as const;

export default function CentralPage() {
  const [operatorId, setOperatorId] = useState<string>(OPERATORS[0]);
  const operator = personById(operatorId);
  const operatorOrg = orgById(operator.orgId);

  const actor: Actor = useMemo(
    () => ({
      id: operator.id,
      name: operator.name,
      orgId: operator.orgId,
      role: operator.role,
      scope:
        operator.role === "autoridade"
          ? { kind: "regional" }
          : { kind: "raio", center: operatorOrg.at, radiusKm: 45 },
      verified: operator.verified,
      reputation: operator.reputation,
    }),
    [operator, operatorOrg],
  );

  const { state, dispatch, peers, selfId } = useVigiaBus(
    "central",
    `${operatorOrg.short} · ${operator.name}`,
  );
  const now = useTicker(1000);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({
    ...DEFAULT_LAYERS,
    alcance: true,
  });
  const [showLayers, setShowLayers] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const risk = useMemo(() => dailyRisk(RISK_SERIES), []);

  const open = useMemo(
    () =>
      state.incidents.filter(
        (i) => i.status !== "encerrado" && i.status !== "cancelado",
      ),
    [state.incidents],
  );

  const selected: Incident | undefined = useMemo(
    () =>
      state.incidents.find((i) => i.id === selectedId) ??
      open[0] ??
      state.incidents[0],
    [state.incidents, selectedId, open],
  );

  // Conduz a simulação apenas se esta aba abriu a ocorrência — ou se a aba que
  // abriu não está mais presente.
  const peerIds = useMemo(() => peers.map((p) => p.id), [peers]);
  useEffect(() => {
    if (!selected || !now) return;
    for (const command of pendingCommands(selected, now, selfId, peerIds))
      dispatch(command);
  }, [selected, now, selfId, peerIds, dispatch]);

  const fire = useMemo(
    () => (selected ? front(selected, now) : null),
    [selected, now],
  );

  const setSpeed = useCallback(
    (scale: number) => {
      if (!selected) return;
      dispatch({
        type: "escala",
        at: Date.now(),
        incidentId: selected.id,
        scale,
      });
    },
    [selected, dispatch],
  );

  /** Abre uma ocorrência de treinamento direto da Central. */
  const startDrill = useCallback(() => {
    const at = Date.now();
    const reporter = personById("p-joao");
    dispatch({
      type: "abrir",
      at,
      incidentId: `inc_${at.toString(36)}`,
      code: nextCode(state, new Date(at).getFullYear()),
      hostId: selfId,
      origin: DEMO_ORIGIN,
      accuracyM: 9,
      parcelId: "t-05",
      evidence: "chamas",
      note: "Perto do aceiro do açude",
      level: "confirmado",
      rationale:
        "Exercício iniciado pela Central com o cenário padrão de Uruçuí.",
      weather: DEMO_WEATHER,
      reporter: {
        actorId: reporter.id,
        name: reporter.name,
        orgId: reporter.orgId,
        role: reporter.role,
      },
      drill: true,
    });
    setToast({
      message: "Exercício iniciado",
      detail: "Mesmo fluxo de uma ocorrência real, marcado como simulação.",
    });
  }, [dispatch, state, selfId]);

  const campoOnline = peers.some((p) => p.role === "campo");
  const headingDeg = windToDeg(DEMO_WEATHER);

  return (
    <div className="ops">
      <ThemeScope theme="ops" color="#070c0d" />

      <header className="ops__bar">
        <Link href="/apresentacao" className="ops__brand">
          <Wordmark size={24} />
        </Link>

        <span className="ops__sep" aria-hidden />

        <div className="ops__context">
          <strong>Central de Operações</strong>
          <span>Uruçuí · PI · Cerrado / MATOPIBA</span>
        </div>

        <div className={`ops__risk is-${risk.klass}`}>
          <Flame size={15} />
          <div>
            <b className="num">FMA+ {risk.index.toFixed(0)}</b>
            <span>risco {risk.label.toLowerCase()}</span>
          </div>
        </div>

        <div className="ops__weather">
          <Wind size={15} />
          <div>
            <b className="num">
              {DEMO_WEATHER.windKmh} km/h {compass(DEMO_WEATHER.windFromDeg)}
            </b>
            <span>
              {DEMO_WEATHER.tempC}° · {DEMO_WEATHER.humidity}% UR · frente para{" "}
              {compass(headingDeg)}
            </span>
          </div>
        </div>

        <div className="ops__spacer" />

        <div className={`ops__link${campoOnline ? " is-live" : ""}`}>
          <span className="pulse-dot" />
          {campoOnline ? "App de campo conectado" : "Nenhum app de campo"}
          {!campoOnline && (
            <Link href="/campo" className="ops__linkcta">
              abrir
            </Link>
          )}
        </div>

        <button
          type="button"
          className="ops__operator"
          onClick={() =>
            setOperatorId((current) =>
              current === OPERATORS[0] ? OPERATORS[1] : OPERATORS[0],
            )
          }
          title="Alternar operador"
        >
          <span className={`orgavatar orgavatar--${operatorOrg.accent}`}>
            {operator.initials}
          </span>
          <span>
            <b>{operator.name}</b>
            <small>{operatorOrg.short}</small>
          </span>
        </button>
      </header>

      <div className="ops__body">
        <IncidentQueue
          incidents={state.incidents}
          selectedId={selected?.id}
          now={now}
          onSelect={setSelectedId}
          onStartDrill={startDrill}
        />

        <section className="ops__stage" aria-label="Mapa da operação">
          <FieldMap
            incident={selected}
            realNow={now}
            layers={layers}
            spanM={7000}
          />

          <div className="ops__mapbar">
            <button
              type="button"
              className="ops__iconbtn"
              onClick={() => setShowLayers((v) => !v)}
              aria-expanded={showLayers}
              aria-label="Camadas do mapa"
              title="Camadas"
            >
              <Layers size={17} />
            </button>
            {showLayers && (
              <div className="ops__layers">
                {(Object.keys(LAYER_LABEL) as LayerId[]).map((id) => (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={layers[id]}
                      onChange={(event) =>
                        setLayers((all) => ({
                          ...all,
                          [id]: event.target.checked,
                        }))
                      }
                    />
                    {LAYER_LABEL[id]}
                  </label>
                ))}
                <div className="ops__layers-legend">
                  <MapLegend compact />
                </div>
              </div>
            )}

            {selected && (
              <div className="ops__speed" role="group" aria-label="Velocidade do tempo simulado">
                <Activity size={14} />
                {SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    className={selected.clock.scale === speed ? "is-active" : undefined}
                    onClick={() => setSpeed(speed)}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && fire && (
            <div className="ops__hud">
              <div className="ops__hud-main">
                <span className={`ops__level is-${selected.level}`}>
                  <span className="pulse-dot" />
                  {LEVEL_LABEL[selected.level]}
                </span>
                <strong>{selected.code}</strong>
                <span className="ops__hud-where">
                  {parcelById(selected.parcelId)?.name ?? "ponto relatado"} ·{" "}
                  {orgById(selected.reporter.orgId).short}
                </span>
              </div>
              <ul className="ops__hud-stats">
                <li>
                  <b className="num">
                    {formatClock(simElapsed(selected.clock, now) / 1000)}
                  </b>
                  <span>decorrido</span>
                </li>
                <li>
                  <b className="num">{formatHa(fire.areaHa)}</b>
                  <span>área</span>
                </li>
                <li>
                  <b className="num">
                    {Math.round(fire.model.headRosMMin)} m/min
                  </b>
                  <span>cabeça</span>
                </li>
                <li>
                  <b className="num">
                    {Math.round(fire.perimeterM).toLocaleString("pt-BR")} m
                  </b>
                  <span>perímetro</span>
                </li>
                <li>
                  <b className="num">{Math.round(elapsedMin(selected, now))}</b>
                  <span>min simulados</span>
                </li>
              </ul>
            </div>
          )}
        </section>

        <DetailPanel
          incident={selected}
          actor={actor}
          now={now}
          dispatch={dispatch}
          onToast={setToast}
        />
      </div>

      <footer className="ops__foot">
        <span>
          <Shield size={13} /> RBAC + ABAC por território · trilha encadeada por
          hash
        </span>
        <span>
          <Radio size={13} /> INPE Queimadas · NASA FIRMS · CEMADEN ·
          Bombeiros/CBMPI
        </span>
        <span>
          <Check size={13} /> {state.incidents.length} ocorrências no período ·{" "}
          {peers.length + 1} dispositivos na sessão
        </span>
        <span className="ops__foot-drill">
          <Alert size={13} /> Ambiente de demonstração — nenhum alerta real é
          emitido
        </span>
      </footer>

      <Toast state={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
