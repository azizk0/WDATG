import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Play, Square, Plus, X, Clock, BarChart3, List, ChevronDown, Check } from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";

/* ---------------------------------------------------------
   Design tokens — exposure sheet / animation production
   paper      #ECE3CD   aged cel-paper, warm cream
   paper-2    #F6EFDD   lighter sheet (cards, modal)
   paper-3    #E3D8BA   deeper sheet (inputs, wells)
   rule       #B9AB84   hairline ink-brown border
   ink        #2A251D   primary text, near-black warm ink
   ink-soft   #6B6151   secondary text
   ink-faint  #96896F   placeholder / dim text
   stamp-red  #A13A24   record / active / discard — red pencil ink
   stamp-grn  #3C6B45   confirm / save — approval stamp ink
   stamp-blue #33587A   secondary accent — non-repro blue
   Type: Special Elite for stamped labels, Courier Prime for
   timecodes/frame counters, Inter for everything else.
--------------------------------------------------------- */

const TAG_PALETTE = [
  "#A13A24", "#33587A", "#3C6B45", "#B3651B", "#6B4A85", "#1E7A6E", "#8A7A1E", "#8C4B62",
];

function tagColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

function tagRotation(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 17 + name.charCodeAt(i)) >>> 0;
  return (h % 5) - 2; // -2..2 deg
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function pad(n) { return String(n).padStart(2, "0"); }

