"use client";

/**
 * Espelho da rede (visível apenas em telas largas).
 *
 * Mostra a mensagem exata que cada vizinho, brigada e órgão recebeu — porque a
 * qualidade de um alerta se mede pelo que chega do outro lado, não pelo que
 * sai. Um aviso genérico ("incêndio na região") não faz ninguém sair de casa;
 * um aviso com direção, distância e tempo de chegada faz.
 */

import { useMemo } from "react";
import { Bell, Message, Phone, Radio, Satellite } from "@/components/Icons.tsx";
import { compass, formatDistance } from "@/lib/geo.ts";
import { windToDeg } from "@/lib/fire.ts";
import { LEVEL_LABEL } from "@/lib/policy.ts";
import { model, notifyPlan } from "@/lib/selectors.ts";
import { timeToReachMin } from "@/lib/fire.ts";
import { orgById, parcelById, WATER } from "@/lib/scenario.ts";
import { distanceM } from "@/lib/geo.ts";
import type { Incident, Person } from "@/lib/domain.ts";

const CHANNEL_ICON = { app: Bell, sms: Message, voz: Phone, órgãos: Radio };

export function NetworkMirror({
  incident,
  now,
  person,
}: {
  incident?: Incident;
  now: number;
  person: Person;
}) {
  const messages = useMemo(() => {
    if (!incident) return [];
    const spread = model(incident);
    const parcel = parcelById(incident.parcelId);
    const nearestWater = [...WATER]
      .filter((w) => w.truckAccess)
      .sort(
        (a, b) =>
          distanceM(a.at, incident.origin) - distanceM(b.at, incident.origin),
      )[0];

    return notifyPlan(incident).map((item) => {
      const org = orgById(item.target.id);
      const eta = timeToReachMin(incident.origin, spread, item.target.at);
      const channel = item.channels.includes("sms") ? "sms" : "app";

      let body: string;
      if (item.target.kind === "vizinho" && item.downwind)
        body = `Fogo a ${formatDistance(item.distanceM)}, vindo na sua direção (${compass(
          windToDeg(incident.weather),
        )}). Frente estimada em ${eta ? Math.round(eta) : "—"} min. Retire pessoas e animais do caminho e confirme se está seguro.`;
      else if (item.target.kind === "vizinho")
        body = `Fogo a ${formatDistance(item.distanceM)}, fora da sua linha de vento. Fique atento à mudança de direção — não é necessário evacuar agora.`;
      else if (item.target.kind === "brigada")
        body = `${incident.code} · ${LEVEL_LABEL[incident.level]} em ${parcel?.name ?? "área rural"}, ${orgById(incident.reporter.orgId).short}. Frente a ${Math.round(spread.headRosMMin)} m/min. Água mais próxima: ${nearestWater?.name} (${formatDistance(distanceM(nearestWater.at, incident.origin))}, acesso para pipa).`;
      else
        body = `${incident.code} · ${LEVEL_LABEL[incident.level]}. ${incident.corroborations.length} fontes, sendo ${incident.corroborations.filter((c) => c.source === "satelite").length} por satélite. Coordenada exata disponível mediante aceite da ocorrência.`;

      return {
        id: item.target.id,
        org,
        wave: item.wave,
        channel,
        reason: item.reason,
        body,
      };
    });
  }, [incident]);

  return (
    <aside className="campo__aside campo__aside--right" aria-label="Espelho da rede">
      <div className="mirror__head">
        <span className="eyebrow">Espelho da rede</span>
        <h2>O que chegou do outro lado</h2>
        <p>
          Mesmo evento, mensagens diferentes. Cada destinatário recebe a
          informação que muda a decisão dele.
        </p>
      </div>

      {!incident && (
        <div className="mirror__empty">
          <Satellite size={22} />
          <strong>Rede em silêncio</strong>
          <span>
            Nenhuma ocorrência aberta. Acione o alerta no celular ao lado para
            ver as mensagens saindo em ondas.
          </span>
        </div>
      )}

      <ol className="mirror__list">
        {messages.map((message) => {
          const Icon =
            CHANNEL_ICON[message.channel as keyof typeof CHANNEL_ICON] ?? Bell;
          return (
            <li key={message.id} className={`mirror__item is-wave-${message.wave}`}>
              <div className="mirror__meta">
                <span className={`orgavatar orgavatar--${message.org.accent}`}>
                  {message.org.initials}
                </span>
                <div>
                  <strong>{message.org.short}</strong>
                  <small>
                    onda {message.wave} · {message.channel.toUpperCase()}
                  </small>
                </div>
                <Icon size={15} />
              </div>
              <p className="mirror__body">{message.body}</p>
              <small className="mirror__why">{message.reason}</small>
            </li>
          );
        })}
      </ol>

      {incident && (
        <p className="mirror__foot">
          Enviado em nome de {person.name} · {incident.code} ·{" "}
          {now
            ? new Date(incident.openedAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </p>
      )}
    </aside>
  );
}
