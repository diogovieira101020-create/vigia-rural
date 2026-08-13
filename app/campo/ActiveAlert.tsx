"use client";

/**
 * Ocorrência em andamento, do ponto de vista de quem está no campo.
 *
 * A ordem da tela é a ordem das perguntas de quem está lá: o que já foi feito,
 * o que vem na minha direção, quem está vindo me ajudar, e eu estou seguro?
 * Estatística de vaidade não entra — cada número aqui muda uma decisão.
 *
 * Em telas largas o conteúdo vira um painel de duas colunas (mapa+ameaças à
 * esquerda, resposta+linha do tempo à direita) para quem acompanha de uma
 * mesa ver tudo sem rolar — a mesma razão pela qual a Central usa colunas.
 */

import { useMemo } from "react";
import { FieldMap } from "@/components/FieldMap.tsx";
import {
  Alert,
  Check,
  ChevronRight,
  Clock,
  Flame,
  Satellite,
  Shield,
  Truck,
  Users,
} from "@/components/Icons.tsx";
import type { ToastState } from "@/components/ui.tsx";
import { formatClock, formatDistance, formatHa } from "@/lib/geo.ts";
import { LEVEL_LABEL, type Actor } from "@/lib/policy.ts";
import { simElapsed, type Incident, type Person } from "@/lib/domain.ts";
import { elapsedMin, front, hasExactAccess, threats } from "@/lib/selectors.ts";
import { orgById, parcelById, unitById } from "@/lib/scenario.ts";
import type { Command } from "@/lib/store.ts";

const ACTION_ICON: Record<string, typeof Check> = {
  "alerta.aberto": Flame,
  "alerta.corroborado": Users,
  "alerta.escalado": Alert,
  "alerta.assumido": Shield,
  "alerta.recurso-despachado": Truck,
  "alerta.recurso-chegou": Check,
  "pessoa.em-seguranca": Check,
  "local.exato-liberado": Shield,
};

