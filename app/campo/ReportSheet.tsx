"use client";

/**
 * Folha de confirmação.
 *
 * O ponto crítico do produto inteiro está aqui. Um alerta que sai fácil demais
 * mata a confiança da rede; um alerta que custa demais chega tarde. A saída é
 * mostrar a consequência antes: quantas pessoas serão acordadas, em que nível,
 * por quais canais — e então pedir um gesto deliberado, não uma leitura.
 */

import { useMemo } from "react";
import { HoldButton } from "@/components/ui.tsx";
import {
  Bell,
  Crosshair,
  Flame,
  Message,
  Phone,
  Radio,
  Smoke,
  Users,
  Wind,
} from "@/components/Icons.tsx";
import { compass, formatDistance } from "@/lib/geo.ts";
import { windToDeg, type DailyRisk } from "@/lib/fire.ts";
import {
  can,
  evaluateEscalation,
  LEVEL_LABEL,
  LEVEL_REACH,
  type Actor,
  type AlertLevel,
} from "@/lib/policy.ts";
import { DEMO_WEATHER, CROP_LABEL } from "@/lib/scenario.ts";
import { newClock, type Evidence, type Incident, type LatLon, type Org, type Person } from "@/lib/domain.ts";
import { notifyPlan, parcelAt, peopleReached } from "@/lib/selectors.ts";

export type ReportDraft = {
  intent: "fogo" | "suspeita";
  evidence: Evidence;
  note: string;
};

const EVIDENCE_OPTIONS: {
  id: Evidence;
  label: string;
  hint: string;
  icon: typeof Flame;
}[] = [
  { id: "chamas", label: "Chamas", hint: "fogo visível agora", icon: Flame },
  { id: "fumaca", label: "Fumaça", hint: "coluna à distância", icon: Smoke },
  { id: "cheiro", label: "Cheiro", hint: "sem ver o foco", icon: Wind },
];

const CHANNEL_ICON: Record<string, typeof Bell> = {
  app: Bell,
  sms: Message,
  voz: Phone,
  órgãos: Radio,
};

