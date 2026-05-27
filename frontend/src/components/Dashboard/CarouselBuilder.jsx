import { useState, useEffect, useMemo } from "react";
import { api } from "../../lib/api.js";
import Toast from "../Common/Toast.jsx";

// ═════════════════════════════════════════════════════════════════════
// CarouselBuilder  —  multi-select + reorder library items to build
//                     an Instagram carousel.
//
//   Props:
//     businessId  — used for fetching library + posting the carousel
//     onDone(post) — called with the newly-created post row
//     onCancel()   — called when user backs out
// ═════════════════════════════════════════════════════════════════════

const SORA       = { fontFamily: "Sora, Inter, system-ui, sans-serif" };
const MIN_ITEMS  = 2;
const MAX_ITEMS  = 10;

const FILTERS = [
  { id: "all",    label: "All"    },
  { id: "photo",  label: "Photos" },
  { id: "video",  label: "Videos" },
  { id: "unused", label: "Unused" },
];

export default function CarouselBuilder({ businessId, onDone, onCancel }) {
  const [media, setMedia]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("all");
  const [selected, setSelected] = useState([]);   // array of media ids, in order
  const [building, setBuilding] = useState(false);
  const [toast, setToast]       = useState(null);

  useEffect(() => {
    api.mediaLibrary(businessId)
      .then(d => setMedia(d.photos || []))
      .catch(e => setToast({ msg: e.message, type: "err" }))
      .finally(() => setLoading(false));
  }, [businessId]);

  const byId = useMemo(() => Object.fromEntries(media.map(m => [m.id, m])), [media]);

  const filtered = useMemo(() => {
    return media.filter(m => {
      const isVideo = m.content_type?.startsWith("video");
      if (filter === "photo")  return !isVideo;
      if (filter === "video")  return isVideo;
      if (filter === "unused") return (m.times_used ?? 0) === 0;
      return true;
    });
  }, [media, filter]);

  const counts = useMemo(() => {
    const videos = media.filter(m => m.content_type?.startsWith("video")).length;
    const photos = media.length - videos;
    const unused = media.filter(m => (m.times_used ?? 0) === 0).length;
    return { all: media.length, photo: photos, video: videos, unused };
  }, [media]);

  // ── Selection logic ───────────────────────────────────────────
  function toggle(id) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_ITEMS) {
        setToast({ msg: `Carousels can have up to ${MAX_ITEMS} items.`, type: "err" });
        return prev;
      }
      return [...prev, id];
    });
  }

  function remove(id) {
    setSelected(prev => prev.filter(x => x !== id));
  }

  function move(id, direction) {
    setSelected(prev => {
      const idx = prev.indexOf(id);
      const newIdx = idx + direction;
      if (idx === -1 || newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }

  function clearAll() {
    setSelected([]);
  }

  // ── Build action ──────────────────────────────────────────────
  async function build() {
    if (selected.length < MIN_ITEMS) {
      setToast({ msg: `Pick at least ${MIN_ITEMS} items.`, type: "err" });
      return;
    }
    setBuilding(true);
    try {
      const post = await api.generateCarousel(businessId, selected);
      onDone(post);
    } catch (e) {
      setToast({ msg: e.message, type: "err" });
      setBuilding(false);
    }
  }

  const enoughToBuild = selected.length >= MIN_ITEMS;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAFAFF] flex flex-col">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Top bar */}
      <div className="bg-white/95 backdrop-blur border-b border-[#EDE9FE] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onCancel}
            className="text-[#4C1D95] hover:bg-[#EDE9FE] rounded-lg p-1.5 transition flex-shrink-0"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5"  y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#2E1065] leading-tight truncate" style={SORA}>
              Build a carousel
            </div>
            <div className="text-[10px] text-[#4C1D95]/60 font-medium">
              {selected.length} of {MAX_ITEMS} selected · min {MIN_ITEMS}
            </div>
          </div>
        </div>

        {selected.length > 0 && (
          <button
            onClick={clearAll}
            className="text-[11px] font-bold text-[#4C1D95]/60 hover:text-[#4C1D95] px-2 py-1 rounded hover:bg-[#EDE9FE] transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
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
      </div>

      {/* Grid */}
      <div className="flex-1 px-4 pb-48">
        {loading && (
          <div className="text-sm text-[#4C1D95]/50 text-center py-16 font-medium">Loading library…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="text-sm text-[#4C1D95]/70 font-medium" style={SORA}>
              {media.length === 0
                ? "Upload media first — then come back and build."
                : "Nothing matches that filter."}
            </div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {filtered.map(item => {
              const order = selected.indexOf(item.id);
              const isSelected = order !== -1;
              const isVideo = item.content_type?.startsWith("video");

              return (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={`group relative aspect-square rounded-xl overflow-hidden transition ${
                    isSelected
                      ? "ring-2 ring-[#6C47FF] ring-offset-2 ring-offset-[#FAFAFF] shadow-[0_4px_16px_-4px_rgba(108,71,255,0.4)]"
                      : "border border-[#EDE9FE] hover:border-[#C4B5FD]"
                  }`}
                >
                  {isVideo ? (
                    <video
                      src={`${item.media_url}#t=0.1`}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                    />
                  ) : (
                    <img
                      src={item.media_url}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}

                  {isVideo && !isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-white/90 p-1.5 rounded-full">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#6C47FF">
                          <path d="M8 5.14v14l11-7-11-7z" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Order badge — top right when selected */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-[#6C47FF]/15 flex items-start justify-end p-2">
                      <div
                        className="w-7 h-7 rounded-full bg-[#6C47FF] text-white text-xs font-bold flex items-center justify-center shadow-md"
                        style={SORA}
                      >
                        {order + 1}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom: selected strip + build button */}
      {selected.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#EDE9FE] shadow-[0_-12px_30px_-12px_rgba(108,71,255,0.2)] z-20">
          {/* Selected strip */}
          <div className="px-4 pt-3 pb-2 overflow-x-auto">
            <div className="text-[10px] font-bold text-[#6C47FF] tracking-[0.18em] mb-2">
              IN CAROUSEL ({selected.length})
            </div>
            <div className="flex gap-2">
              {selected.map((id, idx) => {
                const item = byId[id];
                if (!item) return null;
                const isVideo = item.content_type?.startsWith("video");
                return (
                  <SelectedTile
                    key={id}
                    item={item}
                    isVideo={isVideo}
                    order={idx + 1}
                    canMoveLeft={idx > 0}
                    canMoveRight={idx < selected.length - 1}
                    onRemove={() => remove(id)}
                    onMoveLeft={() => move(id, -1)}
                    onMoveRight={() => move(id, +1)}
                  />
                );
              })}
            </div>
          </div>

          {/* Build button */}
          <div className="px-4 pb-4 pt-2">
            <button
              onClick={build}
              disabled={!enoughToBuild || building}
              className="w-full bg-[#6C47FF] text-white py-3 rounded-2xl font-bold text-sm tracking-tight shadow-[0_6px_20px_-6px_rgba(108,71,255,0.55)] hover:bg-[#5B36F0] active:translate-y-px disabled:opacity-50 disabled:hover:bg-[#6C47FF] transition flex items-center justify-center gap-2"
            >
              {building ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Building carousel…
                </>
              ) : enoughToBuild ? (
                <>✦ Generate carousel ({selected.length})</>
              ) : (
                <>Pick {MIN_ITEMS - selected.length} more to continue</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── A single tile in the bottom "selected" strip ────────────────────
function SelectedTile({ item, isVideo, order, canMoveLeft, canMoveRight, onRemove, onMoveLeft, onMoveRight }) {
  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1">
      <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#EDE9FE]">
        {isVideo ? (
          <video src={`${item.media_url}#t=0.1`} className="w-full h-full object-cover" preload="metadata" muted />
        ) : (
          <img src={item.media_url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-[#6C47FF] text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
          {order}
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove from carousel"
          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm hover:bg-rose-600 transition"
        >
          ×
        </button>
      </div>

      {/* Reorder buttons */}
      <div className="flex gap-0.5">
        <button
          onClick={onMoveLeft}
          disabled={!canMoveLeft}
          aria-label="Move left"
          className="w-7 h-5 rounded bg-[#FAFAFF] border border-[#EDE9FE] text-[#4C1D95] flex items-center justify-center disabled:opacity-30 hover:bg-[#EDE9FE] transition"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <button
          onClick={onMoveRight}
          disabled={!canMoveRight}
          aria-label="Move right"
          className="w-7 h-5 rounded bg-[#FAFAFF] border border-[#EDE9FE] text-[#4C1D95] flex items-center justify-center disabled:opacity-30 hover:bg-[#EDE9FE] transition"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
