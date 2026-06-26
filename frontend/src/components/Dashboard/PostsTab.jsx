import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api.js";
import Toast from "../Common/Toast";
import PostCard from "./PostCard";
import EditCaptionModal from "./EditCaptionModal";
import CarouselBuilder from "./CarouselBuilder";   // ← FIX #2
import { useConfirm } from "../Common/Modal";

// ═════════════════════════════════════════════════════════════════════
// Posts tab  (Socio brand — violet / Sora)
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

const PRIMARY_BTN =
  "flex-1 bg-[#6C47FF] text-white py-2.5 rounded-xl text-sm font-bold tracking-tight " +
  "shadow-[0_4px_14px_-4px_rgba(108,71,255,0.5)] hover:bg-[#5B36F0] active:translate-y-px " +
  "disabled:opacity-60 disabled:hover:bg-[#6C47FF] transition flex items-center justify-center gap-2";

const SECONDARY_BTN =
  "flex-1 bg-white border border-[#EDE9FE] text-[#4C1D95] py-2.5 rounded-xl text-sm font-semibold " +
  "hover:bg-[#FAFAFF] hover:border-[#C4B5FD] disabled:opacity-60 transition " +
  "flex items-center justify-center gap-2";

const Spinner = () => (
  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
);

// ── FIX #1: add `business` to props ─────────────────────────────────
export default function PostsTab({ businessId, business, igPage, onUploadMore }) {
    const confirm = useConfirm();

  // ── All hooks declared FIRST, no conditional returns above them ──
  const [posts, setPosts]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [generating, setGen]            = useState(false);
  const [generatingImage, setGenAI]     = useState(false);
  const [toast, setToast]               = useState(null);
  const [editPost, setEditPost]         = useState(null);
  const [uploading, setUploading]       = useState({});
  const [showCarousel, setShowCarousel] = useState(false);



  const load = useCallback(async () => {
    setLoading(true);
    try { setPosts(await api.listPosts(businessId)); }
    catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived values (safe — `business` is in props now) ──────────
  const carouselLimit    = business?.plan?.weekly_carousels   ?? 0;
  const carouselsUsed    = business?.carousels_used_this_week ?? 0;
  const canBuildCarousel = carouselLimit > 0 && carouselsUsed < carouselLimit;


  // ── Singles quota (Plan A + Plan B both = 3) ──────────────────────
const singlesLimit = (business?.plan?.weekly_photos   ?? 0) +
                     (business?.plan?.weekly_videos   ?? 0);
const singlesUsed  =  business?.posts_used_this_week  ?? 0;
const singlesLeft  = Math.max(0, singlesLimit - singlesUsed);
const canGenerateSingle = singlesLimit > 0 && singlesUsed < singlesLimit;


  // ── Handlers ────────────────────────────────────────────────────
  async function generate() {
    setGen(true);
    try {
      await api.generatePosts(businessId);
      await load();
      setToast({ msg: "3 posts generated!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setGen(false); }
  }

  async function generateImage() {
    setGenAI(true);
    try {
      await api.generateAIImage(businessId);
      await load();
      setToast({ msg: "AI image posts generated!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setGenAI(false); }
  }

  async function uploadImage(postId, file) {
    setUploading(u => ({ ...u, [postId]: true }));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.uploadMedia(businessId, fd);
      await api.updatePost(postId, {
        media_url: res.media_url,
        media_storage_path: res.media_storage_path,
      });
      await load();
      setToast({ msg: "Media uploaded!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setUploading(u => ({ ...u, [postId]: false })); }
  }

  async function sendApproval() {
    const pendingIds = posts.filter(p => p.status === "pending_approval").map(p => p.id);
    if (!pendingIds.length) {
      setToast({ msg: "No pending posts to approve", type: "err" });
      return;
    }
    try {
      await api.sendApproval({ business_id: businessId, post_ids: pendingIds });
      setToast({ msg: "Approval email sent!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
  }

  async function saveEdit() {
    try {
      const updateData = { caption: editPost.caption };
      if (editPost.scheduled_at) {
        updateData.scheduled_at = editPost.scheduled_at;
      }
      if (editPost.hashtags) {
        updateData.hashtags = editPost.hashtags;
      }
      await api.updatePost(editPost.id, updateData, businessId);
      setEditPost(null);
      await load();
      setToast({ msg: "Post updated" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
  }

  async function deletePost(post) {
        const isCarousel = post.media_type === "CAROUSEL" || (post.media_urls?.length || 0) > 1;
        const ok = await confirm({
            title:        "Delete this post?",
            message:      isCarousel
            ? "The carousel and its caption will be removed. The library items it used stay safe."
            : "This post and its caption will be removed. Won't free up your weekly quota.",
            variant:      "danger",
            confirmLabel: "Delete post",
        });
        if (!ok) return;

        try {
            await api.deletePost(post.id);
            await load();
            setToast({ msg: "Post deleted" });
        } catch (e) {
            setToast({ msg: e.message, type: "err" });
        }
    }

  const pending = posts.filter(p => p.status === "pending_approval");
  const rest    = posts.filter(p => p.status !== "pending_approval");

  // ── FIX #3: conditional render INSIDE the return, after all hooks ──
  if (showCarousel) {
    return (
      <CarouselBuilder
        businessId={businessId}
        onDone={async (post) => {
          setShowCarousel(false);
          await load();
          setToast({ msg: "Carousel ready — review and approve in your posts." });
        }}
        onCancel={() => setShowCarousel(false)}
      />
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        {/* Weekly quota strip */}
<div className="bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)] p-4 mb-3">
  <div className="flex items-center justify-between mb-2">
    <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em]">THIS WEEK</div>
    <div className="text-xs text-[#4C1D95]/70 font-semibold">
      {singlesUsed} / {singlesLimit} posts
      {carouselLimit > 0 && ` · ${carouselsUsed} / ${carouselLimit} carousel`}
    </div>
  </div>

  {/* Singles dots */}
  <div className="flex gap-1.5">
    {Array.from({ length: singlesLimit }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 flex-1 rounded-full transition ${
          i < singlesUsed
            ? "bg-gradient-to-r from-[#6C47FF] to-[#A78BFA]"
            : "bg-[#EDE9FE]"
        }`}
      />
    ))}
    {/* Optional: separate carousel slot for Plan B */}
    {carouselLimit > 0 && (
      <div
        className={`h-1.5 w-6 rounded-full ml-1 ring-1 ring-[#EDE9FE] transition ${
          carouselsUsed > 0
            ? "bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
            : "bg-[#FAFAFF]"
        }`}
        title="Carousel slot"
      />
    )}
  </div>

  {!canGenerateSingle && (
    <div className="text-[11px] text-[#4C1D95]/60 mt-2 font-medium">
      Quota resets Monday. You can still upload media to your library.
    </div>
  )}
</div>

      {/* Actions bar */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={onUploadMore} className={SECONDARY_BTN}>
          Upload media
        </button>
        <button
          onClick={() => setShowCarousel(true)}
          disabled={!canBuildCarousel}
          className={canBuildCarousel ? PRIMARY_BTN : SECONDARY_BTN + " opacity-60"}
        >
          {carouselLimit === 0
            ? <>🔒 Carousel — Plan B</>
            : carouselsUsed >= carouselLimit
            ? <>Carousel used — resets Monday</>
            : <>✦ Build carousel</>}
        </button>
        {/* AI image post */}
<button
  onClick={generateImage}
  disabled={generatingImage || !canGenerateSingle}
  className={canGenerateSingle ? PRIMARY_BTN : SECONDARY_BTN + " opacity-60 cursor-not-allowed"}
>
  {generatingImage ? (
    <><Spinner /> Generating…</>
  ) : !canGenerateSingle ? (
    <>Weekly quota reached</>
  ) : (
    <>✦ AI image post</>
  )}
</button>
        {/* Generate weekly posts (batch of 3) */}
<button
  onClick={generate}
  disabled={generating || !canGenerateSingle}
  className={canGenerateSingle ? PRIMARY_BTN : SECONDARY_BTN + " opacity-60 cursor-not-allowed"}
>
  {generating ? (
    <><Spinner /> Generating…</>
  ) : singlesUsed === 0 ? (
    <>✦ Generate weekly posts</>
  ) : !canGenerateSingle ? (
    <>Weekly quota reached</>
  ) : (
    <>✦ Generate {singlesLeft} more</>
  )}
</button>
        {pending.length > 0 && (
          <button
            onClick={sendApproval}
            className="w-full px-4 py-2.5 border border-[#6C47FF] text-[#6C47FF] rounded-xl text-sm font-semibold hover:bg-[#EDE9FE] transition"
          >
            Send approval email ({pending.length})
          </button>
        )}
      </div>

      {/* IG warning */}
      {!igPage?.is_active && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700 flex items-center gap-2">
          ⚠ Instagram not connected — posts will be saved but not published until you connect.
        </div>
      )}

      {/* Loading / empty */}
      {loading && (
        <div className="text-sm text-[#4C1D95]/50 text-center py-12 font-medium">Loading posts…</div>
      )}

      {!loading && posts.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3 text-[#6C47FF]">✦</div>
          <div className="text-sm text-[#4C1D95]/70" style={SORA}>
            No posts yet. Hit generate to create this week's content.
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <>
          <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-3">NEEDS APPROVAL</div>
          {pending.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onEdit={setEditPost}
              onDelete={deletePost}
              onUpload={uploadImage}
              uploading={uploading[post.id]}
            />
          ))}
        </>
      )}

      {/* Others */}
      {rest.length > 0 && (
        <>
          <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-3 mt-6">
            SCHEDULED / PUBLISHED
          </div>
          {rest.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onEdit={setEditPost}
              onDelete={deletePost}
              onUpload={uploadImage}
              uploading={uploading[post.id]}
            />
          ))}
        </>
      )}

      <EditCaptionModal
        post={editPost}
        onChange={setEditPost}
        onClose={() => setEditPost(null)}
        onSave={saveEdit}
      />
    </div>
  );
}
