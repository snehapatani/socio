import { useEffect } from "react";

// ── Toast ─────────────────────────────────────────────────────────────
export default function Toast({ msg, type = "ok", onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const isOk = type === "ok";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-2xl text-sm font-semibold backdrop-blur-sm border animate-[toast-in_0.25s_ease-out] ${
        isOk
          ? "bg-[#6C47FF] text-white border-[#7C3AED] shadow-[0_10px_30px_-8px_rgba(108,71,255,0.55)]"
          : "bg-[#E11D48] text-white border-[#BE123C] shadow-[0_10px_30px_-8px_rgba(225,29,72,0.5)]"
      }`}
      style={{ fontFamily: "Sora, Inter, system-ui, sans-serif" }}
    >
      {/* Icon chip */}
      <span
        className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold ${
          isOk ? "bg-white/20 text-white" : "bg-white/20 text-white"
        }`}
        aria-hidden
      >
        {isOk ? "✓" : "!"}
      </span>

      <span className="leading-snug">{msg}</span>

      {/* Dismiss */}
      <button
        onClick={onClose}
        aria-label="Dismiss"
        className="ml-1 -mr-1 w-6 h-6 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/15 transition"
      >
        <span className="text-xs leading-none">✕</span>
      </button>

      {/* Keyframes (scoped via global style) */}
      <style>{`
        @keyframes toast-in {
          0%   { opacity: 0; transform: translate(-50%, 12px) scale(0.96); }
          100% { opacity: 1; transform: translate(-50%, 0)    scale(1); }
        }
      `}</style>
    </div>
  );
}
