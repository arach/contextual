// pi-ai backend — in-process dispatch via @earendil-works/pi-ai. Stateless:
// each call rebuilds the full Context from Contextual's Fixed/Soft state.
// No subprocess, no session files. Prompt caching is handled by pi-ai via
// `cacheRetention: "short"` (its Anthropic provider maps that to
// cache_control: { type: "ephemeral" } on the system prompt).

import {
  complete,
  getEnvApiKey,
  getModel,
  type AssistantMessage,
  type Context,
  type Message,
  type TextContent,
  type UserMessage,
} from "@earendil-works/pi-ai";

import type {
  Backend,
  DispatchRequest,
  DispatchResult,
} from "./types";
import { getOAuthApiKey } from "./oauth";

function extractText(content: AssistantMessage["content"]): string {
  return content
    .filter((c): c is TextContent => c.type === "text")
    .map((c) => c.text)
    .join("")
    .trim();
}

function buildSystemPrompt(req: DispatchRequest): string {
  const parts: string[] = [];
  if (req.systemPrompt.trim()) parts.push(req.systemPrompt.trim());
  if (req.task?.body.trim()) {
    parts.push(`Current task: ${req.task.body.trim()}`);
  }
  const rules = req.fixed.filter((m) => m.kind === "rules");
  for (const m of rules) {
    parts.push(`## ${m.name}\n\n${m.body.trim()}`);
  }
  const docs = req.fixed.filter((m) => m.kind === "doc" || m.kind === "log");
  for (const m of docs) {
    parts.push(`## ${m.name} (${m.kind})\n\n${m.body.trim()}`);
  }
  return parts.join("\n\n");
}

function buildMessages(req: DispatchRequest): Message[] {
  const messages: Message[] = [];
  const preamble: string[] = [];
  const now = Date.now();

  // Soft items in chronological order. Replay `turn` items as real roles;
  // summarize `summary` and `tool` items into a single preamble user
  // message so the model treats them as background context rather than
  // forged turns. (Codex recommendation, round-1 review.)
  for (const item of req.soft) {
    if (item.kind === "turn") {
      const role: "user" | "assistant" = item.role === "user" ? "user" : "assistant";
      if (role === "user") {
        messages.push({
          role: "user",
          content: item.body,
          timestamp: now,
        } satisfies UserMessage);
      } else {
        messages.push({
          role: "assistant",
          content: [{ type: "text", text: item.body }],
          api: "anthropic-messages",
          provider: "anthropic",
          model: "(historical)",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
          stopReason: "stop",
          timestamp: now,
        } satisfies AssistantMessage);
      }
    } else if (item.kind === "summary") {
      preamble.push(`- summary "${item.title}": ${item.body.trim()}`);
    } else if (item.kind === "tool") {
      preamble.push(`- tool result "${item.title}": ${item.body.trim()}`);
    }
  }

  if (preamble.length > 0) {
    messages.unshift({
      role: "user",
      content: `Earlier in this branch (background context, not your own turns):\n${preamble.join("\n")}`,
      timestamp: now,
    } satisfies UserMessage);
  }

  messages.push({
    role: "user",
    content: req.user,
    timestamp: now,
  } satisfies UserMessage);

  return messages;
}

async function dispatch(req: DispatchRequest): Promise<DispatchResult> {
  if (req.config.backend !== "pi-ai") {
    throw new Error(`pi-ai backend received config for ${req.config.backend}`);
  }
  const { provider, model: modelId, auth } = req.config;

  let apiKey: string | undefined;
  if (auth.mode === "api-key") {
    apiKey = getEnvApiKey(provider);
    if (!apiKey) {
      throw new Error(
        `No API key found for ${provider}. Run the dev server with \`secret run <KEY> -- bun dev\`, or switch the backend chip to an OAuth option.`,
      );
    }
  } else {
    const oauthKey = await getOAuthApiKey(provider);
    if (!oauthKey) {
      throw new Error(
        `Not signed in to ${provider}. Click "sign in" on the backend chip to connect your Pro/Max subscription.`,
      );
    }
    apiKey = oauthKey;
  }

  const model = getModel(provider as never, modelId as never);
  const context: Context = {
    systemPrompt: buildSystemPrompt(req),
    messages: buildMessages(req),
  };

  console.log(
    `[pi-ai] dispatch ${req.threadId}/${req.branchId} (provider=${provider}, model=${modelId}, soft=${req.soft.length}, fixed=${req.fixed.length})`,
  );

  const t0 = Date.now();
  const message = await complete(model, context, {
    apiKey,
    cacheRetention: "short",
  });
  const reply = extractText(message.content);

  console.log(
    `[pi-ai] reply in ${Date.now() - t0}ms (${reply.length} chars, input=${message.usage.input}, output=${message.usage.output}, cost=$${message.usage.cost.total.toFixed(4)})`,
  );

  return {
    reply,
    usage: message.usage,
  };
}

export const piAiBackend: Backend = {
  id: "pi-ai",
  label: "pi-ai · stateless",
  capabilities: {
    hasNativeSessions: false,
    hasOAuth: true,
    hasModelPicker: true,
    hasStreaming: true,
    providers: ["anthropic", "openai", "google", "google-vertex", "mistral", "amazon-bedrock"],
  },
  dispatch,
};
