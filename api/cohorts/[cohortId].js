import { applyCors } from "../_cors.js";
import { authorize, canAccess, forbid, isInstructor } from "../_auth.js";
import { db } from "../_firebaseAdmin.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  const principal = await authorize(req, res);
  if (!principal) return;

  const { cohortId } = req.query;
  const docRef = db.collection("cohorts").doc(cohortId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return res.status(404).json({ error: "Cohort not found" });
  }
  if (!canAccess(principal, docSnap.data())) return forbid(res);

  if (req.method === "GET") {
    return res.status(200).json({ id: docSnap.id, ...docSnap.data() });
  }

  if (req.method === "PUT") {
    let fields = req.body;
    if (isInstructor(principal)) {
      const { instructorId: _instructorId, ...editable } = req.body ?? {};
      fields = editable;
    }
    await docRef.update(fields);
    return res.status(200).json({ id: cohortId, updated: true });
  }

  if (req.method === "DELETE") {
    // PRD DA-04: never leave orphaned assignments behind.
    const remaining = await db.collection("assignments").where("cohortId", "==", cohortId).limit(1).get();
    if (!remaining.empty) {
      return res.status(409).json({ error: "Section still has assignments. Move or delete them first." });
    }
    await docRef.delete();
    return res.status(200).json({ id: cohortId, deleted: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
