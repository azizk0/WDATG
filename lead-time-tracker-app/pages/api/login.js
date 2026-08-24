const COOKIE_NAME = "site_auth";

function serializeCookie(name, value, opts = {}) {
  let str = `${name}=${encodeURIComponent(value)}`;
  if (opts.maxAge != null) str += `; Max-Age=${opts.maxAge}`;
  str += `; Path=${opts.path || "/"}`;
  if (opts.httpOnly) str += "; HttpOnly";
  if (opts.secure) str += "; Secure";
  if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
  return str;
}

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const expected = process.env.SITE_PASSWORD;
  if (!expected) {
    return res.status(500).json({ error: "SITE_PASSWORD is not configured on the server." });
  }

  const { password } = req.body || {};
  if (typeof password !== "string" || password !== expected) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  res.setHeader(
    "Set-Cookie",
    serializeCookie(COOKIE_NAME, expected, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    })
  );
  return res.status(200).json({ ok: true });
}
