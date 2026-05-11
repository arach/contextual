// Three bouncing dots + a token-in-flight readout while waiting for a reply.
import { fmtTokens } from "@/lib/tokens";

export function Thinking({ inFlight }: { inFlight: number }) {
  return (
    <div className="mb-5">
      <div className="hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-accent)] mb-1 flex gap-2 items-baseline">
        <span>model</span>
        <span className="text-[var(--hg-hairline)]">· now</span>
      </div>
      <div className="flex gap-2 items-center text-[var(--hg-muted)] italic">
        <Dot />
        <Dot delay="0.2s" />
        <Dot delay="0.4s" />
        <span className="ml-2 hg-mono not-italic text-[10.5px] tracking-wider uppercase">
          composing call · {fmtTokens(inFlight)} tok in flight
        </span>
      </div>
    </div>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="w-[6px] h-[6px] rounded-full bg-[var(--hg-muted)]"
      style={{
        animation: "hg-bounce 1s infinite",
        animationDelay: delay,
      }}
    />
  );
}

// One-off keyframes injected here to keep the animation co-located with the
// component that uses it.
const KEYFRAMES = `
@keyframes hg-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-3px); }
}
`;

if (typeof document !== "undefined" && !document.getElementById("hg-bounce-keyframes")) {
  const s = document.createElement("style");
  s.id = "hg-bounce-keyframes";
  s.textContent = KEYFRAMES;
  document.head.appendChild(s);
}