function fmtClock(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function fmtTimeShort(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDuration(ms) {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function dayKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dayLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const yest = new Date(today); yest.setDate(today.getDate() - 1);
  const isYest = date.toDateString() === yest.toDateString();
  if (isToday) return "Today";
  if (isYest) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* ---------------------------------------------------------
   Storage helpers — shared, no auth. Talks to /api/kv/[key],
   which is backed by a real Postgres database (see pages/api/kv/[key].js).
--------------------------------------------------------- */

async function loadAll() {
  const out = { users: [], tags: [], entries: [] };
  for (const key of ["users", "tags", "entries"]) {
    try {
      const res = await fetch(`/api/kv/${key}`).then((r) => r.json());
      if (res && res.value) out[key] = JSON.parse(res.value);
    } catch (e) {
      // key not found yet — leave default
    }
  }
  return out;
}

async function saveKey(key, value) {
  try {
    const res = await fetch(`/api/kv/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: JSON.stringify(value) }),
    });
    return res.ok;
  } catch (e) {
    console.error("storage save failed", key, e);
    return false;
  }
}

/* ---------------------------------------------------------
   Small UI primitives
--------------------------------------------------------- */

function Pill({ active, onClick, children, color, onRemove, stamp }) {
  const c = color || "#A13A24";
  const rot = stamp ? tagRotation(String(children)) : 0;
  return (
    <button
      onClick={onClick}
      style={{
        borderColor: active ? c : "#B9AB84",
        background: active ? `${c}1F` : "transparent",
        color: active ? c : "#6B6151",
        transform: rot ? `rotate(${rot}deg)` : undefined,
      }}
      className={`group flex items-center gap-1.5 border px-3 py-1.5 text-[13px] font-medium transition-colors whitespace-nowrap ${
        stamp ? "rounded-[3px] font-stamp uppercase tracking-wide text-[11px] border-[1.5px]" : "rounded-full"
      }`}
    >
      {color && (
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c }} />
      )}
      {children}
      {onRemove && (
        <X
          size={12}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 ml-0.5"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        />
      )}
    </button>
  );
}

function Avatar({ name, size = 28 }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const color = tagColor(name || "?");
  return (
    <div
      style={{ width: size, height: size, background: "#F6EFDD", color, border: `1.5px solid ${color}88` }}
      className="flex items-center justify-center rounded-full font-stamp text-[12px] font-semibold shrink-0"
    >
      {initial}
    </div>
  );
}

/* ---------------------------------------------------------
   Main App
--------------------------------------------------------- */

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [users, setUsers] = useState([]);
  const [tags, setTags] = useState([]);
  const [entries, setEntries] = useState([]);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [view, setView] = useState("log"); // log | dashboard

  // timer state
  const [running, setRunning] = useState(null); // { startedAt } or null
  const [now, setNow] = useState(Date.now());

  // pending entry (after stop, or manual add)
  const [pending, setPending] = useState(null); // { start, end, description, tagIds }

  const [newUserName, setNewUserName] = useState("");
  const [addingUser, setAddingUser] = useState(false);
  const [tagQuery, setTagQuery] = useState("");
  const [showManual, setShowManual] = useState(false);

  const [saveError, setSaveError] = useState(false);

  // load persisted data once
  useEffect(() => {
    (async () => {
      const data = await loadAll();
      setUsers(data.users);
      setTags(data.tags);
      setEntries(data.entries);
      if (data.users.length) setCurrentUserId(data.users[0].id);
      setLoaded(true);
    })();
  }, []);

  // ticking clock while a timer is running
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const persistUsers = useCallback(async (next) => {
    setUsers(next);
    const ok = await saveKey("users", next);
    setSaveError(!ok);
  }, []);
  const persistTags = useCallback(async (next) => {
    setTags(next);
    const ok = await saveKey("tags", next);
    setSaveError(!ok);
  }, []);
  const persistEntries = useCallback(async (next) => {
    setEntries(next);
    const ok = await saveKey("entries", next);
    setSaveError(!ok);
  }, []);

  const currentUser = users.find((u) => u.id === currentUserId) || null;

  function addUser() {
    const name = newUserName.trim();
    if (!name) return;
    if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      setCurrentUserId(users.find((u) => u.name.toLowerCase() === name.toLowerCase()).id);
      setNewUserName("");
      setAddingUser(false);
      return;
    }
    const u = { id: uid(), name };
    const next = [...users, u];
    persistUsers(next);
    setCurrentUserId(u.id);
    setNewUserName("");
    setAddingUser(false);
  }

  function ensureTag(name) {
    const clean = name.trim();
    if (!clean) return null;
    const existing = tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    const t = { id: uid(), name: clean };
    persistTags([...tags, t]);
    return t;
  }

  function startTimer() {
    if (!currentUser) return;
    setRunning({ startedAt: Date.now() });
    setNow(Date.now());
  }

  function stopTimer() {
    if (!running) return;
    const start = running.startedAt;
    const end = Date.now();
    setRunning(null);
    setPending({ start, end, description: "", tagIds: [] });
  }

  function discardPending() {
    setPending(null);
    setTagQuery("");
  }

  function confirmPending() {
    if (!pending || !currentUser) return;
    const entry = {
      id: uid(),
      userId: currentUser.id,
      description: pending.description.trim() || "Untitled",
      tagIds: pending.tagIds,
      start: new Date(pending.start).toISOString(),
      end: new Date(pending.end).toISOString(),
    };
    persistEntries([entry, ...entries]);
    setPending(null);
    setTagQuery("");
  }

  function openManual() {
    const end = Date.now();
    const start = end - 15 * 60 * 1000;
    setPending({ start, end, description: "", tagIds: [], manual: true });
    setShowManual(true);
  }

  function toggleTagOnPending(tagId) {
    if (!pending) return;
    setPending((p) => ({
      ...p,
      tagIds: p.tagIds.includes(tagId) ? p.tagIds.filter((t) => t !== tagId) : [...p.tagIds, tagId],
    }));
  }

  function addTagFromQuery() {
    if (!tagQuery.trim() || !pending) return;
    const t = ensureTag(tagQuery);
    if (t) toggleTagOnPendingAdd(t.id);
    setTagQuery("");
  }
  function toggleTagOnPendingAdd(tagId) {
    setPending((p) => (p.tagIds.includes(tagId) ? p : { ...p, tagIds: [...p.tagIds, tagId] }));
  }

  function deleteEntry(id) {
    persistEntries(entries.filter((e) => e.id !== id));
  }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const k = dayKey(e.start);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(e);
    }
    const keys = Array.from(map.keys()).sort((a, b) => (a < b ? 1 : -1));
    return keys.map((k) => ({
      key: k,
      label: dayLabel(k),
      items: map.get(k).sort((a, b) => new Date(b.start) - new Date(a.start)),
    }));
  }, [entries]);

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#ECE3CD] flex items-center justify-center">
        <div className="font-stamp text-[#6B6151] text-sm tracking-wide">loading sheet…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-[#2A251D]">
      {saveError && (
        <div className="bg-[#A13A2422] border-b border-[#A13A2455] text-[#A13A24] text-[12px] font-stamp text-center py-1.5 px-4 tracking-wide">
          Couldn't sync last change — check connection.
        </div>
      )}

      <Header
        currentUser={currentUser}
        users={users}
        setCurrentUserId={setCurrentUserId}
        addingUser={addingUser}
        setAddingUser={setAddingUser}
        newUserName={newUserName}
        setNewUserName={setNewUserName}
        addUser={addUser}
      />

      <main className="max-w-3xl mx-auto px-4 pb-28">
        <TimerCard
          currentUser={currentUser}
          running={running}
          now={now}
          onStart={startTimer}
          onStop={stopTimer}
          onManual={openManual}
        />

        <div className="flex items-center gap-1 mt-8 mb-4 border-b border-[#B9AB84]">
          <TabButton active={view === "log"} onClick={() => setView("log")} icon={<List size={15} />} label="Log" />
          <TabButton active={view === "dashboard"} onClick={() => setView("dashboard")} icon={<BarChart3 size={15} />} label="Dashboard" />
        </div>

        {view === "log" ? (
          <LogView grouped={grouped} users={users} tags={tags} onDelete={deleteEntry} />
        ) : (
          <Dashboard entries={entries} users={users} tags={tags} />
        )}
      </main>

      {pending && (
        <PendingSheet
          pending={pending}
          setPending={setPending}
          tags={tags}
          tagQuery={tagQuery}
          setTagQuery={setTagQuery}
          onToggleTag={toggleTagOnPending}
          onAddTag={addTagFromQuery}
          onConfirm={confirmPending}
          onDiscard={() => { discardPending(); setShowManual(false); }}
          currentUser={currentUser}
          manual={pending.manual}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Header — user picker
--------------------------------------------------------- */

function Header({ currentUser, users, setCurrentUserId, addingUser, setAddingUser, newUserName, setNewUserName, addUser }) {
  return (
    <header className="max-w-3xl mx-auto px-4 pt-8 pb-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div
            className="inline-flex items-center gap-2 border-2 border-[#A13A24]/60 text-[#A13A24]/90 font-stamp text-[11px] tracking-[0.18em] uppercase px-2.5 py-1 mb-2 -rotate-2"
            style={{ boxShadow: "inset 0 0 0 2px rgba(161,58,36,0.18)" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#A13A24]/80" />
            Lead Time Log
          </div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[#2A251D]">Where did the day go</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {users.map((u) => (
            <Pill key={u.id} active={currentUser?.id === u.id} onClick={() => setCurrentUserId(u.id)} color={tagColor(u.name)}>
              {u.name}
            </Pill>
          ))}

          {addingUser ? (
            <form
              onSubmit={(e) => { e.preventDefault(); addUser(); }}
              className="flex items-center gap-1 rounded-full border border-[#B9AB84] pl-3 pr-1 py-1 bg-[#F6EFDD]"
            >
              <input
                autoFocus
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                onBlur={() => { if (!newUserName.trim()) setAddingUser(false); }}
                placeholder="Name"
                className="bg-transparent outline-none text-[13px] w-20 placeholder:text-[#96896F]"
              />
              <button type="submit" className="rounded-full bg-[#A13A24] text-[#F6EFDD] p-1">
                <Check size={12} />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setAddingUser(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-[#B9AB84] text-[#6B6151] px-3 py-1.5 text-[13px] hover:border-[#A13A24] hover:text-[#A13A24] transition-colors"
            >
              <Plus size={13} /> Person
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
        active ? "border-[#A13A24] text-[#2A251D]" : "border-transparent text-[#6B6151] hover:text-[#2A251D]"
      }`}
    >
      {icon} {label}
    </button>
  );
}

/* ---------------------------------------------------------
   Timer card
--------------------------------------------------------- */

function TimerCard({ currentUser, running, now, onStart, onStop, onManual }) {
  const elapsed = running ? now - running.startedAt : 0;
  return (
    <div className="relative mt-6 rounded-sm border border-[#B9AB84] bg-[#F6EFDD] p-5 pl-8 flex items-center justify-between gap-4 flex-wrap shadow-[3px_3px_0_rgba(42,37,29,0.06)]">
      {/* binder holes */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col gap-6">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ECE3CD] border border-[#B9AB84]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ECE3CD] border border-[#B9AB84]" />
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={running ? onStop : onStart}
          disabled={!currentUser}
          style={{
            background: running ? "#A13A24" : "#F6EFDD",
            border: running ? "2px solid #A13A24" : "2px solid #2A251D",
            boxShadow: running ? "0 0 0 5px #A13A2418" : "none",
          }}
          className="flex items-center justify-center h-14 w-14 rounded-full disabled:opacity-30 disabled:shadow-none transition-all shrink-0"
        >
          {running ? <Square size={18} fill="#F6EFDD" color="#F6EFDD" /> : <Play size={20} fill="#2A251D" color="#2A251D" className="ml-0.5" />}
        </button>
        <div>
          <div className="flex items-center gap-2">
            <div className="font-type text-[28px] font-bold tabular-nums leading-none text-[#2A251D]">
              {running ? fmtElapsed(elapsed) : "00:00"}
            </div>
            {running && (
              <span className="flex items-center gap-1 text-[10px] font-stamp uppercase tracking-widest text-[#A13A24]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A13A24] animate-blink-dot" /> rec
              </span>
            )}
          </div>
          <div className="text-[13px] text-[#6B6151] mt-1">
            {!currentUser
              ? "Add yourself to start logging"
              : running
              ? `Recording for ${currentUser.name}`
              : "Press start when you begin a task"}
          </div>
        </div>
      </div>

      <button
        onClick={onManual}
        disabled={!currentUser}
        className="text-[13px] font-medium text-[#6B6151] hover:text-[#2A251D] disabled:opacity-30 border border-[#B9AB84] rounded-sm px-4 py-2 transition-colors"
      >
        Log manually
      </button>
    </div>
  );
}

/* ---------------------------------------------------------
   Pending entry sheet (after stop, or manual)
--------------------------------------------------------- */

function PendingSheet({ pending, setPending, tags, tagQuery, setTagQuery, onToggleTag, onAddTag, onConfirm, onDiscard, currentUser, manual }) {
  const durationMs = pending.end - pending.start;

  function setField(field, value) {
    setPending((p) => ({ ...p, [field]: value }));
  }

  function timeInputValue(ms) {
    const d = new Date(ms);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function onTimeChange(field, value) {
    const base = new Date(pending[field]);
    const [h, m] = value.split(":").map(Number);
    base.setHours(h, m, 0, 0);
    setField(field, base.getTime());
  }

  const filteredTags = tags.filter((t) => t.name.toLowerCase().includes(tagQuery.toLowerCase()));
  const exactExists = tags.some((t) => t.name.toLowerCase() === tagQuery.trim().toLowerCase());

  return (
    <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-[#2A251D]/50 backdrop-blur-[2px] px-0 sm:px-4">
      <div className="w-full sm:max-w-md bg-[#F6EFDD] border-t sm:border border-[#B9AB84] rounded-t-sm sm:rounded-sm max-h-[88vh] overflow-y-auto animate-stamp" style={{ "--stamp-rot": "-1deg" }}>
        <div className="sprocket-strip" />
        <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Avatar name={currentUser?.name} size={22} />
            <span className="text-[13px] text-[#6B6151]">{currentUser?.name}</span>
          </div>
          <button onClick={onDiscard} className="text-[#6B6151] hover:text-[#2A251D]">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-1.5 font-type text-[13px] text-[#6B6151]">
            <Clock size={13} />
            {manual ? (
              <>
                <input
                  type="time"
                  value={timeInputValue(pending.start)}
                  onChange={(e) => onTimeChange("start", e.target.value)}
                  className="bg-[#E3D8BA] border border-[#B9AB84] rounded-sm px-1.5 py-0.5 text-[#2A251D]"
                />
                <span>–</span>
                <input
                  type="time"
                  value={timeInputValue(pending.end)}
                  onChange={(e) => onTimeChange("end", e.target.value)}
                  className="bg-[#E3D8BA] border border-[#B9AB84] rounded-sm px-1.5 py-0.5 text-[#2A251D]"
                />
              </>
            ) : (
              <span>{fmtTimeShort(new Date(pending.start).toISOString())} – {fmtTimeShort(new Date(pending.end).toISOString())}</span>
            )}
          </div>
          <span className="text-[13px] font-type text-[#A13A24] font-bold">{fmtDuration(durationMs)}</span>
        </div>

        <input
          autoFocus={!manual}
          value={pending.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="What was this? e.g. chat with Shannon about scheduling"
          className="w-full bg-[#E3D8BA] border border-[#B9AB84] rounded-sm px-3 py-2.5 text-[14px] outline-none focus:border-[#A13A24] placeholder:text-[#96896F] mb-4"
        />

        <div className="mb-2 text-[11px] font-stamp uppercase tracking-wider text-[#6B6151]">Tags</div>

        {pending.tagIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {pending.tagIds.map((id) => {
              const t = tags.find((tg) => tg.id === id);
              if (!t) return null;
              return (
                <Pill key={id} active stamp color={tagColor(t.name)} onClick={() => onToggleTag(id)} onRemove={() => onToggleTag(id)}>
                  {t.name}
                </Pill>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5 mb-2">
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAddTag(); } }}
            placeholder="Type to search or create a tag"
            className="flex-1 bg-[#E3D8BA] border border-[#B9AB84] rounded-sm px-3 py-2 text-[13px] outline-none focus:border-[#A13A24] placeholder:text-[#96896F]"
          />
          {tagQuery.trim() && !exactExists && (
            <button onClick={onAddTag} className="shrink-0 rounded-sm bg-[#3C6B4522] text-[#3C6B45] px-2.5 py-2 text-[12px] font-medium border border-[#3C6B4555]">
              + Create "{tagQuery.trim()}"
            </button>
          )}
        </div>

        {filteredTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 max-h-28 overflow-y-auto">
            {filteredTags.filter((t) => !pending.tagIds.includes(t.id)).map((t) => (
              <Pill key={t.id} stamp color={tagColor(t.name)} onClick={() => onToggleTag(t.id)}>
                {t.name}
              </Pill>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 mt-5">
          <button
            onClick={onDiscard}
            className="flex-1 py-2.5 rounded-sm border border-[#B9AB84] text-[#6B6151] text-[13px] font-medium hover:text-[#2A251D] transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-sm bg-[#3C6B45] text-[#F6EFDD] text-[13px] font-semibold hover:brightness-110 transition-all"
          >
            Save entry
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   Log view
--------------------------------------------------------- */

function LogView({ grouped, users, tags, onDelete }) {
  if (grouped.length === 0) {
    return (
      <div className="text-center py-16 text-[#96896F]">
        <Clock size={28} className="mx-auto mb-3 opacity-40" />
        <div className="text-[14px]">No entries yet. Press start above, or log one manually.</div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {grouped.map((day) => {
        const totalMs = day.items.reduce((s, e) => s + (new Date(e.end) - new Date(e.start)), 0);
        return (
          <div key={day.key}>
            <div className="flex items-baseline justify-between mb-2.5 border-b border-dashed border-[#B9AB84] pb-1.5">
              <div className="text-[13px] font-stamp uppercase tracking-wide text-[#2A251D]">{day.label}</div>
              <div className="text-[12px] font-type text-[#96896F]">{fmtDuration(totalMs)} logged</div>
            </div>
            <div className="space-y-1.5">
              {day.items.map((e, i) => {
                const user = users.find((u) => u.id === e.userId);
                const dur = new Date(e.end) - new Date(e.start);
                return (
                  <div
                    key={e.id}
                    className="group flex items-center gap-3 border border-[#B9AB84]/60 bg-[#F6EFDD] px-3.5 py-2.5 hover:border-[#A13A24]/50 transition-colors"
                  >
                    <span className="font-type text-[10px] text-[#96896F] w-5 shrink-0 text-right">{String(day.items.length - i).padStart(2, "0")}</span>
                    <Avatar name={user?.name} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] truncate">{e.description}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="font-type text-[11px] text-[#96896F]">
                          {fmtTimeShort(e.start)}–{fmtTimeShort(e.end)}
                        </span>
                        {e.tagIds.map((id) => {
                          const t = tags.find((tg) => tg.id === id);
                          if (!t) return null;
                          return (
                            <span key={id} style={{ color: tagColor(t.name) }} className="font-stamp text-[10px] uppercase tracking-wide">
                              #{t.name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-[12px] font-type text-[#6B6151] shrink-0">{fmtDuration(dur)}</div>
                    <button
                      onClick={() => onDelete(e.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#96896F] hover:text-[#A13A24] transition-opacity shrink-0"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   Dashboard
--------------------------------------------------------- */

function Dashboard({ entries, users, tags }) {
  const [personFilter, setPersonFilter] = useState("all");
  const [range, setRange] = useState(7); // days
  const [selectedTag, setSelectedTag] = useState(null); // tag name or null

  const cutoff = Date.now() - range * 24 * 60 * 60 * 1000;

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (personFilter !== "all" && e.userId !== personFilter) return false;
      if (new Date(e.start).getTime() < cutoff) return false;
      return true;
    });
  }, [entries, personFilter, cutoff]);

  // per-tag stats: hours, entry count, avg duration, per-person split
  const byTag = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      const dur = new Date(e.end) - new Date(e.start);
      const tagIds = e.tagIds.length ? e.tagIds : ["__untagged"];
      const share = dur / tagIds.length;
      for (const id of tagIds) {
        const name = id === "__untagged" ? "Untagged" : (tags.find((t) => t.id === id)?.name || "Untagged");
        if (!map.has(name)) map.set(name, { ms: 0, count: 0 });
        const rec = map.get(name);
        rec.ms += share;
        rec.count += 1;
      }
    }
    return Array.from(map.entries())
      .map(([name, rec]) => ({
        name,
        hours: +(rec.ms / 3600000).toFixed(2),
        count: rec.count,
        avgMins: Math.round(rec.ms / rec.count / 60000),
        color: name === "Untagged" ? "#B9AB84" : tagColor(name),
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [filtered, tags]);

  const byPerson = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      const dur = new Date(e.end) - new Date(e.start);
      const name = users.find((u) => u.id === e.userId)?.name || "Unknown";
      map.set(name, (map.get(name) || 0) + dur);
    }
    return Array.from(map.entries()).map(([name, ms]) => ({ name, hours: +(ms / 3600000).toFixed(2) }));
  }, [filtered, users]);

  // daily totals, for busiest-day insight and trend lines
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of filtered) {
      const dur = new Date(e.end) - new Date(e.start);
      const k = dayKey(e.start);
      map.set(k, (map.get(k) || 0) + dur);
    }
    return Array.from(map.entries())
      .map(([key, ms]) => ({ key, hours: +(ms / 3600000).toFixed(2) }))
      .sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [filtered]);

  const totalHours = byTag.reduce((s, t) => s + t.hours, 0);
  const avgEntryMins = filtered.length ? Math.round(filtered.reduce((s, e) => s + (new Date(e.end) - new Date(e.start)), 0) / filtered.length / 60000) : 0;

  const insights = useMemo(() => computeInsights({ byTag, byPerson, byDay, filtered, totalHours, avgEntryMins }), [byTag, byPerson, byDay, filtered, totalHours, avgEntryMins]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-[#96896F]">
        <BarChart3 size={28} className="mx-auto mb-3 opacity-40" />
        <div className="text-[14px]">Log a few entries and this fills in.</div>
      </div>
    );
  }

  const selected = selectedTag ? byTag.find((t) => t.name === selectedTag) : null;

  return (
    <div>
      <div className="flex items-center gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-1.5">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium border transition-colors ${
                range === d ? "border-[#A13A24] text-[#A13A24] bg-[#A13A2415]" : "border-[#B9AB84] text-[#6B6151]"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Pill active={personFilter === "all"} onClick={() => setPersonFilter("all")}>Everyone</Pill>
          {users.map((u) => (
            <Pill key={u.id} active={personFilter === u.id} onClick={() => setPersonFilter(u.id)} color={tagColor(u.name)}>
              {u.name}
            </Pill>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[#96896F] text-[14px]">Nothing in this window.</div>
      ) : selected ? (
        <TagDetail
          tag={selected}
          entries={filtered.filter((e) => (selected.name === "Untagged" ? e.tagIds.length === 0 : e.tagIds.some((id) => tags.find((t) => t.id === id)?.name === selected.name)))}
          users={users}
          onBack={() => setSelectedTag(null)}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Stat label="Total logged" value={`${totalHours.toFixed(1)}h`} />
            <Stat label="Entries" value={filtered.length} />
            <Stat label="Avg entry" value={`${avgEntryMins}m`} />
            <Stat label="Tags used" value={byTag.length} />
          </div>

          {insights.length > 0 && (
            <div className="mb-8 border border-[#B9AB84] bg-[#F6EFDD] border-l-4 border-l-[#A13A24] p-4">
              <div className="text-[11px] font-stamp uppercase tracking-wider text-[#A13A24] mb-2.5">Where the time's going</div>
              <ul className="space-y-1.5">
                {insights.map((ins, i) => (
                  <li key={i} className="text-[13px] text-[#2A251D] leading-snug flex gap-2">
                    <span className="text-[#A13A24] shrink-0">→</span>
                    <span>{ins}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] font-stamp uppercase tracking-wider text-[#6B6151]">Time by tag</div>
            <div className="text-[11px] text-[#96896F]">tap a tag for detail</div>
          </div>
          <div className="space-y-1.5 mb-8">
            {byTag.map((t) => (
              <button
                key={t.name}
                onClick={() => setSelectedTag(t.name)}
                className="w-full flex items-center gap-3 border border-[#B9AB84]/60 bg-[#F6EFDD] px-3.5 py-2.5 hover:border-[#A13A24]/50 transition-colors text-left"
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: t.color }} />
                <span className="text-[13px] font-medium flex-1 truncate">{t.name}</span>
                <span className="text-[11px] text-[#96896F] font-type">{t.count} entries · avg {t.avgMins}m</span>
                <span className="font-type text-[13px] font-bold w-14 text-right">{t.hours}h</span>
                <div className="w-20 h-1.5 rounded-full bg-[#E3D8BA] overflow-hidden shrink-0 hidden sm:block">
                  <div className="h-full rounded-full" style={{ width: `${totalHours ? (t.hours / totalHours) * 100 : 0}%`, background: t.color }} />
                </div>
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <div className="text-[11px] font-stamp uppercase tracking-wider text-[#6B6151] mb-3">Share of time</div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byTag} dataKey="hours" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {byTag.map((t, i) => <Cell key={i} fill={t.color} stroke="#F6EFDD" strokeWidth={1} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#F6EFDD", border: "1px solid #B9AB84", borderRadius: 2, fontSize: 12 }}
                    formatter={(v) => [`${v}h`, "hours"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <div className="text-[11px] font-stamp uppercase tracking-wider text-[#6B6151] mb-3">By person</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byPerson}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9CBA3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "#6B6151", fontSize: 11 }} axisLine={{ stroke: "#B9AB84" }} tickLine={false} />
                  <YAxis tick={{ fill: "#6B6151", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#F6EFDD", border: "1px solid #B9AB84", borderRadius: 2, fontSize: 12 }}
                    formatter={(v) => [`${v}h`, "hours"]}
                  />
                  <Bar dataKey="hours" fill="#A13A24" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Insight heuristics — plain, explainable, no black box
--------------------------------------------------------- */

function computeInsights({ byTag, byPerson, byDay, filtered, totalHours, avgEntryMins }) {
  const out = [];
  if (byTag.length === 0) return out;

  const real = byTag.filter((t) => t.name !== "Untagged");

  // biggest time sink
  if (real.length) {
    const top = real[0];
    const pct = totalHours ? Math.round((top.hours / totalHours) * 100) : 0;
    out.push(`"${top.name}" is the biggest single draw at ${top.hours}h (${pct}% of logged time) across ${top.count} entries.`);
  }

  // fragmentation: tag with many entries but short average duration = likely interruptions
  const fragCandidates = real.filter((t) => t.count >= 3 && t.avgMins <= 15).sort((a, b) => b.count - a.count);
  if (fragCandidates.length) {
    const f = fragCandidates[0];
    out.push(`"${f.name}" shows up in short bursts — ${f.count} entries averaging ${f.avgMins}m each. That pattern usually means interruptions rather than focused work; worth asking if it can be batched.`);
  }

  // untagged share
  const untagged = byTag.find((t) => t.name === "Untagged");
  if (untagged && totalHours) {
    const pct = Math.round((untagged.hours / totalHours) * 100);
    if (pct >= 15) out.push(`${pct}% of logged time has no tag yet — tagging it would sharpen the picture above.`);
  }

  // workload imbalance across people
  if (byPerson.length >= 2) {
    const sorted = [...byPerson].sort((a, b) => b.hours - a.hours);
    const [hi, lo] = [sorted[0], sorted[sorted.length - 1]];
    if (hi.hours > 0 && hi.hours >= lo.hours * 1.6 && hi.hours - lo.hours >= 1) {
      out.push(`${hi.name} logged ${hi.hours}h vs ${lo.name}'s ${lo.hours}h in this window — worth a look if that split feels off.`);
    }
  }

  // busiest day
  if (byDay.length >= 2) {
    const busiest = [...byDay].sort((a, b) => b.hours - a.hours)[0];
    out.push(`Busiest day was ${dayLabel(busiest.key)} at ${busiest.hours}h logged.`);
  }

  return out.slice(0, 4);
}

/* ---------------------------------------------------------
   Tag drill-down
--------------------------------------------------------- */

function TagDetail({ tag, entries, users, onBack }) {
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const dur = new Date(e.end) - new Date(e.start);
      const k = dayKey(e.start);
      map.set(k, (map.get(k) || 0) + dur);
    }
    return Array.from(map.entries())
      .map(([key, ms]) => ({ key, label: dayLabel(key).replace("Today", "Tdy").replace("Yesterday", "Yes"), hours: +(ms / 3600000).toFixed(2) }))
      .sort((a, b) => (a.key < b.key ? -1 : 1));
  }, [entries]);

  const byPerson = useMemo(() => {
    const map = new Map();
    for (const e of entries) {
      const dur = new Date(e.end) - new Date(e.start);
      const name = users.find((u) => u.id === e.userId)?.name || "Unknown";
      map.set(name, (map.get(name) || 0) + dur);
    }
    return Array.from(map.entries()).map(([name, ms]) => ({ name, hours: +(ms / 3600000).toFixed(2) }));
  }, [entries, users]);

  const sorted = [...entries].sort((a, b) => new Date(b.start) - new Date(a.start));

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] text-[#6B6151] hover:text-[#2A251D] mb-4">
        <ChevronDown size={14} className="rotate-90" /> All tags
      </button>

      <div className="flex items-center gap-2.5 mb-6">
        <span className="h-3 w-3 rounded-full" style={{ background: tag.color }} />
        <h2 className="text-[18px] font-semibold">{tag.name}</h2>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Total" value={`${tag.hours}h`} />
        <Stat label="Entries" value={tag.count} />
        <Stat label="Avg length" value={`${tag.avgMins}m`} />
      </div>

      <div className="grid sm:grid-cols-2 gap-8 mb-8">
        <div>
          <div className="text-[11px] font-stamp uppercase tracking-wider text-[#6B6151] mb-3">By day</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9CBA3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#6B6151", fontSize: 11 }} axisLine={{ stroke: "#B9AB84" }} tickLine={false} />
              <YAxis tick={{ fill: "#6B6151", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#F6EFDD", border: "1px solid #B9AB84", borderRadius: 2, fontSize: 12 }}
                formatter={(v) => [`${v}h`, "hours"]}
              />
              <Bar dataKey="hours" fill={tag.color} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="text-[11px] font-stamp uppercase tracking-wider text-[#6B6151] mb-3">By person</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byPerson} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9CBA3" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#6B6151", fontSize: 11 }} axisLine={{ stroke: "#B9AB84" }} tickLine={false} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fill: "#2A251D", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#F6EFDD", border: "1px solid #B9AB84", borderRadius: 2, fontSize: 12 }}
                formatter={(v) => [`${v}h`, "hours"]}
              />
              <Bar dataKey="hours" fill={tag.color} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="text-[11px] font-stamp uppercase tracking-wider text-[#6B6151] mb-3">Entries</div>
      <div className="space-y-1.5">
        {sorted.map((e) => {
          const user = users.find((u) => u.id === e.userId);
          const dur = new Date(e.end) - new Date(e.start);
          return (
            <div key={e.id} className="flex items-center gap-3 border border-[#B9AB84]/60 bg-[#F6EFDD] px-3.5 py-2.5">
              <Avatar name={user?.name} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] truncate">{e.description}</div>
                <div className="font-type text-[11px] text-[#96896F] mt-0.5">{fmtTimeShort(e.start)}–{fmtTimeShort(e.end)}</div>
              </div>
              <div className="text-[12px] font-type text-[#6B6151] shrink-0">{fmtDuration(dur)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border border-[#B9AB84] bg-[#F6EFDD] px-4 py-3 shadow-[2px_2px_0_rgba(42,37,29,0.05)]">
      <div className="font-type text-[20px] font-bold text-[#2A251D]">{value}</div>
      <div className="text-[11px] text-[#6B6151] mt-0.5">{label}</div>
    </div>
  );
}
