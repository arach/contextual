import { displaySessionTitle } from "../../lib/sessionLabel";
import { nativeMessageText } from "./at-rest";
import type { AtRestLine, CompactBoundary, HarnessId, HarnessSessionRef, SourceRef, TokenBudgetMetadata, TurnRecord } from "./types";

interface TurnDraft {
  id: string;
  sessionKey: string;
  userLine?: number;
  assistantLine?: number;
  startedAt?: string;
  completedAt?: string;
  model?: string;
  cwd?: string;
  title?: string;
  tokenCounts?: TokenBudgetMetadata;
  compactBoundary?: CompactBoundary;
  nativeRefs: SourceRef[];
  warnings?: string[];
}

export function listTurnsFromAtRest(session: HarnessSessionRef, lines: AtRestLine[]): TurnRecord[] {
  if (session.harness === "codex") return finalizeTurns(buildCodexTurns(session, lines));
  if (session.harness === "claude") return finalizeTurns(buildClaudeTurns(session, lines));
  return finalizeTurns(buildPiTurns(session, lines));
}

export function findTurn(turns: TurnRecord[], turn: "latest" | string | number): TurnRecord | null {
  if (!turns.length) return null;
  if (turn === "latest") return turns[turns.length - 1] ?? null;
  if (typeof turn === "number") return turns[turn] ?? null;
  const byId = turns.find((candidate) => candidate.id === turn);
  if (byId) return byId;
  const parsed = Number(turn);
  return Number.isInteger(parsed) ? turns[parsed] ?? null : null;
}

function finalizeTurns(drafts: TurnDraft[]): TurnRecord[] {
  return drafts.map((draft, index) => ({
    ...draft,
    id: draft.id || `turn-${index + 1}`,
    index,
  }));
}

function buildCodexTurns(session: HarnessSessionRef, lines: AtRestLine[]): TurnDraft[] {
  const turns: TurnDraft[] = [];
  let current: TurnDraft | null = null;

  const pushCurrent = () => {
    if (current && (current.userLine || current.nativeRefs.length)) turns.push(current);
    current = null;
  };

  for (const line of lines) {
    const rec = line.native as Record<string, unknown>;
    const payload = rec.payload as Record<string, unknown> | undefined;

    if (rec.type === "turn_context") {
      pushCurrent();
      current = {
        id: `turn-line-${line.line}`,
        sessionKey: session.key,
        startedAt: line.timestamp,
        model: stringField(payload, "model"),
        cwd: stringField(payload, "cwd") ?? session.cwd,
        nativeRefs: [line.source],
      };
      continue;
    }

    if (rec.type === "response_item" && payload?.type === "message" && payload.role === "user") {
      if (!current || current.userLine) {
        pushCurrent();
        current = { id: `turn-line-${line.line}`, sessionKey: session.key, nativeRefs: [] };
      }
      const text = nativeMessageText("codex", line.native);
      current.userLine = line.line;
      current.startedAt = current.startedAt ?? line.timestamp;
      current.title = text ? displaySessionTitle(text) : undefined;
      current.nativeRefs.push(line.source);
      continue;
    }

    if (rec.type === "response_item" && payload?.type === "message" && payload.role === "assistant") {
      if (current && current.userLine && !current.assistantLine) {
        current.assistantLine = line.line;
        current.completedAt = line.timestamp;
        current.nativeRefs.push(line.source);
      }
      continue;
    }

    if (rec.type === "event_msg" && payload?.type === "token_count" && current) {
      current.tokenCounts = codexTokenCounts(payload, current.model);
      current.nativeRefs.push(line.source);
    }
  }

  pushCurrent();
  return turns;
}

function codexTokenCounts(payload: Record<string, unknown>, model?: string): TokenBudgetMetadata {
  const info = payload.info as Record<string, unknown> | undefined;
  const last = info?.last_token_usage as Record<string, unknown> | undefined;
  return {
    model,
    modelWindow: numberField(payload, "model_context_window") ?? numberField(info, "model_context_window") ?? null,
    loggedInputTokens: numberField(last, "input_tokens"),
    loggedOutputTokens: numberField(last, "output_tokens"),
    loggedTotalTokens: numberField(last, "total_tokens"),
    estimateSource: "harness",
  };
}

