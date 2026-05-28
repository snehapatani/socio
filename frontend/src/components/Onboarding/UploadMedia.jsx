import { useState } from "react";
import { api } from "../../lib/api.js";
import Logo from "../Common/Logo";
import Toast from "../Common/Toast";

// ═════════════════════════════════════════════════════════════════════
// UploadMedia
//
//  Onboarding mode (fromDashboard=false, default):
//    3 fixed slots, all must be filled, progress bar, Done at 3.
//
//  Dashboard mode (fromDashboard=true):
//    Dynamic slots, back button, "Add more" link, Done enabled at 1+.
// ═════════════════════════════════════════════════════════════════════
export default function UploadMedia({
  businessId,
  business,
  onReady,
  fromDashboard = false,
  onBack        = null,
}) {
  const [media,     setMedia]  = useState([]); // [{url, name, type}]
  const [uploading, setUpl]    = useState(false);
  const [toast,     setToast]  = useState(null);

  const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

  async function handleFile(file) {
    // Onboarding: hard-cap at 3
    if (!fromDashboard && media.length >= 3) return;
    setUpl(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.uploadMedia(businessId, fd);
      setMedia(m => [...m, { url: res.media_url, name: file.name, type: file.type || "image/jpeg" }]);
      if (!fromDashboard && res.ready) {
        setToast({ msg: "All 3 media uploaded! Socio will generate your posts tonight." });
      }
    } catch (e) {
      setToast({ msg: e.message, type: "err" });
    } finally {
      setUpl(false);
    }
  }

  const filled  = media.length;
  const canDone = fromDashboard ? filled >= 1 : filled === 3;

  // ── ONBOARDING mode ────────────────────────────────────────────────
  if (!fromDashboard) {
    const remaining = 3 - filled;
    return (
      <div className="relative min-h-screen bg-[#FAFAFF] flex flex-col items-center justify-center p-4 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-[#A78BFA] opacity-20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#6C47FF] opacity-15 blur-3xl" />

        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        <div className="relative w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4"><Logo size={52} /></div>
            <h2 className="text-2xl font-bold text-[#2E1065] mb-2 tracking-tight" style={SORA}>
              Upload 3 media files
            </h2>
            <p className="text-sm text-[#4C1D95]/70 leading-relaxed">
              Socio will write captions for your photos and videos and schedule them for the best times.
            </p>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mb-6">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < filled
                    ? "bg-[#6C47FF]"
                    : i === filled && uploading
                      ? "bg-gradient-to-r from-[#7C3AED] to-[#A78BFA] animate-pulse"
                      : "bg-[#EDE9FE]"
                }`}
              />
            ))}
          </div>

          {/* 3 fixed slots */}
          <div className="space-y-3 mb-6">
            {[0, 1, 2].map(i => {
              const item        = media[i];
              const isUploading = uploading && filled === i;
              const isVideo     = item?.type?.startsWith("video");
              return (
                <label
                  key={i}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition cursor-pointer ${
                    item
                      ? "border-[#6C47FF] bg-[#EDE9FE] shadow-[0_4px_16px_-6px_rgba(108,71,255,0.25)]"
                      : isUploading
                        ? "border-[#C4B5FD] bg-white animate-pulse"
                        : "border-dashed border-[#C4B5FD] bg-white hover:border-[#6C47FF] hover:bg-[#FAFAFF]"
                  } ${(!!item || uploading) ? "cursor-default" : ""}`}
                >
                  {item ? (
                    <>
                      {isVideo ? (
                        <video src={item.url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-2 ring-white" />
                      ) : (
                        <img src={item.url} alt={item.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-2 ring-white" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#2E1065] flex items-center gap-1.5">
                          {isVideo ? "Video" : "Photo"} {i + 1} uploaded
                          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                            <circle cx="6" cy="6" r="6" fill="#6C47FF" />
                            <polyline points="3.5,6.2 5,7.5 8.5,4" stroke="#FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                        <div className="text-[11px] text-[#4C1D95]/70 truncate">{item.name}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-base transition ${
                        isUploading ? "bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD] text-[#4C1D95]" : "bg-[#FAFAFF] border border-[#EDE9FE] text-[#A78BFA]"
                      }`} style={SORA}>
                        {isUploading ? (
                          <span className="inline-block w-3 h-3 border-2 border-[#6C47FF] border-t-transparent rounded-full animate-spin" />
                        ) : i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-[#2E1065]">
                          {isUploading ? "Uploading…" : `Media ${i + 1}`}
                        </div>
                        <div className="text-xs text-[#4C1D95]/60">
                          {isUploading ? "Processing…" : "Tap to choose photo or video"}
                        </div>
                      </div>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    disabled={!!item || uploading}
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                </label>
              );
            })}
          </div>

          {/* Footer */}
          {canDone ? (
            <button
              onClick={onReady}
              className="w-full bg-[#6C47FF] text-white py-3.5 rounded-2xl font-bold text-sm tracking-tight shadow-[0_6px_20px_-6px_rgba(108,71,255,0.55)] hover:bg-[#5B36F0] active:translate-y-px transition"
            >
              Done — go to dashboard →
            </button>
          ) : (
            <div className="text-center text-sm text-[#4C1D95]/60 font-medium">
              {remaining} more item{remaining !== 1 ? "s" : ""} needed
            </div>
          )}

          <p className="text-[11px] text-[#4C1D95]/50 text-center mt-4 leading-relaxed">
            Socio generates posts at 8pm Sunday. You can mix and match photos and videos.
          </p>
        </div>
      </div>
    );
  }

  // ── DASHBOARD mode ─────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-[#FAFAFF] flex flex-col items-center p-4 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-[#A78BFA] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#6C47FF] opacity-15 blur-3xl" />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="relative w-full max-w-sm pt-4">

        {/* ── Back button ─────────────────────────────────────────── */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#6C47FF] hover:text-[#5B36F0] mb-6 -ml-1 transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to dashboard
          </button>
        )}

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4"><Logo size={44} /></div>
          <h2 className="text-2xl font-bold text-[#2E1065] mb-2 tracking-tight" style={SORA}>
            Add to your library
          </h2>
          <p className="text-sm text-[#4C1D95]/70 leading-relaxed">
            Socio picks from these when generating your posts. Upload as many as you like.
          </p>
        </div>

        {/* ── Uploaded items ───────────────────────────────────────── */}
        <div className="space-y-3 mb-3">
          {media.map((item, i) => {
            const isVideo = item.type?.startsWith("video");
            return (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-2xl border border-[#6C47FF] bg-[#EDE9FE] shadow-[0_4px_16px_-6px_rgba(108,71,255,0.25)]"
              >
                {isVideo ? (
                  <video src={item.url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-2 ring-white" />
                ) : (
                  <img src={item.url} alt={item.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-2 ring-white" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#2E1065] flex items-center gap-1.5">
                    {isVideo ? "Video" : "Photo"} uploaded
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                      <circle cx="6" cy="6" r="6" fill="#6C47FF" />
                      <polyline points="3.5,6.2 5,7.5 8.5,4" stroke="#FFF" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="text-[11px] text-[#4C1D95]/70 truncate">{item.name}</div>
                </div>
              </div>
            );
          })}

          {/* Uploading indicator */}
          {uploading && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-[#C4B5FD] bg-white animate-pulse">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD]">
                <span className="inline-block w-4 h-4 border-2 border-[#6C47FF] border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#2E1065]">Uploading…</div>
                <div className="text-xs text-[#4C1D95]/60">Processing your file</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Add more / first upload trigger ─────────────────────── */}
        {filled === 0 && !uploading ? (
          /* Empty state — large dashed area */
          <label className="flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-[#C4B5FD] bg-white hover:border-[#6C47FF] hover:bg-[#FAFAFF] transition cursor-pointer mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD] flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6C47FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-[#2E1065]" style={SORA}>Upload photo or video</div>
              <div className="text-xs text-[#4C1D95]/60 mt-1">Tap to choose from your device</div>
            </div>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              disabled={uploading}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        ) : !uploading ? (
          /* "Add more" link after at least 1 upload */
          <label className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-dashed border-[#C4B5FD] bg-white hover:border-[#6C47FF] hover:bg-[#FAFAFF] transition cursor-pointer mb-6 group">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6C47FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span className="text-sm font-semibold text-[#6C47FF] group-hover:text-[#5B36F0] transition">
              Add more media
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              disabled={uploading}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        ) : null}

        {/* ── Footer ──────────────────────────────────────────────── */}
        {canDone ? (
          <button
            onClick={onReady}
            className="w-full bg-[#6C47FF] text-white py-3.5 rounded-2xl font-bold text-sm tracking-tight shadow-[0_6px_20px_-6px_rgba(108,71,255,0.55)] hover:bg-[#5B36F0] active:translate-y-px transition"
          >
            Done — back to dashboard →
          </button>
        ) : !uploading ? (
          <div className="text-center text-sm text-[#4C1D95]/60 font-medium">
            Upload at least one file to continue
          </div>
        ) : null}

        <p className="text-[11px] text-[#4C1D95]/50 text-center mt-4 leading-relaxed">
          You can mix photos and videos. Socio picks the best ones for each week's posts.
        </p>
      </div>
    </div>
  );
}
