import Logo from "../Common/Logo";

// ═════════════════════════════════════════════════════════════════════
// Landing  —  first-visit page. Two paths: get started, or sign in.
// ═════════════════════════════════════════════════════════════════════

const SORA = { fontFamily: "Sora, Inter, system-ui, sans-serif" };

const FEATURES = [
  {
    icon: "✦",
    title: "AI captions in your voice",
    body:  "Trained on your business, your specials, and your tone. No generic templates.",
  },
  {
    icon: "📸",
    title: "Smart scheduling",
    body:  "Posts go out when your followers are most likely to see them. Never miss prime time.",
  },
  {
    icon: "✉",
    title: "Approve by email",
    body:  "Every Sunday you get 3 ready-to-post captions. One tap approves the whole week.",
  },
];

export default function Landing({ onGetStarted, onSignIn }) {
  return (
    <div className="relative min-h-screen bg-[#FAFAFF] overflow-hidden">
      {/* Ambient violet blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full bg-[#A78BFA] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -right-32 w-[36rem] h-[36rem] rounded-full bg-[#6C47FF] opacity-15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] rounded-full bg-[#EDE9FE] opacity-50 blur-3xl" />

      {/* Top bar — logo only, with sign-in tucked top-right */}
      <header className="relative px-5 py-5 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5">
          <Logo size={36} />
          <div className="text-lg font-bold text-[#2E1065] tracking-tight" style={SORA}>socio</div>
        </div>
        <button
          onClick={onSignIn}
          className="text-xs font-semibold text-[#4C1D95]/70 hover:text-[#4C1D95] transition px-3 py-2 rounded-lg hover:bg-[#EDE9FE]"
        >
          Sign in
        </button>
      </header>

      {/* Hero */}
      <main className="relative max-w-2xl mx-auto px-5 pt-8 pb-12 text-center">
        <div className="inline-flex items-center gap-1.5 bg-white border border-[#EDE9FE] rounded-full px-3 py-1 mb-6 text-[11px] font-bold text-[#6C47FF] tracking-wide shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#6C47FF]" />
          AI SOCIAL MEDIA MANAGER
        </div>

        <h1
          className="text-4xl sm:text-5xl font-bold text-[#2E1065] leading-[1.05] tracking-tight mb-4"
          style={SORA}
        >
          Your Instagram,<br />
          <span className="bg-gradient-to-r from-[#6C47FF] to-[#A78BFA] bg-clip-text text-transparent">
            on autopilot.
          </span>
        </h1>

        <p className="text-base text-[#4C1D95]/75 leading-relaxed max-w-md mx-auto mb-8">
          Socio writes, schedules, and posts to your Instagram every week.
          You just approve by email — no app to learn.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 max-w-sm mx-auto mb-4">
          <button
            onClick={onGetStarted}
            className="flex-[2] bg-[#6C47FF] text-white py-3.5 rounded-2xl font-bold text-sm tracking-tight shadow-[0_8px_24px_-8px_rgba(108,71,255,0.6)] hover:bg-[#5B36F0] active:translate-y-px transition"
          >
            Get started — free for 14 days →
          </button>
        </div>

        <p className="text-[11px] text-[#4C1D95]/50 font-medium">
          No credit card required · Cancel anytime
        </p>
      </main>

      {/* Features */}
      <section className="relative max-w-2xl mx-auto px-5 pb-16">
        <div className="grid sm:grid-cols-3 gap-3">
          {FEATURES.map(f => (
            <div
              key={f.title}
              className="bg-white rounded-2xl border border-[#EDE9FE] shadow-[0_4px_20px_-8px_rgba(108,71,255,0.12)] p-5 text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EDE9FE] to-[#C4B5FD] flex items-center justify-center text-lg mb-3">
                {f.icon}
              </div>
              <div className="text-sm font-bold text-[#2E1065] mb-1.5" style={SORA}>{f.title}</div>
              <div className="text-xs text-[#4C1D95]/70 leading-relaxed">{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Social-proof strip (placeholder copy — swap when you have testimonials) */}
      <section className="relative max-w-2xl mx-auto px-5 pb-16 text-center">
        <div className="text-[11px] font-bold text-[#6C47FF] tracking-[0.18em] mb-3">BUILT FOR</div>
        <div className="text-sm text-[#4C1D95]/80 font-medium">
          Restaurants · Cafés · Salons · Gyms · Boutique retail
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative max-w-md mx-auto px-5 pb-12 text-center">
        <div className="bg-gradient-to-br from-[#6C47FF] to-[#7C3AED] rounded-3xl p-8 shadow-[0_12px_40px_-12px_rgba(108,71,255,0.55)]">
          <div className="text-lg font-bold text-white mb-2 tracking-tight" style={SORA}>
            Ready in under 2 minutes
          </div>
          <p className="text-xs text-white/85 leading-relaxed mb-5">
            Tell us about your business, connect Instagram, upload 3 photos.
            That's it — Socio handles the rest.
          </p>
          <button
            onClick={onGetStarted}
            className="w-full bg-white text-[#6C47FF] py-3 rounded-2xl font-bold text-sm tracking-tight hover:bg-[#FAFAFF] active:translate-y-px transition shadow-sm"
          >
            Get started →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative max-w-2xl mx-auto px-5 pb-8 text-center text-[11px] text-[#4C1D95]/40 font-medium">
        © 2026 Socio · Built for small businesses
      </footer>
    </div>
  );
}
