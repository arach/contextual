import { estimateTokens, nativeMessageText } from "./at-rest";
import { findTurn } from "./turns";
import type {
  AtRestLine,
  HarnessSessionRef,
  ManifestPart,
  ManifestPartKind,
  ManifestTransfer,
  ManifestTruth,
  SidecarFile,
  TokenBudgetMetadata,
  TurnReadyManifest,
  TurnRecord,
} from "./types";

export const HARNESS_MANIFEST_ADAPTER_VERSION = "harness-context-api@0.1.0";

export function buildManifestFromAtRest(
  session: HarnessSessionRef,
  lines: AtRestLine[],
  turns: TurnRecord[],
  sidecars: SidecarFile[],
  turnSelector: "latest" | string | number,
): TurnReadyManifest {
  const turn = findTurn(turns, turnSelector) ?? fallbackTurn(session, lines);
  const cutoffLine = turn.userLine ?? maxSourceLine(turn) ?? lines[lines.length - 1]?.line ?? 0;
  const eligible = lines.filter((line) => line.line <= cutoffLine);
  const parts = buildParts(session, eligible, sidecars);
  const tokenBudget = mergeTokenBudget(turn, parts);
  const hasTurnContext = turn.nativeRefs.some((ref) => ref.recordType === "turn_context");
  const warnings = manifestWarnings(session, turn, sidecars, hasTurnContext);

  return {
    id: `${session.key}:${turn.id}:manifest`,
    session,
    turn,
    harness: session.harness,
    model: turn.model ?? tokenBudget.model,
    cwd: turn.cwd ?? session.cwd,
    generatedAt: new Date().toISOString(),
    adapterVersion: HARNESS_MANIFEST_ADAPTER_VERSION,
    assembly: assemblyFor(session, hasTurnContext),
    parts,
    tokenBudget,
    sidecars,
    warnings,
  };
}

function fallbackTurn(session: HarnessSessionRef, lines: AtRestLine[]): TurnRecord {
  const lastLine = lines[lines.length - 1];
  return {
    id: "turn-fallback",
    sessionKey: session.key,
    index: 0,
    userLine: lastLine?.line,
    cwd: session.cwd,
    nativeRefs: lastLine ? [lastLine.source] : [],
    warnings: ["No explicit user turn boundary was found; manifest uses the final readable line as a fallback."],
  };
}

function buildParts(
  session: HarnessSessionRef,
  lines: AtRestLine[],
  sidecars: SidecarFile[],
): ManifestPart[] {
  const parts: ManifestPart[] = [];
  const add = (part: Omit<ManifestPart, "id" | "order" | "tokens"> & { id?: string; tokens?: number }) => {
    const content = part.content ?? "";
    parts.push({
      ...part,
      id: part.id ?? `part-${parts.length + 1}`,
      order: parts.length,
      tokens: part.tokens ?? (content ? estimateTokens(content) : undefined),
    });
  };

  if (session.harness === "codex") {
    addCodexPolicyParts(lines, add);
    addSidecarParts(sidecars, add, "inferred");
    addCodexTranscriptParts(lines, add);
  } else if (session.harness === "claude") {
    addSidecarParts(sidecars, add, "inferred");
    addClaudeTranscriptParts(lines, add);
  } else {
    addSidecarParts(sidecars, add, "reconstructed");
    addPiTranscriptParts(lines, add);
  }

  return parts;
}

function addCodexPolicyParts(
  lines: AtRestLine[],
  add: (part: Omit<ManifestPart, "id" | "order" | "tokens"> & { id?: string; tokens?: number }) => void,
): void {
  const sessionMeta = lines.find((line) => line.recordType === "session_meta");
  const latestTurnContext = [...lines].reverse().find((line) => line.recordType === "turn_context");

  if (sessionMeta) {
    const rec = sessionMeta.native as Record<string, unknown>;
    const payload = rec.payload as Record<string, unknown> | undefined;
    const content = stringifyInstructionPayload(payload?.base_instructions ?? payload?.instructions ?? payload?.cwd);
    if (content) {
      add({
        kind: "system",
        role: "system",
        title: "Codex session metadata",
        content,
        truth: "logged",
        sourceRefs: [sessionMeta.source],
        transfer: "transform",
        native: payload,
      });
    }
  }

  if (latestTurnContext) {
    const rec = latestTurnContext.native as Record<string, unknown>;
    const payload = rec.payload as Record<string, unknown> | undefined;
    const developerInstructions = stringifyInstructionPayload(payload?.developer_instructions);
    const userInstructions = stringifyInstructionPayload(payload?.user_instructions);
    const cwd = stringifyInstructionPayload(payload?.cwd);

    if (developerInstructions) {
      add({
        kind: "developer",
        role: "developer",
        title: "Codex turn developer instructions",
        content: developerInstructions,
        truth: "logged",
        sourceRefs: [latestTurnContext.source],
        transfer: "transform",
        native: payload?.developer_instructions,
      });
    }
    if (userInstructions) {
      add({
        kind: "user",
        role: "user",
        title: "Codex turn user instructions",
        content: userInstructions,
        truth: "logged",
        sourceRefs: [latestTurnContext.source],
        transfer: "transform",
        native: payload?.user_instructions,
      });
    }
    if (cwd && !developerInstructions && !userInstructions) {
      add({
        kind: "developer",
        role: "developer",
        title: "Codex turn context",
        content: `cwd: ${cwd}`,
        truth: "logged",
        sourceRefs: [latestTurnContext.source],
        transfer: "transform",
        native: payload,
      });
    }
  }
}

