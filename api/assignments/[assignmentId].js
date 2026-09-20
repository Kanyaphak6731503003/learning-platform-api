import { db } from "../_firebaseAdmin.js";

export default async function handler(req, res) {
  const { assignmentId } = req.query;
  const docRef = db.collection("assignments").doc(assignmentId);

  if (req.method === "GET") {
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: "Assignment not found" });
    }
    return res.status(200).json({ id: docSnap.id, ...docSnap.data() });
  }

  if (req.method === "PUT") {
    await docRef.update(req.body);
    return res.status(200).json({ id: assignmentId, updated: true });
  }

  if (req.method === "DELETE") {
    await docRef.delete();
    return res.status(200).json({ id: assignmentId, deleted: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}