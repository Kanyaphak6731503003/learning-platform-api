import { applyCors } from "../_cors.js";
import { authorize, canAccess, forbid, isInstructor, ownsCohort } from "../_auth.js";
import { withNames } from "../_enrich.js";
import { db } from "../_firebaseAdmin.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  const principal = await authorize(req, res);
  if (!principal) return;

  const { assignmentId } = req.query;
  const docRef = db.collection("assignments").doc(assignmentId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    return res.status(404).json({ error: "Assignment not found" });
  }
  if (!canAccess(principal, docSnap.data())) return forbid(res);

  if (req.method === "GET") {
    const [assignment] = await withNames([{ id: docSnap.id, ...docSnap.data() }]);
    return res.status(200).json(assignment);
  }

  if (req.method === "PUT") {
    let fields = req.body;
    if (isInstructor(principal)) {
      const { instructorId: _instructorId, createdAt: _createdAt, ...editable } = req.body ?? {};
      if ("cohortId" in editable && !(await ownsCohort(principal, editable.cohortId))) return forbid(res);
      fields = editable;
    }
    await docRef.update(fields);
    return res.status(200).json({ id: assignmentId, updated: true });
  }

  if (req.method === "DELETE") {
    await docRef.delete();
    return res.status(200).json({ id: assignmentId, deleted: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
