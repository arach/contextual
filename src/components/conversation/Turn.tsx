import type { SoftItem } from "@/types";

interface TurnProps {
  item: SoftItem;
}

export function Turn({ item }: TurnProps) {
  if (item.kind === "summary") {
    return (
      <div className="mb-6 max-w-[720px]">
        <p className="text-[11px] text-neutral-500 mb-1.5">{item.title}</p>
        <p className="text-[14px] leading-relaxed text-neutral-400 italic border-l border-[var(--ctx-accent-line)] pl-3">
          {item.body}
        </p>
      </div>
    );
  }

  if (item.kind === "tool") {
    return (
      <div className="mb-6 max-w-[720px]">
        <p className="text-[11px] text-neutral-500 mb-1">{item.title}</p>
        <pre className="text-[12px] leading-relaxed text-neutral-400 font-mono whitespace-pre-wrap border border-[var(--hg-line)] rounded-md px-3 py-2 bg-[var(--hg-surface)]/50">
          {item.body}
        </pre>
      </div>
    );
  }

  const isUser = item.role === "user";
  return (
    <div className={`mb-6 max-w-[720px] ${isUser ? "ml-6" : ""}`}>
      <p
        className={
          "text-[15px] leading-relaxed " +
          (isUser ? "text-[var(--hg-ink)]" : "text-[var(--ctx-ink-2)]")
        }
      >
        {item.body}
      </p>
    </div>
  );
}
