"use client";

/**
 * Perfil e centro de confiança.
 *
 * Em vez de listar promessas de segurança, a tela mostra o estado real dos
 * mecanismos: quantos acionamentos ainda restam no balde de fichas, qual a
 * reputação do autor, quem tem acesso à coordenada exata neste momento — e
 * deixa a pessoa reexecutar a verificação da cadeia de auditoria ali mesmo.
 */

import { useCallback, useMemo, useState } from "react";
import { OrgAvatar } from "@/components/ui.tsx";
import type { ToastState } from "@/components/ui.tsx";
import {
  Check,
  FileText,
  Link as LinkIcon,
  Lock,
  Shield,
  X,
} from "@/components/Icons.tsx";
import {
  sealChain,
  shortHash,
  verifyChain,
  type ChainVerdict,
  type SealedRecord,
} from "@/lib/audit.ts";
import { LIMITS, consume, newBucket, type Bucket } from "@/lib/ratelimit.ts";
import { ROLE_LABEL } from "@/lib/policy.ts";
import { activeGrants } from "@/lib/selectors.ts";
import type { Incident, Org, Person } from "@/lib/domain.ts";

const LIMIT_LABEL: Record<keyof typeof LIMITS, string> = {
  "alerta:suspeita": "Registrar suspeita",
  "alerta:confirmar": "Confirmar fogo",
  "alerta:emergencia": "Escalar emergência",
  "local:exato": "Consultar local exato",
};

