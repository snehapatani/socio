import Logo from "../Common/Logo";

export default function Loading() {
  return (
    <div className="relative min-h-screen bg-[#FAFAFF] flex items-center justify-center overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-24 w-96 h-96 rounded-full bg-[#A78BFA] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-[#6C47FF] opacity-15 blur-3xl" />

      <div className="relative flex flex-col items-center gap-5">
        <div className="animate-[logo-breathe_2.4s_ease-in-out_infinite]">
          <Logo size={56} />
        </div>

        <div className="flex gap-1.5">
          {[
            { color: "#4C1D95", delay: "0s"    },
            { color: "#7C3AED", delay: "0.15s" },
            { color: "#A78BFA", delay: "0.3s"  },
          ].map(({ color, delay }, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: color, animationDelay: delay }}
            />
          ))}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes logo-breathe {
              0%, 100% { opacity: 1;    transform: scale(1); }
              50%      { opacity: 0.75; transform: scale(0.97); }
            }
          `,
        }}
      />
    </div>
  );
}
