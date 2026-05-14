import { createContext, useContext, useState, useCallback, useEffect } from "react";

// ═════════════════════════════════════════════════════════════════════
// Modal  —  promise-based confirm dialog, app-wide.
//
//   Setup once in main.jsx:
//     <ConfirmProvider>
//       <App />
//     </ConfirmProvider>
//
//   Use from anywhere:
//     const confirm = useConfirm();
//     const ok = await confirm({
//       title: "Sign out?",
//       message: "You'll need your password to sign back in.",
//       variant: "danger",            // "default" | "danger"
//       confirmLabel: "Sign out",
//       cancelLabel: "Stay",
//     });
//     if (ok) signOut();
//
//   Defaults: title="Are you sure?", confirmLabel="Confirm",
//             cancelLabel="Cancel", variant="default".
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  // state shape: { title, message, confirmLabel, cancelLabel, variant, resolve }

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      setState({
        title:        opts.title        || "Are you sure?",
        message:      opts.message      || "",
        confirmLabel: opts.confirmLabel || "Confirm",
        cancelLabel:  opts.cancelLabel  || "Cancel",
        variant:      opts.variant      || "default",
        resolve,
      });
    });
  }, []);

  const close = useCallback((value) => {
    setState(prev => {
      if (prev) prev.resolve(value);
      return null;
    });
  }, []);

  // Escape key closes with cancel
  useEffect(() => {
    if (!state) return;
    function onKey(e) {
      if (e.key === "Escape") close(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state, close]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!state) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          {...state}
          onConfirm={() => close(true)}
          onCancel={()  => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const fn = useContext(ConfirmContext);
  if (!fn) throw new Error("useConfirm must be used inside <ConfirmProvider>.");
  return fn;
}

// ── Modal UI ────────────────────────────────────────────────────────
function Modal({ title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel }) {
  const isDanger = variant === "danger";

  return (
    <div
      className="fixed inset-0 bg-[#2E1065]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-[modal-fade_0.15s_ease-out]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="bg-white rounded-3xl border border-[#EDE9FE] shadow-[0_20px_60px_-12px_rgba(46,16,101,0.4)] max-w-sm w-full p-6 animate-[modal-pop_0.18s_ease-out]"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        {/* Optional icon for danger variant */}
        {isDanger && (
          <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-4 mx-auto">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9"  x2="12"    y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
        )}

        <h2
          id="confirm-modal-title"
          className={`text-lg font-bold text-[#2E1065] mb-2 ${isDanger ? "text-center" : ""}`}
          style={SORA}
        >
          {title}
        </h2>

        {message && (
          <p className={`text-sm text-[#4C1D95]/70 leading-relaxed mb-5 ${isDanger ? "text-center" : ""}`}>
            {message}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-white border border-[#EDE9FE] text-[#4C1D95] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#FAFAFF] hover:border-[#C4B5FD] transition"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold tracking-tight active:translate-y-px transition ${
              isDanger
                ? "bg-rose-600 text-white hover:bg-rose-700 shadow-[0_6px_20px_-6px_rgba(225,29,72,0.55)]"
                : "bg-[#6C47FF] text-white hover:bg-[#5B36F0] shadow-[0_6px_20px_-6px_rgba(108,71,255,0.55)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modal-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modal-pop {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}
