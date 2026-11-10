import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
// Authorization and data-isolation tests for the API handlers.
// Firestore and Firebase Auth are replaced with in-memory fakes, so these run
// offline and never touch real data. Run with: npm test
const API = new URL("../api/", import.meta.url);

let store;
const snap = (c, id) => ({ id, exists: id in (store[c] ?? {}), data: () => store[c][id] });
const docRef = (c, id) => ({ __c: c, __id: id,
  get: async () => snap(c, id),
  set: async (v, o) => { store[c] ??= {}; store[c][id] = o?.merge ? { ...store[c][id], ...v } : v; },
  update: async (v) => { if (!(id in store[c])) throw new Error("NOT_FOUND"); store[c][id] = { ...store[c][id], ...v }; },
  delete: async () => { delete store[c][id]; } });
let auto = 0;
const query = (c, filters = [], max = Infinity) => ({
  where: (f, _op, v) => query(c, [...filters, [f, v]], max),
  limit: (n) => query(c, filters, n),
  get: async () => { const docs = Object.keys(store[c] ?? {}).filter((id) => filters.every(([f, v]) => store[c][id][f] === v)).slice(0, max).map((id) => snap(c, id)); return { docs, empty: docs.length === 0 }; },
});
const db = { collection: (c) => ({ ...query(c), doc: (id = "auto" + ++auto) => docRef(c, id), add: async (v) => { const id = "auto" + ++auto; store[c] ??= {}; store[c][id] = v; return { id }; } }),
  getAll: async (...refs) => refs.map((r) => snap(r.__c, r.__id)) };
const auth = { verifyIdToken: async (t) => { const m = { "tok-A": "A", "tok-B": "B" }[t]; if (!m) throw new Error("bad"); return { uid: m, email: m + "@x.th" }; } };
mock.module(new URL("_firebaseAdmin.js", API).href, { exports: { db, auth } });

const load = (p) => import(new URL(p, API).href).then((m) => m.default);
const [assignments, assignment, cohorts, cohort, cohortAssign, proxy, me] = await Promise.all(
  ["assignments.js", "assignments/[assignmentId].js", "cohorts.js", "cohorts/[cohortId].js", "cohorts/[cohortId]/assignments.js", "team06/assignments/[assignmentId]/submissions.js", "me.js"].map(load));

async function call(h, { method = "GET", query = {}, body, headers = {} } = {}) {
  const out = { status: null, body: undefined };
  const res = { setHeader() {}, status(s) { out.status = s; return this; }, json(b) { out.body = b; return this; }, end() { return this; } };
  await h({ method, query, body, headers }, res);
  return out;
}
const A = { authorization: "Bearer tok-A" }, B = { authorization: "Bearer tok-B" }, KEY = { "x-integration-key": "read-key" };

beforeEach(() => {
  delete process.env.REQUIRE_AUTH; process.env.INTEGRATION_READ_KEY = "read-key"; process.env.TEAM06_INTEGRATION_KEY = "x";
  process.env.TEAM06_BASE_URL = "http://t6"; 
  globalThis.fetch = async () => new Response(JSON.stringify({ assignment_id: "a1", submissions: [{ submission_id: "s" }] }));
  store = { assignments: { a1: { title: "A work", cohortId: "c1", instructorId: "A" }, b1: { title: "B work", cohortId: "c2", instructorId: "B" } },
    cohorts: { c1: { name: "CS101 - Section A", instructorId: "A" }, c2: { name: "CS102 - Section A", instructorId: "B" } },
    users: { A: { fullName: "Aj. A" } } };
});

