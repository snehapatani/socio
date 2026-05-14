import { useState } from "react";
import { api } from "../../lib/api.js";
import Logo from "../Common/Logo";
import Toast from "../Common/Toast";

// ═════════════════════════════════════════════════════════════════════
// Upload Media  (Socio brand — violet / Sora)
// ═════════════════════════════════════════════════════════════════════
export default function UploadMedia({ businessId, business, onReady }) {
  const [media, setMedia] = useState([]); // [{url, name, type}]
  const [uploading, setUpl] = useState(false);
  const [toast, setToast] = useState(null);

  const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

  async function handleFile(file) {
    if (media.length >= 3) return;
    setUpl(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.uploadMedia(businessId, fd);

      setMedia(m => [...m, {
        url:  res.media_url,   // ← was res.media_urls (singular, plural typo)
        name: file.name,
        type: file.type || "image/jpeg",
      }]);

      if (res.ready) {
        setToast({ msg: "All 3 media uploaded! Socio will generate your posts tonight." });
      }
    } catch (e) {
      setToast({ msg: e.message, type: "err" });
    } finally {
      setUpl(false);
    }
  }

  const filled    = media.length;
  const remaining = 3 - filled;

  return (
    <div className="relative min-h-screen bg-[#FAFAFF] flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Ambient violet blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-[#A78BFA] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#6C47FF] opacity-15 blur-3xl" />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="relative w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4"><Logo size={52} /></div>
          <h2
            className="text-2xl font-bold text-[#2E1065] mb-2 tracking-tight"
            style={SORA}
          >
            Upload 3 media files
          </h2>
          <p className="text-sm text-[#4C1D95]/70 leading-relaxed">
            Socio will write captions for your photos and videos and schedule them for the best times.
          </p>
        </div>

        {/* Progress (1/3, 2/3, 3/3) — mirrors the onboarding pattern */}
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

        {/* Slots */}
        <div className="space-y-3 mb-6">
          {[0, 1, 2].map(i => {
            const item       = media[i];
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
                      <video
                        src={item.url}
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-2 ring-white"
                      />
                    ) : (
                      <img
                        src={item.url}
                        alt={item.name}
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0 ring-2 ring-white"
                      />
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
                      isUploading
                        ? "bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD] text-[#4C1D95]"
                        : "bg-[#FAFAFF] border border-[#EDE9FE] text-[#A78BFA]"
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

        {/* Footer action */}
        {filled === 3 ? (
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
