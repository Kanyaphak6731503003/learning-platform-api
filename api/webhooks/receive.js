import { db } from "../_firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-webhook-secret"];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Invalid secret" });
  }

  const { event, timestamp, data } = req.body;

  if (!event || !data) {
    return res.status(400).json({ error: "Missing event or data" });
  }

  if (event === "submission.created") {
    const { submissionId, assignmentId, studentId, status } = data;

    if (!submissionId) {
      return res.status(400).json({ error: "Missing submissionId" });
    }

    // เช็คว่า submissionId นี้เคยประมวลผลไปแล้วหรือยัง (Idempotency check)
    const existing = await db
      .collection("webhookLogs")
      .doc(submissionId)
      .get();

    if (existing.exists) {
      console.log(`[IDEMPOTENT] submissionId ${submissionId} already processed, skipping duplicate`);

      return res.status(200).json({
        status: "already_processed",
        event: "submission.created",
        submissionId,
        idempotent: true,
        originalReceivedAt: existing.data().receivedAt,
      });
    }

    // บันทึกใหม่ (ครั้งแรกที่เจอ submissionId นี้)
    const receivedAt = new Date().toISOString();

    await db.collection("webhookLogs").doc(submissionId).set({
      event,
      submissionId,
      assignmentId: assignmentId || null,
      studentId: studentId || null,
      status: status || null,
      timestamp: timestamp || null,
      receivedAt,
    });

    console.log(`[NEW] Webhook received: submission.created`, {
      submissionId,
      assignmentId,
      studentId,
      status,
      receivedAt,
    });

    return res.status(200).json({
      status: "received",
      event: "submission.created",
      submissionId,
      idempotent: false,
      receivedAt,
    });
  }

  // event อื่นๆ ที่ไม่ใช่ submission.created
  console.log(`Webhook received: ${event}`, data);
  return res.status(200).json({ status: "received", event });
}