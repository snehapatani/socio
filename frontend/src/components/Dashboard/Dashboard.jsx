import { useState, useRef, useEffect } from "react";
import { signOut } from "../../lib/auth";
import { getConnectUrl } from "../../lib/api.js";

import Logo         from "../Common/Logo";
import DashboardTab from "./DashboardTab";
import PostsTab     from "./PostsTab";
import SettingsTab  from "./SettingsTab";
import { useConfirm } from "../Common/Modal";

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };


// ═════════════════════════════════════════════════════════════════════
// Dashboard  —  the authenticated app shell.
//   Owns the top bar, bottom nav, and tab routing. Each tab is its
//   own component under components/Dashboard/.
// ═════════════════════════════════════════════════════════════════════

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: (on) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={on ? "#6C47FF" : "#A78BFA"} strokeWidth="1.5">
      <rect x="2"  y="2"  width="7" height="7" rx="1.5"/>
      <rect x="11" y="2"  width="7" height="7" rx="1.5"/>
      <rect x="2"  y="11" width="7" height="7" rx="1.5"/>
      <rect x="11" y="11" width="7" height="7" rx="1.5"/>
    </svg>
  )},
  { id: "posts", label: "Posts", icon: (on) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={on ? "#6C47FF" : "#A78BFA"} strokeWidth="1.5">
      <rect x="2" y="2" width="16" height="16" rx="2.5"/>
      <path d="M5 7h10M5 10.5h7M5 14h5" strokeLinecap="round"/>
    </svg>
  )},
  { id: "settings", label: "Settings", icon: (on) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={on ? "#6C47FF" : "#A78BFA"} strokeWidth="1.5">
      <circle cx="10" cy="10" r="2.5"/>
      <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" strokeLinecap="round"/>
    </svg>
  )},
];

export default function Dashboard({ businessId, business, igPage, onUploadMore }) {
  const [tab, setTab] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

   // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const confirm = useConfirm();

    async function handleSignOut() {
        setMenuOpen(false);
        const ok = await confirm({
            title:        "Sign out of Socio?",
            message:      "You'll need your email and password to sign back in.",
            variant:      "danger",
            confirmLabel: "Sign out",
            cancelLabel:  "Stay",
        });
        if (ok) await signOut();
    }

  const initial = (business?.name || "U").trim()[0]?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-[#FAFAFF] flex flex-col max-w-2xl mx-auto">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="bg-white/95 backdrop-blur border-b border-[#EDE9FE] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <Logo size={30} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-[#2E1065] leading-tight truncate" style={SORA}>
              {business?.name || "Socio"}
            </div>
            {igPage?.ig_username && (
              <div className="text-[10px] text-[#4C1D95]/60 font-medium">@{igPage.ig_username}</div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {igPage && !igPage.is_active && (

             <a href={getConnectUrl(businessId)}
              className="text-[11px] bg-amber-50 text-amber-700 font-bold px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-100 transition"
            >
              Reconnect IG
            </a>
          )}

          {/* ── Account menu ─────────────────────────────────── */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6C47FF] to-[#A78BFA] flex items-center justify-center text-white text-sm font-bold hover:opacity-90 active:scale-95 transition shadow-[0_4px_12px_-4px_rgba(108,71,255,0.5)]"
              style={SORA}
            >
              {initial}
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-11 w-60 bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_12px_32px_-8px_rgba(108,71,255,0.25)] overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-[#EDE9FE]">
                  <div className="text-xs font-bold text-[#2E1065] truncate" style={SORA}>
                    {business?.name || "Your business"}
                  </div>
                  <div className="text-[11px] text-[#4C1D95]/60 font-medium mt-0.5 truncate">
                    {business?.owner_email || ""}
                  </div>
                </div>

                <button
                  onClick={() => { setMenuOpen(false); setTab("settings"); }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-[#4C1D95] hover:bg-[#FAFAFF] transition flex items-center gap-2.5"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  Settings
                </button>

                <button
                  onClick={handleSignOut}
                  className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition flex items-center gap-2.5 border-t border-[#EDE9FE]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {tab === "dashboard" && <DashboardTab businessId={businessId} />}
        {tab === "posts"     && <PostsTab businessId={businessId} igPage={igPage} onUploadMore={onUploadMore} />}
        {tab === "settings"  && <SettingsTab businessId={businessId} business={business} igPage={igPage} />}
      </div>

      {/* ── Bottom nav (unchanged) ───────────────────────────── */}
      <div className="bg-white/95 backdrop-blur border-t border-[#EDE9FE] px-4 py-2 flex sticky bottom-0 z-10">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 transition ${
              tab === t.id ? "text-[#6C47FF]" : "text-[#A78BFA]"
            }`}
          >
            {t.icon(tab === t.id)}
            <span className="text-[10px] font-semibold">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
