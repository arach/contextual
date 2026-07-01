import { ContextualStudioApp } from "@/studio/ContextualStudioApp";
import { loadCtxDocs } from "@/studio/ctxDocs";

export default function StudioRoute() {
  return <ContextualStudioApp ctxDocs={loadCtxDocs()} />;
}
