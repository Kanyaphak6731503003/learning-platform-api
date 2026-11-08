import { applyCors } from "../_cors.js";
import { db } from "../_firebaseAdmin.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;

  const { cohortId } = req.query;

  if (req.method === "GET") {
    const docSnap = await db.collection("cohorts").doc(cohortId).get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Cohort not found" });
    }
    return res.status(200).json({ id: docSnap.id, ...docSnap.data() });
  }

  if (req.method === "PUT") {
    await db.collection("cohorts").doc(cohortId).update(req.body);
    return res.status(200).json({ id: cohortId, updated: true });
  }

  if (req.method === "DELETE") {
    // PRD DA-04: never leave orphaned assignments behind.
    const remaining = await db.collection("assignments").where("cohortId", "==", cohortId).limit(1).get();
    if (!remaining.empty) {
      return res.status(409).json({ error: "Section still has assignments. Move or delete them first." });
    }
    await db.collection("cohorts").doc(cohortId).delete();
    return res.status(200).json({ id: cohortId, deleted: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}