export function ReportSheet({
  draft,
  actor,
  person,
  org,
  coords,
  accuracyM,
  locationState,
  risk,
  now,
  onLocate,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: ReportDraft | null;
  actor: Actor;
  person: Person;
  org: Org;
  coords: LatLon;
  accuracyM: number;
  locationState: string;
  risk: DailyRisk;
  /** Instante do relógio compartilhado da página. */
  now: number;
  onLocate: () => void;
  onChange: (draft: ReportDraft) => void;
  onCancel: () => void;
  onSubmit: (draft: ReportDraft) => void;
}) {
  const preview = useMemo(() => {
    if (!draft) return null;
    const decision = can(
      actor,
      draft.intent === "fogo" ? "alerta:confirmar" : "alerta:suspeita",
      { at: coords, propertyId: org.id },
    );
    const escalation = evaluateEscalation({
      actor,
      origin: coords,
      propertyId: org.id,
      corroborations: [],
      now,
      riskIndex: risk.index,
    });
    const level: AlertLevel =
      draft.intent === "fogo"
        ? decision.allowed
          ? escalation.level
          : "suspeita"
        : "suspeita";

    const provisional: Incident = {
      id: "preview",
      code: "—",
      level,
      status: "aberto",
      origin: coords,
      accuracyM,
      evidence: draft.evidence,
      reporter: {
        actorId: person.id,
        name: person.name,
        orgId: org.id,
        role: person.role,
      },
      openedAt: now,
      updatedAt: now,
      weather: DEMO_WEATHER,
      corroborations: [],
      dispatches: [],
      audit: [],
      exactGrants: [],
      clock: newClock(now),
      drill: true,
    };

    return {
      level,
      decision,
      escalation,
      plan: notifyPlan(provisional),
      people: peopleReached(provisional),
      reach: LEVEL_REACH[level],
      parcel: parcelAt(coords),
    };
  }, [draft, actor, coords, accuracyM, org.id, person, risk.index, now]);

  if (!draft || !preview) return null;

  const isFire = draft.intent === "fogo";
  const headingDeg = windToDeg(DEMO_WEATHER);

  return (
    <div
      className="sheet-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className={`sheet ${isFire ? "sheet--danger" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={isFire ? "Confirmar alerta de fogo" : "Registrar suspeita"}
      >
        <span className="sheet__grip" aria-hidden />
        <header className="sheet__head">
          <span className="eyebrow">
            {isFire ? "Confirmação de emergência" : "Registro de suspeita"}
          </span>
          <h2>{isFire ? "O que você está vendo?" : "Relatar sem alarmar"}</h2>
        </header>

        <div className="sheet__body scroll-slim">
          <div className="evidence" role="group" aria-label="Evidência observada">
            {EVIDENCE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const selected = draft.evidence === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={selected ? "is-selected" : undefined}
                  onClick={() => onChange({ ...draft, evidence: option.id })}
                  aria-pressed={selected}
                >
                  <Icon size={22} />
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </button>
              );
            })}
          </div>

          <label className="notefield">
            <span>Referência para quem vai chegar (opcional)</span>
            <input
              type="text"
              value={draft.note}
              maxLength={90}
              placeholder="Ex.: perto do aceiro do açude, portão azul"
              onChange={(event) =>
                onChange({ ...draft, note: event.target.value })
              }
            />
          </label>

          <div className="previewcard">
            <div className="previewcard__row">
              <Crosshair size={17} />
              <div>
                <strong>
                  {preview.parcel
                    ? `${preview.parcel.name} · ${CROP_LABEL[preview.parcel.crop]}`
                    : "Fora dos talhões cadastrados"}
                </strong>
                <small className="num">
                  {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)} · ±
                  {accuracyM} m ·{" "}
                  {locationState === "gps" ? "GPS do aparelho" : "ponto cadastrado"}
                </small>
              </div>
              <button type="button" className="previewcard__mini" onClick={onLocate}>
                atualizar
              </button>
            </div>

            <div className="previewcard__row">
              <Wind size={17} />
              <div>
                <strong>
                  Vento {DEMO_WEATHER.windKmh} km/h de{" "}
                  {compass(DEMO_WEATHER.windFromDeg)}
                </strong>
                <small>
                  O fogo caminha para {compass(headingDeg)} — quem está nessa
                  direção é avisado primeiro.
                </small>
              </div>
            </div>
          </div>

          <div className={`impact impact--${preview.level}`}>
            <div className="impact__head">
              <span className="impact__level">
                Nível {LEVEL_LABEL[preview.level]}
              </span>
              <span className="impact__count">
                <Users size={15} />
                <b className="num">≈ {preview.people}</b> pessoas
              </span>
            </div>
            <p className="impact__why">
              {preview.decision.allowed
                ? preview.escalation.rationale
                : `${preview.decision.reason}. ${preview.decision.hint ?? ""}`}
            </p>
            <ul className="impact__targets">
              {preview.plan.slice(0, 4).map((item) => (
                <li key={item.target.id}>
                  <span
                    className={`impact__dot${item.downwind ? " is-downwind" : ""}`}
                    aria-hidden
                  />
                  <strong>{item.target.name}</strong>
                  <em>{formatDistance(item.distanceM)}</em>
                  {item.downwind && <small>a favor do vento</small>}
                </li>
              ))}
              {preview.plan.length > 4 && (
                <li className="impact__more">
                  +{preview.plan.length - 4} organizações no raio de{" "}
                  {preview.reach.radiusKm} km
                </li>
              )}
            </ul>
            <div className="impact__channels">
              {preview.reach.channels.map((channel) => {
                const Icon = CHANNEL_ICON[channel] ?? Bell;
                return (
                  <span key={channel} className="chip">
                    <Icon size={13} />
                    {channel}
                  </span>
                );
              })}
            </div>
          </div>

          <p className="sheet__legal">
            Ao enviar, {person.name} declara ter observado a ocorrência. O envio
            fica registrado com identidade, hora e local em trilha auditável —
            e alarme falso reduz o limite de acionamento do autor.
          </p>
        </div>

        <div className="sheet__actions">
          <HoldButton
            tone={isFire ? "danger" : "primary"}
            holdMs={isFire ? 1200 : 700}
            onComplete={() => onSubmit(draft)}
          >
            {isFire ? <Flame size={19} /> : <Smoke size={19} />}
            {isFire ? "Segure para enviar o alerta" : "Segure para registrar"}
          </HoldButton>
          <button type="button" className="btn btn--ghost btn--block" onClick={onCancel}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