function buildClaudeTurns(session: HarnessSessionRef, lines: AtRestLine[]): TurnDraft[] {
  const turns: TurnDraft[] = [];
  let current: TurnDraft | null = null;
  let pendingCompact: CompactBoundary | undefined;

  const pushCurrent = () => {
    if (current && (current.userLine || current.nativeRefs.length)) turns.push(current);
    current = null;
  };

  for (const line of lines) {
    const rec = line.native as Record<string, unknown>;
    const message = rec.message as Record<string, unknown> | undefined;

    if (rec.type === "system") {
      const boundary = compactBoundaryFromSystem(line);
      if (boundary) {
        pendingCompact = boundary;
        if (current) current.compactBoundary = boundary;
      }
      continue;
    }

    if (rec.type === "user") {
      const content = message?.content;
      if (isClaudeToolResultOnly(content)) {
        if (current) current.nativeRefs.push(line.source);
        continue;
      }

      pushCurrent();
      const text = nativeMessageText("claude", line.native);
      current = {
        id: `turn-line-${line.line}`,
        sessionKey: session.key,
        userLine: line.line,
        startedAt: line.timestamp,
        title: text ? displaySessionTitle(text) : undefined,
        compactBoundary: pendingCompact,
        nativeRefs: pendingCompact ? [pendingCompact.source, line.source] : [line.source],
        warnings: pendingCompact ? ["This turn follows a Claude compaction boundary; full pre-compaction prompt assembly is not on disk."] : undefined,
      };
      pendingCompact = undefined;
      continue;
    }

    if (rec.type === "assistant") {
      if (current && !current.assistantLine) {
        current.assistantLine = line.line;
        current.completedAt = line.timestamp;
        current.tokenCounts = claudeTokenCounts(message);
        current.nativeRefs.push(line.source);
      }
    }
  }

  pushCurrent();
  return turns;
}

function buildPiTurns(session: HarnessSessionRef, lines: AtRestLine[]): TurnDraft[] {
  const turns: TurnDraft[] = [];
  let current: TurnDraft | null = null;
  let model: string | undefined;

  const pushCurrent = () => {
    if (current && (current.userLine || current.nativeRefs.length)) turns.push(current);
    current = null;
  };

  for (const line of lines) {
    const rec = line.native as Record<string, unknown>;
    if (rec.type === "model_change") {
      model = stringField(rec, "model") ?? model;
      continue;
    }

    if (rec.type !== "message") continue;
    const message = rec.message as Record<string, unknown> | undefined;
    if (message?.role === "user") {
      pushCurrent();
      const text = nativeMessageText("pi", line.native);
      current = {
        id: `turn-line-${line.line}`,
        sessionKey: session.key,
        userLine: line.line,
        startedAt: line.timestamp,
        model,
        cwd: session.cwd,
        title: text ? displaySessionTitle(text) : undefined,
        nativeRefs: [line.source],
      };
    } else if (message?.role === "assistant" && current && !current.assistantLine) {
      current.assistantLine = line.line;
      current.completedAt = line.timestamp;
      current.nativeRefs.push(line.source);
    }
  }

  pushCurrent();
  return turns;
}

function isClaudeToolResultOnly(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.length > 0 && content.every((part) => Boolean(part && typeof part === "object" && (part as Record<string, unknown>).type === "tool_result"));
}

function compactBoundaryFromSystem(line: AtRestLine): CompactBoundary | null {
  const rec = line.native as Record<string, unknown>;
  const text = JSON.stringify(line.native);
  if (rec.subtype !== "compact_boundary" && !/compact[_-]?boundary/i.test(text)) return null;
  const metadata = rec.compactMetadata as Record<string, unknown> | undefined;
  return {
    source: line.source,
    preTokens: numberField(metadata, "preTokens") ?? firstNumberFor(text, /pre[^0-9]{0,24}(\d{3,})/i),
    postTokens: numberField(metadata, "postTokens") ?? firstNumberFor(text, /post[^0-9]{0,24}(\d{3,})/i),
    summary: nativeMessageText("claude", line.native).slice(0, 1_200) || undefined,
  };
}

function claudeTokenCounts(message: Record<string, unknown> | undefined): TokenBudgetMetadata | undefined {
  const usage = message?.usage as Record<string, unknown> | undefined;
  if (!usage) return undefined;
  const input =
    (numberField(usage, "input_tokens") ?? 0) +
    (numberField(usage, "cache_creation_input_tokens") ?? 0) +
    (numberField(usage, "cache_read_input_tokens") ?? 0);
  const output = numberField(usage, "output_tokens") ?? 0;
  return {
    loggedInputTokens: input || undefined,
    loggedOutputTokens: output || undefined,
    loggedTotalTokens: input || output ? input + output : undefined,
    estimateSource: "harness",
  };
}

function stringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
}

function numberField(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : undefined;
}

function firstNumberFor(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  return match?.[1] ? Number(match[1]) : undefined;
}
