"use client";

/**
 * App de campo — a tela de quem está com o pé na terra.
 *
 * Quatro decisões de projeto mandam em tudo aqui:
 *
 *  1. Sob sol forte e com pressa, contraste e tamanho valem mais que
 *     elegância. Nada abaixo de 12 px, alvo de toque de 46 px, uma ação
 *     primária por tela.
 *  2. O botão de emergência é grande, mas nunca dispara em um toque: a
 *     confirmação é por pressão contínua e mostra antes o que vai acontecer.
 *  3. Toda restrição é explicada. Um botão desativado sem motivo é um usuário
 *     que desinstala o app.
 *  4. Celular e mesa são o mesmo produto, não a mesma tela em dois tamanhos:
 *     no celular é um app de tela cheia travado ao viewport visível; na mesa
 *     é um app de trabalho com rail de navegação e conteúdo em duas colunas.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ThemeScope } from "@/components/ThemeScope.tsx";
import { ContrastScope } from "@/components/ContrastScope.tsx";
import { Logomark, Wordmark } from "@/components/Brand.tsx";
import { Toast, type ToastState } from "@/components/ui.tsx";
import { Bell, Home, MapIcon, Radio, Shield, Users } from "@/components/Icons.tsx";
import { dailyRisk } from "@/lib/fire.ts";
import { can, evaluateEscalation, type Actor, type Scope } from "@/lib/policy.ts";
import { consume, formatRetry, LIMITS, newBucket, type Bucket } from "@/lib/ratelimit.ts";
import {
  DEMO_ORIGIN,
  DEMO_SESSIONS,
  DEMO_WEATHER,
  PEOPLE,
  RISK_SERIES,
  orgById,
  personById,
} from "@/lib/scenario.ts";
import { useTicker, useVigiaBus } from "@/lib/bus.ts";
import { usePersistentState } from "@/lib/storage.ts";
import { nextCode, type Command } from "@/lib/store.ts";
import { pendingCommands } from "@/lib/director.ts";
import { parcelAt } from "@/lib/selectors.ts";
import type { AlertLevel, Incident, LatLon, Person } from "@/lib/domain.ts";
import { HomeScreen } from "./HomeScreen.tsx";
import { ActiveAlert } from "./ActiveAlert.tsx";
import { MapScreen } from "./MapScreen.tsx";
import { NetworkScreen } from "./NetworkScreen.tsx";
import { ProfileScreen } from "./ProfileScreen.tsx";
import { ReportSheet, type ReportDraft } from "./ReportSheet.tsx";
import { ActivityPanel } from "./ActivityPanel.tsx";
import type { Settings } from "./types.ts";
import type { Tab } from "./types.ts";
import "./campo.css";

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "mapa", label: "Mapa", icon: MapIcon },
  { id: "rede", label: "Rede", icon: Users },
  { id: "perfil", label: "Perfil", icon: Shield },
];

const DEFAULT_SETTINGS: Settings = {
  highContrast: false,
  soundAlerts: true,
  smsNotify: true,
};

type LocationState = "cadastro" | "buscando" | "gps" | "negado";

/** Escopo territorial derivado do papel — quem age só age onde responde. */
function scopeFor(person: Person): Scope {
  const org = orgById(person.orgId);
  if (person.role === "autoridade") return { kind: "regional" };
  if (org.kind === "brigada")
    return { kind: "raio", center: org.at, radiusKm: 45 };
  return { kind: "propriedade", propertyIds: [org.id] };
}

function actorFor(person: Person): Actor {
  return {
    id: person.id,
    name: person.name,
    orgId: person.orgId,
    role: person.role,
    scope: scopeFor(person),
    verified: person.verified,
    reputation: person.reputation,
  };
}

