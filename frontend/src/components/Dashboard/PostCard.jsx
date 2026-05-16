import { useState } from "react";
import StatusPill from "../Common/StatusPill";
import { fmt } from "../../lib/format";

// Match the same extensions the backend's _looks_like_video() uses
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm"];
function isVideoUrl(url) {
  if (!url) return false;
  const clean = url.toLowerCase().split("?")[0];
  return VIDEO_EXTENSIONS.some(ext => clean.endsWith(ext));
}

export default function PostCard({ post, onEdit, onDelete, onUpload, uploading }) {
  const urls         = post.media_urls || [];
  const hasMedia     = urls.length > 0;
  const isCarousel   = post.media_type === "CAROUSEL" || urls.length > 1;
  const postIsVideo  = post.media_type === "VIDEO";
  const isPublished  = post.status === "published";
  const isPending    = post.status === "pending_approval";

  const [activeSlide, setActiveSlide] = useState(0);
  const activeUrl     = urls[activeSlide];
  const activeIsVideo = isVideoUrl(activeUrl);

  // Action matrix:
  //   pending_approval → edit caption ✅, change media ✅ (singles only), delete ✅
  //   approved/scheduled/failed → delete ✅
  //   published        → none
  const canEditCaption = isPending;
  const canChangeMedia = isPending && !isCarousel;
  const canDelete      = !isPublished;

  return (
    <div className="bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)] overflow-hidden mb-3 transition hover:shadow-[0_8px_28px_-8px_rgba(108,71,255,0.2)]">
      {/* Hero media */}
      <div className="w-full h-40 bg-[#FAFAFF] flex items-center justify-center relative group overflow-hidden">
        {hasMedia ? (
          <>
            {activeIsVideo ? (
              <video
                src={`${activeUrl}#t=0.1`}
                className="w-full h-full object-cover"
                preload="metadata"
                muted
              />
            ) : (
              <img src={activeUrl} alt="" className="w-full h-full object-cover" />
            )}

            {isCarousel && (
              <div className="absolute top-2 right-2 bg-[#2E1065]/85 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="14" height="14" rx="2"/>
                  <rect x="7" y="7" width="14" height="14" rx="2"/>
                </svg>
                {activeSlide + 1} / {urls.length}
              </div>
            )}

            {activeIsVideo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/95 p-3 rounded-full shadow-lg">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#6C47FF">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                </div>
              </div>
            )}

            {canChangeMedia && (
              <label className="absolute inset-0 bg-[#2E1065]/0 group-hover:bg-[#2E1065]/60 transition flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100">
                <span className="text-white text-xs font-bold">
                  Change {postIsVideo ? "video" : "photo"}
                </span>
                <input
                  type="file"
                  accept={postIsVideo ? "video/*" : "image/*"}
                  className="hidden"
                  onChange={e => e.target.files?.[0] && onUpload(post.id, e.target.files[0])}
                />
              </label>
            )}
          </>
        ) : isPending ? (
          <label className="cursor-pointer flex flex-col items-center gap-2 text-[#A78BFA] hover:text-[#6C47FF] transition">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <polyline points="21,15 16,10 5,21" />
            </svg>
            <span className="text-xs font-semibold">
              {uploading ? "Uploading…" : "Upload photo or video"}
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              disabled={uploading}
              onChange={e => e.target.files?.[0] && onUpload(post.id, e.target.files[0])}
            />
          </label>
        ) : (
          <div className="text-xs text-[#4C1D95]/40 font-medium">No media</div>
        )}
      </div>

      {/* Carousel thumbnail strip */}
      {isCarousel && (
        <div className="bg-[#FAFAFF] border-t border-[#EDE9FE] px-3 py-2 flex gap-1.5 overflow-x-auto">
          {urls.map((url, i) => {
            const slideIsVideo = isVideoUrl(url);
            const isActive     = i === activeSlide;
            return (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                aria-label={`Show ${slideIsVideo ? "video" : "photo"} ${i + 1}`}
                className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border transition relative ${
                  isActive
                    ? "border-[#6C47FF] ring-2 ring-[#6C47FF]/30"
                    : "border-[#EDE9FE] hover:border-[#C4B5FD] opacity-70 hover:opacity-100"
                }`}
              >
                {slideIsVideo ? (
                  <video src={`${url}#t=0.1`} className="w-full h-full object-cover" preload="metadata" muted />
                ) : (
                  <img src={url} alt="" className="w-full h-full object-cover" />
                )}

                {slideIsVideo && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/90 rounded-full w-4 h-4 flex items-center justify-center">
                      <svg width="6" height="6" viewBox="0 0 24 24" fill="#6C47FF">
                        <path d="M8 5.14v14l11-7-11-7z" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-[#4C1D95]/60 font-medium">{fmt(post.scheduled_at)}</span>
          <StatusPill status={post.status} />
        </div>

        <p className="text-sm text-[#2E1065] leading-relaxed line-clamp-3 mb-3">{post.caption}</p>

        {post.hashtags?.length > 0 && (
          <p className="text-[11px] text-[#7C3AED] mb-3 font-semibold">
            {post.hashtags.slice(0, 5).map(h => `#${h}`).join(" ")}
          </p>
        )}

        {post.post_theme && (
          <p className="text-[11px] text-[#4C1D95]/60 mb-3 italic">💡 {post.post_theme}</p>
        )}

        {post.ig_permalink && (

            <a href={post.ig_permalink}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-[#6C47FF] hover:text-[#5B36F0] font-bold transition"
          >
            View on Instagram →
          </a>
        )}

        {/* Action row — adapts to which actions are available */}
        {(canEditCaption || canDelete) && (
          <div className={`flex gap-2 mt-3 ${canEditCaption ? "" : "justify-end"}`}>
            {canEditCaption && (
              <button
                onClick={() => onEdit(post)}
                className="flex-1 bg-white border border-[#EDE9FE] text-[#4C1D95] py-2 rounded-lg text-xs font-semibold hover:bg-[#FAFAFF] hover:border-[#C4B5FD] transition"
              >
                Edit caption
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(post)}
                aria-label="Delete post"
                className="px-3 py-2 bg-white border border-rose-200 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-50 transition flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Delete
              </button>
            )}
          </div>
        )}

        {post.status === "failed" && post.error_message && (
          <div className="mt-2 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
            {post.error_message}
          </div>
        )}
      </div>
    </div>
  );
}
