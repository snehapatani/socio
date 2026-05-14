import { getConnectUrl } from "../../lib/api.js";

import Logo from "../Common/Logo";
import Toast from "../Common/Toast";

// ═════════════════════════════════════════════════════════════════════
// SCREEN 2 · Connect Instagram  (Socio brand — violet / Sora)
// ═════════════════════════════════════════════════════════════════════
export default function ConnectInstagram({ businessId, business, onConnected }) {
  const params = new URLSearchParams(window.location.search);
  const error  = params.get("error");

  const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

  const REQUIREMENTS = [
    "Instagram must be a Professional (Business or Creator) account",
    "Must be linked to a Facebook Page",
    "Facebook account must be an admin of that Page",
  ];

  return (
    <div className="relative min-h-screen bg-[#FAFAFF] flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Ambient violet blobs — echo the three-diamond logo */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-[#A78BFA] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#6C47FF] opacity-15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-[#EDE9FE] opacity-60 blur-3xl" />

      <div className="relative w-full max-w-sm text-center">
        <div className="flex justify-center">
          <Logo size={56} />
        </div>

        <h2
          className="text-2xl font-bold text-[#2E1065] mt-5 mb-2 tracking-tight"
          style={SORA}
        >
          Connect Instagram
        </h2>
        <p className="text-sm text-[#4C1D95]/70 mb-6 leading-relaxed">
          Link <strong className="text-[#2E1065] font-semibold">{business?.name}</strong>'s
          Instagram Business account so Socio can publish posts on your behalf.
        </p>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 mb-5 text-xs text-rose-700 text-left flex items-start gap-2">
            <span className="font-bold mt-0.5">!</span>
            <span>
              Connection failed: {error.replace(/_/g, " ")}. Please try again.
            </span>
          </div>
        )}

        <div className="bg-white rounded-3xl border border-[#EDE9FE] shadow-[0_8px_40px_-12px_rgba(108,71,255,0.18)] p-5 mb-5 text-left space-y-3">
          <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-1">
            REQUIREMENTS
          </div>
          {REQUIREMENTS.map((req, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 8 8">
                  <polyline
                    points="1,4 3,6 7,2"
                    stroke="#4C1D95"
                    strokeWidth="1.7"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <span className="text-xs text-[#4C1D95] leading-relaxed">{req}</span>
            </div>
          ))}
        </div>


          <a href={getConnectUrl(businessId)}
          className="group relative block w-full bg-[#6C47FF] text-white py-3.5 rounded-2xl font-bold text-sm tracking-tight shadow-[0_6px_20px_-6px_rgba(108,71,255,0.55)] hover:bg-[#5B36F0] active:translate-y-px transition text-center"
          >
          <span className="inline-flex items-center gap-2">
            {/* Tiny Facebook glyph — keeps brand context */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.99 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.99 22 12z" />
            </svg>
            Connect with Facebook
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </span>
        </a>

        <button
          onClick={onConnected}
          className="mt-4 text-xs text-[#4C1D95]/50 hover:text-[#4C1D95] font-medium transition"
        >
          Skip for now (use test data)
        </button>

        {/* Footnote */}
        <div className="mt-6 text-[11px] text-[#4C1D95]/40 leading-relaxed">
          We only request the permissions needed to publish on your behalf.
          You can disconnect anytime from settings.
        </div>
      </div>
    </div>
  );
}
