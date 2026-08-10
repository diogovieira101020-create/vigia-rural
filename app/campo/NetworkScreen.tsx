"use client";

import { useMemo, useState } from "react";
import { UnitIcon } from "@/components/FieldMap.tsx";
import { OrgAvatar } from "@/components/ui.tsx";
import { Drop, Message, Phone, Search, Users } from "@/components/Icons.tsx";
import { distanceM, formatDistance } from "@/lib/geo.ts";
import { ROLE_LABEL } from "@/lib/policy.ts";
import { DEMO_ORIGIN, ORGS, UNITS, UNIT_LABEL, WATER, WATER_LABEL, orgById } from "@/lib/scenario.ts";
import type { Incident, Person } from "@/lib/domain.ts";

const KIND_LABEL: Record<string, string> = {
  propriedade: "Propriedade vizinha",
  brigada: "Brigada credenciada",
  orgao: "Órgão público",
};

// Intervalo de marcas diacríticas combinantes (U+0300–U+036F), usado para
// tirar acento depois de normalizar em NFD — assim a busca acha "Uruçuí"
// digitando "urucui".
const DIACRITICS = /[̀-ͯ]/g;
const normalize = (value: string) =>
  value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

/** Telefone só com dígitos, formato aceito por `tel:`/`sms:`. */
const dial = (phone: string) => phone.replace(/[^\d+]/g, "");

export function NetworkScreen({
  incident,
  person,
}: {
  incident?: Incident;
  person: Person;
}) {
  const origin = incident?.origin ?? DEMO_ORIGIN;
  const [query, setQuery] = useState("");

  const entities = useMemo(
    () =>
      ORGS.filter((o) => o.id !== person.orgId)
        .map((org) => ({ org, dist: distanceM(origin, org.at) }))
        .sort((a, b) => a.dist - b.dist),
    [origin, person.orgId],
  );

  const filteredEntities = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return entities;
    return entities.filter(
      ({ org }) =>
        normalize(org.name).includes(q) ||
        normalize(KIND_LABEL[org.kind]).includes(q),
    );
  }, [entities, query]);

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

      <div className="cardrow">
        <div className="cardblock">
          <div className="sectionlabel">
            <span>Quem responde perto de você</span>
          </div>
          <label className="searchfield">
            <Search size={15} />
            <input
              type="search"
              inputMode="search"
              placeholder="Buscar por nome ou tipo…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Buscar organização na rede"
            />
          </label>
          {filteredEntities.length === 0 ? (
            <p className="netempty">
              Nenhuma organização encontrada para “{query}”.
            </p>
          ) : (
            <ul className="entitylist">
              {filteredEntities.map(({ org, dist }) => (
                <li key={org.id}>
                  <OrgAvatar
                    initials={org.initials}
                    accent={org.accent}
                    size={40}
                    online
                  />
                  <div>
                    <strong>{org.name}</strong>
                    <small>
                      {KIND_LABEL[org.kind]} · {org.detail}
                    </small>
                  </div>
                  <span className="entitylist__meta">
                    <span className="entitylist__dist num">
                      {formatDistance(dist)}
                    </span>
                    <a
                      className="entitylist__contact"
                      href={`tel:${dial(org.phone)}`}
                      aria-label={`Ligar para ${org.name}`}
                      title={`Ligar · ${org.phone}`}
                    >
                      <Phone size={13} />
                    </a>
                    <a
                      className="entitylist__contact"
                      href={`sms:${dial(org.phone)}`}
                      aria-label={`Enviar SMS para ${org.name}`}
                      title={`SMS · ${org.phone}`}
                    >
                      <Message size={13} />
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="cardblock">
          <div className="sectionlabel">
            <span>Recursos disponíveis</span>
            <small>por tempo de chegada</small>
          </div>
          <ul className="unitlist">
            {UNITS.map((unit) => {
              const org = orgById(unit.orgId);
              const km = (distanceM(unit.base, origin) * 1.3) / 1000;
              const eta =
                (km / unit.speedKmh) * 60 + (unit.kind === "drone" ? 1 : 4);
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
                  <span className="unitlist__eta num">
                    {Math.round(eta)} min
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

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
