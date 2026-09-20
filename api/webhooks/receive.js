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

    console.log("Webhook received: submission.created", {
      submissionId,
      assignmentId,
      studentId,
      status,
      timestamp,
    });

    return res.status(200).json({
      status: "received",
      event: "submission.created",
      submissionId,
    });
  }

  console.log(`Webhook received: ${event}`, data);
  return res.status(200).json({ status: "received", event });
}