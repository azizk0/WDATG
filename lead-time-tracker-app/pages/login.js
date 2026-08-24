import { useState } from "react";
import { useRouter } from "next/router";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const next = typeof router.query.next === "string" ? router.query.next : "/";
        window.location.href = next; // full reload so middleware re-checks with the new cookie
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Incorrect password.");
      setLoading(false);
    } catch {
      setError("Something went wrong — try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 text-[#2A251D]">
      <form onSubmit={onSubmit} className="w-full max-w-xs">
        <div
          className="inline-flex items-center gap-2 border-2 border-[#A13A24]/60 text-[#A13A24]/90 font-stamp text-[11px] tracking-[0.18em] uppercase px-2.5 py-1 mb-6 -rotate-2"
          style={{ boxShadow: "inset 0 0 0 2px rgba(161,58,36,0.18)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#A13A24]/80" />
          Lead Time Log
        </div>

        <div className="border border-[#B9AB84] bg-[#F6EFDD] p-6 shadow-[3px_3px_0_rgba(42,37,29,0.06)]">
          <div className="text-[13px] text-[#6B6151] mb-4">Enter the password to continue.</div>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-[#E3D8BA] border border-[#B9AB84] rounded-sm px-3 py-2.5 text-[14px] outline-none focus:border-[#A13A24] placeholder:text-[#96896F] mb-3"
          />
          {error && <div className="text-[12px] text-[#A13A24] mb-3">{error}</div>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 rounded-sm bg-[#3C6B45] text-[#F6EFDD] text-[13px] font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? "Checking…" : "Enter"}
          </button>
        </div>
      </form>
    </div>
  );
}
