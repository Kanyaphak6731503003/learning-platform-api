// Browsers only need CORS for the endpoints the Team 05 frontend calls.
// Server-to-server callers (Team 06 webhooks, Postman) are unaffected.
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "https://learning-platform-assign-658de.web.app",
  "https://learning-platform-assign-658de.firebaseapp.com",
];

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : DEFAULT_ORIGINS;

// Returns true when the request was a preflight that has been fully answered.
export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Integration-Key");
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