function addCodexTranscriptParts(
  lines: AtRestLine[],
  add: (part: Omit<ManifestPart, "id" | "order" | "tokens"> & { id?: string; tokens?: number }) => void,
): void {
  for (const line of lines) {
    const rec = line.native as Record<string, unknown>;
    const payload = rec.payload as Record<string, unknown> | undefined;
    if (rec.type !== "response_item" || !payload) continue;

    if (payload.type === "message") {
      const role = payload.role === "assistant" ? "assistant" : payload.role === "user" ? "user" : payload.role === "developer" ? "developer" : "system";
      const kind: ManifestPartKind = role === "developer" ? "developer" : role;
      add({
        kind,
        role,
        title: `Codex ${role} message`,
        content: nativeMessageText("codex", line.native),
        truth: "logged",
        sourceRefs: [line.source],
        transfer: role === "assistant" || role === "user" ? "direct" : "transform",
        native: payload,
      });
    } else if (payload.type === "function_call") {
      add({
        kind: "tool-call",
        role: "tool",
        title: `Codex tool call · ${String(payload.name ?? "tool")}`,
        content: stringifyInstructionPayload(payload.arguments),
        truth: "logged",
        sourceRefs: [line.source],
        transfer: "transform",
        native: payload,
      });
    } else if (payload.type === "function_call_output") {
      add({
        kind: "tool-result",
        role: "tool",
        title: "Codex tool result",
        content: nativeMessageText("codex", line.native),
        truth: "logged",
        sourceRefs: [line.source],
        transfer: "direct",
        native: payload,
      });
    } else if (payload.type === "reasoning") {
      add({
        kind: "reasoning",
        role: "assistant",
        title: "Codex reasoning item",
        content: nativeMessageText("codex", line.native),
        truth: "logged",
        sourceRefs: [line.source],
        transfer: "harness-native",
        native: payload,
      });
    }
  }
}

function addClaudeTranscriptParts(
  lines: AtRestLine[],
  add: (part: Omit<ManifestPart, "id" | "order" | "tokens"> & { id?: string; tokens?: number }) => void,
): void {
  for (const line of lines) {
    const rec = line.native as Record<string, unknown>;
    const message = rec.message as Record<string, unknown> | undefined;

    if (rec.type === "system" && /compact[_-]?boundary/i.test(JSON.stringify(rec))) {
      add({
        kind: "compact-summary",
        role: "system",
        title: "Claude compact boundary",
        content: nativeMessageText("claude", line.native) || "Claude logged a compact boundary.",
        truth: "logged",
        sourceRefs: [line.source],
        transfer: "transform",
        native: rec,
      });
    } else if (rec.type === "user") {
      if (Array.isArray(message?.content) && message.content.every((part) => Boolean(part && typeof part === "object" && (part as Record<string, unknown>).type === "tool_result"))) {
        add({
          kind: "tool-result",
          role: "tool",
          title: "Claude tool result",
          content: nativeMessageText("claude", line.native),
          truth: "logged",
          sourceRefs: [line.source],
          transfer: "direct",
          native: message,
        });
      } else {
        add({
          kind: "user",
          role: "user",
          title: "Claude user message",
          content: nativeMessageText("claude", line.native),
          truth: "logged",
          sourceRefs: [line.source],
          transfer: "direct",
          native: message,
        });
      }
    } else if (rec.type === "assistant") {
      addClaudeAssistantParts(line, add);
    } else if (rec.type === "attachment") {
      add({
        kind: "attachment",
        role: "user",
        title: "Claude attachment",
        content: nativeMessageText("claude", line.native) || JSON.stringify(rec),
        truth: "logged",
        sourceRefs: [line.source],
        transfer: "manual",
        native: rec,
      });
    }
  }
}

