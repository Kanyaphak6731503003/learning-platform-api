import { applyCors } from "./_cors.js";
import { authorize, isInstructor } from "./_auth.js";
import { db } from "./_firebaseAdmin.js";

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  const principal = await authorize(req, res);
  if (!principal) return;
  if (!isInstructor(principal)) return res.status(401).json({ error: "Please sign in" });

  const ref = db.collection("users").doc(principal.uid);

  if (req.method === "GET") {
    const snap = await ref.get();
    return res.status(200).json({ id: principal.uid, email: principal.email, ...(snap.exists ? snap.data() : {}) });
  }

  if (req.method === "PUT") {
    const fullName = typeof req.body?.fullName === "string" ? req.body.fullName.trim() : "";
    if (!fullName || fullName.length > 100) {
      return res.status(400).json({ error: "Full name is required (100 characters or fewer)" });
    }
    await ref.set({ fullName, email: principal.email }, { merge: true });
    return res.status(200).json({ id: principal.uid, fullName, email: principal.email });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
