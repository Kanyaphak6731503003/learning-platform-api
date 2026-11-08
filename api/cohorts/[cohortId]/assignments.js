import { applyCors } from "../../_cors.js";
import { authorize, forbid, isInstructor, ownsCohort } from "../../_auth.js";
import { withNames } from "../../_enrich.js";
import { db } from "../../_firebaseAdmin.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  const principal = await authorize(req, res);
  if (!principal) return;

  const { cohortId } = req.query;
  if (!(await ownsCohort(principal, cohortId))) return forbid(res);

  if (req.method === "GET") {
    const snapshot = await db
      .collection("assignments")
      .where("cohortId", "==", cohortId)
      .get();
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json(await withNames(data));
  }
  if (req.method === "POST") {
    const owner = isInstructor(principal) ? { instructorId: principal.uid } : {};
    const docRef = db.collection("assignments").doc();
    const record = { ...req.body, ...owner, cohortId };
    await docRef.set(record);
    return res.status(201).json({ id: docRef.id, ...record });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