function addClaudeAssistantParts(
  line: AtRestLine,
  add: (part: Omit<ManifestPart, "id" | "order" | "tokens"> & { id?: string; tokens?: number }) => void,
): void {
  const rec = line.native as Record<string, unknown>;
  const message = rec.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (!Array.isArray(content)) {
    add({
      kind: "assistant",
      role: "assistant",
      title: "Claude assistant message",
      content: nativeMessageText("claude", line.native),
      truth: "logged",
      sourceRefs: [line.source],
      transfer: "direct",
      native: message,
    });
    return;
  }

  for (const [index, part] of content.entries()) {
    if (!part || typeof part !== "object") continue;
    const partRecord = part as Record<string, unknown>;
    if (partRecord.type === "tool_use") {
      add({
        kind: "tool-call",
        role: "tool",
        title: `Claude tool call · ${String(partRecord.name ?? "tool")}`,
        content: stringifyInstructionPayload(partRecord.input),
        truth: "logged",
        sourceRefs: [{ ...line.source, fieldPath: `message.content.${index}` }],
        transfer: "transform",
        native: partRecord,
      });
    } else {
      add({
        kind: "assistant",
        role: "assistant",
        title: "Claude assistant text",
        content: stringifyInstructionPayload(partRecord.text ?? partRecord.content),
        truth: "logged",
        sourceRefs: [{ ...line.source, fieldPath: `message.content.${index}` }],
        transfer: "direct",
        native: partRecord,
      });
    }
  }
}

function addPiTranscriptParts(
  lines: AtRestLine[],
  add: (part: Omit<ManifestPart, "id" | "order" | "tokens"> & { id?: string; tokens?: number }) => void,
): void {
  for (const line of lines) {
    const rec = line.native as Record<string, unknown>;
    if (rec.type === "session") {
      const cwd = typeof rec.cwd === "string" ? rec.cwd : undefined;
      add({
        kind: "system",
        role: "system",
        title: "Pi session header",
        content: cwd ? `cwd: ${cwd}` : JSON.stringify(rec),
        truth: "logged",
        sourceRefs: [line.source],
        transfer: "transform",
        native: rec,
      });
      continue;
    }
    if (rec.type !== "message") continue;
    const message = rec.message as Record<string, unknown> | undefined;
    const role = message?.role === "assistant" ? "assistant" : message?.role === "system" ? "system" : "user";
    add({
      kind: role,
      role,
      title: `Pi ${role} message`,
      content: nativeMessageText("pi", line.native),
      truth: "logged",
      sourceRefs: [line.source],
      transfer: role === "user" || role === "assistant" ? "direct" : "transform",
      native: message,
    });
  }
}

function addSidecarParts(
  sidecars: SidecarFile[],
  add: (part: Omit<ManifestPart, "id" | "order" | "tokens"> & { id?: string; tokens?: number }) => void,
  truth: ManifestTruth,
): void {
  for (const sidecar of sidecars) {
    add({
      kind: sidecar.kind === "agents" || sidecar.kind === "claude-md" || sidecar.kind === "skill" ? "sidecar" : "workspace",
      role: "system",
      title: sidecar.path,
      content: sidecar.content,
      contentRef: { kind: "sidecar", path: sidecar.path, hash: sidecar.hash },
      truth,
      sourceRefs: [{ kind: "sidecar", path: sidecar.path, hash: sidecar.hash }],
      transfer: "transform",
    });
  }
}

function assemblyFor(session: HarnessSessionRef, hasTurnContext: boolean): TurnReadyManifest["assembly"] {
  if (session.harness === "codex" && hasTurnContext) {
    return { status: "turn-context-logged", confidence: "high" };
  }
  if (session.harness === "pi") return { status: "reconstructed", confidence: "high" };
  if (session.harness === "claude") return { status: "best-effort", confidence: "medium" };
  return { status: "reconstructed", confidence: "medium" };
}

function manifestWarnings(
  session: HarnessSessionRef,
  turn: TurnRecord,
  sidecars: SidecarFile[],
  hasTurnContext: boolean,
): string[] {
  const warnings = [...(turn.warnings ?? [])];
  if (session.harness === "codex" && !hasTurnContext) {
    warnings.push("No Codex turn_context record found before this turn; prompt assembly is reconstructed from transcript records.");
  }
  if (session.harness === "claude") {
    warnings.push("Claude Code last-prompt is not a full prompt manifest; hidden system/tool instructions may be unavailable on disk.");
  }
  if (session.harness === "pi" && !sidecars.length) {
    warnings.push("No Pi workspace sidecars were found for this session; fixed context may be incomplete.");
  }
  return [...new Set(warnings)];
}

function mergeTokenBudget(turn: TurnRecord, parts: ManifestPart[]): TokenBudgetMetadata {
  const estimatedInputTokens = parts.reduce((sum, part) => sum + (part.tokens ?? 0), 0);
  return {
    ...turn.tokenCounts,
    model: turn.model ?? turn.tokenCounts?.model,
    estimatedInputTokens,
    estimateSource: turn.tokenCounts?.estimateSource ?? "heuristic",
  };
}

function maxSourceLine(turn: TurnRecord): number | undefined {
  const lines = turn.nativeRefs.map((ref) => ref.line).filter((line): line is number => typeof line === "number");
  return lines.length ? Math.max(...lines) : undefined;
}

function stringifyInstructionPayload(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyInstructionPayload(item))
      .filter(Boolean)
      .join("\n");
  }
  if (!value || typeof value !== "object") return "";
  const rec = value as Record<string, unknown>;
  if (typeof rec.text === "string") return rec.text.trim();
  if (typeof rec.content === "string") return rec.content.trim();
  return JSON.stringify(value, null, 2);
}
