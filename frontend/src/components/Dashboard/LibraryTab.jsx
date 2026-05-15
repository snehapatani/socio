import { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api.js";
import { fmt } from "../../lib/format";
import Toast from "../Common/Toast";
import { useConfirm } from "../Common/Modal";

// ═════════════════════════════════════════════════════════════════════
// Library tab  —  grid of all uploaded media (photos + videos).
//   Tap a tile → detail modal (preview, metadata, remove).
//   Upload button bridges to the existing upload-media flow.
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

const FILTERS = [
  { id: "all",    label: "All"    },
  { id: "photo",  label: "Photos" },
  { id: "video",  label: "Videos" },
  { id: "unused", label: "Unused" },
];

export default function LibraryTab({ businessId, onUploadMore }) {
  const [media, setMedia]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [filter, setFilter]     = useState("all");
  const [selected, setSelected] = useState(null);
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const data = await api.mediaLibrary(businessId);
      setMedia(data.photos || []);
    } catch (e) {
      setToast({ msg: e.message, type: "err" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [businessId]);

  // Counts per filter (computed once, not per render)
  const counts = useMemo(() => {
    const videos = media.filter(m => m.content_type?.startsWith("video")).length;
    const photos = media.length - videos;
    const unused = media.filter(m => (m.times_used ?? 0) === 0).length;
    return { all: media.length, photo: photos, video: videos, unused };
  }, [media]);

  const filtered = useMemo(() => {
    return media.filter(m => {
      const isVideo = m.content_type?.startsWith("video");
      if (filter === "photo")  return !isVideo;
      if (filter === "video")  return isVideo;
      if (filter === "unused") return (m.times_used ?? 0) === 0;
      return true;
    });
  }, [media, filter]);

  async function handleDelete(item) {
    const ok = await confirm({
      title:        "Remove from library?",
      message:      "This media will be hidden from your library, but posts already using it stay intact.",
      variant:      "danger",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    try {
      await api.deleteMedia(businessId, item.id);
      setMedia(prev => prev.filter(m => m.id !== item.id));
      setSelected(null);
      setToast({ msg: "Removed from library" });
    } catch (e) {
      setToast({ msg: e.message, type: "err" });
    }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-end justify-between mb-4 px-1">
        <div className="min-w-0">
          <div className="text-[11px] font-bold text-[#6C47FF]/70 tracking-[0.18em] uppercase">YOUR</div>
          <div className="text-2xl font-bold text-[#2E1065] tracking-tight" style={SORA}>Library</div>
          <div className="text-[11px] text-[#4C1D95]/60 mt-1 font-medium">
            {counts.photo} photo{counts.photo !== 1 ? "s" : ""} · {counts.video} video{counts.video !== 1 ? "s" : ""}
          </div>
        </div>
        <button
          onClick={onUploadMore}
          className="bg-[#6C47FF] text-white px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight shadow-[0_4px_14px_-4px_rgba(108,71,255,0.5)] hover:bg-[#5B36F0] active:translate-y-px transition flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Upload
        </button>
      </div>

      {/* ── Filter pills ──────────────────────────────────────── */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              filter === f.id
                ? "bg-[#6C47FF] text-white shadow-[0_4px_12px_-4px_rgba(108,71,255,0.5)]"
                : "bg-white border border-[#EDE9FE] text-[#4C1D95] hover:border-[#C4B5FD]"
            }`}
          >
            {f.label}
            <span className={`text-[10px] font-bold ${filter === f.id ? "opacity-80" : "text-[#6C47FF]/70"}`}>
              {counts[f.id]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Loading / empty / grid ─────────────────────────────── */}
      {loading && (
        <div className="text-sm text-[#4C1D95]/50 text-center py-16 font-medium">Loading library…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD] flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4C1D95" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <div className="text-sm text-[#4C1D95]/70 font-medium" style={SORA}>
            {media.length === 0   ? "No media yet — upload your first photo or video." :
             filter   === "video" ? "No videos in your library yet." :
             filter   === "unused"? "Every item has been used at least once." :
                                    "Nothing matches that filter."}
          </div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {filtered.map(item => (
            <MediaTile key={item.id} item={item} onClick={() => setSelected(item)} />
          ))}
        </div>
      )}

      {selected && (
        <MediaDetail
          item={selected}
          onClose={() => setSelected(null)}
          onDelete={() => handleDelete(selected)}
        />
      )}
    </div>
  );
}

// ── Single tile in the grid ─────────────────────────────────────────
function MediaTile({ item, onClick }) {
  const isVideo = item.content_type?.startsWith("video");
  const isUsed  = (item.times_used ?? 0) > 0;

  return (
    <button
      onClick={onClick}
      className="group relative aspect-square rounded-2xl overflow-hidden bg-[#FAFAFF] border border-[#EDE9FE] hover:border-[#6C47FF] hover:shadow-[0_8px_24px_-8px_rgba(108,71,255,0.3)] transition"
    >
      {isVideo ? (
        <>
          <video
            src={`${item.media_url}#t=0.1`}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 p-2 rounded-full shadow-md">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#6C47FF">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </div>
          </div>
        </>
      ) : (
        <img
          src={item.media_url}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}

      {/* "Used N×" badge — top right */}
      {isUsed && (
        <div className="absolute top-2 right-2 bg-[#2E1065]/85 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {item.times_used}×
        </div>
      )}

      {/* "New / unused" dot — top left */}
      {!isUsed && (
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-[#6C47FF] ring-2 ring-white" />
      )}
    </button>
  );
}

// ── Detail modal ────────────────────────────────────────────────────
function MediaDetail({ item, onClose, onDelete }) {
  const isVideo = item.content_type?.startsWith("video");

  return (
    <div
      className="fixed inset-0 bg-[#2E1065]/50 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-[modal-fade_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-[#EDE9FE] shadow-[0_20px_60px_-12px_rgba(46,16,101,0.4)] max-w-md w-full overflow-hidden animate-[modal-pop_0.18s_ease-out]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Preview */}
        <div className="bg-[#FAFAFF] aspect-square flex items-center justify-center overflow-hidden">
          {isVideo ? (
            <video src={item.media_url} controls className="w-full h-full object-contain" />
          ) : (
            <img src={item.media_url} alt="" className="w-full h-full object-contain" />
          )}
        </div>

        {/* Info */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em]">
              {isVideo ? "VIDEO" : "PHOTO"}
            </div>
            <div className="text-[11px] text-[#4C1D95]/60 font-semibold">
              {(item.times_used ?? 0) > 0 ? `Used ${item.times_used}×` : "Not used yet"}
            </div>
          </div>

          <div className="space-y-1.5 mb-5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#4C1D95]/60 font-medium">Added</span>
              <span className="text-[#2E1065] font-semibold">{fmt(item.created_at)}</span>
            </div>
            {item.last_used_at && (
              <div className="flex justify-between">
                <span className="text-[#4C1D95]/60 font-medium">Last used</span>
                <span className="text-[#2E1065] font-semibold">{fmt(item.last_used_at)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-white border border-[#EDE9FE] text-[#4C1D95] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FAFAFF] transition"
            >
              Close
            </button>
            <button
              onClick={onDelete}
              className="flex-1 bg-white border border-rose-200 text-rose-600 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-50 transition flex items-center justify-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Remove
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes modal-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modal-pop {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}
