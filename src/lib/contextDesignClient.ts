import type {
  ContextDesignAgentInput,
  ContextDesignProposalResponse,
} from "@/lib/contextCreation";

export async function proposeContextDesign(
  input: ContextDesignAgentInput,
): Promise<ContextDesignProposalResponse> {
  const response = await fetch("/api/context-design/propose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({ error: response.statusText }))) as {
      error?: string;
    };
    throw new Error(body.error ?? `context design failed: ${response.status}`);
  }

  return (await response.json()) as ContextDesignProposalResponse;
}
