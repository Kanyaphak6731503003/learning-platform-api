import { db } from "./_firebaseAdmin.js";

async function namesById(collection, ids, field) {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id))];
  if (unique.length === 0) return {};
  const snaps = await db.getAll(...unique.map((id) => db.collection(collection).doc(id)));
  return Object.fromEntries(snaps.filter((s) => s.exists).map((s) => [s.id, s.data()[field] ?? null]));
}

// Adds the display names partner teams and the frontend need alongside the raw IDs.
export async function withNames(assignments) {
  const [cohorts, users] = await Promise.all([
    namesById("cohorts", assignments.map((a) => a.cohortId), "name"),
    namesById("users", assignments.map((a) => a.instructorId), "fullName"),
  ]);
  return assignments.map((a) => ({
    ...a,
    cohortName: cohorts[a.cohortId] ?? null,
    instructorName: users[a.instructorId] ?? null,
  }));
}
