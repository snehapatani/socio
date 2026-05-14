import { useState, useEffect } from "react";
import { api, getConnectUrl } from "../../lib/api.js";
import { signUp } from "../../lib/auth";
import Logo from "../Common/Logo";
import Toast from "../Common/Toast";

// ═════════════════════════════════════════════════════════════════════
// SCREEN 1 · Onboarding  (Socio brand — violet / Sora)
// ═════════════════════════════════════════════════════════════════════
export default function Onboarding({ onDone }) {
  const [step, setStep]   = useState(1);
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    name: "", business_type: "restaurant", specialty: "",
    brand_tone: "warm_friendly", weekly_specials: "", owner_email: "", password: "",
  });

  const [showPw,    setShowPw]    = useState(false);
  const [emailSent, setEmailSent] = useState(false);  // for "check your email" state

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const TONES = [
    { id: "warm_friendly", label: "Warm & friendly" },
    { id: "upbeat",        label: "Upbeat & fun" },
    { id: "elegant",       label: "Elegant & refined" },
    { id: "bold_casual",   label: "Bold & casual" },
  ];
  const TYPES = ["restaurant", "salon", "gym", "cafe", "retail", "other"];

  // Brand tokens (pulled from the Socio logo)
  const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

 async function submit() {
  if (!form.name || !form.owner_email || !form.password) {
    setToast({ msg: "Name, email, and password are required", type: "err" });
    return;
  }
  if (form.password.length < 8) {
    setToast({ msg: "Password must be at least 8 characters", type: "err" });
    return;
  }

  setBusy(true);
  try {
    // 1. Create the auth user
    const { session } = await signUp({
      email:    form.owner_email,
      password: form.password,
      fullName: form.name,
    });

    // If email confirmation is required in Supabase, no session is returned
    // until the user clicks the link. Show a "check your email" state.
    if (!session) {
      setEmailSent(true);
      return;
    }

    // 2. Create the business — JWT auto-attaches via api.js
    const biz = await api.createBusiness({
      name:             form.name,
      business_type:    form.business_type,
      brand_tone:       form.brand_tone,
      business_context: {
        specialty:       form.specialty       || undefined,
        weekly_specials: form.weekly_specials || undefined,
      },
    });

    onDone(biz);
  } catch (e) {
    setToast({ msg: e.message, type: "err" });
  } finally {
    setBusy(false);
  }
}

  return (
    <div className="relative min-h-screen bg-[#FAFAFF] flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Soft violet ambient blobs — echo the three-diamond logo */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-[#A78BFA] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#6C47FF] opacity-15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-[#EDE9FE] opacity-60 blur-3xl" />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Logo size={44} />
          <div>
            <div className="text-2xl font-bold text-[#2E1065] tracking-tight leading-none" style={SORA}>socio</div>
            <div className="text-[11px] text-[#6C47FF]/70 font-medium tracking-wide mt-1">AI social media manager</div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {[1,2,3].map(n => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                n < step ? "bg-[#6C47FF]"
                : n === step ? "bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]"
                : "bg-[#EDE9FE]"
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-[#EDE9FE] shadow-[0_8px_40px_-12px_rgba(108,71,255,0.18)] overflow-hidden">
          {/* Step 1 */}
          {step === 1 && (
            <div className="p-7">
              <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-2">STEP 1 OF 3</div>
              <h2 className="text-xl font-bold text-[#2E1065] mb-6" style={SORA}>About your business</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Business name *</label>
                  <input
                    className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl px-3.5 py-2.5 text-sm text-[#2E1065] placeholder-gray-400 outline-none focus:border-[#6C47FF] focus:bg-white focus:ring-2 focus:ring-[#6C47FF]/15 transition"
                    placeholder="e.g. Mia's Kitchen"
                    value={form.name}
                    onChange={e => set("name", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#4C1D95]/70 font-semibold mb-2 block">Business type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TYPES.map(t => (
                      <button
                        key={t}
                        onClick={() => set("business_type", t)}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition ${
                          form.business_type === t
                            ? "bg-[#EDE9FE] border-[#6C47FF] text-[#4C1D95] shadow-sm"
                            : "bg-white border-[#EDE9FE] text-gray-600 hover:border-[#C4B5FD] hover:text-[#4C1D95]"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Specialty / cuisine</label>
                  <input
                    className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl px-3.5 py-2.5 text-sm text-[#2E1065] placeholder-gray-400 outline-none focus:border-[#6C47FF] focus:bg-white focus:ring-2 focus:ring-[#6C47FF]/15 transition"
                    placeholder="e.g. Italian, Hair & Color, CrossFit"
                    value={form.specialty}
                    onChange={e => set("specialty", e.target.value)}
                  />
                </div>
              </div>
              <button
                onClick={() => { if (!form.name) { setToast({ msg: "Enter your business name", type: "err" }); return; } setStep(2); }}
                className="w-full mt-7 bg-[#6C47FF] text-white py-3 rounded-2xl font-bold text-sm tracking-tight shadow-[0_6px_20px_-6px_rgba(108,71,255,0.55)] hover:bg-[#5B36F0] active:translate-y-px transition"
              >
                Continue →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="p-7">
              <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-2">STEP 2 OF 3</div>
              <h2 className="text-xl font-bold text-[#2E1065] mb-6" style={SORA}>Brand voice</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[#4C1D95]/70 font-semibold mb-2 block">Brand Tone</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TONES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => set("brand_tone", t.id)}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition ${
                          form.brand_tone === t.id
                            ? "bg-[#EDE9FE] border-[#6C47FF] text-[#4C1D95] shadow-sm"
                            : "bg-white border-[#EDE9FE] text-gray-600 hover:border-[#C4B5FD] hover:text-[#4C1D95]"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Weekly specials or promotions</label>
                  <textarea
                    className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl px-3.5 py-2.5 text-sm text-[#2E1065] placeholder-gray-400 outline-none focus:border-[#6C47FF] focus:bg-white focus:ring-2 focus:ring-[#6C47FF]/15 transition resize-none h-20"
                    placeholder="Happy hour 4–7pm Mon–Fri, new truffle pasta, live music Fridays…"
                    value={form.weekly_specials}
                    onChange={e => set("weekly_specials", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-7">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-white border border-[#EDE9FE] text-[#4C1D95] py-3 rounded-2xl text-sm font-semibold hover:bg-[#FAFAFF] hover:border-[#C4B5FD] transition"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-[2] bg-[#6C47FF] text-white py-3 rounded-2xl font-bold text-sm tracking-tight shadow-[0_6px_20px_-6px_rgba(108,71,255,0.55)] hover:bg-[#5B36F0] active:translate-y-px transition"
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && !emailSent && (
  <div className="p-7">
    <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-2">STEP 3 OF 3</div>
    <h2 className="text-xl font-bold text-[#2E1065] mb-6" style={SORA}>Create your account</h2>

    <div className="bg-gradient-to-br from-[#EDE9FE] to-[#FAFAFF] border border-[#EDE9FE] rounded-2xl p-4 mb-5 text-xs text-[#4C1D95] leading-relaxed">
      You'll use this email and password to sign in. We'll also send you the Sunday approval emails here.
    </div>

    <div className="space-y-4">
      <div>
        <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Email *</label>
        <input
          type="email"
          autoComplete="email"
          className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl px-3.5 py-2.5 text-sm text-[#2E1065] placeholder-gray-400 outline-none focus:border-[#6C47FF] focus:bg-white focus:ring-2 focus:ring-[#6C47FF]/15 transition"
          placeholder="you@yourbusiness.com"
          value={form.owner_email}
          onChange={e => set("owner_email", e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Password *</label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl pl-3.5 pr-16 py-2.5 text-sm text-[#2E1065] placeholder-gray-400 outline-none focus:border-[#6C47FF] focus:bg-white focus:ring-2 focus:ring-[#6C47FF]/15 transition"
            placeholder="••••••••"
            value={form.password}
            onChange={e => set("password", e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPw(s => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#6C47FF] hover:text-[#5B36F0] px-2 py-1 rounded hover:bg-[#EDE9FE] transition"
          >
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
        <div className="text-[10px] text-[#4C1D95]/50 mt-1.5 font-medium">
          Must be at least 8 characters
        </div>
      </div>
    </div>

    <div className="flex gap-2 mt-7">
      <button
        onClick={() => setStep(2)}
        className="flex-1 bg-white border border-[#EDE9FE] text-[#4C1D95] py-3 rounded-2xl text-sm font-semibold hover:bg-[#FAFAFF] hover:border-[#C4B5FD] transition"
      >
        ← Back
      </button>
      <button
        onClick={submit}
        disabled={busy}
        className="flex-[2] bg-[#6C47FF] text-white py-3 rounded-2xl font-bold text-sm tracking-tight shadow-[0_6px_20px_-6px_rgba(108,71,255,0.55)] hover:bg-[#5B36F0] active:translate-y-px transition disabled:opacity-60 disabled:hover:bg-[#6C47FF] flex items-center justify-center gap-2"
      >
        {busy ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Creating account…
          </>
        ) : "Create account →"}
      </button>
    </div>
  </div>
)}

{step === 3 && emailSent && (
  <div className="p-7 text-center">
    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD] flex items-center justify-center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4C1D95" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="14" rx="2"/>
        <path d="m3 7 9 6 9-6"/>
      </svg>
    </div>
    <h2 className="text-xl font-bold text-[#2E1065] mb-3" style={SORA}>Check your email</h2>
    <p className="text-sm text-[#4C1D95]/70 leading-relaxed mb-6">
      We sent a confirmation link to <strong className="text-[#2E1065]">{form.owner_email}</strong>.
      Click it to finish creating your account, then sign in.
    </p>
    <button
      onClick={() => { setEmailSent(false); }}
      className="text-xs text-[#6C47FF] hover:text-[#5B36F0] font-bold transition"
    >
      Use a different email
    </button>
  </div>
)}
        </div>

        {/* Footnote */}
        <div className="text-center mt-5 text-[11px] text-[#4C1D95]/50 font-medium">
          By continuing you agree to Socio's terms & privacy policy
        </div>
      </div>
    </div>
  );
}

