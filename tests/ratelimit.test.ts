import assert from "node:assert/strict";
import test from "node:test";
import {
  consume,
  cooldownMs,
  formatRetry,
  LIMITS,
  newBucket,
  reputationAfter,
} from "../lib/ratelimit.ts";

const T0 = 1_700_000_000_000;

test("o balde começa cheio e esvazia a cada uso", () => {
  const limit = LIMITS["alerta:suspeita"];
  let bucket = newBucket(limit, T0);
  for (let i = 0; i < limit.capacity; i++) {
    const result = consume(bucket, limit, T0);
    assert.equal(result.allowed, true, `uso ${i + 1} deveria passar`);
    bucket = result.bucket;
  }
  const bloqueado = consume(bucket, limit, T0);
  assert.equal(bloqueado.allowed, false);
  assert.ok(bloqueado.retryAfterMs > 0);
});

test("a espera informada é suficiente para liberar a próxima ficha", () => {
  const limit = LIMITS["alerta:emergencia"];
  let bucket = newBucket(limit, T0);
  bucket = consume(bucket, limit, T0).bucket;
  const bloqueado = consume(bucket, limit, T0);
  assert.equal(bloqueado.allowed, false);
  const depois = consume(bloqueado.bucket, limit, T0 + bloqueado.retryAfterMs);
  assert.equal(depois.allowed, true);
});

test("o balde recarrega com o tempo mas não passa da capacidade", () => {
  const limit = LIMITS["alerta:suspeita"];
  let bucket = newBucket(limit, T0);
  bucket = consume(bucket, limit, T0).bucket;
  bucket = consume(bucket, limit, T0).bucket;
  const muitoDepois = consume(bucket, limit, T0 + 24 * 60 * 60_000);
  assert.equal(muitoDepois.allowed, true);
  assert.ok(muitoDepois.bucket.tokens <= limit.capacity);
});

test("escalar emergência é mais caro que registrar suspeita", () => {
  assert.ok(
    LIMITS["alerta:emergencia"].capacity < LIMITS["alerta:suspeita"].capacity,
  );
  assert.ok(
    LIMITS["alerta:emergencia"].refillPerMin <
      LIMITS["alerta:suspeita"].refillPerMin,
  );
});

test("consumo de custo zero apenas recarrega, sem gastar ficha", () => {
  const limit = LIMITS["local:exato"];
  const bucket = newBucket(limit, T0);
  const sonda = consume(bucket, limit, T0, 0);
  assert.equal(sonda.allowed, true);
  assert.equal(sonda.bucket.tokens, limit.capacity);
});

test("a carência cresce com o número de pessoas mobilizadas", () => {
  const poucas = cooldownMs(10, 90);
  const muitas = cooldownMs(300, 90);
  assert.ok(muitas > poucas);
});

test("reputação alta encurta a carência", () => {
  assert.ok(cooldownMs(200, 95) < cooldownMs(200, 30));
});

test("a carência fica sempre entre 1 e 45 minutos", () => {
  assert.ok(cooldownMs(0, 100) >= 60_000);
  assert.ok(cooldownMs(10_000, 0) <= 45 * 60_000);
});

test("alarme falso pesa mais que acerto na reputação", () => {
  const acerto = reputationAfter(80, "procedente") - 80;
  const erro = 80 - reputationAfter(80, "improcedente");
  assert.ok(erro > acerto * 4);
  assert.equal(reputationAfter(80, "inconclusivo"), 80);
});

test("a reputação fica presa entre 0 e 100", () => {
  assert.equal(reputationAfter(99, "procedente"), 100);
  assert.equal(reputationAfter(5, "improcedente"), 0);
});

test("a espera é escrita em segundos ou minutos", () => {
  assert.equal(formatRetry(0), "disponível");
  assert.match(formatRetry(30_000), /^aguarde \d+ s$/);
  assert.match(formatRetry(300_000), /^aguarde \d+ min$/);
});
