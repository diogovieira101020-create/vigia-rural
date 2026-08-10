/**
 * Laudo da ocorrência.
 *
 * A trilha de auditoria é a fonte da verdade; o laudo é apenas a mesma
 * informação formatada para ser lida por gente que não vai abrir o app —
 * a seguradora, o órgão ambiental, o próprio produtor arquivando o caso.
 * Texto simples e determinístico: o mesmo incidente sempre gera o mesmo
 * laudo, byte a byte, o que importa quando o arquivo vira anexo de processo.
 */

import { formatClock, formatHa, formatLatLon } from "./geo.ts";
import { LEVEL_LABEL, ROLE_LABEL } from "./policy.ts";
import { STATUS_LABEL, type Incident } from "./domain.ts";
import { orgById, parcelById, unitById } from "./scenario.ts";
import { front } from "./selectors.ts";

const line = (width = 62) => "-".repeat(width);

function section(title: string): string {
  return `\n${title.toUpperCase()}\n${line(title.length)}\n`;
}

/** Gera o laudo em texto simples a partir do estado final do incidente. */
export function buildReport(incident: Incident, generatedAt: number): string {
  const fire = front(incident, incident.updatedAt);
  const parcel = parcelById(incident.parcelId);
  const reporterOrg = orgById(incident.reporter.orgId);
  const commandOrg = incident.commandOrgId
    ? orgById(incident.commandOrgId)
    : null;

  const out: string[] = [];
  out.push(line());
  out.push(`LAUDO DE OCORRÊNCIA — ${incident.code}`);
  out.push(line());
  out.push(`Gerado em: ${new Date(generatedAt).toLocaleString("pt-BR")}`);
  out.push(
    `Documento gerado a partir da trilha de auditoria encadeada (SHA-256) ` +
      `registrada no Vigia Rural. ${incident.drill ? "SIMULAÇÃO — não representa ocorrência real." : ""}`,
  );

  out.push(section("Identificação"));
  out.push(`Código operacional: ${incident.code}`);
  out.push(`Nível final: ${LEVEL_LABEL[incident.level]}`);
  out.push(`Status: ${STATUS_LABEL[incident.status]}`);
  if (incident.outcome) out.push(`Desfecho: ${incident.outcome}`);
  out.push(
    `Local: ${parcel ? `${parcel.name} · ` : ""}${reporterOrg.name}`,
  );
  out.push(`Coordenada: ${formatLatLon(incident.origin)} (± ${incident.accuracyM} m)`);
  if (incident.note) out.push(`Referência informada: "${incident.note}"`);

  out.push(section("Relato inicial"));
  out.push(
    `${incident.reporter.name} (${ROLE_LABEL[incident.reporter.role]}, ${reporterOrg.name})`,
  );
  out.push(`Evidência declarada: ${incident.evidence}`);
  out.push(
    `Aberto em: ${new Date(incident.openedAt).toLocaleString("pt-BR")}`,
  );

  out.push(section("Condições meteorológicas"));
  out.push(`Temperatura: ${incident.weather.tempC} °C`);
  out.push(`Umidade relativa: ${incident.weather.humidity} %`);
  out.push(
    `Vento: ${incident.weather.windKmh} km/h, de ${incident.weather.windFromDeg}°`,
  );
  out.push(`Dias sem chuva: ${incident.weather.daysSinceRain}`);

  out.push(section("Extensão estimada"));
  out.push(`Área atingida (projeção do modelo): ${formatHa(fire.areaHa)}`);
  out.push(`Perímetro estimado: ${Math.round(fire.perimeterM)} m`);
  out.push(
    `Duração até o encerramento: ${formatClock((incident.updatedAt - incident.openedAt) / 1000 * incident.clock.scale)} (tempo simulado)`,
  );

  out.push(section("Corroborações"));
  if (incident.corroborations.length === 0) out.push("Nenhuma corroboração registrada.");
  for (const c of incident.corroborations) {
    const org = c.source === "humano" ? orgById(c.orgId).name : c.orgId;
    out.push(
      `• ${new Date(c.timestamp).toLocaleTimeString("pt-BR")} — fonte ${c.source} (${org})`,
    );
  }

  out.push(section("Comando e recursos despachados"));
  out.push(`Comando assumido por: ${commandOrg ? commandOrg.name : "não assumido"}`);
  if (incident.dispatches.length === 0) out.push("Nenhum recurso despachado.");
  for (const d of incident.dispatches) {
    const unit = unitById(d.unitId);
    const org = orgById(unit.orgId);
    out.push(
      `• ${unit.name} (${org.name}) — status: ${d.status} — ETA registrada: ${Math.round(d.etaMin)} min`,
    );
  }

  out.push(section("Trilha de auditoria (encadeada por hash)"));
  out.push(
    `${incident.audit.length} eventos. Integridade verificável a partir do registro nº 1 (gênesis) até nº ${incident.audit.length}.`,
  );
  for (const event of incident.audit) {
    out.push(
      `#${event.seq} · ${new Date(event.ts).toLocaleString("pt-BR")} · ${event.actorName} · ${event.summary}`,
    );
  }

  out.push(section("Liberações de coordenada exata"));
  if (incident.exactGrants.length === 0) out.push("Nenhuma liberação registrada.");
  for (const grant of incident.exactGrants) {
    out.push(
      `• ${orgById(grant.orgId).name} — válida até ${new Date(grant.until).toLocaleString("pt-BR")}`,
    );
  }

  out.push("\n" + line());
  out.push(
    "Este documento é gerado automaticamente pela plataforma Vigia Rural e " +
      "reflete o estado da trilha de auditoria no momento da exportação.",
  );
  out.push(line());

  return out.join("\n");
}

/** Nome de arquivo determinístico para o laudo. */
export function reportFileName(incident: Incident): string {
  return `laudo-${incident.code.toLowerCase()}.txt`;
}

/** Dispara o download de um arquivo de texto no navegador. */
export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Adia a revogação: alguns navegadores iniciam o download de forma
  // assíncrona e revogar a URL antes disso corrompe o arquivo salvo.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
