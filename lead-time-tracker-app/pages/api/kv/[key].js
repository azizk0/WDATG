import { sql } from "@vercel/postgres";

export default async function handler(req, res) {
  const { key } = req.query;

  try {
    await sql`CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)`;

    if (req.method === "GET") {
      const { rows } = await sql`SELECT value FROM kv_store WHERE key = ${key}`;
      return res.status(200).json({ value: rows.length ? rows[0].value : null });
    }

    if (req.method === "POST") {
      const { value } = req.body;
      await sql`
        INSERT INTO kv_store (key, value) VALUES (${key}, ${value})
        ON CONFLICT (key) DO UPDATE SET value = ${value}
      `;
      return res.status(200).json({ ok: true });
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
}
