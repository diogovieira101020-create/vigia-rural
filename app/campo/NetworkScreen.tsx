"use client";

import { useMemo } from "react";
import { UnitIcon } from "@/components/FieldMap.tsx";
import { OrgAvatar } from "@/components/ui.tsx";
import { Drop, Users } from "@/components/Icons.tsx";
import { distanceM, formatDistance } from "@/lib/geo.ts";
import { ROLE_LABEL } from "@/lib/policy.ts";
import { DEMO_ORIGIN, ORGS, UNITS, UNIT_LABEL, WATER, WATER_LABEL, orgById } from "@/lib/scenario.ts";
import type { Incident, Person } from "@/lib/domain.ts";

const KIND_LABEL: Record<string, string> = {
  propriedade: "Propriedade vizinha",
  brigada: "Brigada credenciada",
  orgao: "Órgão público",
};

export function NetworkScreen({
  incident,
  person,
}: {
  incident?: Incident;
  person: Person;
}) {
  const origin = incident?.origin ?? DEMO_ORIGIN;

  const entities = useMemo(
    () =>
      ORGS.filter((o) => o.id !== person.orgId)
        .map((org) => ({ org, dist: distanceM(origin, org.at) }))
        .sort((a, b) => a.dist - b.dist),
    [origin, person.orgId],
  );

  const water = useMemo(
    () =>
      [...WATER]
        .map((w) => ({ w, dist: distanceM(origin, w.at) }))
        .sort((a, b) => a.dist - b.dist),
    [origin],
  );

  return (
    <section className="screen">
      <header className="screen__head screen__head--tight">
        <span className="eyebrow">Cooperação verificada</span>
        <h2>Sua rede de resposta</h2>
      </header>

      <ul className="netsummary">
        <li>
          <b className="num">23</b>
          <span>pessoas</span>
        </li>
        <li>
          <b className="num">{ORGS.length}</b>
          <span>organizações</span>
        </li>
        <li>
          <b className="num">
            {(UNITS.reduce((sum, u) => sum + u.waterL, 0) / 1000).toFixed(0)} m³
          </b>
          <span>água móvel</span>
        </li>
      </ul>

      <div className="sectionlabel">
        <span>Quem responde perto de você</span>
      </div>
      <ul className="entitylist">
        {entities.map(({ org, dist }) => (
          <li key={org.id}>
            <OrgAvatar initials={org.initials} accent={org.accent} size={40} online />
            <div>
              <strong>{org.name}</strong>
              <small>
                {KIND_LABEL[org.kind]} · {org.detail}
              </small>
            </div>
            <span className="entitylist__meta num">{formatDistance(dist)}</span>
          </li>
        ))}
      </ul>

      <div className="sectionlabel">
        <span>Recursos disponíveis</span>
        <small>ordenados por tempo de chegada</small>
      </div>
      <ul className="unitlist">
        {UNITS.map((unit) => {
          const org = orgById(unit.orgId);
          const km = (distanceM(unit.base, origin) * 1.3) / 1000;
          const eta = (km / unit.speedKmh) * 60 + (unit.kind === "drone" ? 1 : 4);
          return (
            <li key={unit.id}>
              <span className="unitlist__icon">
                <UnitIcon kind={unit.kind} size={17} />
              </span>
              <div>
                <strong>{unit.name}</strong>
                <small>
                  {UNIT_LABEL[unit.kind]} · {org.short}
                  {unit.waterL > 0
                    ? ` · ${unit.waterL.toLocaleString("pt-BR")} L`
                    : ""}
                </small>
              </div>
              <span className="unitlist__eta num">{Math.round(eta)} min</span>
            </li>
          );
        })}
      </ul>

      <div className="sectionlabel">
        <span>Água mais próxima do foco</span>
        <small>quem chega precisa saber</small>
      </div>
      <ul className="waterlist">
        {water.map(({ w, dist }) => (
          <li key={w.id}>
            <span className="waterlist__icon">
              <Drop size={16} />
            </span>
            <div>
              <strong>{w.name}</strong>
              <small>
                {WATER_LABEL[w.kind]} · {w.volumeM3.toLocaleString("pt-BR")} m³ ·{" "}
                {w.truckAccess ? "acesso para pipa" : "sem acesso de caminhão"}
              </small>
            </div>
            <span className="num">{formatDistance(dist)}</span>
          </li>
        ))}
      </ul>

      <section className="governance">
        <span className="governance__badge">
          <Users size={17} />
        </span>
        <div>
          <strong>Duas chaves antes da sirene</strong>
          <p>
            Qualquer pessoa verificada registra uma suspeita. Só{" "}
            {ROLE_LABEL.produtor.toLowerCase()}, brigada credenciada e
            autoridade pública elevam o alerta — ou duas organizações
            independentes confirmando o mesmo foco em 10 minutos.
          </p>
        </div>
      </section>
    </section>
  );
}
