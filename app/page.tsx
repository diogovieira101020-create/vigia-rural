"use client";

import { useEffect, useState } from "react";

type Tab = "inicio" | "mapa" | "rede" | "perfil";
type LocationState = "demo" | "loading" | "live" | "denied";
type Profile = { id: string; initials: string; name: string; type: string; person: string; role: string; accent: string };

const profiles: Profile[] = [
  { id: "farm", initials: "BE", name: "Fazenda Boa Esperança", type: "Empresa rural privada", person: "João Martins", role: "Responsável habilitado", accent: "green" },
  { id: "brigade", initials: "BV", name: "Brigada Vale Verde", type: "Brigada privada", person: "Marina Alves", role: "Chefe de brigada", accent: "amber" },
  { id: "civil", initials: "DC", name: "Defesa Civil · Uruçuí", type: "Órgão público municipal", person: "Carlos Nunes", role: "Coordenador de plantão", accent: "blue" },
];

const network = [
  { initials: "SL", name: "Fazenda Santa Luzia", type: "Propriedade vizinha", distance: "1,2 km", status: "Online", accent: "sand" },
  { initials: "BV", name: "Brigada Vale Verde", type: "Brigada privada · 8 membros", distance: "6 min", status: "Pronta", accent: "amber" },
  { initials: "DC", name: "Defesa Civil · Uruçuí", type: "Órgão público", distance: "Plantão", status: "Online", accent: "blue" },
  { initials: "BM", name: "Corpo de Bombeiros", type: "Resposta pública regional", distance: "Regional", status: "Integrado", accent: "red" },
];

const navItems: { id: Tab; label: string; symbol: string }[] = [
  { id: "inicio", label: "Início", symbol: "⌂" }, { id: "mapa", label: "Mapa", symbol: "⌖" },
  { id: "rede", label: "Rede", symbol: "◎" }, { id: "perfil", label: "Perfil", symbol: "●" },
];

const DEMO_MAP_URL = "https://www.openstreetmap.org/export/embed.html?bbox=-44.57039%2C-7.25425%2C-44.53425%2C-7.23025&layer=mapnik&marker=-7.24225%2C-44.55239";

