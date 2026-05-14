import { useState } from "react";
import { api, getConnectUrl } from "../../lib/api.js";
import { signOut } from "../../lib/auth";
import Toast from "../Common/Toast.jsx";
import { useConfirm } from "../Common/Modal";

// ═════════════════════════════════════════════════════════════════════
// Settings tab  (Socio brand — violet / Sora)
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };
const CARD = "bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)]";

const TONES = [
  ["warm_friendly", "Warm & friendly"],
  ["upbeat",        "Upbeat & fun"],
  ["elegant",       "Elegant & refined"],
  ["bold_casual",   "Bold & casual"],
];

export default function SettingsTab({ businessId, business, igPage }) {
  const [form, setForm] = useState({
    weekly_specials: business?.business_context?.weekly_specials || "",
    brand_tone:      business?.brand_tone || "warm_friendly",
  });
  const [saving, setSav]  = useState(false);
  const [toast, setToast] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const confirm = useConfirm();

  async function save() {
    setSav(true);
    try {
      await api.updateBusiness(businessId, form);
      setToast({ msg: "Saved!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setSav(false); }
  }


async function handleSignOut() {
  const ok = await confirm({
    title:        "Sign out?",
    message:      "You'll need your password to sign back in.",
    variant:      "danger",
    confirmLabel: "Sign out",
  });
  if (!ok) return;
  setSigningOut(true);
  try { await signOut(); }
  catch (e) {
    setToast({ msg: e.message, type: "err" });
    setSigningOut(false);
  }
}

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Brand voice */}
      <div className={`${CARD} p-5 mb-4`}>
        <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-4">BRAND VOICE</div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#4C1D95]/70 font-semibold mb-2 block">Brand tone</label>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => set("brand_tone", id)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition ${
                    form.brand_tone === id
                      ? "bg-[#EDE9FE] border-[#6C47FF] text-[#4C1D95] shadow-sm"
                      : "bg-white border-[#EDE9FE] text-gray-600 hover:border-[#C4B5FD] hover:text-[#4C1D95]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#4C1D95]/70 font-semibold mb-1.5 block">Weekly specials / promotions</label>
            <textarea
              className="w-full bg-[#FAFAFF] border border-[#EDE9FE] rounded-xl p-3 text-sm text-[#2E1065] resize-none h-24 outline-none focus:border-[#6C47FF] focus:bg-white focus:ring-2 focus:ring-[#6C47FF]/15 transition"
              value={form.weekly_specials}
              onChange={e => set("weekly_specials", e.target.value)}
            />
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="mt-5 w-full bg-[#6C47FF] text-white py-2.5 rounded-xl text-sm font-bold shadow-[0_4px_14px_-4px_rgba(108,71,255,0.5)] hover:bg-[#5B36F0] disabled:opacity-60 transition"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* IG connection */}
      <div className={`${CARD} p-5`}>
        <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-3">INSTAGRAM CONNECTION</div>
        {igPage?.is_active ? (
          <div className="flex items-center gap-3">
            {igPage.profile_picture_url ? (
              <img src={igPage.profile_picture_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-[#EDE9FE]" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6C47FF] to-[#A78BFA] flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={SORA}>
                IG
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#2E1065] truncate">@{igPage.ig_username}</div>
              <div className="text-xs text-[#4C1D95]/60 font-medium">
                Connected · {igPage.followers_count?.toLocaleString()} followers
              </div>
            </div>
          </div>
        ) : (
          <a
            href={getConnectUrl(businessId)}
            className="block w-full text-center bg-[#6C47FF] text-white py-2.5 rounded-xl text-sm font-bold shadow-[0_4px_14px_-4px_rgba(108,71,255,0.5)] hover:bg-[#5B36F0] transition"
          >
            Connect Instagram →
          </a>
        )}
      </div>
      <div className={`${CARD} p-5`}>
        <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-3">ACCOUNT</div>
        <div className="space-y-1 mb-4">
          <div className="text-xs text-[#4C1D95]/60 font-medium">Signed in as</div>
          <div className="text-sm font-bold text-[#2E1065] truncate" style={SORA}>
            {business?.owner_email || "—"}
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full bg-white border border-rose-200 text-rose-600 py-2.5 rounded-xl text-sm font-bold hover:bg-rose-50 disabled:opacity-60 transition flex items-center justify-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
