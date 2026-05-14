import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import { num } from "../../lib/format";
import StatusPill from "../Common/StatusPill";
import Toast from "../Common/Toast";

// ═════════════════════════════════════════════════════════════════════
// Dashboard tab  —  morning check-in. Three things, in order of weight:
//   1. What's going out this week (hero)
//   2. Is the account connected (only loud when disconnected)
//   3. How am I doing overall (footer stats)
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };
const CARD = "bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)]";
const WEEKLY_LIMIT = 3;

export default function DashboardTab({ businessId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null);

  useEffect(() => {
    api.getDashboard(businessId)
      .then(setData)
      .catch(e => setToast({ msg: e.message, type: "err" }))
      .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) return <div className="text-sm text-[#4C1D95]/50 text-center py-16 font-medium">Loading…</div>;
  if (!data)   return <div className="text-sm text-[#4C1D95]/50 text-center py-16 font-medium">No data</div>;

  const ig    = data.instagram_page;
  const posts = data.posts_this_week || [];
  const used  = posts.length;

  const today = new Date();
  const weekday = today.toLocaleDateString(undefined, { weekday: "long" });
  const monthDay = today.toLocaleDateString(undefined, { month: "long", day: "numeric" });

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24 space-y-3">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── IG warning (only when disconnected) ────────────────── */}
      {ig && !ig.is_active && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
          <div className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 font-bold flex items-center justify-center flex-shrink-0 text-xs">!</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-amber-800">Instagram disconnected</div>
            <div className="text-[11px] text-amber-700/80 mt-0.5 font-medium">
              Posts will save but won't publish. Reconnect from settings.
            </div>
          </div>
        </div>
      )}
      {/* ── Account context — always at top, state-aware ──────── */}
    {ig?.is_active ? (
      <div className={`${CARD} p-3.5 flex items-center gap-3`}>
        {ig.profile_picture_url ? (
          <img src={ig.profile_picture_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-[#EDE9FE]" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6C47FF] to-[#A78BFA] flex items-center justify-center text-white text-xs font-bold" style={SORA}>
            IG
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-[#2E1065] truncate">@{ig.ig_username}</div>
          <div className="text-[11px] text-[#4C1D95]/60 font-medium">
            {ig.followers_count?.toLocaleString() || 0} followers
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Live
        </div>
      </div>
    ) : ig ? (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
        <div className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 font-bold flex items-center justify-center flex-shrink-0 text-xs">!</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-amber-800">Instagram disconnected</div>
          <div className="text-[11px] text-amber-700/80 mt-0.5 font-medium">
            Posts will save but won't publish. Reconnect from settings.
          </div>
        </div>
      </div>
    ) : null}

{/* ── Date grounding ─────────────────────────────────────── */}
      <div className="px-1 pb-1">
        <div className="text-[11px] font-bold text-[#6C47FF]/70 tracking-[0.18em] uppercase">
          {weekday}
        </div>
        <div className="text-2xl font-bold text-[#2E1065] tracking-tight leading-tight" style={SORA}>
          {monthDay}
        </div>
      </div>

      {/* ── HERO · This week ───────────────────────────────────── */}
      <div className={`${CARD} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em]">THIS WEEK</div>
            <div className="text-sm text-[#4C1D95]/70 mt-1 font-medium">
              {used === 0 ? "Nothing scheduled yet" :
               used === WEEKLY_LIMIT ? "All set for this week" :
               `${used} of ${WEEKLY_LIMIT} posts scheduled`}
            </div>
          </div>
          <div className="flex gap-1.5" aria-label={`${used} of ${WEEKLY_LIMIT} posts used`}>
            {Array.from({ length: WEEKLY_LIMIT }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition ${
                  i < used ? "bg-gradient-to-br from-[#6C47FF] to-[#A78BFA]" : "bg-[#EDE9FE]"
                }`}
              />
            ))}
          </div>
        </div>

        {posts.length > 0 ? (
          <div className="-mx-2">
            {posts.map(p => <PostRow key={p.id} post={p} />)}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-2 text-[#6C47FF]">✦</div>
            <div className="text-xs text-[#4C1D95]/60 font-medium">
              Head to the Posts tab to generate this week's content.
            </div>
          </div>
        )}
      </div>

      {/* ── Performance footer ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5 pt-1">
        {[
          { label: "Published", val: data.total_published ?? 0 },
          { label: "Reach",     val: num(data.total_reach) },
          { label: "Saves",     val: num(data.total_saves) },
        ].map(({ label, val }) => (
          <div key={label} className={`${CARD} p-3.5 text-center`}>
            <div className="text-xl font-bold text-[#2E1065]" style={SORA}>{val}</div>
            <div className="text-[10px] text-[#4C1D95]/60 mt-0.5 font-semibold uppercase tracking-wider">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Single post row in the "This week" timeline ─────────────────────
function PostRow({ post }) {
  const d = post.scheduled_at ? new Date(post.scheduled_at) : null;

  const day  = d ? d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase() : "—";
  const time = d ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase() : "";

  return (
    <div className="flex items-start gap-3 px-2 py-3 border-t border-[#EDE9FE] first:border-0">
      <div className="flex-shrink-0 w-11 text-center">
        <div className="text-[10px] font-bold text-[#6C47FF] tracking-wider">{day}</div>
        <div className="text-[10px] text-[#4C1D95]/60 font-medium mt-0.5">{time}</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#2E1065] leading-relaxed line-clamp-2">
          {post.caption || <span className="text-[#4C1D95]/40 italic">No caption yet</span>}
        </div>
      </div>
      <div className="flex-shrink-0">
        <StatusPill status={post.status} />
      </div>
    </div>
  );
}
