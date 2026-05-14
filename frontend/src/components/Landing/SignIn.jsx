import { useState } from "react";
import { signIn, requestPasswordReset } from "../../lib/auth";
import Logo from "../Common/Logo";
import Toast from "../Common/Toast";

// ═════════════════════════════════════════════════════════════════════
// SignIn  —  Supabase email/password auth.
//   On success, parent (App) routes the user based on role + business.
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

export default function SignIn({ onSignedIn, onBack, onCreateInstead }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [busy,     setBusy]     = useState(false);
  const [toast,    setToast]    = useState(null);
  const [reset,    setReset]    = useState(false);

  async function submit(e) {
    e.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !cleaned.includes("@")) {
      setToast({ msg: "Please enter a valid email.", type: "err" });
      return;
    }
    if (!password) {
      setToast({ msg: "Please enter your password.", type: "err" });
      return;
    }

    setBusy(true);
    try {
      const { user, session } = await signIn({ email: cleaned, password });
      onSignedIn({ user, session });
    } catch (err) {
      setToast({ msg: err.message || "Sign-in failed.", type: "err" });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    const cleaned = email.trim().toLowerCase();
    if (!cleaned) {
      setToast({ msg: "Enter your email above first, then tap Forgot password.", type: "err" });
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(cleaned);
      setReset(true);
      setToast({ msg: "Reset link sent. Check your email." });
    } catch (err) {
      setToast({ msg: err.message, type: "err" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#FAFAFF] flex flex-col items-center justify-center p-4 overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-[#A78BFA] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#6C47FF] opacity-15 blur-3xl" />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="relative w-full max-w-sm">
        <button
          onClick={onBack}
          className="text-xs text-[#4C1D95]/60 hover:text-[#4C1D95] font-semibold mb-6 transition"
        >
          ← Back
        </button>

        <div className="text-center mb-6">
          <div className="flex justify-center mb-4"><Logo size={52} /></div>
          <h2 className="text-2xl font-bold text-[#2E1065] mb-2 tracking-tight" style={SORA}>
            Welcome back
          </h2>
          <p className="text-sm text-[#4C1D95]/70 leading-relaxed">
            Sign in to manage your posts, captions, and brand voice.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white rounded-3xl border border-[#EDE9FE] shadow-[0_8px_40px_-12px_rgba(108,71,255,0.18)] p-6"
        >
          <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@yourbusiness.com"
            autoFocus
            autoComplete="email"
            className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl px-3.5 py-2.5 text-sm text-[#2E1065] placeholder-gray-400 outline-none focus:border-[#6C47FF] focus:bg-white focus:ring-2 focus:ring-[#6C47FF]/15 transition"
          />

          <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 mt-4 block">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl px-3.5 py-2.5 text-sm text-[#2E1065] placeholder-gray-400 outline-none focus:border-[#6C47FF] focus:bg-white focus:ring-2 focus:ring-[#6C47FF]/15 transition"
          />

          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={busy || reset}
              className="text-[11px] text-[#6C47FF] hover:text-[#5B36F0] font-semibold disabled:opacity-60 transition"
            >
              {reset ? "Reset link sent ✓" : "Forgot password?"}
            </button>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full mt-5 bg-[#6C47FF] text-white py-3 rounded-2xl font-bold text-sm tracking-tight shadow-[0_6px_20px_-6px_rgba(108,71,255,0.55)] hover:bg-[#5B36F0] active:translate-y-px disabled:opacity-60 disabled:hover:bg-[#6C47FF] transition flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : "Sign in →"}
          </button>
        </form>

        <div className="text-center mt-5 text-xs text-[#4C1D95]/60">
          New to Socio?{" "}
          <button
            onClick={onCreateInstead}
            className="text-[#6C47FF] hover:text-[#5B36F0] font-bold transition"
          >
            Create an account
          </button>
        </div>
      </div>
    </div>
  );
}
