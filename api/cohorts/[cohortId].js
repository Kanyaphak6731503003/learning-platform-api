import { db } from "../_firebaseAdmin.js";

export default async function handler(req, res) {
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
    await db.collection("cohorts").doc(cohortId).delete();
    return res.status(200).json({ id: cohortId, deleted: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}