function baseName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

/** True when the message is harness context, not the user's actual task. */
export function isLowSignalUserMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;

  const oneLine = trimmed.replace(/\s+/g, " ");
  if (oneLine.length < 16) return true;

  const lower = oneLine.toLowerCase();

  if (/^#+\s*agents\.?md\b/i.test(oneLine)) return true;
  if (/agents\.?md\s+instructions\s+for\b/i.test(oneLine)) return true;
  if (/^read(\s+(the|this))?\s+.*\b(agents|claude|readme)\b/i.test(oneLine)) return true;
  if (/^<instructions>[\s\S]*<\/instructions>\s*$/i.test(trimmed)) return true;

  if (/^@[\w./-]+\.(md|txt)\s*$/i.test(oneLine)) return true;
  if (/^\/[\w./@-]+\.(md|tsx?|jsx?|json|ya?ml)\s*$/i.test(oneLine)) return true;

  if (trimmed.startsWith("<environment") || trimmed.startsWith("<context")) return true;
  if (lower.includes("you are running in") && oneLine.length < 240) return true;

  if (/^\/[\w-]+\s*$/.test(oneLine)) return true;

  if (/^import\s+(type\s+)?[\s{]/.test(oneLine)) return true;
  if (/^export\s+(type\s+)?[\s{]/.test(oneLine)) return true;

  if (/^@[\w-]+\s*->\s*@[\w.-]+\s*\.?\s*$/i.test(oneLine)) return true;

  const withoutHeaders = trimmed
    .replace(/^#+\s+.+$/gm, "")
    .replace(/<instructions>[\s\S]*?<\/instructions>/gi, "")
    .trim();
  if (!withoutHeaders && /^#+\s/m.test(trimmed)) return true;

  if (
    (lower.includes("llms.txt") || lower.includes("dev_instructions")) &&
    oneLine.length < 280 &&
    !/\b(fix|add|implement|why|how|please)\b/i.test(oneLine)
  ) {
    return true;
  }

  return false;
}

export function scoreUserMessage(text: string): number {
  if (isLowSignalUserMessage(text)) return 0;

  const oneLine = text.replace(/\s+/g, " ").trim();
  let score = Math.min(oneLine.length, 220);

  if (/\?/.test(oneLine)) score += 35;
  if (/^(can you|please|fix|add|implement|update|refactor|help|why|how|follow-up)/i.test(oneLine)) {
    score += 30;
  }
  if (/\b(bug|error|failing|broken|review|investigate|debug)\b/i.test(oneLine)) score += 25;
  if (/(?:^|\n)goal:/i.test(text)) score += 40;
  if (oneLine.length > 80) score += 15;

  return score;
}

export function pickBestUserMessage(candidates: string[]): string | null {
  let best: { text: string; score: number } | null = null;
  for (const raw of candidates) {
    const text = raw.trim();
    if (!text) continue;
    const score = scoreUserMessage(text);
    if (score <= 0) continue;
    if (!best || score > best.score) best = { text, score };
  }
  return best?.text ?? null;
}

function clipTitle(text: string, max = 72): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function humanizeAgentHandle(handle: string): string {
  const core = handle.replace(/^@/, "").toLowerCase();
  if (core.includes("ask-codex") || core.includes("ask_codex")) return "Ask Codex";
  if (core.includes("ask-claude")) return "Ask Claude";
  if (core === "operator") return "operator";
  if (core.includes("openscout")) return "OpenScout";
  return core
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isMostlyUppercase(text: string): boolean {
  const letters = text.replace(/[^a-zA-Z]/g, "");
  if (letters.length < 8) return false;
  const upper = letters.replace(/[^A-Z]/g, "").length;
  return upper / letters.length > 0.7;
}

function softenCase(text: string): string {
  if (!isMostlyUppercase(text)) return text;
  return text
    .toLowerCase()
    .replace(/(?:^|[.!?]\s+)([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(/^([a-z])/, (_, c: string) => c.toUpperCase());
}

/** Calm, human-facing title — sentence case, no broker noise. */
export function displaySessionTitle(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "Session";

  const route = text.match(/^@([\w-]+)\s*->\s*@([\w.-]+)(?:\s*[-–—]\s*(.+))?/i);
  if (route) {
    const [, from, to, rest] = route;
    const task = rest?.trim()
      ? clipTitle(softenCase(rest), 56)
      : humanizeAgentHandle(to);
    const via = humanizeAgentHandle(from);
    return via.toLowerCase() === "operator" ? `${task} · via operator` : `${task} · ${via}`;
  }

  text = softenCase(text);
  return clipTitle(text);
}

/** Turn a substantive user turn into a short session title. */
export function titleFromUserMessage(text: string): string {
  const goal = text.match(/(?:^|\n)\s*Goal:\s*(.+?)(?:\n|$)/im)?.[1]?.trim();
  if (goal && goal.length >= 12) return clipTitle(goal);

  let body = text
    .replace(/^#+\s*AGENTS\.?MD[\s\S]*?(?=\n\n|\n[A-Z])/im, "")
    .replace(/<instructions>[\s\S]*?<\/instructions>/gi, "")
    .trim();

  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !isLowSignalUserMessage(line));

  const lead = lines[0] ?? body.replace(/\s+/g, " ");
  const stripped = lead
    .replace(/^you are a (fresh )?reviewer[^.]*\.\s*/i, "")
    .replace(/^follow-up,?\s*/i, "")
    .replace(/^please\s+/i, "")
    .trim();

  const sentence =
    stripped.match(/^[^.!?\n]{12,120}[.!?]/)?.[0] ??
    stripped.split(/\n/)[0] ??
    stripped;

  return displaySessionTitle(clipTitle(sentence || lead || "Session", 120));
}

export function summaryFromUserMessage(text: string): string {
  const goal = text.match(/(?:^|\n)\s*Goal:\s*([\s\S]+?)(?:\n\n|\n[A-Z][a-z]+:)/im)?.[1]?.trim();
  const core = goal ?? text.replace(/^#+\s*AGENTS\.?MD[\s\S]*?(?=\n\n)/im, "").trim();
  const oneLine = core.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 200) return oneLine;
  return `${oneLine.slice(0, 197)}…`;
}

export function projectHintFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.includes("scout") || lower.includes("openscout")) return "Scout";
  if (lower.includes("talkie")) return "Talkie";
  if (lower.includes("contextual")) return "Contextual";
  if (lower.includes("hudson")) return "Hudson";
  return "Other";
}

export function titleFromPath(path: string): string {
  const project = projectHintFromPath(path);
  const rollout = path.match(/rollout-(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})/);
  if (rollout) {
    const [, y, mo, d, h, mi] = rollout;
    const when = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
    const label = when.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    return `${project} · ${label}`;
  }
  const file = baseName(path).replace(/\.jsonl$/i, "");
  if (file.length > 8 && file.length <= 48) return `${project} · ${file}`;
  return `${project} session`;
}

export interface TranscriptSessionMeta {
  cwd?: string;
  agentLabel?: string;
  project?: string;
}

export function titleFromTranscriptMeta(meta: TranscriptSessionMeta, path: string): string {
  const project =
    meta.project ??
    (meta.cwd ? projectHintFromPath(meta.cwd) : projectHintFromPath(path));
  const repo = meta.cwd ? baseName(meta.cwd) : null;
  const agent = meta.agentLabel;

  if (repo && agent) return `${clipTitle(repo, 32)} · ${clipTitle(agent, 24)}`;
  if (repo) return `${project} · ${clipTitle(repo, 40)}`;
  return titleFromPath(path);
}
