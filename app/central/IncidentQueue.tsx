"use client";

/**
 * Fila de ocorrências.
 *
 * Ordenada por gravidade e depois por tempo aberto — não por ordem de
 * chegada. Quem opera precisa ver primeiro o que está pior, mesmo que tenha
 * entrado depois.
 */

import { useMemo, useState } from "react";
import { Flame, Play, Satellite, Users } from "@/components/Icons.tsx";
import { formatClock, formatHa } from "@/lib/geo.ts";
import { LEVEL_LABEL, type AlertLevel } from "@/lib/policy.ts";
import { simElapsed, STATUS_LABEL, type Incident } from "@/lib/domain.ts";
import { front } from "@/lib/selectors.ts";
import { orgById, parcelById } from "@/lib/scenario.ts";

const ORDER: Record<AlertLevel, number> = {
  emergencia: 0,
  confirmado: 1,
  suspeita: 2,
};

type Filter = "abertas" | "todas";

export function IncidentQueue({
  incidents,
  selectedId,
  now,
  onSelect,
  onStartDrill,
}: {
  incidents: Incident[];
  selectedId?: string;
  now: number;
  onSelect: (id: string) => void;
  onStartDrill: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("abertas");

  const list = useMemo(() => {
    const filtered =
      filter === "abertas"
        ? incidents.filter(
            (i) => i.status !== "encerrado" && i.status !== "cancelado",
          )
        : incidents;
    return [...filtered].sort(
      (a, b) => ORDER[a.level] - ORDER[b.level] || a.openedAt - b.openedAt,
    );
  }, [incidents, filter]);

  return (
    <aside className="queue" aria-label="Fila de ocorrências">
      <header className="queue__head">
        <h2>Ocorrências</h2>
        <div className="queue__filters" role="tablist">
          {(["abertas", "todas"] as Filter[]).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={filter === option}
              className={filter === option ? "is-active" : undefined}
              onClick={() => setFilter(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </header>

      {list.length === 0 ? (
        <div className="queue__empty">
          <Satellite size={24} />
          <strong>Nenhuma ocorrência</strong>
          <p>
            A região está monitorada e em silêncio. Abra o app de campo em outra
            janela e acione o alerta, ou inicie um exercício aqui.
          </p>
          <button type="button" className="btn btn--primary" onClick={onStartDrill}>
            <Play size={15} /> Iniciar exercício
          </button>
        </div>
      ) : (
        <ol className="queue__list scroll-slim">
          {list.map((incident) => {
            const fire = front(incident, now);
            const parcel = parcelById(incident.parcelId);
            const sources = new Set(
              incident.corroborations.map((c) =>
                c.source === "humano" ? c.orgId : c.source,
              ),
            ).size;
            const closed =
              incident.status === "encerrado" || incident.status === "cancelado";
            return (
              <li key={incident.id}>
                <button
                  type="button"
                  className={`qcard is-${incident.level}${
                    incident.id === selectedId ? " is-selected" : ""
                  }${closed ? " is-closed" : ""}`}
                  onClick={() => onSelect(incident.id)}
                >
                  <div className="qcard__top">
                    <span className="qcard__level">
                      {!closed && <span className="pulse-dot" />}
                      {LEVEL_LABEL[incident.level]}
                    </span>
                    <time className="num">
                      {formatClock(simElapsed(incident.clock, now) / 1000)}
                    </time>
                  </div>
                  <strong className="qcard__title">
                    {parcel?.name ?? "Ponto relatado"}
                  </strong>
                  <span className="qcard__where">
                    {incident.code} · {orgById(incident.reporter.orgId).short}
                  </span>
                  <div className="qcard__meta">
                    <span>
                      <Flame size={12} /> {formatHa(fire.areaHa)}
                    </span>
                    <span>
                      <Users size={12} /> {sources}{" "}
                      {sources === 1 ? "fonte" : "fontes"}
                    </span>
                    <span className="qcard__status">
                      {STATUS_LABEL[incident.status]}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {list.length > 0 && (
        <button type="button" className="queue__drill" onClick={onStartDrill}>
          <Play size={13} /> Novo exercício
        </button>
      )}
    </aside>
  );
}
