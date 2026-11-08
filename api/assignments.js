import { applyCors } from "./_cors.js";
import { authorize, forbid, isInstructor, ownsCohort } from "./_auth.js";
import { withNames } from "./_enrich.js";
import { db } from "./_firebaseAdmin.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  const principal = await authorize(req, res);
  if (!principal) return;

  if (req.method === "GET") {
    const base = db.collection("assignments");
    const snapshot = await (isInstructor(principal) ? base.where("instructorId", "==", principal.uid) : base).get();
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json(await withNames(data));
  }

  if (req.method === "POST") {
    if (!(await ownsCohort(principal, req.body?.cohortId))) return forbid(res);
    const owner = isInstructor(principal) ? { instructorId: principal.uid } : {};
    const docRef = await db.collection("assignments").add({
      ...req.body,
      ...owner,
      createdAt: new Date(),
    });
    return res.status(201).json({ id: docRef.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
