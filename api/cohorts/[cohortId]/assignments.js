import { db } from "../../_firebaseAdmin.js";

export default async function handler(req, res) {
  const { cohortId } = req.query;

  if (req.method === "GET") {
    const snapshot = await db
      .collection("assignments")
      .where("cohortId", "==", cohortId)
      .get();
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json(data);
  }
  if (req.method === "POST") {
    const docRef = db.collection("assignments").doc();
    await docRef.set({ ...req.body, cohortId });
    return res.status(201).json({ id: docRef.id, ...req.body, cohortId });
  }

  return res.status(405).json({ error: "Method not allowed" });
}