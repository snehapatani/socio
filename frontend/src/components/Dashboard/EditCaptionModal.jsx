// ═════════════════════════════════════════════════════════════════════
// EditCaptionModal — bottom sheet for editing post caption and schedule
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

export default function EditCaptionModal({ post, onChange, onClose, onSave }) {
  if (!post) return null;

  const handleScheduledAtChange = (date, time) => {
    if (date && time) {
      const isoString = `${date}T${time}:00`;
      onChange({ ...post, scheduled_at: isoString });
    }
  };

  const getDateFromScheduledAt = () => {
    if (!post.scheduled_at) return "";
    return post.scheduled_at.split("T")[0];
  };

  const getTimeFromScheduledAt = () => {
    if (!post.scheduled_at) return "";
    return post.scheduled_at.split("T")[1].substring(0, 5);
  };

  return (
    <div
      className="fixed inset-0 bg-[#2E1065]/40 backdrop-blur-sm z-40 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl rounded-t-3xl p-6 shadow-[0_-12px_40px_-12px_rgba(46,16,101,0.3)] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-base font-bold text-[#2E1065] mb-4" style={SORA}>
          Edit post
        </div>

        {/* Caption */}
        <div className="mb-4">
          <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Caption</label>
          <textarea
            className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl p-3 text-sm text-[#2E1065] resize-none h-32 outline-none focus:border-[#6C47FF] focus:ring-2 focus:ring-[#6C47FF]/15 transition"
            value={post.caption || ""}
            onChange={e => onChange({ ...post, caption: e.target.value })}
          />
        </div>

        {/* Schedule Date & Time */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Date</label>
            <input
              type="date"
              className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl p-2.5 text-sm text-[#2E1065] outline-none focus:border-[#6C47FF] focus:ring-2 focus:ring-[#6C47FF]/15 transition"
              value={getDateFromScheduledAt()}
              onChange={e => handleScheduledAtChange(e.target.value, getTimeFromScheduledAt())}
            />
          </div>
          <div>
            <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Time</label>
            <input
              type="time"
              className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl p-2.5 text-sm text-[#2E1065] outline-none focus:border-[#6C47FF] focus:ring-2 focus:ring-[#6C47FF]/15 transition"
              value={getTimeFromScheduledAt()}
              onChange={e => handleScheduledAtChange(getDateFromScheduledAt(), e.target.value)}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
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
