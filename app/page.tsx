"use client";

import { useEffect, useState } from "react";

const responders = [
  { name: "Brigada Vale Verde", role: "Brigada rural", eta: "6 min", tone: "green" },
  { name: "Fazenda Santa Luzia", role: "Vizinho mais próximo", eta: "2 min", tone: "sand" },
  { name: "Defesa Civil · Uruçuí", role: "Autoridade acionada", eta: "notificada", tone: "slate" },
];

export default function Home() {
  const [alertActive, setAlertActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!alertActive) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [alertActive]);

  const triggerAlert = () => {
    setAlertActive(true);
    setSeconds(0);
    setToast("Alerta enviado para 23 pessoas e 2 instituições");
    window.setTimeout(() => setToast(""), 4200);
  };

  const resetDemo = () => {
    setAlertActive(false);
    setSeconds(0);
    setToast("Simulação encerrada com segurança");
    window.setTimeout(() => setToast(""), 3200);
  };

  const elapsed = `00:${String(seconds).padStart(2, "0")}`;

  return (
    <main className={`app-shell ${alertActive ? "is-alert" : ""}`}>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Vigia Rural — início">
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span>VIGIA <b>RURAL</b></span>
        </a>

        <div className="system-status" aria-label="Status do sistema">
          <span className="status-dot" />
          Rede protegida
          <span className="status-detail">· 23 conectados</span>
        </div>

        <button className="profile" type="button" aria-label="Abrir perfil de João Martins">
          <span>JM</span>
          <span className="profile-copy">João Martins<small>Fazenda Boa Esperança</small></span>
        </button>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="eyebrow">REDE COOPERATIVA CONTRA INCÊNDIOS</p>
          <h1>{alertActive ? "Alerta em andamento." : "Viu fogo?\nA rede age junto."}</h1>
          <p className="hero-description">
            {alertActive
              ? "A ocorrência foi compartilhada. Acompanhe quem recebeu, quem está a caminho e o tempo de resposta."
              : "Um alerta geolocalizado conecta quem está no campo a vizinhos, brigadas e autoridades — no instante em que cada segundo importa."}
          </p>

          <div className="impact-row" aria-label="Indicadores da rede">
            <div><strong>2,8 km</strong><span>raio de alcance</span></div>
            <div><strong>23</strong><span>pessoas na rede</span></div>
            <div><strong>&lt; 10 s</strong><span>para todos saberem</span></div>
          </div>
        </div>

        <section className="alert-panel" aria-label="Disparo de alerta">
          {!alertActive ? (
            <>
              <div className="location-row">
                <span className="location-icon" aria-hidden="true">⌖</span>
                <div>
                  <span>LOCALIZAÇÃO DETECTADA</span>
                  <strong>Talhão Norte · Fazenda Boa Esperança</strong>
                  <small>GPS preciso em 8 metros</small>
                </div>
                <span className="verified">CONFIRMADO</span>
              </div>

              <button className="alert-button" type="button" onClick={triggerAlert}>
                <span className="flame" aria-hidden="true"><i /></span>
                <span><strong>ALERTAR INCÊNDIO</strong><small>Toque para mobilizar a rede</small></span>
                <span className="arrow" aria-hidden="true">→</span>
              </button>

              <div className="alert-hint">
                <span aria-hidden="true">i</span>
                Use somente ao identificar fumaça ou fogo ativo. Sua localização será compartilhada.
              </div>
            </>
          ) : (
            <div className="active-state">
              <div className="active-heading">
                <div className="pulse-ring"><span /></div>
                <div><span>ALERTA TRANSMITIDO</span><strong>Foco ativo no Talhão Norte</strong></div>
                <time>{elapsed}</time>
              </div>
              <div className="delivery-progress"><i /></div>
              <div className="delivery-stats">
                <span><strong>23</strong> pessoas avisadas</span>
                <span><strong>2</strong> equipes acionadas</span>
                <span><strong>3</strong> confirmações</span>
              </div>
              <button className="reset-button" type="button" onClick={resetDemo}>Encerrar simulação</button>
            </div>
          )}
        </section>
      </section>

      <section className="operations" aria-label="Central de resposta">
        <div className="map-card">
          <div className="section-heading">
            <div><span>LOCAL DA OCORRÊNCIA</span><h2>Talhão Norte</h2></div>
            <div className="map-key"><span><i className="key-fire" /> foco</span><span><i className="key-range" /> alcance</span></div>
          </div>

          <div className="map" role="img" aria-label="Mapa ilustrativo do foco de incêndio e propriedades vizinhas">
            <div className="road road-one" /><div className="road road-two" />
            <div className="field field-one"><span>BOA ESPERANÇA</span></div>
            <div className="field field-two"><span>SANTA LUZIA</span></div>
            <div className="field field-three"><span>VALE VERDE</span></div>
            <div className="range-circle" />
            <div className={`fire-marker ${alertActive ? "marker-active" : ""}`}>
              <span className="marker-ripple" /><span className="marker-core"><i /></span>
              <b>FOCO DETECTADO<small>09:42 · agora</small></b>
            </div>
            <div className="responder-marker neighbor"><span>2</span><b>Vizinho<small>2 min</small></b></div>
            <div className="responder-marker brigade"><span>1</span><b>Brigada<small>6 min</small></b></div>
            <div className="coordinates">07°14&apos;32.1&quot;S · 44°33&apos;08.6&quot;W</div>
            <div className="map-scale">500 m</div>
          </div>
        </div>

        <aside className="response-card">
          <div className="section-heading">
            <div><span>REDE DE RESPOSTA</span><h2>{alertActive ? "Mobilização ao vivo" : "Quem será avisado"}</h2></div>
            <span className={`live-tag ${alertActive ? "visible" : ""}`}>AO VIVO</span>
          </div>

          <div className="responders">
            {responders.map((responder, index) => (
              <div className="responder" key={responder.name}>
                <span className={`avatar ${responder.tone}`}>{index === 0 ? "BV" : index === 1 ? "SL" : "DC"}</span>
                <div><strong>{responder.name}</strong><small>{responder.role}</small></div>
                <span className={`eta ${alertActive ? "active" : ""}`}>
                  {alertActive ? (index === 2 ? "recebido" : responder.eta) : index === 2 ? "autoridade" : responder.eta}
                </span>
              </div>
            ))}
          </div>

          <div className="response-summary">
            <div className="summary-line"><span>Alcance inteligente</span><strong>Raio de 2,8 km</strong></div>
            <div className="summary-line"><span>Canais de envio</span><strong>App + SMS</strong></div>
            <div className="summary-line"><span>Rede disponível</span><strong>98% online</strong></div>
          </div>

          <p className="offline-note"><span aria-hidden="true">↗</span> O alerta também é enviado por SMS quando não há internet.</p>
        </aside>
      </section>

      <footer>
        <p><strong>VIGIA RURAL</strong> · Tecnologia que transforma vizinhança em proteção.</p>
        <span>Conceito para o futuro do campo</span>
      </footer>

      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}
