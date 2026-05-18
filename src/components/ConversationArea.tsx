import type { Thread } from "@/types";
import { Conversation } from "@/components/conversation/Conversation";
import { Composer } from "@/components/composer/Composer";

interface ConversationAreaProps {
  thread: Thread;
  thinking: boolean;
  inFlightTokens: number;
  onComposerChange: (v: string) => void;
  onDispatch: () => void;
}

export function ConversationArea({
  thread,
  thinking,
  inFlightTokens,
  onComposerChange,
  onDispatch,
}: ConversationAreaProps) {
  return (
    <section className="flex-1 min-w-0 flex flex-col min-h-0 bg-[var(--hg-bg)]">
      <Conversation thread={thread} thinking={thinking} inFlightTokens={inFlightTokens} />
      <Composer
        thread={thread}
        thinking={thinking}
        onChange={onComposerChange}
        onDispatch={onDispatch}
      />
    </section>
  );
}
