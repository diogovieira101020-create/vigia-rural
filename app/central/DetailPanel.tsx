"use client";

/**
 * Painel de decisão.
 *
 * Quatro perguntas, quatro abas: com o que eu respondo, o que está em risco,
 * quem já foi avisado e o que ficou registrado. Toda ação de comando passa
 * pela mesma função de autorização usada no app de campo — quando ela nega, o
 * motivo aparece na tela em vez de um botão cinza sem explicação.
 */

import { useCallback, useMemo, useState } from "react";
import { UnitIcon } from "@/components/FieldMap.tsx";
import type { ToastState } from "@/components/ui.tsx";
import {
  Alert,
  Check,
  Drop,
  FileText,
  Lock,
  Satellite,
  Shield,
  Users,
  X,
} from "@/components/Icons.tsx";
import {
  sealChain,
  shortHash,
  verifyChain,
  type ChainVerdict,
  type SealedRecord,
} from "@/lib/audit.ts";
import { formatDistance, formatHa } from "@/lib/geo.ts";
import {
  can,
  LEVEL_LABEL,
  LEVEL_REACH,
  type Actor,
} from "@/lib/policy.ts";
import { STATUS_LABEL, type Incident } from "@/lib/domain.ts";
import {
  activeGrants,
  front,
  notifyPlan,
  threats,
  unitOptions,
} from "@/lib/selectors.ts";
import { orgById, parcelById, WATER_LABEL, WATER } from "@/lib/scenario.ts";
import type { Command } from "@/lib/store.ts";

type TabId = "resposta" | "ameacas" | "rede" | "auditoria";

const TABS: { id: TabId; label: string }[] = [
  { id: "resposta", label: "Resposta" },
  { id: "ameacas", label: "Ameaças" },
  { id: "rede", label: "Rede" },
  { id: "auditoria", label: "Registro" },
];

