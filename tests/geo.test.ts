import assert from "node:assert/strict";
import test from "node:test";
import {
  angleDelta,
  bearingDeg,
  coarsen,
  compass,
  destination,
  distanceM,
  formatClock,
  formatDistance,
  polygonAreaHa,
  pointInPolygon,
  project,
  unproject,
} from "../lib/geo.ts";

const URUCUI = { lat: -7.234, lon: -44.548 };

test("distância de 1° de latitude fica próxima de 111 km", () => {
  const d = distanceM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  assert.ok(Math.abs(d - 111_195) < 300, `esperado ~111 km, obtido ${d}`);
});

test("distância é simétrica e nula para o mesmo ponto", () => {
  const a = URUCUI;
  const b = { lat: -7.21, lon: -44.51 };
  assert.equal(distanceM(a, a), 0);
  assert.ok(Math.abs(distanceM(a, b) - distanceM(b, a)) < 1e-6);
});

test("azimute aponta para o norte e para o leste corretamente", () => {
  assert.ok(Math.abs(bearingDeg(URUCUI, { ...URUCUI, lat: URUCUI.lat + 0.1 })) < 0.5);
  const east = bearingDeg(URUCUI, { ...URUCUI, lon: URUCUI.lon + 0.1 });
  assert.ok(Math.abs(east - 90) < 0.5, `esperado ~90°, obtido ${east}`);
});

test("destination percorre a distância pedida no azimute pedido", () => {
  for (const bearing of [0, 35, 90, 215, 350]) {
    const target = destination(URUCUI, bearing, 2500);
    assert.ok(Math.abs(distanceM(URUCUI, target) - 2500) < 2);
    const back = bearingDeg(URUCUI, target);
    assert.ok(Math.abs(angleDelta(bearing, back)) < 0.5);
  }
});

test("projeção local e sua inversa fecham o ciclo", () => {
  const point = { lat: -7.2205, lon: -44.5312 };
  const round = unproject(project(point, URUCUI), URUCUI);
  assert.ok(Math.abs(round.lat - point.lat) < 1e-9);
  assert.ok(Math.abs(round.lon - point.lon) < 1e-9);
});

test("área de um quadrado de 1 km dá 100 hectares", () => {
  const nw = destination(destination(URUCUI, 0, 1000), 270, 0);
  const ring = [
    nw,
    destination(nw, 90, 1000),
    destination(destination(nw, 90, 1000), 180, 1000),
    destination(nw, 180, 1000),
  ];
  const ha = polygonAreaHa(ring);
  assert.ok(Math.abs(ha - 100) < 1, `esperado ~100 ha, obtido ${ha}`);
});

test("pointInPolygon distingue dentro de fora", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  assert.equal(pointInPolygon({ x: 5, y: 5 }, square), true);
  assert.equal(pointInPolygon({ x: 15, y: 5 }, square), false);
});

test("angleDelta devolve o menor arco assinado", () => {
  assert.equal(angleDelta(350, 10), 20);
  assert.equal(angleDelta(10, 350), -20);
  assert.equal(angleDelta(0, 180), -180);
});

test("rosa dos ventos usa L para leste e O para oeste", () => {
  assert.equal(compass(0), "N");
  assert.equal(compass(90), "L");
  assert.equal(compass(180), "S");
  assert.equal(compass(270), "O");
  assert.equal(compass(45), "NE");
});

test("coarsen reduz a precisão para a célula pedida", () => {
  const exact = { lat: -7.24451, lon: -44.55853 };
  const cell = coarsen(exact, 1000);
  assert.equal(cell.cellM, 1000);
  // Fica dentro de meia célula do ponto original, mas deixa de identificá-lo.
  assert.ok(distanceM(exact, cell) < 800);
  assert.notEqual(cell.lat.toFixed(5), exact.lat.toFixed(5));
});

test("coarsen é estável: dois pontos da mesma célula colapsam no mesmo valor", () => {
  const a = coarsen({ lat: -7.2445, lon: -44.5585 }, 1000);
  const b = coarsen({ lat: -7.2448, lon: -44.5588 }, 1000);
  assert.equal(a.lat, b.lat);
  assert.equal(a.lon, b.lon);
});

test("formatação em português usa vírgula decimal", () => {
  assert.equal(formatDistance(820), "820 m");
  assert.equal(formatDistance(1240), "1,2 km");
  assert.equal(formatDistance(14200), "14 km");
});

test("relógio formata minutos e horas", () => {
  assert.equal(formatClock(42), "00:42");
  assert.equal(formatClock(727), "12:07");
  assert.equal(formatClock(3840), "1h 04");
});
