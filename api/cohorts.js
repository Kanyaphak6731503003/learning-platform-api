import { db } from "./_firebaseAdmin";

export default async function handler(req, res) {
  if (req.method === "GET") {
    const snapshot = await db.collection("cohorts").get();
    const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const docRef = await db.collection("cohorts").add(req.body);
    return res.status(201).json({ id: docRef.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
