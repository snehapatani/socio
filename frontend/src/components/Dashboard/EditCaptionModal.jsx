// ═════════════════════════════════════════════════════════════════════
// EditCaptionModal — bottom sheet for editing a post caption
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

export default function EditCaptionModal({ post, onChange, onClose, onSave }) {
  if (!post) return null;

  return (
    <div
      className="fixed inset-0 bg-[#2E1065]/40 backdrop-blur-sm z-40 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-t-3xl p-6 shadow-[0_-12px_40px_-12px_rgba(46,16,101,0.3)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-base font-bold text-[#2E1065] mb-4" style={SORA}>
          Edit caption
        </div>

        <textarea
          className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl p-3 text-sm text-[#2E1065] resize-none h-32 outline-none focus:border-[#6C47FF] focus:ring-2 focus:ring-[#6C47FF]/15 transition"
          value={post.caption || ""}
          onChange={e => onChange({ ...post, caption: e.target.value })}
        />

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 bg-white border border-[#EDE9FE] text-[#4C1D95] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FAFAFF] transition"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-[2] bg-[#6C47FF] text-white py-2.5 rounded-xl text-sm font-bold shadow-[0_4px_16px_-6px_rgba(108,71,255,0.55)] hover:bg-[#5B36F0] transition"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
