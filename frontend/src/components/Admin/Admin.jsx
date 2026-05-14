import { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api.js";
import { getSession, getProfile, signOut, onAuthChange } from "../../lib/auth";
import Logo from "../Common/Logo";
import SignIn from "../Landing/SignIn";
import { fmt, num } from "../../lib/format";
import { useConfirm } from "../Common/Modal";

// ═════════════════════════════════════════════════════════════════════
// Admin  —  protected by profiles.role = 'admin'.
//   No more shared key. Uses the same Supabase session as the rest of
//   the app, but the gate fails for any non-admin profile.
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

export default function Admin() {
  const [session,    setSession]    = useState(undefined); // undefined = loading
  const [profile,    setProfile]    = useState(null);
  const [stats,      setStats]      = useState(null);
  const [biz,        setBiz]        = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [search,     setSearch]     = useState("");

  // Subscribe to session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getSession();
      if (!cancelled) setSession(s);
    })();
    const unsub = onAuthChange(s => { if (!cancelled) setSession(s); });
    return () => { cancelled = true; unsub(); };
  }, []);

  // Load profile when session changes
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    let cancelled = false;
    getProfile(session.user.id)
      .then(p => { if (!cancelled) setProfile(p); })
      .catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [session]);

  // Load admin data once we confirm role
  useEffect(() => {
    if (profile?.role !== "admin") return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [s, b] = await Promise.all([api.adminStats(), api.adminListBusinesses()]);
      setStats(s);
      setBiz(b.businesses || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return biz;
    const q = search.trim().toLowerCase();
    return biz.filter(b =>
      (b.name           || "").toLowerCase().includes(q) ||
      (b.owner_email    || "").toLowerCase().includes(q) ||
      (b.business_type  || "").toLowerCase().includes(q) ||
      (b.instagram_page?.ig_username || "").toLowerCase().includes(q)
    );
  }, [biz, search]);

  // ── Loading initial session ───────────────────────────────────────
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#FAFAFF] flex items-center justify-center">
        <div className="text-sm text-[#4C1D95]/60 font-medium">Loading…</div>
      </div>
    );
  }

  // ── Not signed in — show SignIn ───────────────────────────────────
  if (!session) {
    return (
      <SignIn
        onSignedIn={() => {}}    // session change handled by effect above
        onBack={() => { window.location.href = "/"; }}
        onCreateInstead={() => { window.location.href = "/"; }}
      />
    );
  }

  // ── Signed in but not admin ───────────────────────────────────────
  if (profile && profile.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#FAFAFF] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl border border-[#EDE9FE] shadow-[0_8px_40px_-12px_rgba(108,71,255,0.18)] p-8 max-w-sm text-center">
          <div className="flex justify-center mb-4"><Logo size={48} /></div>
          <h2 className="text-xl font-bold text-[#2E1065] mb-2" style={SORA}>Not authorized</h2>
          <p className="text-sm text-[#4C1D95]/70 mb-5">This area is restricted to admins.</p>
          <div className="flex gap-2">
            <button
              onClick={() => { window.location.href = "/"; }}
              className="flex-1 bg-white border border-[#EDE9FE] text-[#4C1D95] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FAFAFF] transition"
            >
              Back to app
            </button>
            <button
              onClick={async () => { await signOut(); }}
              className="flex-1 bg-[#6C47FF] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#5B36F0] transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── AUTHED ADMIN: dashboard ──────────────────────────────────────
  const subStatus = stats?.businesses?.by_sub_status || {};

  return (
    <div className="min-h-screen bg-[#FAFAFF]">
      <div className="bg-white border-b border-[#EDE9FE] px-5 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <div>
            <div className="text-sm font-bold text-[#2E1065] tracking-tight" style={SORA}>Socio · Admin</div>
            <div className="text-[10px] text-[#6C47FF] font-bold tracking-wider">{profile?.full_name || session.user.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="text-xs font-semibold text-[#4C1D95]/70 hover:text-[#4C1D95] px-3 py-1.5 rounded-lg hover:bg-[#EDE9FE] transition"
          >
            ↻ Refresh
          </button>
          <button
            onClick={async () => { await signOut(); window.location.href = "/"; }}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-5">
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-4 text-xs text-rose-700">{error}</div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Businesses"   val={stats?.businesses?.total} />
          <StatCard label="Onboarded"    val={stats?.businesses?.onboarded} />
          <StatCard label="IG connected" val={`${stats?.instagram?.active ?? 0} / ${stats?.instagram?.total ?? 0}`} />
          <StatCard label="Total posts"  val={num(stats?.posts?.total)} />
        </div>

        {/* Sub-status breakdown */}
        {Object.keys(subStatus).length > 0 && (
          <div className="bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)] p-4 mb-6">
            <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-3">SUBSCRIPTION STATUS</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(subStatus).map(([k, v]) => (
                <div key={k} className="bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl px-3 py-1.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#4C1D95] capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="text-xs font-bold text-[#2E1065]" style={SORA}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)] p-3 mb-3 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" className="flex-shrink-0 ml-1">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, type, or @ig_username…"
            className="flex-1 bg-transparent text-sm text-[#2E1065] placeholder-gray-400 outline-none"
          />
          <span className="text-[11px] text-[#4C1D95]/60 font-semibold pr-2">{filtered.length} / {biz.length}</span>
        </div>

        {/* Business table */}
        <div className="bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)] overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-3 bg-[#FAFAFF] border-b border-[#EDE9FE] text-[10px] font-bold text-[#6C47FF] tracking-[0.15em] uppercase">
            <div className="col-span-3">Business</div>
            <div className="col-span-2">Type · Tone</div>
            <div className="col-span-2">Plan · Status</div>
            <div className="col-span-3">Instagram</div>
            <div className="col-span-1 text-right">Posts</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {loading && <div className="px-4 py-12 text-center text-sm text-[#4C1D95]/60">Loading…</div>}

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[#4C1D95]/60">
              {biz.length === 0 ? "No businesses yet." : "No matches for that search."}
            </div>
          )}

          {!loading && filtered.map(b => (
            <BusinessRow key={b.id} b={b} onChange={refresh} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, val }) {
  return (
    <div className="bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)] p-4">
      <div className="text-3xl font-bold text-[#2E1065]" style={{ fontFamily: "Sora, Inter, system-ui, sans-serif" }}>
        {val ?? "—"}
      </div>
      <div className="text-[11px] text-[#4C1D95]/60 mt-1 font-semibold uppercase tracking-wider">{label}</div>
    </div>
  );
}

function BusinessRow({ b, onChange }) {
  const ig = b.instagram_page;
  const [busy, setBusy] = useState(false);

  const confirm = useConfirm();

async function suspend() {
  const ok = await confirm({
    title:        "Suspend this business?",
    message:      `${b.name} will be marked cancelled and stop receiving generated posts.`,
    variant:      "danger",
    confirmLabel: "Suspend",
  });
  if (!ok) return;
  setBusy(true);
  try { await api.adminSuspendBusiness(b.id); onChange(); }
  catch (e) { /* show toast */ }
  finally { setBusy(false); }
}

return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-3 border-b border-[#EDE9FE] last:border-0 hover:bg-[#FAFAFF] transition items-center text-xs">
      <div className="md:col-span-3 min-w-0">
        <div className="font-bold text-[#2E1065] truncate">{b.name}</div>
        <div className="text-[#4C1D95]/70 truncate">{b.owner_email}</div>
      </div>
      <div className="md:col-span-2 min-w-0">
        <div className="text-[#2E1065] capitalize">{b.business_type || "—"}</div>
        <div className="text-[#4C1D95]/60 capitalize">{(b.brand_tone || "").replace(/_/g, " ")}</div>
      </div>
      <div className="md:col-span-2 min-w-0">
        <div className="text-[#2E1065] capitalize">{b.plan_id || "—"}</div>
        <div>
          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            b.sub_status === "active"   ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
            b.sub_status === "trialing" ? "bg-[#EDE9FE]  text-[#4C1D95]    border-[#C4B5FD]"  :
                                          "bg-rose-50    text-rose-700    border-rose-200"
          }`}>
            {(b.sub_status || "—").replace(/_/g, " ")}
          </span>
        </div>
      </div>
      <div className="md:col-span-3 min-w-0">
        {ig ? (
          <>
            <div className="font-semibold text-[#2E1065] truncate flex items-center gap-1.5">
              @{ig.ig_username}
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${ig.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
            </div>
            <div className="text-[#4C1D95]/60">{ig.followers_count?.toLocaleString() ?? 0} followers</div>
          </>
        ) : <span className="text-[#4C1D95]/40">Not connected</span>}
      </div>
      <div className="md:col-span-1 text-right">
        <div className="font-bold text-[#2E1065]" style={{ fontFamily: "Sora, Inter, system-ui, sans-serif" }}>
          {b.posts_used_this_week ?? 0}
        </div>
        <div className="text-[10px] text-[#4C1D95]/60">this wk</div>
      </div>
      <div className="md:col-span-1 text-right">
        {b.sub_status !== "cancelled" && (
          <button
            onClick={suspend}
            disabled={busy}
            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 px-2 py-1 rounded hover:bg-rose-50 disabled:opacity-50 transition"
          >
            Suspend
          </button>
        )}
      </div>
    </div>
  );
}
