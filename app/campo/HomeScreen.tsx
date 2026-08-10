"use client";

import { Gauge } from "@/components/ui.tsx";
import type { ToastState } from "@/components/ui.tsx";
import {
  ChevronRight,
  Crosshair,
  Drop,
  Flame,
  Lock,
  Shield,
  Smoke,
  Thermometer,
  Wind,
  X,
} from "@/components/Icons.tsx";
import type { DailyRisk } from "@/lib/fire.ts";
import { DEMO_WEATHER } from "@/lib/scenario.ts";
import { compass } from "@/lib/geo.ts";
import { can, ROLE_LABEL, type Actor } from "@/lib/policy.ts";
import { STATUS_LABEL, type Incident, type LatLon, type Org, type Person } from "@/lib/domain.ts";
import { usePersistentState } from "@/lib/storage.ts";
import { ReadinessChecklist } from "./ReadinessChecklist.tsx";
import type { Tab } from "./types.ts";

const RISK_COLOR: Record<DailyRisk["klass"], string> = {
  nulo: "var(--brand)",
  pequeno: "var(--brand)",
  medio: "var(--amber)",
  alto: "var(--amber)",
  "muito-alto": "var(--ember)",
};

function greeting(now: number) {
  const hour = now ? new Date(now).getHours() : 9;
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomeScreen({
  person,
  org,
  risk,
  now,
  coords,
  accuracyM,
  locationState,
  onLocate,
  onReport,
  onOpenTab,
  actor,
  recent,
  onToast,
}: {
  person: Person;
  org: Org;
  risk: DailyRisk;
  now: number;
  coords: LatLon;
  accuracyM: number;
  locationState: "cadastro" | "buscando" | "gps" | "negado";
  onLocate: () => void;
  onReport: (intent: "fogo" | "suspeita") => void;
  onOpenTab: (tab: Tab) => void;
  actor: Actor;
  recent: Incident[];
  onToast: (toast: ToastState) => void;
}) {
  const firstName = person.name.split(" ")[0];
  const canAlert = can(actor, "alerta:confirmar");
  const [installDismissed, setInstallDismissed] = usePersistentState(
    "vigia-rural:installhint",
    false,
  );

  return (
    <section className="screen">
      <header className="screen__head">
        <p className="screen__hello">
          {greeting(now)}, {firstName}
        </p>
        <h2>
          Tudo pronto
          <br />
          para proteger.
        </h2>
      </header>

      {!installDismissed && (
        <div className="installhint" role="status">
          <span className="installhint__icon">
            <Shield size={17} />
          </span>
          <div>
            <strong>Adicione à tela inicial</strong>
            <small>
              Abre em tela cheia, sem barra do navegador, e continua no ar
              mesmo com internet ruim no talhão.
            </small>
          </div>
          <button
            type="button"
            onClick={() => setInstallDismissed(true)}
            aria-label="Dispensar"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Índice de risco — o motivo de abrir o app num dia comum. */}
      <section className="riskcard" aria-labelledby="risk-title">
        <div className="riskcard__top">
          <Gauge ratio={risk.ratio} color={RISK_COLOR[risk.klass]} size={92}>
            <b className="num">{risk.index.toFixed(0)}</b>
            <small>FMA+</small>
          </Gauge>
          <div>
            <span className="eyebrow">Risco de incêndio hoje</span>
            <h3 id="risk-title" style={{ color: RISK_COLOR[risk.klass] }}>
              {risk.label}
            </h3>
            <p>{risk.advice}</p>
          </div>
        </div>
        <ul className="riskcard__vars">
          <li>
            <Thermometer size={15} />
            <b className="num">{DEMO_WEATHER.tempC}°</b>
            <span>temperatura</span>
          </li>
          <li>
            <Drop size={15} />
            <b className="num">{DEMO_WEATHER.humidity}%</b>
            <span>umidade</span>
          </li>
          <li>
            <Wind size={15} />
            <b className="num">{DEMO_WEATHER.windKmh}</b>
            <span>km/h de {compass(DEMO_WEATHER.windFromDeg)}</span>
          </li>
          <li>
            <Flame size={15} />
            <b className="num">{DEMO_WEATHER.daysSinceRain}</b>
            <span>dias sem chuva</span>
          </li>
        </ul>
        <p className="riskcard__source">
          Fórmula de Monte Alegre estendida (FMA+), acumulada em 14 dias de
          observação da estação de Uruçuí.
        </p>
      </section>

      {/* Ação de emergência */}
      <section className="emergency" aria-labelledby="emergency-title">
        <span className="eyebrow" id="emergency-title">
          Em caso de fogo
        </span>
        <button
          type="button"
          className="emergency__button"
          onClick={() => onReport("fogo")}
        >
          <span className="emergency__ring" aria-hidden />
          <Flame size={38} />
          <strong>Detectei fogo</strong>
          <small>
            {canAlert.allowed
              ? "toque para confirmar o alerta"
              : "seu perfil registra como suspeita"}
          </small>
        </button>
        <button
          type="button"
          className="emergency__soft"
          onClick={() => onReport("suspeita")}
        >
          <Smoke size={17} />
          <span>
            <strong>Vejo fumaça ou algo suspeito</strong>
            <small>Registra sem mobilizar a região inteira</small>
          </span>
          <ChevronRight size={16} />
        </button>
      </section>

      <ReadinessChecklist orgId={org.id} onToast={onToast} />

      <div className="cardrow">
        <button
          type="button"
          className="rowcard"
          onClick={() => onOpenTab("rede")}
        >
          <span className="rowcard__icon rowcard__icon--brand">
            <Shield size={19} />
          </span>
          <span className="rowcard__body">
            <strong>Rede ativa na sua região</strong>
            <small>23 pessoas · brigada a 11 min</small>
          </span>
          <ChevronRight size={17} />
        </button>

        <button
          type="button"
          className="rowcard"
          onClick={() => onOpenTab("mapa")}
        >
          <span className="rowcard__icon">
            <Crosshair size={19} />
          </span>
          <span className="rowcard__body">
            <strong>
              {locationState === "gps"
                ? "Posição do aparelho"
                : "Talhão Pasto Sul · Boa Esperança"}
            </strong>
            <small className="num">
              {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)} · ±{accuracyM} m
            </small>
          </span>
          <span
            className="rowcard__action"
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
              onLocate();
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.stopPropagation();
                onLocate();
              }
            }}
          >
            {locationState === "buscando" ? "…" : "GPS"}
          </span>
        </button>
      </div>

      {recent.length > 0 && (
        <>
          <div className="sectionlabel">
            <span>Ocorrências recentes</span>
            <small>{recent.length} nos últimos registros</small>
          </div>
          <ul className="recentlist">
            {recent.map((item) => (
              <li key={item.id}>
                <span
                  className={`recentlist__dot${item.outcome ? ` is-${item.outcome}` : ""}`}
                />
                <div>
                  <strong>{item.code}</strong>
                  <small>
                    {STATUS_LABEL[item.status]} ·{" "}
                    {new Date(item.updatedAt).toLocaleDateString("pt-BR")}
                  </small>
                </div>
                <span>
                  {item.outcome === "procedente"
                    ? "confirmado"
                    : item.outcome === "improcedente"
                      ? "alarme falso"
                      : "sem desfecho"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="trustline">
        <Lock size={15} />
        <p>
          <strong>{ROLE_LABEL[person.role]}</strong> em {org.short}. Identidade
          e vínculo verificados — é isso que dá peso ao seu alerta.
        </p>
        <button type="button" onClick={() => onOpenTab("perfil")}>
          ver
        </button>
      </div>
    </section>
  );
}
