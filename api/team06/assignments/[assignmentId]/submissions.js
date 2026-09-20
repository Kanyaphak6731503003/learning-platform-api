export default async function handler(req, res) {
  const { assignmentId } = req.query;

  try {
    const url = `${process.env.TEAM06_BASE_URL}/assignments/${assignmentId}/submissions`;

    const response = await fetch(url, {
      headers: {
        "X-Integration-Key": process.env.TEAM06_INTEGRATION_KEY,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Team06 returned status ${response.status}`);
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error(`[${new Date().toISOString()}] Team06 API unreachable:`, err.message);

    return res.status(200).json({
      assignment_id: assignmentId,
      submissions: [],
      warning: "Team06 service temporarily unavailable, showing fallback result",
      fallback: true,
      error_detail: err.message,
    });
  }
}