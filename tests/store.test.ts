import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_STATE, simElapsed, type AppState } from "../lib/domain.ts";
import { nextCode, reduce, reduceAll, type Command } from "../lib/store.ts";
import { sealChain, verifyChain } from "../lib/audit.ts";

const T0 = 1_700_000_000_000;
const FOCO = { lat: -7.2445, lon: -44.5585 };

const CLIMA = {
  tempC: 36,
  humidity: 21,
  windKmh: 24,
  windFromDeg: 215,
  curing: 92,
  daysSinceRain: 13,
};

const abrir: Command = {
  type: "abrir",
  at: T0,
  incidentId: "inc_1",
  code: "VR-2026-0001",
  hostId: "t_abc",
  origin: FOCO,
  accuracyM: 9,
  parcelId: "t-05",
  evidence: "chamas",
  level: "confirmado",
  rationale: "Responsável habilitado declarou fogo ativo.",
  weather: CLIMA,
  reporter: {
    actorId: "p-joao",
    name: "João Martins",
    orgId: "org-boa-esperanca",
    role: "produtor",
  },
  drill: true,
};

const aberta = (): AppState => reduce(EMPTY_STATE, abrir);

test("abrir cria a ocorrência com o primeiro registro de auditoria", () => {
  const state = aberta();
  assert.equal(state.incidents.length, 1);
  const incident = state.incidents[0];
  assert.equal(incident.status, "aberto");
  assert.equal(incident.level, "confirmado");
  assert.equal(incident.audit.length, 1);
  assert.equal(incident.audit[0].action, "alerta.aberto");
  // Quem abre já conta como a primeira corroboração.
  assert.equal(incident.corroborations.length, 1);
});

test("reabrir o mesmo id não duplica a ocorrência", () => {
  const state = reduce(aberta(), abrir);
  assert.equal(state.incidents.length, 1);
});

test("comando sobre ocorrência inexistente não altera o estado", () => {
  const state = aberta();
  const depois = reduce(state, {
    type: "chegou",
    at: T0,
    incidentId: "inc_fantasma",
    unitId: "u-vv-pipa",
    unitName: "Pipa",
  });
  assert.equal(depois, state);
});

test("corroboração do mesmo ator e mesma fonte entra só uma vez", () => {
  const corroboration = {
    actorId: "p-josefa",
    orgId: "org-santa-luzia",
    at: FOCO,
    timestamp: T0 + 30_000,
    source: "humano" as const,
  };
  const command: Command = {
    type: "corroborar",
    at: T0 + 30_000,
    incidentId: "inc_1",
    corroboration,
    actorName: "Josefa Lima",
    label: "Josefa confirmou fumaça",
  };
  const state = reduceAll(aberta(), [command, command]);
  assert.equal(state.incidents[0].corroborations.length, 2);
});

test("o nível só sobe, nunca desce", () => {
  const state = reduceAll(aberta(), [
    {
      type: "escalar",
      at: T0 + 1000,
      incidentId: "inc_1",
      level: "emergencia",
      rationale: "Satélite validou o foco.",
      actorId: "sistema",
      actorName: "Protocolo",
    },
    {
      type: "escalar",
      at: T0 + 2000,
      incidentId: "inc_1",
      level: "suspeita",
      rationale: "Tentativa de rebaixar",
      actorId: "p-x",
      actorName: "X",
    },
  ]);
  assert.equal(state.incidents[0].level, "emergencia");
});

test("assumir comando move a ocorrência para em atendimento", () => {
  const state = reduce(aberta(), {
    type: "assumir",
    at: T0 + 5000,
    incidentId: "inc_1",
    orgId: "org-brigada",
    orgName: "Brigada Vale Verde",
    actorId: "p-marina",
    actorName: "Marina Alves",
  });
  assert.equal(state.incidents[0].commandOrgId, "org-brigada");
  assert.equal(state.incidents[0].status, "em_atendimento");
});

test("despacho registra ETA e a chegada muda o status do recurso", () => {
  const state = reduceAll(aberta(), [
    {
      type: "despachar",
      at: T0 + 6000,
      incidentId: "inc_1",
      unitId: "u-vv-pipa",
      unitName: "Pipa Vale Verde",
      etaMin: 11.4,
      actorId: "p-marina",
      actorName: "Marina Alves",
    },
    {
      type: "chegou",
      at: T0 + 700_000,
      incidentId: "inc_1",
      unitId: "u-vv-pipa",
      unitName: "Pipa Vale Verde",
    },
  ]);
  const dispatch = state.incidents[0].dispatches[0];
  assert.equal(dispatch.status, "no_local");
  assert.equal(Math.round(dispatch.etaMin), 11);
});

test("despachar o mesmo recurso duas vezes não duplica", () => {
  const command: Command = {
    type: "despachar",
    at: T0 + 6000,
    incidentId: "inc_1",
    unitId: "u-vv-pipa",
    unitName: "Pipa Vale Verde",
    etaMin: 11,
    actorId: "p-marina",
    actorName: "Marina Alves",
  };
  const state = reduceAll(aberta(), [command, command]);
  assert.equal(state.incidents[0].dispatches.length, 1);
});