test("rollout phase: no credentials still works and names are added", async () => {
  const r = await call(assignments);
  assert.equal(r.status, 200); assert.equal(r.body.length, 2);
  assert.deepEqual([r.body[0].cohortName, r.body[0].instructorName], ["CS101 - Section A", "Aj. A"]);
  assert.equal(r.body[1].instructorName, null);
});
test("migration: anonymous PUT can reassign owner before enforcement", async () => {
  await call(assignment, { method: "PUT", query: { assignmentId: "a1" }, body: { instructorId: "NEW" } });
  assert.equal(store.assignments.a1.instructorId, "NEW");
});
test("REQUIRE_AUTH blocks anonymous on every data endpoint", async () => {
  process.env.REQUIRE_AUTH = "true";
  for (const [h, query] of [[assignments, {}], [assignment, { assignmentId: "a1" }], [cohorts, {}], [cohort, { cohortId: "c1" }], [cohortAssign, { cohortId: "c1" }], [proxy, { assignmentId: "a1" }], [me, {}]]) {
    assert.equal((await call(h, { query })).status, 401);
  }
  const before = JSON.stringify(store);
  assert.equal((await call(assignment, { method: "DELETE", query: { assignmentId: "a1" } })).status, 401);
  assert.equal(JSON.stringify(store), before);
});
test("bad token is rejected even before enforcement", async () => {
  assert.equal((await call(assignments, { headers: { authorization: "Bearer nope" } })).status, 401);
});
test("instructor lists only their own", async () => {
  const a = await call(assignments, { headers: A }); assert.deepEqual(a.body.map((x) => x.id), ["a1"]);
  const c = await call(cohorts, { headers: B }); assert.deepEqual(c.body.map((x) => x.id), ["c2"]);
});
test("instructor cannot read, change or delete another's work", async () => {
  process.env.REQUIRE_AUTH = "true";
  const before = JSON.stringify(store);
  for (const method of ["GET", "PUT", "DELETE"]) {
    assert.equal((await call(assignment, { method, query: { assignmentId: "b1" }, headers: A, body: { title: "x" } })).status, 403, method);
    assert.equal((await call(cohort, { method, query: { cohortId: "c2" }, headers: A, body: { name: "x" } })).status, 403, method);
  }
  assert.equal((await call(cohortAssign, { query: { cohortId: "c2" }, headers: A })).status, 403);
  assert.equal((await call(proxy, { query: { assignmentId: "b1" }, headers: A })).status, 403);
  assert.equal(JSON.stringify(store), before);
});
test("create forces the owner and rejects someone else's section", async () => {
  const ok = await call(assignments, { method: "POST", headers: A, body: { title: "n", cohortId: "c1", instructorId: "SPOOF" } });
  assert.equal(ok.status, 201); assert.equal(store.assignments[ok.body.id].instructorId, "A");
  assert.equal((await call(assignments, { method: "POST", headers: A, body: { title: "n", cohortId: "c2" } })).status, 403);
  const c = await call(cohorts, { method: "POST", headers: A, body: { name: "n", instructorId: "SPOOF" } });
  assert.equal(store.cohorts[c.body.id].instructorId, "A");
});
test("instructor update cannot change owner or move to another's section", async () => {
  await call(assignment, { method: "PUT", query: { assignmentId: "a1" }, headers: A, body: { title: "new", instructorId: "B" } });
  assert.deepEqual([store.assignments.a1.title, store.assignments.a1.instructorId], ["new", "A"]);
  assert.equal((await call(assignment, { method: "PUT", query: { assignmentId: "a1" }, headers: A, body: { cohortId: "c2" } })).status, 403);
});
test("Team 06 key reads everything but cannot write", async () => {
  process.env.REQUIRE_AUTH = "true";
  const r = await call(assignments, { headers: KEY });
  assert.equal(r.status, 200); assert.equal(r.body.length, 2); assert.equal(r.body[0].cohortName, "CS101 - Section A");
  assert.equal((await call(cohorts, { headers: KEY })).body.length, 2);
  assert.equal((await call(assignment, { query: { assignmentId: "b1" }, headers: KEY })).status, 200);
  assert.equal((await call(assignments, { method: "POST", headers: KEY, body: {} })).status, 403);
  assert.equal((await call(assignment, { method: "DELETE", query: { assignmentId: "a1" }, headers: KEY })).status, 403);
  assert.ok(store.assignments.a1);
});
test("wrong key, or key not configured, is rejected", async () => {
  assert.equal((await call(assignments, { headers: { "x-integration-key": "wrong" } })).status, 401);
  delete process.env.INTEGRATION_READ_KEY;
  assert.equal((await call(assignments, { headers: KEY })).status, 401);
});
test("falls back to the existing Team 06 key", async () => {
  process.env.REQUIRE_AUTH = "true"; delete process.env.INTEGRATION_READ_KEY; process.env.TEAM06_INTEGRATION_KEY = "shared";
  assert.equal((await call(assignments, { headers: { "x-integration-key": "shared" } })).status, 200);
  assert.equal((await call(assignments, { headers: { "x-integration-key": "other" } })).status, 401);
  assert.equal((await call(assignments, { method: "POST", headers: { "x-integration-key": "shared" }, body: {} })).status, 403);
  delete process.env.TEAM06_INTEGRATION_KEY;
  assert.equal((await call(assignments, { headers: { "x-integration-key": "shared" } })).status, 401);
});
test("sections include the instructor's name", async () => {
  const list = await call(cohorts, { headers: KEY });
  assert.equal(list.body.find((c) => c.id === "c1").instructorName, "Aj. A");
  assert.equal(list.body.find((c) => c.id === "c2").instructorName, null);
  assert.equal((await call(cohort, { query: { cohortId: "c1" }, headers: KEY })).body.instructorName, "Aj. A");
});
test("owner can use the Team 06 proxy", async () => {
  process.env.REQUIRE_AUTH = "true";
  const r = await call(proxy, { query: { assignmentId: "a1" }, headers: A });
  assert.equal(r.status, 200); assert.equal(r.body.submissions.length, 1);
});
test("non-empty section still cannot be deleted", async () => {
  assert.equal((await call(cohort, { method: "DELETE", query: { cohortId: "c1" }, headers: A })).status, 409);
  assert.ok(store.cohorts.c1);
});
test("/api/me stores the profile for the signed-in user only", async () => {
  const r = await call(me, { method: "PUT", headers: B, body: { fullName: "  Aj. B ", uid: "A" } });
  assert.equal(r.status, 200); assert.equal(store.users.B.fullName, "Aj. B"); assert.equal(store.users.A.fullName, "Aj. A");
  assert.equal((await call(me, { method: "PUT", headers: B, body: { fullName: "" } })).status, 400);
  assert.equal((await call(me, { method: "PUT", body: { fullName: "x" } })).status, 401);
});
