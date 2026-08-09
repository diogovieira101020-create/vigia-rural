import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRisk,
  dailyRisk,
  fineFuelMoisture,
  fireFront,
  frontPolygon,
  monteAlegrePlus,
  moistureCoefficient,
  rainAbatement,
  spreadModel,
  timeToReachMin,
  windToDeg,
  type Weather,
} from "../lib/fire.ts";
import { destination, distanceM, polygonAreaHa } from "../lib/geo.ts";

const ORIGIN = { lat: -7.2445, lon: -44.5585 };

const TARDE_CRITICA: Weather = {
  tempC: 36,
  humidity: 21,
  windKmh: 24,
  windFromDeg: 215,
  curing: 92,
  daysSinceRain: 13,
};

test("umidade do material fino cai com calor e sobe com UR", () => {
  const seco = fineFuelMoisture(38, 18);
  const umido = fineFuelMoisture(24, 70);
  assert.ok(seco < umido);
  assert.ok(seco > 0 && umido < 40);
});

test("acima de 20 % de umidade o modelo não sustenta propagação", () => {
  assert.equal(moistureCoefficient(22, 20), 0);
  // Só madrugada fria e saturada leva o material fino além de 20 %: a fórmula
  // é calibrada para pastagem exposta ao sol, e num dia quente o capim seca
  // mesmo com UR alta — motivo pelo qual incêndio de pasto ocorre fora da seca.
  const madrugadaFria = spreadModel({
    ...TARDE_CRITICA,
    tempC: 12,
    humidity: 100,
  });
  assert.equal(madrugadaFria.headRosMMin, 0);
});

test("pasto verde quase não propaga, mesmo com vento forte", () => {
  const verde = spreadModel({ ...TARDE_CRITICA, curing: 10 });
  const curado = spreadModel(TARDE_CRITICA);
  assert.ok(verde.headRosMMin < curado.headRosMMin / 100);
});

test("a tarde crítica produz uma cabeça de fogo na faixa esperada", () => {
  const model = spreadModel(TARDE_CRITICA);
  // Incêndio em pastagem curada com 24 km/h: dezenas de metros por minuto.
  assert.ok(
    model.headRosMMin > 50 && model.headRosMMin < 160,
    `fora da faixa plausível: ${model.headRosMMin} m/min`,
  );
  assert.ok(model.backRosMMin < model.headRosMMin / 10);
  assert.ok(model.lengthToBreadth > 3);
});

test("mais vento significa frente mais rápida e elipse mais alongada", () => {
  const calmo = spreadModel({ ...TARDE_CRITICA, windKmh: 8 });
  const forte = spreadModel({ ...TARDE_CRITICA, windKmh: 32 });
  assert.ok(forte.headRosMMin > calmo.headRosMMin);
  assert.ok(forte.lengthToBreadth > calmo.lengthToBreadth);
});

test("a direção de propagação é oposta à de origem do vento", () => {
  assert.equal(windToDeg({ windFromDeg: 215 }), 35);
  assert.equal(windToDeg({ windFromDeg: 10 }), 190);
});

test("a área cresce com o quadrado do tempo em propagação livre", () => {
  const model = spreadModel(TARDE_CRITICA);
  const dez = fireFront(model, 10).areaHa;
  const vinte = fireFront(model, 20).areaHa;
  assert.ok(Math.abs(vinte / dez - 4) < 0.02, `razão obtida: ${vinte / dez}`);
  assert.ok(fireFront(model, 0).areaHa === 0);
});

test("o polígono da frente tem a área que o modelo declara", () => {
  const model = spreadModel(TARDE_CRITICA);
  const front = fireFront(model, 12);
  const ring = frontPolygon(ORIGIN, model, 12, 96);
  const ha = polygonAreaHa(ring);
  assert.ok(
    Math.abs(ha - front.areaHa) / front.areaHa < 0.02,
    `polígono ${ha} ha vs modelo ${front.areaHa} ha`,
  );
});