test("liberar local exato grava concessão com prazo", () => {
  const state = reduce(aberta(), {
    type: "liberar-local",
    at: T0,
    incidentId: "inc_1",
    actorId: "p-marina",
    actorName: "Marina Alves",
    orgId: "org-brigada",
    ttlMin: 120,
  });
  const grant = state.incidents[0].exactGrants[0];
  assert.equal(grant.actorId, "p-marina");
  assert.equal(grant.until, T0 + 120 * 60_000);
});

test("nova concessão para o mesmo ator substitui a anterior", () => {
  const state = reduceAll(aberta(), [
    {
      type: "liberar-local",
      at: T0,
      incidentId: "inc_1",
      actorId: "p-marina",
      actorName: "Marina Alves",
      orgId: "org-brigada",
      ttlMin: 30,
    },
    {
      type: "liberar-local",
      at: T0 + 1000,
      incidentId: "inc_1",
      actorId: "p-marina",
      actorName: "Marina Alves",
      orgId: "org-brigada",
      ttlMin: 120,
    },
  ]);
  assert.equal(state.incidents[0].exactGrants.length, 1);
});

test("a confirmação de segurança de uma pessoa entra uma vez só", () => {
  const command: Command = {
    type: "seguranca",
    at: T0 + 9000,
    incidentId: "inc_1",
    actorId: "p-joao",
    actorName: "João Martins",
    orgName: "Boa Esperança",
  };
  const state = reduceAll(aberta(), [command, command]);
  const marcas = state.incidents[0].audit.filter(
    (e) => e.action === "pessoa.em-seguranca",
  );
  assert.equal(marcas.length, 1);
});

test("ação negada é registrada na trilha sem mudar a ocorrência", () => {
  const state = reduce(aberta(), {
    type: "negado",
    at: T0 + 100,
    incidentId: "inc_1",
    actorId: "p-antonio",
    actorName: "Antônio Ribeiro",
    action: "Escalar para emergência",
    reason: "Colaborador verificado não tem essa atribuição",
  });
  const incident = state.incidents[0];
  assert.equal(incident.level, "confirmado");
  assert.equal(incident.audit.at(-1)?.action, "acesso.negado");
});

test("a sequência da auditoria é global e estritamente crescente", () => {
  const state = reduceAll(aberta(), [
    {
      type: "assumir",
      at: T0 + 1,
      incidentId: "inc_1",
      orgId: "org-brigada",
      orgName: "Brigada",
      actorId: "p-marina",
      actorName: "Marina",
    },
    {
      type: "escalar",
      at: T0 + 2,
      incidentId: "inc_1",
      level: "emergencia",
      rationale: "satélite",
      actorId: "sistema",
      actorName: "Protocolo",
    },
  ]);
  const seqs = state.incidents[0].audit.map((e) => e.seq);
  assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b));
  assert.equal(new Set(seqs).size, seqs.length);
  assert.equal(state.seq, seqs.at(-1));
});

test("a versão do estado avança a cada comando aceito", () => {
  const state = aberta();
  const depois = reduce(state, {
    type: "assumir",
    at: T0 + 1,
    incidentId: "inc_1",
    orgId: "org-brigada",
    orgName: "Brigada",
    actorId: "p-marina",
    actorName: "Marina",
  });
  assert.ok(depois.version > state.version);
});

test("a trilha produzida pelo redutor passa na verificação de integridade", async () => {
  const state = reduceAll(aberta(), [
    {
      type: "assumir",
      at: T0 + 1,
      incidentId: "inc_1",
      orgId: "org-brigada",
      orgName: "Brigada",
      actorId: "p-marina",
      actorName: "Marina",
    },
    {
      type: "despachar",
      at: T0 + 2,
      incidentId: "inc_1",
      unitId: "u-vv-pipa",
      unitName: "Pipa",
      etaMin: 11,
      actorId: "p-marina",
      actorName: "Marina",
    },
  ]);
  const verdict = await verifyChain(await sealChain(state.incidents[0].audit));
  assert.equal(verdict.valid, true);
  assert.equal(verdict.checked, 3);
});

/* -------------------------------------------------------------- relógio -- */

test("o relógio simulado avança pela escala configurada", () => {
  const state = aberta();
  const clock = state.incidents[0].clock;
  assert.equal(simElapsed(clock, T0), 0);
  assert.equal(simElapsed(clock, T0 + 10_000), 10_000 * clock.scale);
});

test("mudar a escala preserva o tempo já decorrido", () => {
  const state = reduce(aberta(), {
    type: "escala",
    at: T0 + 10_000,
    incidentId: "inc_1",
    scale: 20,
  });
  const clock = state.incidents[0].clock;
  const antes = 10_000 * 6; // escala inicial
  assert.equal(simElapsed(clock, T0 + 10_000), antes);
  assert.equal(simElapsed(clock, T0 + 11_000), antes + 20_000);
});

test("o código da ocorrência é sequencial e legível", () => {
  assert.equal(nextCode(EMPTY_STATE, 2026), "VR-2026-0001");
  assert.equal(nextCode(aberta(), 2026), "VR-2026-0002");
});

test("limpar zera as ocorrências mas avança a versão", () => {
  const state = reduce(aberta(), { type: "limpar", at: T0 });
  assert.equal(state.incidents.length, 0);
  assert.ok(state.version > 0);
});