function formatElapsed(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("inicio");
  const [activeProfile, setActiveProfile] = useState(profiles[0]);
  const [profilePicker, setProfilePicker] = useState(false);
  const [confirmSheet, setConfirmSheet] = useState(false);
  const [visualConfirmation, setVisualConfirmation] = useState(false);
  const [evidence, setEvidence] = useState<"smoke" | "flames">("flames");
  const [alertActive, setAlertActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [safe, setSafe] = useState(false);
  const [toast, setToast] = useState("");
  const [coords, setCoords] = useState({ lat: -7.24225, lon: -44.55239 });
  const [accuracy, setAccuracy] = useState(8);
  const [locationState, setLocationState] = useState<LocationState>("demo");

  useEffect(() => {
    if (!alertActive) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [alertActive]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const mapUrl = DEMO_MAP_URL;

  const requestLocation = () => {
    if (!("geolocation" in navigator)) { setLocationState("denied"); setToast("GPS indisponível neste dispositivo"); return; }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => { setCoords({ lat: position.coords.latitude, lon: position.coords.longitude }); setAccuracy(Math.round(position.coords.accuracy)); setLocationState("live"); setToast("Localização atualizada com precisão"); },
      () => { setLocationState("denied"); setToast("Permissão não concedida — mantendo o local demonstrativo"); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  const openAlertFlow = () => { setVisualConfirmation(false); setEvidence("flames"); setConfirmSheet(true); };
  const sendAlert = () => { if (!visualConfirmation) return; setAlertActive(true); setSeconds(0); setSafe(false); setConfirmSheet(false); setTab("inicio"); setToast("Alerta enviado · rede mobilizada"); };
  const reportSuspicion = () => { setConfirmSheet(false); setToast("Suspeita registrada · aguardando segunda confirmação"); };
  const resetDemo = () => { setAlertActive(false); setSeconds(0); setSafe(false); setToast("Simulação encerrada com registro preservado"); };

  return (
    <div className={`platform ${alertActive ? "alert-mode" : ""}`}>
      <aside className="desktop-rail rail-left" aria-label="Apresentação do produto">
        <a className="wordmark" href="#app" aria-label="Vigia Rural"><span className="wordmark-symbol"><i /></span><span>Vigia <strong>Rural</strong></span></a>
        <div className="rail-copy"><span className="rail-kicker">RESPOSTA COOPERATIVA</span><h1>O campo<br />responde junto.</h1><p>Alerta preciso, pessoas certas e uma única visão da ocorrência.</p></div>
        <div className="rail-foot"><span className="network-pulse" />Rede demonstrativa ativa</div>
      </aside>

      <main className="mobile-app" id="app">
        <div className="device-status" aria-hidden="true"><span>9:41</span><span className="device-signal">▮▮▮ ᯤ ●</span></div>
        <header className="app-header">
          <button className="mini-brand" type="button" onClick={() => setTab("inicio")} aria-label="Ir para o início"><span className="mini-logo"><i /></span><span>Vigia Rural</span></button>
          <button className="profile-avatar" type="button" onClick={() => setProfilePicker(true)} aria-label="Trocar perfil">{activeProfile.initials}<i /></button>
        </header>

        <div className="app-content">
          {tab === "inicio" && (
            <section className="screen home-screen" aria-labelledby="home-title">
              {!alertActive ? (
                <>
                  <div className="screen-title"><p>Bom dia, {activeProfile.person.split(" ")[0]}</p><h2 id="home-title">Tudo pronto<br />para proteger.</h2></div>
                  <button className="readiness-card" type="button" onClick={() => setTab("mapa")}><div className="readiness-icon"><span /></div><div><strong>Região monitorada</strong><span>Rede ativa · 23 pessoas próximas</span></div><span className="chevron">›</span></button>
                  <div className="emergency-zone">
                    <span className="emergency-label">EM CASO DE FOGO</span>
                    <button className="fire-action" type="button" onClick={openAlertFlow} aria-label="Iniciar alerta de incêndio"><span className="fire-glyph"><i /></span><strong>Detectei<br />fogo</strong><small>toque para confirmar</small></button>
                    <button className="suspicion-link" type="button" onClick={reportSuspicion}>Só vejo fumaça ou algo suspeito<span>Relatar sem alarmar a rede ›</span></button>
                  </div>
                  <button className="location-card" type="button" onClick={() => setTab("mapa")}><span className="pin-symbol">⌖</span><div><small>LOCAL PRONTO PARA O ALERTA</small><strong>{locationState === "live" ? "Minha localização atual" : "Talhão Norte · Boa Esperança"}</strong><span>GPS com precisão de {accuracy} m</span></div><span className="location-lock">Seguro</span></button>
                  <div className="trust-strip"><span className="trust-check">✓</span><p><strong>{activeProfile.role}</strong><br />Identidade e vínculo verificados</p><button type="button" onClick={() => setTab("perfil")}>ver</button></div>
                </>
              ) : <ActiveAlert elapsed={formatElapsed(seconds)} mapUrl={mapUrl} safe={safe} setSafe={setSafe} resetDemo={resetDemo} setTab={setTab} />}
            </section>
          )}
          {tab === "mapa" && (
            <section className="screen map-screen" aria-labelledby="map-title">
              <div className="screen-title compact-title"><p>Localização protegida</p><h2 id="map-title">Mapa da operação</h2></div>
              <div className="real-map large-map">
                <iframe src={mapUrl} title="Mapa demonstrativo OpenStreetMap da área operacional" loading="lazy" />
                <div className="map-top-overlay"><span className="map-dot" /> GPS local · {accuracy} m</div>
                <button className="locate-button" type="button" onClick={requestLocation} disabled={locationState === "loading"}>{locationState === "loading" ? "Localizando…" : "⌖"}</button>
              </div>
              <div className="map-address">
                <div><span className="pin-symbol">⌖</span><p><strong>{locationState === "live" ? "Posição capturada no aparelho" : "Talhão Norte"}</strong><small>Fazenda Boa Esperança · Uruçuí, PI</small></p></div>
                <button type="button" onClick={requestLocation}>Atualizar</button>
              </div>
              <div className="coordinate-row">
                <div><small>LATITUDE</small><strong>{coords.lat.toFixed(5)}</strong></div>
                <div><small>LONGITUDE</small><strong>{coords.lon.toFixed(5)}</strong></div>
                <div><small>PRECISÃO</small><strong>± {accuracy} m</strong></div>
              </div>
              <section className="privacy-card"><span className="shield-icon">✓</span><div><strong>Coordenadas ficam no aplicativo</strong><p>O mapa externo usa apenas a área demonstrativa. A posição exata só seria liberada a envolvidos autenticados durante um alerta.</p></div></section>
              <p className="map-credit">Base demonstrativa por OpenStreetMap · GPS exato não é enviado ao provedor do mapa</p>
            </section>
          )}

          {tab === "rede" && (
            <section className="screen network-screen" aria-labelledby="network-title">
              <div className="screen-title compact-title"><p>Cooperação verificada</p><h2 id="network-title">Sua rede de resposta</h2></div>
              <div className="network-summary"><div><strong>23</strong><span>pessoas</span></div><div><strong>4</strong><span>instituições</span></div><div><strong>2,8</strong><span>km de alcance</span></div></div>
              <div className="section-label"><span>PRONTOS PARA RESPONDER</span><button type="button">Gerenciar</button></div>
              <div className="entity-list">
                {network.map((entity) => <article className="entity-row" key={entity.name}><span className={`entity-avatar ${entity.accent}`}>{entity.initials}<i /></span><div><strong>{entity.name}</strong><small>{entity.type}</small></div><p><strong>{entity.status}</strong><small>{entity.distance}</small></p></article>)}
              </div>
              <section className="governance-card"><span className="governance-number">2</span><div><strong>Dois níveis evitam alarmes falsos</strong><p>Qualquer membro verificado relata uma suspeita. Somente responsáveis habilitados, brigadistas e autoridades ativam o alerta geral.</p></div></section>
            </section>
          )}

          {tab === "perfil" && (
            <section className="screen profile-screen" aria-labelledby="profile-title">
              <div className="screen-title compact-title"><p>Conta institucional</p><h2 id="profile-title">Perfil e segurança</h2></div>
              <button className="organization-card" type="button" onClick={() => setProfilePicker(true)}><span className={`organization-avatar ${activeProfile.accent}`}>{activeProfile.initials}</span><div><small>{activeProfile.type.toUpperCase()}</small><strong>{activeProfile.name}</strong><span>Verificada · trocar perfil</span></div><span className="chevron">›</span></button>
              <div className="responsible-card"><div className="person-avatar">{activeProfile.person.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><small>RESPONSÁVEL DA SESSÃO</small><strong>{activeProfile.person}</strong><span>{activeProfile.role}</span></div><span className="verified-seal">✓</span></div>
              <div className="section-label"><span>CENTRO DE CONFIANÇA</span><small>4 proteções ativas</small></div>
              <div className="settings-list">
                <SecurityRow symbol="◉" title="Acesso forte" detail="Biometria ou chave do dispositivo" status="Ativo" />
                <SecurityRow symbol="⌖" title="Privacidade de localização" detail="Exata somente durante alertas" status="Protegida" />
                <SecurityRow symbol="≡" title="Registro auditável" detail="Toda ação recebe autor, hora e local" status="Ativo" />
                <SecurityRow symbol="↻" title="Detecção de abuso" detail="Limites e análise de alertas atípicos" status="Ativa" />
              </div>
              <p className="lgpd-note"><span>✓</span> Arquitetura proposta com acesso por função, minimização de dados e práticas alinhadas à LGPD.</p>
            </section>
          )}
        </div>

        <nav className="bottom-nav" aria-label="Navegação principal">
          {navItems.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} type="button" onClick={() => setTab(item.id)} aria-current={tab === item.id ? "page" : undefined}><span>{item.symbol}</span>{item.label}</button>)}
        </nav>
      </main>

      <aside className="desktop-rail rail-right" aria-label="Regras de confiança">
        <span className="rail-kicker">RÁPIDO, NÃO IMPULSIVO</span><h2>Quem pode<br />acionar?</h2>
        <div className="authority-list"><div><span>01</span><p><strong>Qualquer usuário verificado</strong><small>registra uma suspeita</small></p></div><div><span>02</span><p><strong>Responsável ou brigadista</strong><small>ativa o alerta amplo</small></p></div><div><span>03</span><p><strong>Autoridade pública</strong><small>amplia ou encerra</small></p></div></div>
        <p className="rail-security"><span>✓</span> Identidade, GPS e cada decisão ficam registrados.</p>
      </aside>
      {confirmSheet && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmSheet(false)}>
          <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <span className="sheet-handle" /><button className="sheet-close" type="button" onClick={() => setConfirmSheet(false)} aria-label="Fechar">×</button>
            <p className="sheet-kicker">CONFIRMAÇÃO DE EMERGÊNCIA</p><h2 id="confirm-title">Você confirma fogo ativo?</h2>
            <p className="sheet-intro">Essa segunda ação evita toques acidentais e registra o contexto do alerta.</p>
            <div className="evidence-picker" role="group" aria-label="Tipo de evidência observada">
              <button className={evidence === "flames" ? "selected" : ""} type="button" onClick={() => setEvidence("flames")}><span className="tiny-flame"><i /></span><strong>Vejo chamas</strong></button>
              <button className={evidence === "smoke" ? "selected" : ""} type="button" onClick={() => setEvidence("smoke")}><span className="smoke-symbol">≈</span><strong>Vejo fumaça</strong></button>
            </div>
            <div className="verification-stack">
              <div><span className="verify-icon">✓</span><p><strong>Identidade habilitada</strong><small>{activeProfile.person} · {activeProfile.role}</small></p></div>
              <div><span className="verify-icon">⌖</span><p><strong>Localização anexada</strong><small>{coords.lat.toFixed(5)}, {coords.lon.toFixed(5)} · ± {accuracy} m</small></p></div>
              <label className={visualConfirmation ? "checked" : ""}>
                <input type="checkbox" checked={visualConfirmation} onChange={(event) => setVisualConfirmation(event.target.checked)} />
                <span className="checkbox-mark">✓</span><p><strong>Confirmo que estou vendo o foco</strong><small>Declaro que as informações são verdadeiras.</small></p>
              </label>
            </div>
            <button className="send-alert" type="button" disabled={!visualConfirmation} onClick={sendAlert}>Enviar alerta de emergência</button>
            <button className="report-only" type="button" onClick={reportSuspicion}>Não tenho certeza · registrar só como suspeita</button>
          </section>
        </div>
      )}

      {profilePicker && (
        <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setProfilePicker(false)}>
          <section className="bottom-sheet profile-sheet" role="dialog" aria-modal="true" aria-labelledby="profile-picker-title">
            <span className="sheet-handle" /><button className="sheet-close" type="button" onClick={() => setProfilePicker(false)} aria-label="Fechar">×</button>
            <p className="sheet-kicker">PERFIS DEMONSTRATIVOS</p><h2 id="profile-picker-title">Entrar como organização</h2>
            <p className="sheet-intro">Cada perfil recebe permissões compatíveis com sua função e território.</p>
            <div className="profile-options">
              {profiles.map((profile) => (
                <button key={profile.id} className={profile.id === activeProfile.id ? "selected" : ""} type="button" onClick={() => { setActiveProfile(profile); setProfilePicker(false); setToast(`Perfil alterado para ${profile.name}`); }}>
                  <span className={`organization-avatar ${profile.accent}`}>{profile.initials}</span><p><small>{profile.type}</small><strong>{profile.name}</strong><span>{profile.role}</span></p><i>{profile.id === activeProfile.id ? "✓" : "›"}</i>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </div>
  );
}

function ActiveAlert({ elapsed, mapUrl, safe, setSafe, resetDemo, setTab }: { elapsed: string; mapUrl: string; safe: boolean; setSafe: (value: boolean) => void; resetDemo: () => void; setTab: (tab: Tab) => void }) {
  return (
    <div className="active-alert-view">
      <div className="active-alert-heading"><div><span className="live-pulse" /><p>ALERTA EM ANDAMENTO</p></div><time>{elapsed}</time></div>
      <h2>Foco no<br />Talhão Norte</h2><p className="active-subtitle">Rede mobilizada · atualização há poucos segundos</p>
      <button className="real-map active-map" type="button" onClick={() => setTab("mapa")} aria-label="Abrir mapa da ocorrência">
        <iframe src={mapUrl} title="Mapa demonstrativo do alerta" tabIndex={-1} /><span className="fire-map-pin"><i /></span><span className="active-map-label">Ver mapa completo <b>›</b></span>
      </button>
      <div className="alert-metrics"><div><strong>23</strong><span>avisados</span></div><div><strong>3</strong><span>confirmaram</span></div><div><strong>2</strong><span>equipes a caminho</span></div></div>
      <div className="response-timeline">
        <div className="timeline-item done"><span>✓</span><p><strong>Alerta entregue à rede</strong><small>App e SMS · agora</small></p></div>
        <div className="timeline-item moving"><span>↗</span><p><strong>Fazenda Santa Luzia</strong><small>Vizinho confirmou · 2 min</small></p></div>
        <div className="timeline-item moving"><span>↗</span><p><strong>Brigada Vale Verde</strong><small>Equipe a caminho · chegada em 6 min</small></p></div>
        <div className="timeline-item"><span>•</span><p><strong>Defesa Civil</strong><small>Ocorrência recebida</small></p></div>
      </div>
      <button className={`safety-button ${safe ? "confirmed" : ""}`} type="button" onClick={() => setSafe(true)}>{safe ? "✓ Sua segurança foi confirmada" : "Estou em local seguro"}</button>
      <button className="end-demo" type="button" onClick={resetDemo}>Encerrar simulação</button>
    </div>
  );
}

function SecurityRow({ symbol, title, detail, status }: { symbol: string; title: string; detail: string; status: string }) {
  return <div className="security-row"><span className="setting-icon">{symbol}</span><div><strong>{title}</strong><small>{detail}</small></div><span className="setting-status">{status}</span></div>;
}
