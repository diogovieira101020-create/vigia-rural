"use client";

/**
 * Painel de atividade — exclusivo do desktop.
 *
 * A vantagem real de uma tela grande não é caber mais botão, é caber mais
 * contexto ao mesmo tempo. Este painel mostra a mensagem exata que cada
 * vizinho, brigada e órgão recebeu — o que a rede está fazendo agora — sem
 * tirar o produtor da tela em que ele está. É uma gaveta que abre por cima,
 * não uma terceira coluna fixa disputando espaço com o conteúdo principal.
 */

import { useEffect, useMemo, useRef } from "react";
import { Bell, Message, Phone, Radio, Satellite, X } from "@/components/Icons.tsx";
import { compass, distanceM, formatDistance } from "@/lib/geo.ts";
import { timeToReachMin, windToDeg } from "@/lib/fire.ts";
import { LEVEL_LABEL } from "@/lib/policy.ts";
import { model, notifyPlan } from "@/lib/selectors.ts";
import { orgById, parcelById, WATER } from "@/lib/scenario.ts";
import type { Incident, Person } from "@/lib/domain.ts";

const CHANNEL_ICON = { app: Bell, sms: Message, voz: Phone, órgãos: Radio };

export function ActivityPanel({
  open,
  onClose,
  incident,
  person,
}: {
  open: boolean;
  onClose: () => void;
  incident?: Incident;
  person: Person;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        )}). Frente estimada em ${eta ? Math.round(eta) : "—"} min. Retire pessoas e animais do caminho.`;
      else if (item.target.kind === "vizinho")
        body = `Fogo a ${formatDistance(item.distanceM)}, fora da sua linha de vento. Fique atento — não é necessário evacuar agora.`;
      else if (item.target.kind === "brigada")
        body = `${incident.code} · ${LEVEL_LABEL[incident.level]} em ${parcel?.name ?? "área rural"}. Frente a ${Math.round(spread.headRosMMin)} m/min. Água mais próxima: ${nearestWater?.name}.`;
      else
        body = `${incident.code} · ${LEVEL_LABEL[incident.level]}. ${incident.corroborations.length} fontes. Coordenada exata sob aceite.`;

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
    <div
      className={`activitypanel-backdrop${open ? " is-open" : ""}`}
      aria-hidden={!open}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        ref={panelRef}
        className={`activitypanel${open ? " is-open" : ""}`}
        aria-label="Atividade da rede"
        aria-hidden={!open}
      >
        <header className="activitypanel__head">
          <div>
            <span className="eyebrow">Atividade da rede</span>
            <h2>O que chegou do outro lado</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar painel">
            <X size={16} />
          </button>
        </header>

        {!incident && (
          <div className="activitypanel__empty">
            <Satellite size={22} />
            <strong>Rede em silêncio</strong>
            <span>
              Nenhuma ocorrência aberta agora. Quando um alerta sair, as
              mensagens enviadas a cada organização aparecem aqui, em ordem.
            </span>
          </div>
        )}

        <ol className="activitypanel__list scroll-slim">
          {messages.map((message) => {
            const Icon =
              CHANNEL_ICON[message.channel as keyof typeof CHANNEL_ICON] ?? Bell;
            return (
              <li
                key={message.id}
                className={`activitypanel__item is-wave-${message.wave}`}
              >
                <div className="activitypanel__meta">
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
                <p>{message.body}</p>
                <small className="activitypanel__why">{message.reason}</small>
              </li>
            );
          })}
        </ol>

        {incident && (
          <p className="activitypanel__foot">
            Enviado em nome de {person.name} · {incident.code}
          </p>
        )}
      </aside>
    </div>
  );
}
