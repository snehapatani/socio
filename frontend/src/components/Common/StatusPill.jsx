// ── Status pill ───────────────────────────────────────────────────────
//
// Color strategy:
//   • Approved      → brand violet (the "good to go" state)
//   • Pending       → amber (universal "needs your attention")
//   • Scheduled     → indigo (in flight, distinguishable from brand)
//   • Published     → emerald (universal success signal)
//   • Failed        → rose (universal error signal)
//   • Draft / unknown → quiet violet-tinted gray

const STATUS_STYLES = {
  draft:            "bg-[#FAFAFF]    text-[#4C1D95]/70  border-[#EDE9FE]",
  pending_approval: "bg-amber-50     text-amber-700     border-amber-200",
  pending:          "bg-amber-50     text-amber-700     border-amber-200",
  approved:         "bg-[#EDE9FE]    text-[#4C1D95]     border-[#C4B5FD]",
  scheduled:        "bg-indigo-50    text-indigo-700    border-indigo-200",
  published:        "bg-emerald-50   text-emerald-700   border-emerald-200",
  failed:           "bg-rose-50      text-rose-700      border-rose-200",
};

const STATUS_LABELS = {
  draft:            "Draft",
  pending_approval: "Pending",
  pending:          "Pending",
  approved:         "Approved",
  scheduled:        "Scheduled",
  published:        "Published",
  failed:           "Failed",
};

export default function StatusPill({ status }) {
  const cls   = STATUS_STYLES[status] || STATUS_STYLES.draft;
  const label = STATUS_LABELS[status] || prettyFallback(status);

  return (
    <span
      className={`inline-flex items-center text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-full border whitespace-nowrap ${cls}`}
      style={{ fontFamily: "Sora, Inter, system-ui, sans-serif" }}
    >
      {label}
    </span>
  );
}

// Fallback: turn "some_unknown_status" → "Some unknown status"
function prettyFallback(s = "") {
  return s.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}
