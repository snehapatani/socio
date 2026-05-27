import Logo from "../Common/Logo";

const VARIANTS = {
  success: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6C47FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    iconBg: "bg-[#EDE9FE]",
    heading: (count) => `${count} post${count !== "1" ? "s" : ""} approved`,
    body: "They've been queued for scheduling. You'll receive a confirmation once they're live on Instagram.",
    cta: null,
  },
  expired: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    iconBg: "bg-[#EDE9FE]",
    heading: () => "This link has expired",
    body: "Approval links are valid for 7 days. Ask your Socio manager to send a new approval email.",
    cta: null,
  },
  "already-used": {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    iconBg: "bg-[#F1EFFF]",
    heading: () => "Already approved",
    body: "These posts were approved earlier. No action needed — they're already queued for publishing.",
    cta: null,
  },
  invalid: {
    icon: (
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
    iconBg: "bg-[#EDE9FE]",
    heading: () => "Invalid link",
    body: "This approval link doesn't exist or has been revoked. Contact your Socio manager for a new one.",
    cta: null,
  },
};

export default function ApproveResult() {
  const path   = window.location.pathname;           // e.g. /approve/success
  const params = new URLSearchParams(window.location.search);
  const count  = params.get("count") || "0";

  // Derive variant from the last path segment
  const segment = path.split("/").filter(Boolean).pop(); // "success" | "expired" | …
  const variant = VARIANTS[segment] ?? VARIANTS.invalid;

  return (
    <div className="relative min-h-screen bg-[#FAFAFF] flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Ambient blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-[#A78BFA] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#6C47FF] opacity-15 blur-3xl" />

      <div className="relative flex flex-col items-center text-center max-w-sm w-full">
        {/* Logo */}
        <div className="mb-8">
          <Logo size={44} />
        </div>

        {/* Icon */}
        <div className={`w-20 h-20 rounded-2xl ${variant.iconBg} flex items-center justify-center mb-6 shadow-[0_4px_20px_-8px_rgba(108,71,255,0.18)]`}>
          {variant.icon}
        </div>

        {/* Heading */}
        <h1
          className="text-2xl font-bold text-[#2E1065] mb-3 leading-tight tracking-tight"
          style={{ fontFamily: "Sora, Inter, system-ui, sans-serif" }}
        >
          {variant.heading(count)}
        </h1>

        {/* Body */}
        <p
          className="text-sm text-[#7C3AED] leading-relaxed"
          style={{ fontFamily: "Sora, Inter, system-ui, sans-serif" }}
        >
          {variant.body}
        </p>

        {/* Powered-by footer */}
        <p
          className="mt-10 text-[11px] text-[#A78BFA] tracking-wide"
          style={{ fontFamily: "Sora, Inter, system-ui, sans-serif" }}
        >
          Powered by Socio
        </p>
      </div>
    </div>
  );
}
