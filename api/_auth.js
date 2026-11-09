import { timingSafeEqual } from "node:crypto";
import { auth, db } from "./_firebaseAdmin.js";

function keyMatches(given, expected) {
  if (!expected) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Works out who is calling, or answers 401/403 and returns null.
//   instructor  - signed-in user, limited to their own data
//   integration - partner team with the read-only key, GET requests only
//   legacy      - no credentials, only allowed until REQUIRE_AUTH is "true"
export async function authorize(req, res) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const token = await auth.verifyIdToken(header.slice("Bearer ".length));
      return { role: "instructor", uid: token.uid, email: token.email ?? null };
    } catch {
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
      return null;
    }
  }

  const key = req.headers["x-integration-key"];
  if (key) {
    // Partner teams use the key already shared with Team 06 unless a separate one is set.
    if (!keyMatches(key, process.env.INTEGRATION_READ_KEY || process.env.TEAM06_INTEGRATION_KEY)) {
      res.status(401).json({ error: "Invalid integration key" });
      return null;
    }
    if (req.method !== "GET") {
      res.status(403).json({ error: "The integration key is read-only" });
      return null;
    }
    return { role: "integration" };
  }

  if (process.env.REQUIRE_AUTH === "true") {
    res.status(401).json({ error: "Please sign in" });
    return null;
  }
  return { role: "legacy" };
}

export function isInstructor(principal) {
  return principal.role === "instructor";
}

// Non-instructor callers have already been limited by authorize().
export function canAccess(principal, record) {
  return !isInstructor(principal) || record?.instructorId === principal.uid;
}

export function forbid(res) {
  return res.status(403).json({ error: "You don't have access to this item" });
}

// A signed-in instructor may only attach assignments to a section they own.
export async function ownsCohort(principal, cohortId) {
  if (!isInstructor(principal)) return true;
  if (typeof cohortId !== "string" || !cohortId) return false;
  const snap = await db.collection("cohorts").doc(cohortId).get();
  return snap.exists && snap.data().instructorId === principal.uid;
}