test("o ponto mais avançado do polígono fica a favor do vento", () => {
  const model = spreadModel(TARDE_CRITICA);
  const ring = frontPolygon(ORIGIN, model, 10, 64);
  const longe = ring.reduce((best, p) =>
    distanceM(ORIGIN, p) > distanceM(ORIGIN, best) ? p : best,
  );
  const front = fireFront(model, 10);
  assert.ok(Math.abs(distanceM(ORIGIN, longe) - front.headDistanceM) < 5);
});

test("tempo até um alvo diretamente a favor do vento bate com a velocidade", () => {
  const model = spreadModel(TARDE_CRITICA);
  const alvo = destination(ORIGIN, model.headingDeg, 1200);
  const t = timeToReachMin(ORIGIN, model, alvo);
  assert.ok(t !== null);
  const esperado = 1200 / model.headRosMMin;
  assert.ok(
    Math.abs((t as number) - esperado) / esperado < 0.02,
    `esperado ~${esperado} min, obtido ${t}`,
  );
});

test("alvo contra o vento demora muito mais que alvo a favor", () => {
  const model = spreadModel(TARDE_CRITICA);
  const favor = timeToReachMin(
    ORIGIN,
    model,
    destination(ORIGIN, model.headingDeg, 900),
  );
  const contra = timeToReachMin(
    ORIGIN,
    model,
    destination(ORIGIN, (model.headingDeg + 180) % 360, 900),
  );
  assert.ok(favor !== null && contra !== null);
  assert.ok((contra as number) > (favor as number) * 20);
});

test("sem propagação não há tempo de chegada", () => {
  const parado = spreadModel({ ...TARDE_CRITICA, tempC: 12, humidity: 100 });
  assert.equal(timeToReachMin(ORIGIN, parado, { lat: -7.24, lon: -44.55 }), null);
});

/* ------------------------------------------------------- risco diário -- */

test("abatimento por chuva segue as faixas da Fórmula de Monte Alegre", () => {
  assert.equal(rainAbatement(1.2), 1);
  assert.equal(rainAbatement(3), 0.7);
  assert.equal(rainAbatement(7), 0.4);
  assert.equal(rainAbatement(12), 0.2);
  assert.equal(rainAbatement(20), 0);
});

test("chuva forte zera o índice acumulado", () => {
  const series = Array.from({ length: 10 }, () => ({
    humidity13h: 25,
    windMs: 5,
    rainMm: 0,
  }));
  const seco = monteAlegrePlus(series);
  const molhado = monteAlegrePlus([
    ...series,
    { humidity13h: 80, windMs: 2, rainMm: 30 },
  ]);
  assert.ok(seco > 20);
  assert.equal(molhado, 0);
});

test("índice sobe com a estiagem e com o vento", () => {
  const base = Array.from({ length: 8 }, () => ({
    humidity13h: 40,
    windMs: 3,
    rainMm: 0,
  }));
  const ventoso = base.map((d) => ({ ...d, windMs: 8 }));
  assert.ok(monteAlegrePlus(ventoso) > monteAlegrePlus(base));
  assert.ok(monteAlegrePlus(base.slice(0, 4)) < monteAlegrePlus(base));
});

test("classificação usa as faixas oficiais", () => {
  assert.equal(classifyRisk(0.8), "nulo");
  assert.equal(classifyRisk(2.5), "pequeno");
  assert.equal(classifyRisk(6), "medio");
  assert.equal(classifyRisk(15), "alto");
  assert.equal(classifyRisk(28), "muito-alto");
});

test("dailyRisk devolve rótulo, proporção limitada e recomendação", () => {
  const risk = dailyRisk([{ humidity13h: 20, windMs: 7, rainMm: 0 }]);
  assert.ok(risk.ratio >= 0 && risk.ratio <= 1);
  assert.ok(risk.label.length > 0);
  assert.ok(risk.advice.length > 10);
});
