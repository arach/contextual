import { fmtTokens } from "@/lib/tokens";

export function Thinking({ inFlight }: { inFlight: number }) {
  return (
    <div className="mb-6 flex items-center gap-2 text-[14px] text-neutral-500">
      <span className="inline-flex gap-1">
        <Dot />
        <Dot delay="0.15s" />
        <Dot delay="0.3s" />
      </span>
      <span className="text-[12px] text-neutral-600">
        Thinking · {fmtTokens(inFlight)}
      </span>
    </div>
  );
}

function Dot({ delay = "0s" }: { delay?: string }) {
  return (
    <span
      className="w-1 h-1 rounded-full bg-neutral-500 animate-pulse"
      style={{ animationDelay: delay }}
    />
  );
}