export default function CampoPage() {
  const [personId, setPersonId] = usePersistentState<string>(
    "vigia-rural:person",
    PEOPLE[0].id,
  );
  const person = personById(personId);
  const org = orgById(person.orgId);
  const actor = useMemo(() => actorFor(person), [person]);

  const { state, dispatch, peers, selfId } = useVigiaBus(
    "campo",
    `${org.short} · ${person.name}`,
  );
  const now = useTicker(1000);

  const [tab, setTab] = useState<Tab>("inicio");
  const [toast, setToast] = useState<ToastState>(null);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [personPicker, setPersonPicker] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const [settings, setSettings] = usePersistentState<Settings>(
    "vigia-rural:settings",
    DEFAULT_SETTINGS,
  );

  const [coords, setCoords] = useState<LatLon>(DEMO_ORIGIN);
  const [accuracyM, setAccuracyM] = useState(9);
  const [locationState, setLocationState] = useState<LocationState>("cadastro");
  const [buckets, setBuckets] = useState<Record<string, Bucket>>({});

  const risk = useMemo(() => dailyRisk(RISK_SERIES), []);

  const incident: Incident | undefined = useMemo(
    () =>
      state.incidents.find(
        (i) => i.status !== "encerrado" && i.status !== "cancelado",
      ),
    [state.incidents],
  );

  const recentIncidents = useMemo(
    () =>
      state.incidents
        .filter((i) => i.status === "encerrado" || i.status === "cancelado")
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [state.incidents],
  );

  const reportIncident = incident ?? recentIncidents[0];

  // A aba que abriu a ocorrência conduz a simulação da rede do outro lado.
  const peerIds = useMemo(() => peers.map((p) => p.id), [peers]);
  useEffect(() => {
    if (!incident || !now) return;
    for (const command of pendingCommands(incident, now, selfId, peerIds))
      dispatch(command);
  }, [incident, now, selfId, peerIds, dispatch]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationState("negado");
      setToast({
        message: "GPS indisponível neste aparelho",
        tone: "warn",
        detail: "O alerta seguiria com a coordenada cadastrada do talhão.",
      });
      return;
    }
    setLocationState("buscando");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setAccuracyM(Math.max(3, Math.round(position.coords.accuracy)));
        setLocationState("gps");
        setToast({ message: "Localização do aparelho confirmada" });
      },
      () => {
        setLocationState("negado");
        setToast({
          message: "Permissão de localização negada",
          tone: "warn",
          detail:
            "Seguimos com o ponto cadastrado. Sem GPS, o alerta perde precisão de talhão.",
        });
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 20_000 },
    );
  }, []);

  /** Cheque de limite antes de qualquer ação que mobilize gente. */
  const checkLimit = useCallback(
    (action: keyof typeof LIMITS) => {
      const limit = LIMITS[action];
      const key = `${personId}:${action}`;
      const current = buckets[key] ?? newBucket(limit, Date.now());
      const result = consume(current, limit, Date.now());
      setBuckets((all) => ({ ...all, [key]: result.bucket }));
      return result;
    },
    [buckets, personId],
  );

  const openReport = useCallback((intent: "fogo" | "suspeita") => {
    setDraft({
      intent,
      evidence: intent === "fogo" ? "chamas" : "fumaca",
      note: "",
    });
  }, []);

  const submitReport = useCallback(
    (submitted: ReportDraft) => {
      const at = Date.now();
      const wantsAlert = submitted.intent === "fogo";
      const action = wantsAlert ? "alerta:confirmar" : "alerta:suspeita";

      const decision = can(actor, wantsAlert ? "alerta:confirmar" : "alerta:suspeita", {
        at: coords,
        propertyId: org.id,
      });

      const escalation = evaluateEscalation({
        actor,
        origin: coords,
        propertyId: org.id,
        corroborations: [],
        now: at,
        riskIndex: risk.index,
      });

      const level: AlertLevel = wantsAlert
        ? decision.allowed
          ? escalation.level
          : "suspeita"
        : "suspeita";

      const limit = checkLimit(action);
      if (!limit.allowed) {
        setToast({
          message: "Limite de acionamentos atingido",
          tone: "error",
          detail: `Proteção contra disparo em cadeia — ${formatRetry(limit.retryAfterMs)}. Um coordenador pode abrir por você.`,
        });
        return;
      }

      const parcel = parcelAt(coords);
      const command: Command = {
        type: "abrir",
        at,
        incidentId: `inc_${at.toString(36)}`,
        code: nextCode(state, new Date(at).getFullYear()),
        hostId: selfId,
        origin: coords,
        accuracyM,
        parcelId: parcel?.id,
        evidence: submitted.evidence,
        note: submitted.note || undefined,
        level,
        rationale: decision.allowed
          ? escalation.rationale
          : `Rebaixado para suspeita: ${decision.reason}`,
        weather: DEMO_WEATHER,
        reporter: {
          actorId: person.id,
          name: person.name,
          orgId: org.id,
          role: person.role,
        },
        drill: true,
      };

      dispatch(command);
      setDraft(null);
      setTab("inicio");
      setToast({
        message:
          level === "suspeita"
            ? "Suspeita registrada na rede imediata"
            : "Alerta enviado · rede mobilizada",
        detail: decision.allowed
          ? escalation.rationale
          : `${decision.reason}. ${decision.hint ?? ""}`,
        tone: level === "suspeita" ? "warn" : "ok",
      });
    },
    [
      actor,
      accuracyM,
      checkLimit,
      coords,
      dispatch,
      org.id,
      person,
      risk.index,
      selfId,
      state,
    ],
  );

  const closeIncident = useCallback(
    (outcome: "procedente" | "improcedente") => {
      if (!incident) return;
      dispatch({
        type: "status",
        at: Date.now(),
        incidentId: incident.id,
        status: outcome === "procedente" ? "encerrado" : "cancelado",
        actorId: person.id,
        actorName: person.name,
        outcome,
        reason:
          outcome === "procedente"
            ? "Simulação encerrada pelo responsável — registro preservado para laudo."
            : "Ocorrência cancelada pelo autor antes da mobilização ampla.",
      });
      setToast({
        message: "Ocorrência encerrada",
        detail: "O registro auditável continua disponível no perfil.",
      });
    },
    [incident, dispatch, person],
  );

  const centralOnline = peers.some((p) => p.role === "central");

  return (
    <div className="campo">
      <ThemeScope theme="campo" color="#eef1ec" />
      <ContrastScope high={settings.highContrast} />

      <nav className="rail" aria-label="Navegação principal">
        <Link href="/apresentacao" className="rail__brand" aria-label="Vigia Rural">
          <Logomark size={26} />
        </Link>
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "is-active" : undefined}
              onClick={() => setTab(item.id)}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={active ? 2 : 1.6} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <main className="phone" aria-label="Aplicativo Vigia Rural">
        <header className="phone__header">
          <button
            type="button"
            className="phone__brand"
            onClick={() => setTab("inicio")}
          >
            <Wordmark size={24} />
          </button>

          <span className={`phone__peerstatus${centralOnline ? " is-live" : ""}`}>
            <span
              className="pulse-dot"
              style={{ color: centralOnline ? "var(--brand)" : "var(--faint)" }}
            />
            {centralOnline ? "Central conectada" : "Central de Operações"}
          </span>

          <div className="phone__header-right">
            {incident && (
              <span className="phone__live">
                <span className="pulse-dot" />
                ao vivo
              </span>
            )}
            <button
              type="button"
              className={`phone__iconbtn${activityOpen ? " is-active" : ""}`}
              onClick={() => setActivityOpen((v) => !v)}
              aria-label="Atividade da rede"
              aria-pressed={activityOpen}
              title="Atividade da rede"
            >
              <Radio size={17} />
            </button>
            <button
              type="button"
              className="phone__avatar"
              onClick={() => setPersonPicker(true)}
              aria-label={`Sessão de ${person.name}. Trocar perfil`}
            >
              {person.initials}
            </button>
          </div>
        </header>

        <div className="phone__content scroll-slim" key={tab}>
          {tab === "inicio" &&
            (incident ? (
              <ActiveAlert
                incident={incident}
                now={now}
                person={person}
                actor={actor}
                dispatch={dispatch}
                onOpenMap={() => setTab("mapa")}
                onClose={closeIncident}
                onToast={setToast}
              />
            ) : (
              <HomeScreen
                person={person}
                org={org}
                risk={risk}
                now={now}
                coords={coords}
                accuracyM={accuracyM}
                locationState={locationState}
                onLocate={requestLocation}
                onReport={openReport}
                onOpenTab={setTab}
                actor={actor}
                recent={recentIncidents.slice(0, 3)}
                onToast={setToast}
              />
            ))}

          {tab === "mapa" && (
            <MapScreen
              incident={incident}
              now={now}
              coords={coords}
              accuracyM={accuracyM}
              locationState={locationState}
              onLocate={requestLocation}
              actor={actor}
              onToast={setToast}
            />
          )}

          {tab === "rede" && (
            <NetworkScreen incident={incident} person={person} />
          )}

          {tab === "perfil" && (
            <ProfileScreen
              person={person}
              org={org}
              incident={incident}
              reportIncident={reportIncident}
              history={recentIncidents}
              buckets={buckets}
              now={now}
              settings={settings}
              onSettingsChange={setSettings}
              onToast={setToast}
            />
          )}
        </div>
      </main>

      <ActivityPanel
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        incident={incident}
        person={person}
      />

      <ReportSheet
        draft={draft}
        actor={actor}
        person={person}
        org={org}
        coords={coords}
        accuracyM={accuracyM}
        locationState={locationState}
        risk={risk}
        now={now}
        onLocate={requestLocation}
        onChange={setDraft}
        onCancel={() => setDraft(null)}
        onSubmit={submitReport}
      />

      {personPicker && (
        <div
          className="sheet-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPersonPicker(false);
          }}
        >
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Trocar perfil">
            <span className="sheet__grip" aria-hidden />
            <header className="sheet__head">
              <span className="eyebrow">Perfis da demonstração</span>
              <h2>Entrar como</h2>
            </header>
            <p className="sheet__note">
              O papel muda o que a pessoa pode fazer. Um colaborador registra
              suspeita; só responsável, brigada e autoridade acionam a rede
              ampla.
            </p>
            <div className="personlist">
              {DEMO_SESSIONS.map((option) => {
                const candidate = personById(option.personId);
                const candidateOrg = orgById(candidate.orgId);
                const selected = candidate.id === person.id;
                return (
                  <button
                    key={option.personId}
                    type="button"
                    className={selected ? "is-selected" : undefined}
                    onClick={() => {
                      setPersonId(option.personId);
                      setPersonPicker(false);
                      setToast({
                        message: `Sessão de ${candidate.name}`,
                        detail: option.blurb,
                      });
                    }}
                  >
                    <span className={`orgavatar orgavatar--${candidateOrg.accent}`}>
                      {candidate.initials}
                    </span>
                    <span className="personlist__body">
                      <small>{option.label}</small>
                      <strong>{candidate.name}</strong>
                      <span>{option.blurb}</span>
                    </span>
                    {selected && <Bell size={16} />}
                  </button>
                );
              })}
            </div>
            <Link
              href="/central"
              className="campo__link"
              onClick={() => setPersonPicker(false)}
              style={{ display: "block", marginTop: 14 }}
            >
              Abrir Central de Operações em outra janela →
            </Link>
          </div>
        </div>
      )}

      <Toast state={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
