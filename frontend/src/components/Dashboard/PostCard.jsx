import StatusPill from "../Common/StatusPill";
import { fmt } from "../../lib/format";

// ═════════════════════════════════════════════════════════════════════
// PostCard  (single post tile inside PostsTab)
// ═════════════════════════════════════════════════════════════════════

export default function PostCard({ post, onEdit, onUpload, uploading }) {
  const hasMedia = post.media_urls?.length > 0;
  const isVideo  = post.media_type === "VIDEO";

  return (
    <div className="bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)] overflow-hidden mb-3 transition hover:shadow-[0_8px_28px_-8px_rgba(108,71,255,0.2)]">
      {/* Media area */}
      <div className="w-full h-40 bg-[#FAFAFF] flex items-center justify-center relative group overflow-hidden">
        {hasMedia ? (
          <>
            {isVideo ? (
              <video
                src={`${post.media_urls[0]}#t=0.1`}
                className="w-full h-full object-cover"
                preload="metadata"
              />
            ) : (
              <img
                src={post.media_urls[0]}
                alt=""
                className="w-full h-full object-cover"
              />
            )}

            {/* Play icon on top of video */}
            {isVideo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/95 p-3 rounded-full shadow-lg">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#6C47FF">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Hover overlay → change media */}
            <label className="absolute inset-0 bg-[#2E1065]/0 group-hover:bg-[#2E1065]/60 transition flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100">
              <span className="text-white text-xs font-bold">
                Change {isVideo ? "video" : "photo"}
              </span>
              <input
                type="file"
                accept={isVideo ? "video/*" : "image/*"}
                className="hidden"
                onChange={e => e.target.files?.[0] && onUpload(post.id, e.target.files[0])}
              />
            </label>
          </>
        ) : (
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
        )}
      </div>

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
          <a
            href={post.ig_permalink}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-[#6C47FF] hover:text-[#5B36F0] font-bold transition"
          >
            View on Instagram →
          </a>
        )}

        {post.status === "pending_approval" && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onEdit(post)}
              className="flex-1 bg-white border border-[#EDE9FE] text-[#4C1D95] py-2 rounded-lg text-xs font-semibold hover:bg-[#FAFAFF] hover:border-[#C4B5FD] transition"
            >
              Edit caption
            </button>
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
