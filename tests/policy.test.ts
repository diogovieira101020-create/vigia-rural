import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotifyPlan,
  can,
  evaluateEscalation,
  independentCorroborations,
  LEVEL_REACH,
  withinScope,
  type Actor,
  type Corroboration,
} from "../lib/policy.ts";
import { bearingDeg, destination } from "../lib/geo.ts";

const FAZENDA = { lat: -7.24, lon: -44.54 };
const FOCO = { lat: -7.2445, lon: -44.5585 };

const produtor: Actor = {
  id: "p-joao",
  name: "João Martins",
  orgId: "org-boa-esperanca",
  role: "produtor",
  scope: { kind: "propriedade", propertyIds: ["org-boa-esperanca"] },
  verified: true,
  reputation: 92,
};

const colaborador: Actor = {
  ...produtor,
  id: "p-antonio",
  name: "Antônio Ribeiro",
  role: "operador",
  reputation: 78,
};

const coordenador: Actor = {
  id: "p-marina",
  name: "Marina Alves",
  orgId: "org-brigada",
  role: "coordenador",
  scope: { kind: "raio", center: { lat: -7.2105, lon: -44.5735 }, radiusKm: 45 },
  verified: true,
  reputation: 96,
};

const autoridade: Actor = {
  id: "p-carlos",
  name: "Carlos Nunes",
  orgId: "org-defesa-civil",
  role: "autoridade",
  scope: { kind: "regional" },
  verified: true,
  reputation: 99,
};

const now = 1_700_000_000_000;

const humano = (actorId: string, orgId: string, offsetMs = 0): Corroboration => ({
  actorId,
  orgId,
  at: FOCO,
  timestamp: now - offsetMs,
  source: "humano",
});

/* ------------------------------------------------------------ autorização */

test("identidade não verificada bloqueia qualquer ação", () => {
  const decision = can({ ...produtor, verified: false }, "alerta:suspeita");
  assert.equal(decision.allowed, false);
  assert.ok(decision.allowed === false && decision.reason.includes("verificada"));
});

test("colaborador relata suspeita mas não confirma fogo", () => {
  assert.equal(can(colaborador, "alerta:suspeita").allowed, true);
  const negado = can(colaborador, "alerta:confirmar");
  assert.equal(negado.allowed, false);
  // A negativa precisa dizer o que fazer, não só que não pode.
  assert.ok(negado.allowed === false && (negado.hint ?? "").length > 10);
});

test("produtor confirma na própria propriedade e não fora dela", () => {
  assert.equal(
    can(produtor, "alerta:confirmar", {
      at: FOCO,
      propertyId: "org-boa-esperanca",
    }).allowed,
    true,
  );
  assert.equal(
    can(produtor, "alerta:confirmar", {
      at: FOCO,
      propertyId: "org-santa-luzia",
    }).allowed,
    false,
  );
});

test("produtor não escala emergência regional; coordenador e autoridade sim", () => {
  assert.equal(can(produtor, "alerta:emergencia").allowed, false);
  assert.equal(can(coordenador, "alerta:emergencia").allowed, true);
  assert.equal(can(autoridade, "alerta:emergencia").allowed, true);
});

test("reputação baixa derruba o escalonamento amplo", () => {
  const queimado = { ...coordenador, reputation: 22 };
  const decision = can(queimado, "alerta:emergencia");
  assert.equal(decision.allowed, false);
  assert.ok(decision.allowed === false && decision.reason.includes("Reputação"));
});

test("escopo territorial respeita propriedade, raio e região", () => {
  assert.equal(withinScope(produtor, FOCO, "org-boa-esperanca"), true);
  assert.equal(withinScope(produtor, FOCO, "org-tres-irmaos"), false);
  assert.equal(withinScope(coordenador, FOCO), true);
  assert.equal(
    withinScope(coordenador, { lat: -6.0, lon: -43.0 }),
    false,
  );
  assert.equal(withinScope(autoridade, { lat: -6.0, lon: -43.0 }), true);
});

/* -------------------------------------------------------------- quórum -- */

test("várias pessoas da mesma organização contam como uma fonte", () => {
  const sources = independentCorroborations({
    actor: produtor,
    origin: FOCO,
    corroborations: [
      humano("a", "org-boa-esperanca"),
      humano("b", "org-boa-esperanca"),
      humano("c", "org-boa-esperanca"),
    ],
    now,
    riskIndex: 40,
  });
  assert.equal(sources, 1);
});

test("organizações distintas somam fontes independentes", () => {
  const sources = independentCorroborations({
    actor: produtor,
    origin: FOCO,
    corroborations: [
      humano("a", "org-boa-esperanca"),
      humano("b", "org-santa-luzia"),
    ],
    now,
    riskIndex: 40,
  });
  assert.equal(sources, 2);
});

