// One turn in the conversation. Variants handle the three legible kinds:
// summary (compacted history), turn (user/model exchange), tool (tool call).
import type { SoftItem } from "@/types";

interface TurnProps {
  item: SoftItem;
}

export function Turn({ item }: TurnProps) {
  if (item.kind === "summary") {
    return (
      <div className="mb-5 max-w-[720px]">
        <RoleLabel role="summary" age={item.age} />
        <div className="border-l-2 border-[var(--hg-accent)] bg-[rgba(255,123,44,0.06)] py-1.5 px-3.5 text-[13px] italic text-[var(--hg-ink-2)] rounded-r-[4px] max-w-[540px]">
          <div className="hg-mono not-italic text-[10px] tracking-wider uppercase text-[var(--hg-accent)] mb-0.5">
            {item.title}
          </div>
          {item.body}
        </div>
      </div>
    );
  }
  if (item.kind === "tool") {
    return (
      <div className="mb-5 max-w-[720px]">
        <RoleLabel role="tool call" age={item.age} />
        <div className="border border-dashed border-[var(--hg-hairline)] rounded-[2px] px-3 py-2 hg-mono text-[11.5px] text-[var(--hg-ink-2)] bg-[var(--hg-surface-2)] max-w-[540px]">
          {item.title}
          <br />
          {item.body}
        </div>
      </div>
    );
  }
  return (
    <div className="mb-5 max-w-[720px]">
      <RoleLabel role={item.role} age={item.age} />
      <div
        className={
          "hg-mono text-[12.5px] leading-[1.65] " +
          (item.role === "user" ? "text-[var(--hg-ink)] font-medium" : "text-[var(--hg-ink-2)]")
        }
      >
        {item.body}
      </div>
    </div>
  );
}

function RoleLabel({ role, age }: { role: string; age: string }) {
  return (
    <div className="hg-mono text-[10px] tracking-wider uppercase text-[var(--hg-accent)] mb-1 flex gap-2 items-baseline">
      <span>{role}</span>
      <span className="text-[var(--hg-hairline)]">· {age}</span>
    </div>
  );
}
