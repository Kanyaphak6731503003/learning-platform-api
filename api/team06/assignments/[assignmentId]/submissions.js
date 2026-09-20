export default async function handler(req, res) {
  const { assignmentId } = req.query;

  try {
    const url = `${process.env.TEAM06_BASE_URL}/assignments/${assignmentId}/submissions`;

    const response = await fetch(url, {
      headers: {
        "X-Integration-Key": process.env.TEAM06_INTEGRATION_KEY,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Team 06 API request failed",
        status: response.status,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}