export function DetailPanel({
  incident,
  actor,
  now,
  dispatch,
  onToast,
}: {
  incident?: Incident;
  actor: Actor;
  now: number;
  dispatch: (command: Command) => void;
  onToast: (toast: ToastState) => void;
}) {
  const [tab, setTab] = useState<TabId>("resposta");
  const [chain, setChain] = useState<SealedRecord[] | null>(null);
  const [verdict, setVerdict] = useState<ChainVerdict | null>(null);

  const options = useMemo(
    () => (incident ? unitOptions(incident) : []),
    [incident],
  );
  const risks = useMemo(
    () => (incident ? threats(incident, now).slice(0, 8) : []),
    [incident, now],
  );
  const plan = useMemo(
    () => (incident ? notifyPlan(incident) : []),
    [incident],
  );

  const runVerify = useCallback(
    async (tamper: boolean) => {
      if (!incident) return;
      const sealed = await sealChain(incident.audit);
      const inspected = tamper
        ? sealed.map((record, index) =>
            index === Math.min(2, sealed.length - 1)
              ? { ...record, summary: "Registro reescrito (teste de integridade)" }
              : record,
          )
        : sealed;
      const result = await verifyChain(inspected);
      setChain(inspected);
      setVerdict(result);
      onToast(
        result.valid
          ? {
              message: "Cadeia íntegra",
              detail: `${result.checked} registros conferidos.`,
            }
          : {
              message: "Adulteração detectada",
              tone: "error",
              detail: `${result.reason} Registro nº ${result.brokenAtSeq}.`,
            },
      );
    },
    [incident, onToast],
  );

  const act = useCallback(
    (command: Command, permission: Parameters<typeof can>[1], label: string) => {
      if (!incident) return;
      const decision = can(actor, permission, {
        at: incident.origin,
        propertyId: incident.reporter.orgId,
      });
      if (!decision.allowed) {
        dispatch({
          type: "negado",
          at: Date.now(),
          incidentId: incident.id,
          actorId: actor.id,
          actorName: actor.name,
          action: label,
          reason: decision.reason,
        });
        onToast({
          message: `${label} bloqueado`,
          tone: "error",
          detail: `${decision.reason}. ${decision.hint ?? ""}`,
        });
        return;
      }
      dispatch(command);
    },
    [incident, actor, dispatch, onToast],
  );

  if (!incident)
    return (
      <aside className="detail detail--empty" aria-label="Detalhe da ocorrência">
        <Shield size={26} />
        <strong>Sem ocorrência selecionada</strong>
        <p>
          A Central fica em vigília. Quando um alerta entra, este painel passa a
          concentrar recurso, risco, alcance e registro da ocorrência.
        </p>
        <ul className="detail__idle">
          <li>
            <Satellite size={15} /> Focos de calor do INPE conferidos a cada 10
            min
          </li>
          <li>
            <Users size={15} /> 23 pessoas verificadas na rede local
          </li>
          <li>
            <Drop size={15} />{" "}
            {(WATER.reduce((sum, w) => sum + w.volumeM3, 0) / 1000).toFixed(0)}{" "}
            mil m³ de água mapeada
          </li>
        </ul>
      </aside>
    );

  const commandOrg = incident.commandOrgId ? orgById(incident.commandOrgId) : null;
  const fire = front(incident, now);
  const grants = activeGrants(incident, now);
  const reach = LEVEL_REACH[incident.level];

  return (
    <aside className="detail" aria-label="Detalhe da ocorrência">
      <header className="detail__head">
        <div className="detail__id">
          <span className={`ops__level is-${incident.level}`}>
            {LEVEL_LABEL[incident.level]}
          </span>
          <strong>{incident.code}</strong>
        </div>
        <h2>{parcelById(incident.parcelId)?.name ?? "Ponto relatado"}</h2>
        <p className="detail__sub">
          {incident.reporter.name} · {orgById(incident.reporter.orgId).short} ·{" "}
          {STATUS_LABEL[incident.status]}
          {incident.note ? ` · “${incident.note}”` : ""}
        </p>

        <div className="detail__commands">
          {!commandOrg && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() =>
                act(
                  {
                    type: "assumir",
                    at: Date.now(),
                    incidentId: incident.id,
                    orgId: actor.orgId,
                    orgName: orgById(actor.orgId).name,
                    actorId: actor.id,
                    actorName: actor.name,
                  },
                  "alerta:assumir",
                  "Assumir comando",
                )
              }
            >
              <Shield size={15} /> Assumir comando
            </button>
          )}
          {incident.level !== "emergencia" && (
            <button
              type="button"
              className="btn btn--danger"
              onClick={() =>
                act(
                  {
                    type: "escalar",
                    at: Date.now(),
                    incidentId: incident.id,
                    level: "emergencia",
                    rationale: `Escalonamento manual por ${actor.name} (${orgById(actor.orgId).short}).`,
                    actorId: actor.id,
                    actorName: actor.name,
                  },
                  "alerta:emergencia",
                  "Escalar para emergência",
                )
              }
            >
              <Alert size={15} /> Escalar
            </button>
          )}
          {incident.status !== "controlado" && (
            <button
              type="button"
              className="btn btn--soft"
              onClick={() =>
                act(
                  {
                    type: "status",
                    at: Date.now(),
                    incidentId: incident.id,
                    status: "controlado",
                    actorId: actor.id,
                    actorName: actor.name,
                    reason: "Frente contida pelas equipes em campo.",
                  },
                  "alerta:controlar",
                  "Marcar como controlado",
                )
              }
            >
              <Check size={15} /> Controlado
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() =>
              act(
                {
                  type: "status",
                  at: Date.now(),
                  incidentId: incident.id,
                  status: "encerrado",
                  actorId: actor.id,
                  actorName: actor.name,
                  outcome: "procedente",
                  reason: "Ocorrência encerrada; laudo gerado a partir da trilha.",
                },
                "alerta:encerrar",
                "Encerrar ocorrência",
              )
            }
          >
            Encerrar
          </button>
        </div>

        {commandOrg && (
          <p className="detail__command-note">
            <Shield size={13} /> Comando com {commandOrg.name}
          </p>
        )}
      </header>

      <nav className="detail__tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "is-active" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="detail__body scroll-slim">
        {tab === "resposta" && (
          <>
            <p className="detail__hint">
              Ordenado por tempo de chegada real, considerando estrada de terra
              (+30 % sobre a linha reta) e o preparo do veículo.
            </p>
            <ul className="unitopts">
              {options.map((option) => {
                const org = orgById(option.unit.orgId);
                const sent = option.dispatched;
                return (
                  <li key={option.unit.id} className={sent ? "is-sent" : undefined}>
                    <span className="unitopts__icon">
                      <UnitIcon kind={option.unit.kind} size={17} />
                    </span>
                    <div className="unitopts__body">
                      <strong>{option.unit.name}</strong>
                      <small>
                        {org.short} · {option.unit.crew}{" "}
                        {option.unit.crew === 1 ? "pessoa" : "pessoas"}
                        {option.unit.waterL > 0
                          ? ` · ${option.unit.waterL.toLocaleString("pt-BR")} L · ${Math.round(option.autonomyMin)} min de autonomia`
                          : ""}
                      </small>
                      <small className="unitopts__why">{option.reason}</small>
                      {/* Reabastecimento só faz sentido para quem carrega água. */}
                      {option.water && option.unit.waterL > 0 && (
                        <small className="unitopts__water">
                          <Drop size={11} /> Reabastece no{" "}
                          {WATER_LABEL[option.water.kind].toLowerCase()}{" "}
                          {option.water.name}
                        </small>
                      )}
                    </div>
                    <div className="unitopts__action">
                      <b className="num">{Math.round(option.etaMin)} min</b>
                      {sent ? (
                        <span className="unitopts__sent">
                          {sent.status === "no_local" ? "no local" : "a caminho"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn btn--soft"
                          onClick={() =>
                            act(
                              {
                                type: "despachar",
                                at: Date.now(),
                                incidentId: incident.id,
                                unitId: option.unit.id,
                                unitName: option.unit.name,
                                etaMin: option.etaMin,
                                waterSourceId: option.water?.id,
                                actorId: actor.id,
                                actorName: actor.name,
                              },
                              "alerta:assumir",
                              "Despachar recurso",
                            )
                          }
                        >
                          Despachar
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tab === "ameacas" && (
          <>
            <p className="detail__hint">
              Tempo até a frente alcançar cada ativo, sem combate, pelo modelo
              CSIRO com o vento atual. Área projetada agora:{" "}
              <b>{formatHa(fire.areaHa)}</b>.
            </p>
            <ul className="threatlist">
              {risks.map((risk) => (
                <li key={risk.id} className={risk.critical ? "is-critical" : undefined}>
                  <span className="threatlist__eta num">
                    {risk.etaMin === null ? "—" : `${Math.max(1, Math.round(risk.etaMin))}′`}
                  </span>
                  <div>
                    <strong>{risk.name}</strong>
                    <small>
                      {risk.detail} · {formatDistance(risk.distanceM)}
                      {risk.people > 0 ? ` · ${risk.people} pessoas` : ""}
                    </small>
                  </div>
                  {risk.critical && <Alert size={15} />}
                </li>
              ))}
            </ul>
          </>
        )}

        {tab === "rede" && (
          <>
            <p className="detail__hint">
              Nível {LEVEL_LABEL[incident.level]} alcança {reach.radiusKm} km em
              volta e {reach.downwindKm} km no setor a favor do vento, por{" "}
              {reach.channels.join(", ")}.
            </p>
            <ol className="wavelist">
              {[1, 2, 3].map((wave) => {
                const items = plan.filter((p) => p.wave === wave);
                if (!items.length) return null;
                return (
                  <li key={wave}>
                    <div className="wavelist__head">
                      <span className={`wavelist__badge is-w${wave}`}>
                        Onda {wave}
                      </span>
                      <small>
                        {wave === 1
                          ? "quem está no caminho do fogo"
                          : wave === 2
                            ? "quem combate"
                            : "quem coordena e acompanha"}
                      </small>
                    </div>
                    <ul>
                      {items.map((item) => (
                        <li key={item.target.id}>
                          <strong>{item.target.name}</strong>
                          <span className="num">
                            {formatDistance(item.distanceM)}
                          </span>
                          {item.downwind && <em>a favor do vento</em>}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>

            <div className="grantbox">
              <Lock size={15} />
              <div>
                <strong>Acesso à coordenada exata</strong>
                {grants.length ? (
                  <ul>
                    {grants.map((grant) => (
                      <li key={grant.actorId}>
                        {orgById(grant.orgId).short} · expira em{" "}
                        <b className="num">
                          {Math.max(0, Math.round((grant.until - now) / 60_000))} min
                        </b>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <small>
                    Ninguém tem acesso exato agora — a rede vê o quadrante de 1 km.
                  </small>
                )}
              </div>
            </div>
          </>
        )}

        {tab === "auditoria" && (
          <>
            <p className="detail__hint">
              {incident.audit.length} eventos encadeados por SHA-256. É esta
              trilha que vira laudo de ocorrência, prova para a seguradora e
              base de apuração de alarme falso.
            </p>
            <div className="detail__chainactions">
              <button
                type="button"
                className="btn btn--soft"
                onClick={() => runVerify(false)}
              >
                <Check size={15} /> Verificar
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => runVerify(true)}
              >
                Simular adulteração
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() =>
                  onToast({
                    message: "Laudo gerado a partir da trilha",
                    detail:
                      "Área, linha do tempo, recursos empregados e participantes — exportável em PDF.",
                  })
                }
              >
                <FileText size={15} /> Laudo
              </button>
            </div>

            {verdict && (
              <div className={`verdict${verdict.valid ? " is-ok" : " is-bad"}`}>
                <span>{verdict.valid ? <Check size={14} /> : <X size={14} />}</span>
                <div>
                  <strong>
                    {verdict.valid
                      ? `${verdict.checked} registros conferidos`
                      : `Elo rompido no registro nº ${verdict.brokenAtSeq}`}
                  </strong>
                  <small>
                    {verdict.valid
                      ? "Cadeia consistente do gênesis ao último evento."
                      : verdict.reason}
                  </small>
                </div>
              </div>
            )}

            <ol className="auditlist">
              {(chain ?? incident.audit).map((event) => {
                // A cadeia selada acrescenta o hash; a lista crua ainda não tem.
                const hash = (event as Partial<SealedRecord>).hash;
                return (
                  <li key={event.seq}>
                    <span className="auditlist__seq num">#{event.seq}</span>
                    <div>
                      <strong>{event.summary}</strong>
                      <small className="num">
                        {new Date(event.ts).toLocaleTimeString("pt-BR")} ·{" "}
                        {event.actorName}
                      </small>
                      {hash && <code className="mono">{shortHash(hash)}</code>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </aside>
  );
}