export function ActiveAlert({
  incident,
  now,
  person,
  actor,
  dispatch,
  onOpenMap,
  onClose,
  onToast,
}: {
  incident: Incident;
  now: number;
  person: Person;
  actor: Actor;
  dispatch: (command: Command) => void;
  onOpenMap: () => void;
  onClose: (outcome: "procedente" | "improcedente") => void;
  onToast: (toast: ToastState) => void;
}) {
  const fire = useMemo(() => front(incident, now), [incident, now]);
  const risk = useMemo(() => threats(incident, now).slice(0, 3), [incident, now]);
  const elapsed = simElapsed(incident.clock, now) / 1000;
  const minutes = elapsedMin(incident, now);

  const safe = incident.audit.some(
    (e) => e.action === "pessoa.em-seguranca" && e.actorId === person.id,
  );
  const enRoute = incident.dispatches.filter((d) => d.status === "a_caminho");
  const onSite = incident.dispatches.filter((d) => d.status === "no_local");
  const exact = hasExactAccess(incident, actor.id, now);

  const timeline = [...incident.audit].reverse().slice(0, 8);

  return (
    <section className="screen screen--alert">
      <div className="alerthead">
        <span className={`alerthead__level is-${incident.level}`}>
          <span className="pulse-dot" />
          {LEVEL_LABEL[incident.level]}
        </span>
        <time className="num" aria-label="Tempo decorrido">
          {formatClock(elapsed)}
        </time>
      </div>

      <h2 className="alerthead__title">
        Foco no
        <br />
        {parcelById(incident.parcelId)?.name ?? "ponto relatado"}
      </h2>
      <p className="alerthead__sub">
        {incident.code} · {incident.drill ? "simulação" : "ocorrência real"} ·
        tempo × {incident.clock.scale}
      </p>

      <div className="alertdash">
        <div className="alertdash__col">
          <button type="button" className="alertmap" onClick={onOpenMap}>
            <FieldMap
              incident={incident}
              realNow={now}
              interactive={false}
              overlays={false}
              compactLabels
              masked={!exact}
              spanM={3200}
            />
            <span className="alertmap__cta">
              Abrir mapa completo <ChevronRight size={14} />
            </span>
          </button>

          <ul className="alertmetrics">
            <li>
              <b className="num">{formatHa(fire.areaHa)}</b>
              <span>área atingida</span>
            </li>
            <li>
              <b className="num">{Math.round(fire.model.headRosMMin)} m/min</b>
              <span>frente do fogo</span>
            </li>
            <li>
              <b className="num">{enRoute.length + onSite.length}</b>
              <span>equipes acionadas</span>
            </li>
          </ul>

          {/* O que o fogo alcança se ninguém agir */}
          {risk.length > 0 && (
            <section className="threats" aria-labelledby="threats-title">
              <div className="sectionlabel">
                <span id="threats-title">No caminho da frente</span>
                <small>projeção sem combate</small>
              </div>
              <ul>
                {risk.map((item) => (
                  <li
                    key={item.id}
                    className={item.critical ? "is-critical" : undefined}
                  >
                    <span className="threats__eta num">
                      {item.etaMin === null || item.etaMin > 180
                        ? "—"
                        : `${Math.max(1, Math.round(item.etaMin))}′`}
                    </span>
                    <span className="threats__body">
                      <strong>{item.name}</strong>
                      <small>
                        {formatDistance(item.distanceM)}
                        {item.people > 0 ? ` · ${item.people} pessoas` : ""}
                        {item.critical ? " · prioridade" : ""}
                      </small>
                    </span>
                    {item.critical && <Alert size={16} />}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="alertdash__col">
          {/* Quem está vindo */}
          <section className="responders">
            <div className="sectionlabel">
              <span>Resposta a caminho</span>
              <small className="num">
                {Math.round(minutes)} min de ocorrência
              </small>
            </div>
            {incident.dispatches.length === 0 ? (
              <p className="responders__empty">
                <Clock size={15} />
                Aguardando a brigada assumir. A rede já foi avisada.
              </p>
            ) : (
              <ul>
                {incident.dispatches.map((item) => {
                  const unit = unitById(item.unitId);
                  const org = orgById(unit.orgId);
                  const done = item.status === "no_local";
                  return (
                    <li key={item.unitId}>
                      <span
                        className={`responders__icon${done ? " is-done" : ""}`}
                      >
                        {done ? <Check size={15} /> : <Truck size={15} />}
                      </span>
                      <span className="responders__body">
                        <strong>{unit.name}</strong>
                        <small>
                          {org.short} · {unit.crew} pessoas ·{" "}
                          {unit.waterL.toLocaleString("pt-BR")} L
                        </small>
                      </span>
                      <span
                        className={`responders__eta num${done ? " is-done" : ""}`}
                      >
                        {done ? "no local" : `${Math.round(item.etaMin)} min`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Linha do tempo — é o próprio log auditável */}
          <section className="timeline">
            <div className="sectionlabel">
              <span>Registro da ocorrência</span>
              <small>{incident.audit.length} eventos</small>
            </div>
            <ol>
              {timeline.map((event) => {
                const Icon = ACTION_ICON[event.action] ?? Satellite;
                return (
                  <li key={event.seq}>
                    <span className="timeline__mark">
                      <Icon size={13} />
                    </span>
                    <div>
                      <strong>{event.summary}</strong>
                      <small className="num">
                        {new Date(event.ts).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}{" "}
                        · {event.actorName}
                      </small>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="alertactions">
            <button
              type="button"
              className={`btn btn--block ${safe ? "btn--soft" : "btn--primary"}`}
              disabled={safe}
              onClick={() => {
                dispatch({
                  type: "seguranca",
                  at: Date.now(),
                  incidentId: incident.id,
                  actorId: person.id,
                  actorName: person.name,
                  orgName: orgById(person.orgId).short,
                });
                onToast({
                  message: "Sua segurança foi comunicada à rede",
                  detail:
                    "A Central deixa de contar você entre as pessoas em risco.",
                });
              }}
            >
              {safe ? <Check size={17} /> : <Shield size={17} />}
              {safe ? "Segurança confirmada" : "Estou em local seguro"}
            </button>
            <div className="alertactions__row">
              <button
                type="button"
                className="btn btn--warn"
                onClick={() => onClose("improcedente")}
              >
                Foi alarme falso
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onClose("procedente")}
              >
                Encerrar ocorrência
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