export function ProfileScreen({
  person,
  org,
  incident,
  buckets,
  now,
  onToast,
}: {
  person: Person;
  org: Org;
  incident?: Incident;
  buckets: Record<string, Bucket>;
  /** Instante do relógio compartilhado; 0 antes da montagem. */
  now: number;
  onToast: (toast: ToastState) => void;
}) {
  const [chain, setChain] = useState<SealedRecord[] | null>(null);
  const [verdict, setVerdict] = useState<ChainVerdict | null>(null);
  const [busy, setBusy] = useState(false);

  const grants = incident ? activeGrants(incident, now) : [];

  // Custo zero: só recarrega o balde até `now` para mostrar o saldo real,
  // sem gastar ficha por abrir a tela.
  const limits = useMemo(
    () =>
      (Object.keys(LIMITS) as (keyof typeof LIMITS)[]).map((action) => {
        const limit = LIMITS[action];
        const bucket = buckets[`${person.id}:${action}`] ?? newBucket(limit, now);
        return {
          action,
          remaining: Math.floor(consume(bucket, limit, now, 0).bucket.tokens),
          capacity: limit.capacity,
        };
      }),
    [buckets, person.id, now],
  );

  const runVerification = useCallback(
    async (tamper: boolean) => {
      if (!incident) {
        onToast({
          message: "Nenhuma ocorrência para verificar",
          tone: "warn",
          detail: "Abra um alerta na tela inicial para gerar a trilha.",
        });
        return;
      }
      setBusy(true);
      try {
        const sealed = await sealChain(incident.audit);
        const inspected = tamper
          ? sealed.map((record, index) =>
              index === Math.min(1, sealed.length - 1)
                ? {
                    ...record,
                    summary: "Registro alterado depois do fato (teste)",
                  }
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
                detail: `${result.checked} registros conferidos, nenhum elo rompido.`,
              }
            : {
                message: "Adulteração detectada",
                tone: "error",
                detail: `${result.reason} Registro nº ${result.brokenAtSeq}.`,
              },
        );
      } finally {
        setBusy(false);
      }
    },
    [incident, onToast],
  );

  return (
    <section className="screen">
      <header className="screen__head screen__head--tight">
        <span className="eyebrow">Conta institucional</span>
        <h2>Perfil e segurança</h2>
      </header>

      <div className="orgcard">
        <OrgAvatar initials={org.initials} accent={org.accent} size={52} />
        <div>
          <small>{org.registry}</small>
          <strong>{org.name}</strong>
          <span>{org.detail}</span>
        </div>
      </div>

      <div className="personcard">
        <span className="personcard__avatar">{person.initials}</span>
        <div>
          <small>Responsável da sessão</small>
          <strong>{person.name}</strong>
          <span>{ROLE_LABEL[person.role]}</span>
        </div>
        <span className="personcard__seal" title="Identidade verificada">
          <Check size={13} />
        </span>
      </div>
      <p className="verifiedby">
        <Shield size={14} /> Verificado por: {person.verifiedBy}
      </p>

      <div className="sectionlabel">
        <span>Centro de confiança</span>
        <small>estado real, não promessa</small>
      </div>

      <div className="trustlist">
        <article>
          <span className="trustlist__icon">
            <Lock size={17} />
          </span>
          <div>
            <strong>Reputação de acionamento</strong>
            <small>
              Sobe a cada alerta procedente, cai 22 pontos a cada alarme falso
              confirmado.
            </small>
            <div className="meter">
              <span style={{ width: `${person.reputation}%` }} />
            </div>
          </div>
          <b className="num">{person.reputation}</b>
        </article>

        <article>
          <span className="trustlist__icon">
            <Shield size={17} />
          </span>
          <div>
            <strong>Limites anti-abuso</strong>
            <small>
              Balde de fichas por ação. Escalar custa mais caro do que relatar.
            </small>
            <ul className="limitlist">
              {limits.map((item) => (
                <li key={item.action}>
                  <span>{LIMIT_LABEL[item.action]}</span>
                  <b className="num">
                    {item.remaining}/{item.capacity}
                  </b>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article>
          <span className="trustlist__icon">
            <LinkIcon size={17} />
          </span>
          <div>
            <strong>Privacidade de localização</strong>
            <small>
              A rede recebe um quadrante de 1 km. A coordenada exata é liberada
              por tempo determinado a quem aceita a ocorrência.
            </small>
            {grants.length > 0 ? (
              <ul className="grantlist">
                {grants.map((grant) => (
                  <li key={grant.actorId}>
                    <span>{grant.orgId.replace("org-", "")}</span>
                    <b className="num">
                      expira em{" "}
                      {Math.max(0, Math.round((grant.until - now) / 60_000))} min
                    </b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="grantlist__empty">
                Nenhuma liberação ativa neste momento.
              </p>
            )}
          </div>
        </article>
      </div>

      <div className="sectionlabel">
        <span>Registro auditável</span>
        <small>{incident ? `${incident.audit.length} eventos` : "sem ocorrência"}</small>
      </div>

      <section className="chaincard">
        <p>
          Cada evento carrega o hash SHA-256 do anterior. Mudar ou apagar um
          registro antigo quebra todos os elos seguintes — é o que transforma a
          ocorrência em prova para seguradora e para o órgão ambiental.
        </p>
        <div className="chaincard__actions">
          <button
            type="button"
            className="btn btn--soft"
            disabled={busy}
            onClick={() => runVerification(false)}
          >
            <Check size={16} /> Verificar integridade
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={busy}
            onClick={() => runVerification(true)}
          >
            Simular adulteração
          </button>
        </div>

        {verdict && (
          <div className={`verdict${verdict.valid ? " is-ok" : " is-bad"}`}>
            <span>{verdict.valid ? <Check size={15} /> : <X size={15} />}</span>
            <div>
              <strong>
                {verdict.valid
                  ? `${verdict.checked} registros conferidos`
                  : `Elo rompido no registro nº ${verdict.brokenAtSeq}`}
              </strong>
              <small>
                {verdict.valid
                  ? "Cadeia consistente do gênesis até o último evento."
                  : verdict.reason}
              </small>
            </div>
          </div>
        )}

        {chain && (
          <ol className="chainlist">
            {chain.slice(-6).map((record) => (
              <li key={record.seq}>
                <span className="num">#{record.seq}</span>
                <div>
                  <strong>{record.summary}</strong>
                  <small className="mono">{shortHash(record.hash)}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="lgpd">
        <FileText size={14} />
        <span>
          Tratamento com base em legítimo interesse e proteção à vida (LGPD, art.
          7º). Minimização por padrão, retenção de 24 meses para a trilha de
          incidentes e anonimização das demais bases. O titular pode revogar o
          compartilhamento contínuo sem perder o registro histórico já
          pseudonimizado.
        </span>
      </p>
    </section>
  );
}
