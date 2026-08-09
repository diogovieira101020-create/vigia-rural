import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalize,
  GENESIS_HASH,
  hashEvent,
  sealChain,
  shortHash,
  verifyChain,
  type AuditEvent,
} from "../lib/audit.ts";

const evento = (seq: number, summary: string): AuditEvent => ({
  seq,
  ts: 1_700_000_000_000 + seq * 1000,
  actorId: "p-joao",
  actorName: "João Martins",
  action: "alerta.aberto",
  summary,
  payload: { nivel: "confirmado", precisaoM: 9 },
});

const trilha = [
  evento(1, "Ocorrência aberta"),
  evento(2, "Vizinho confirmou o foco"),
  evento(3, "Brigada assumiu o comando"),
  evento(4, "Pipa despachada"),
];

test("serialização canônica independe da ordem das chaves", () => {
  const a = canonicalize({ b: 2, a: 1, c: { z: 1, y: 2 } });
  const b = canonicalize({ c: { y: 2, z: 1 }, a: 1, b: 2 });
  assert.equal(a, b);
});

test("serialização canônica distingue conteúdos diferentes", () => {
  assert.notEqual(canonicalize({ a: 1 }), canonicalize({ a: 2 }));
  assert.notEqual(canonicalize([1, 2]), canonicalize([2, 1]));
});

test("a cadeia começa no gênesis e encadeia cada elo", async () => {
  const sealed = await sealChain(trilha);
  assert.equal(sealed.length, 4);
  assert.equal(sealed[0].prevHash, GENESIS_HASH);
  for (let i = 1; i < sealed.length; i++)
    assert.equal(sealed[i].prevHash, sealed[i - 1].hash);
});

test("o mesmo log produz sempre os mesmos hashes", async () => {
  const a = await sealChain(trilha);
  const b = await sealChain([...trilha].reverse()); // reordena na entrada
  assert.deepEqual(
    a.map((r) => r.hash),
    b.map((r) => r.hash),
  );
});

test("uma cadeia íntegra é verificada com sucesso", async () => {
  const verdict = await verifyChain(await sealChain(trilha));
  assert.equal(verdict.valid, true);
  assert.equal(verdict.checked, 4);
});

test("alterar o conteúdo de um registro rompe a cadeia naquele ponto", async () => {
  const sealed = await sealChain(trilha);
  const adulterada = sealed.map((record) =>
    record.seq === 2
      ? { ...record, summary: "Vizinho NÃO confirmou o foco" }
      : record,
  );
  const verdict = await verifyChain(adulterada);
  assert.equal(verdict.valid, false);
  assert.equal(verdict.brokenAtSeq, 2);
  assert.ok((verdict.reason ?? "").includes("alterado"));
});

test("remover um registro do meio rompe a cadeia", async () => {
  const sealed = await sealChain(trilha);
  const verdict = await verifyChain(sealed.filter((r) => r.seq !== 3));
  assert.equal(verdict.valid, false);
  assert.equal(verdict.brokenAtSeq, 4);
});

test("alterar o payload sem mexer no resumo também é detectado", async () => {
  const sealed = await sealChain(trilha);
  const adulterada = sealed.map((record) =>
    record.seq === 1
      ? { ...record, payload: { ...record.payload, precisaoM: 900 } }
      : record,
  );
  const verdict = await verifyChain(adulterada);
  assert.equal(verdict.valid, false);
  assert.equal(verdict.brokenAtSeq, 1);
});

test("hashes têm 64 caracteres hexadecimais", async () => {
  const hash = await hashEvent(trilha[0], GENESIS_HASH);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("shortHash encurta preservando as pontas", () => {
  const hash = "a".repeat(28) + "b".repeat(36);
  const short = shortHash(hash);
  assert.ok(short.startsWith("aaaaaa"));
  assert.ok(short.endsWith("bbbbbb"));
  assert.ok(short.length < 20);
  assert.equal(shortHash("abc"), "abc");
});
