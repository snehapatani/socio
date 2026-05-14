import { useState, useEffect, useCallback } from "react";
import { api } from "../../lib/api.js";
import Toast from "../Common/Toast";
import PostCard from "./PostCard";
import EditCaptionModal from "./EditCaptionModal";

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

export default function PostsTab({ businessId, igPage, onUploadMore }) {
  const [posts, setPosts]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [generating, setGen]            = useState(false);
  const [generatingImage, setGenAI]     = useState(false);
  const [toast, setToast]               = useState(null);
  const [editPost, setEditPost]         = useState(null);
  const [uploading, setUploading]       = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try { setPosts(await api.listPosts(businessId)); }
    catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

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
      await api.updatePost(editPost.id, { caption: editPost.caption });
      setEditPost(null);
      await load();
      setToast({ msg: "Caption saved" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
  }

  const pending = posts.filter(p => p.status === "pending_approval");
  const rest    = posts.filter(p => p.status !== "pending_approval");

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Actions bar */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={onUploadMore} className={SECONDARY_BTN}>
          Upload media
        </button>
        <button onClick={generateImage} disabled={generatingImage} className={PRIMARY_BTN}>
          {generatingImage ? <><Spinner /> Generating…</> : "✦ AI image post"}
        </button>
        <button onClick={generate} disabled={generating} className={PRIMARY_BTN}>
          {generating ? <><Spinner /> Generating…</> : "✦ Generate weekly posts"}
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