test("corroboração antiga ou distante não conta", () => {
  const velha = independentCorroborations({
    actor: produtor,
    origin: FOCO,
    corroborations: [humano("a", "org-santa-luzia", 20 * 60_000)],
    now,
    riskIndex: 40,
  });
  const longe = independentCorroborations({
    actor: produtor,
    origin: FOCO,
    corroborations: [
      { ...humano("a", "org-santa-luzia"), at: { lat: -7.1, lon: -44.4 } },
    ],
    now,
    riskIndex: 40,
  });
  assert.equal(velha, 0);
  assert.equal(longe, 0);
});

/* -------------------------------------------------------- escalonamento -- */

test("relato isolado de colaborador fica em suspeita", () => {
  const result = evaluateEscalation({
    actor: colaborador,
    origin: FOCO,
    propertyId: "org-boa-esperanca",
    corroborations: [],
    now,
    riskIndex: 40,
  });
  assert.equal(result.level, "suspeita");
  assert.ok(result.nextStep);
});

test("produtor habilitado eleva para confirmado", () => {
  const result = evaluateEscalation({
    actor: produtor,
    origin: FOCO,
    propertyId: "org-boa-esperanca",
    corroborations: [],
    now,
    riskIndex: 40,
  });
  assert.equal(result.level, "confirmado");
});

test("quórum de duas organizações eleva mesmo sem papel habilitado", () => {
  const result = evaluateEscalation({
    actor: colaborador,
    origin: FOCO,
    propertyId: "org-boa-esperanca",
    corroborations: [
      humano("a", "org-boa-esperanca"),
      humano("b", "org-santa-luzia"),
    ],
    now,
    riskIndex: 5,
  });
  assert.equal(result.level, "confirmado");
  assert.equal(result.independentSources, 2);
});

test("satélite mais quórum em dia crítico chega a emergência", () => {
  const result = evaluateEscalation({
    actor: colaborador,
    origin: FOCO,
    propertyId: "org-boa-esperanca",
    corroborations: [
      humano("a", "org-boa-esperanca"),
      { ...humano("sat", "inpe"), source: "satelite" },
    ],
    now,
    riskIndex: 47,
  });
  assert.equal(result.level, "emergencia");
});

test("autoridade com duas fontes chega a emergência", () => {
  const result = evaluateEscalation({
    actor: autoridade,
    origin: FOCO,
    corroborations: [
      humano("a", "org-boa-esperanca"),
      humano("b", "org-santa-luzia"),
    ],
    now,
    riskIndex: 12,
  });
  assert.equal(result.level, "emergencia");
});

test("autoridade sozinha, sem corroboração, não pula para emergência", () => {
  const result = evaluateEscalation({
    actor: autoridade,
    origin: FOCO,
    corroborations: [],
    now,
    riskIndex: 12,
  });
  assert.equal(result.level, "confirmado");
});

/* ------------------------------------------------------------- alcance -- */

test("nível maior alcança mais longe e por mais canais", () => {
  assert.ok(LEVEL_REACH.emergencia.radiusKm > LEVEL_REACH.confirmado.radiusKm);
  assert.ok(LEVEL_REACH.confirmado.radiusKm > LEVEL_REACH.suspeita.radiusKm);
  assert.ok(
    LEVEL_REACH.emergencia.channels.length >
      LEVEL_REACH.suspeita.channels.length,
  );
});

test("o plano de notificação põe quem está a favor do vento na primeira onda", () => {
  const heading = 35; // vento de sudoeste empurrando para nordeste
  const aFavor = destination(FOCO, heading, 3000);
  const atras = destination(FOCO, (heading + 180) % 360, 3000);
  const plan = buildNotifyPlan(
    "confirmado",
    FOCO,
    heading,
    [
      { id: "atras", name: "Vizinho a barlavento", at: atras, kind: "vizinho" },
      { id: "favor", name: "Vizinho a sotavento", at: aFavor, kind: "vizinho" },
      { id: "brigada", name: "Brigada", at: FAZENDA, kind: "brigada" },
    ],
    bearingDeg,
  );
  assert.equal(plan[0].target.id, "favor");
  assert.equal(plan[0].wave, 1);
  assert.equal(plan[0].downwind, true);

  // A brigada está mais perto e também a favor do vento, mas continua na onda
  // 2: ela é recurso de combate, não gente para tirar do caminho.
  const brigada = plan.find((p) => p.target.id === "brigada");
  assert.ok(brigada);
  assert.equal(brigada.wave, 2);

  // Vizinho a barlavento é avisado por último, e o motivo diz por quê.
  const atrasPlan = plan.find((p) => p.target.id === "atras");
  assert.equal(atrasPlan?.wave, 3);
  assert.ok((atrasPlan?.reason ?? "").includes("fora da linha do vento"));
});

test("quem está fora do raio do nível não é notificado", () => {
  const longe = destination(FOCO, 90, 40_000);
  const plan = buildNotifyPlan(
    "suspeita",
    FOCO,
    35,
    [{ id: "longe", name: "Fazenda distante", at: longe, kind: "vizinho" }],
    bearingDeg,
  );
  assert.equal(plan.length, 0);
});
