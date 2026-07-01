/**
 * Filesystem-backed reader for `docs/presentations/CTX-*.md`.
 *
 * CTX docs follow a fixed shape:
 *
 *   # CTX-NNN: Title
 *
 *   Status: active presentation
 *   Owner: Contextual
 *   Last updated: 2026-05-31
 *
 *   ## Thesis
 *   …short prose…
 *
 *   ## H2 Section
 *   …
 *
 * The loader extracts the plain `Key: value` meta block, lifts the
 * `## Thesis` (and `## Summary` / `## Overview` if present) H2 sections
 * into a `headerSections` array, and returns the remaining body. The
 * data-sheet renderer pulls header sections into the top sheet; body
 * markdown renders below.
 *
 * Modeled on `openscout/design/studio/lib/eng-docs.ts`; intentionally
 * narrower (one filename family, simpler status mapping).
 */

import fs from "node:fs";
import path from "node:path";

import type { StudioStatus } from "@/studio/studioRegistry";

const PRESENTATIONS_DIR = path.resolve(
  process.cwd(),
  "docs",
  "presentations",
);
const REPO_REL = "docs/presentations";

export interface CtxHeaderSection {
  /** Uppercase label rendered in the data-sheet grid. */
  label: string;
  /** Markdown body of the section, without the `##` heading. */
  body: string;
}

export interface CtxDoc {
  /** `CTX-001` — display id. */
  id: string;
  /** Numeric sort key. */
  number: number;
  /** `ctx-001` — used in route. */
  slug: string;
  /** `/studio/ctx-001` — route. */
  href: string;
  /** Display title with `CTX-NNN:` prefix stripped. */
  title: string;
  /** Normalized status for the StatusPill. */
  status: StudioStatus;
  /** Original raw text from `Status: …` for the meta line. */
  statusRaw: string;
  /** From `Owner: …`. */
  owner: string | null;
  /** From `Last updated: …` — kept as-is, no parsing. */
  lastUpdated: string | null;
  /** Any other `Key: value` lines we didn't recognize. */
  extraMeta: { label: string; value: string }[];
  /** First paragraph of the Thesis section — for list cards / sidebar blurbs. */
  blurb: string | null;
  /** Lifted H2 sections (Thesis, Summary, Overview) — render in the header sheet. */
  headerSections: CtxHeaderSection[];
  /** Body with title line + meta block + lifted sections removed. */
  body: string;
  /** Repo-relative source path. */
  source: string;
  /** ISO mtime. */
  updatedAt: string;
}

/** Lift these H2 sections into the header sheet. Order = render order.
 *  Working notes don't have thesis statements — the opening prose just
 *  leads the body. A `## Summary` section is still lifted if a doc
 *  genuinely benefits from one. */
const LIFT_PATTERNS: { label: string; match: RegExp }[] = [
  { label: "Summary", match: /^(summary|overview|tldr|tl;dr)\s*$/i },
];

function parseCtxId(filename: string): { id: string; number: number } | null {
  const m = filename.match(/^ctx-?(\d+)-/i);
  if (!m) return null;
  return { id: `CTX-${m[1].padStart(3, "0")}`, number: parseInt(m[1], 10) };
}

function extractTitle(body: string, fallbackId: string): string {
  const match = body.match(/^#\s+(.+?)$/m);
  if (!match) return fallbackId;
  return match[1].trim().replace(/^CTX-?\d+\s*[:—–-]\s*/i, "");
}

interface MetaBlock {
  status: StudioStatus;
  statusRaw: string;
  owner: string | null;
  lastUpdated: string | null;
  extra: { label: string; value: string }[];
  /** Indices of source lines that were part of the meta block — dropped from body. */
  consumedLineIdx: number[];
}

/** Walk lines after the H1, capture `Key: value` rows until the first H2. */
function parseMetaBlock(lines: string[], h1Idx: number): MetaBlock {
  const meta: MetaBlock = {
    status: "draft",
    statusRaw: "",
    owner: null,
    lastUpdated: null,
    extra: [],
    consumedLineIdx: [],
  };

  for (let i = h1Idx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      meta.consumedLineIdx.push(i);
      continue;
    }
    if (line.startsWith("#")) break;
    const m = line.match(/^([A-Z][A-Za-z ]{0,30}):\s+(.+)$/);
    if (!m) break;
    assignMeta(meta, m[1].trim(), m[2].trim());
    meta.consumedLineIdx.push(i);
  }
  return meta;
}

function assignMeta(meta: MetaBlock, key: string, value: string): void {
  const lk = key.toLowerCase();
  if (lk === "status") {
    meta.statusRaw = value;
    meta.status = normalizeStatus(value);
    return;
  }
  if (lk === "owner" || lk === "owners") {
    meta.owner = value;
    return;
  }
  if (lk === "last updated" || lk === "updated") {
    meta.lastUpdated = value;
    return;
  }
  meta.extra.push({ label: key, value });
}

function normalizeStatus(raw: string): StudioStatus {
  const head = raw.toLowerCase();
  if (/study|spike|sketch|exploratory/.test(head)) return "study";
  if (/draft|propos/.test(head)) return "draft";
  if (/active|live|shipped|done/.test(head)) return "active";
  return "active";
}

interface H2Match {
  start: number;
  bodyStart: number;
  text: string;
}

function findH2Headings(input: string): H2Match[] {
  const out: H2Match[] = [];
  const re = /^##\s+(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    const lineEnd = input.indexOf("\n", m.index);
    out.push({
      start: m.index,
      bodyStart: lineEnd === -1 ? input.length : lineEnd + 1,
      text: m[1],
    });
  }
  return out;
}

function labelFor(headingText: string): string | null {
  const normalized = headingText.trim().replace(/:+$/, "");
  for (const p of LIFT_PATTERNS) {
    if (p.match.test(normalized)) return p.label;
  }
  return null;
}

interface LiftResult {
  headerSections: CtxHeaderSection[];
  rest: string;
}

function liftHeaderSections(input: string): LiftResult {
  const headings = findH2Headings(input);
  const matched: { start: number; bodyStart: number; end: number; label: string }[] = [];

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const next = headings[i + 1];
    const label = labelFor(h.text);
    if (!label) continue;
    matched.push({
      start: h.start,
      bodyStart: h.bodyStart,
      end: next ? next.start : input.length,
      label,
    });
  }

  if (matched.length === 0) return { headerSections: [], rest: input };

  let rest = "";
  let cursor = 0;
  for (const mm of matched) {
    rest += input.slice(cursor, mm.start);
    cursor = mm.end;
  }
  rest += input.slice(cursor);
  rest = rest.replace(/^\s*\n+/, "").replace(/\n{3,}/g, "\n\n");

  const order = new Map(LIFT_PATTERNS.map((p, i) => [p.label, i] as const));
  matched.sort(
    (a, b) =>
      (order.get(a.label) ?? Infinity) - (order.get(b.label) ?? Infinity),
  );

  const headerSections = matched.map((mm) => ({
    label: mm.label,
    body: input.slice(mm.bodyStart, mm.end).trim(),
  }));

  return { headerSections, rest };
}

function extractBlurb(sectionBody: string): string | null {
  for (const para of sectionBody.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    if (/^[>*\-`|#]/.test(trimmed)) continue;
    if (/^```/.test(trimmed)) continue;
    const text = trimmed.replace(/\s+/g, " ");
    return text.length > 240 ? text.slice(0, 237) + "…" : text;
  }
  return null;
}

function isMarkdown(name: string): boolean {
  if (name.startsWith("_") || name.startsWith(".")) return false;
  return name.endsWith(".md");
}

function parseDoc(filename: string, raw: string, mtime: Date): CtxDoc | null {
  const parsedId = parseCtxId(filename);
  if (!parsedId) return null;

  const lines = raw.split("\n");
  let h1Idx = -1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].startsWith("# ")) {
      h1Idx = i;
      break;
    }
  }

  const meta =
    h1Idx === -1
      ? ({
          status: "draft" as StudioStatus,
          statusRaw: "",
          owner: null,
          lastUpdated: null,
          extra: [],
          consumedLineIdx: [] as number[],
        })
      : parseMetaBlock(lines, h1Idx);

  const dropIdx = new Set<number>([h1Idx, ...meta.consumedLineIdx]);
  const stripped = lines
    .filter((_, i) => !dropIdx.has(i))
    .join("\n")
    .replace(/^\s*\n+/, "");

  const { headerSections, rest } = liftHeaderSections(stripped);

  const thesis = headerSections.find((s) => s.label === "Thesis");
  const summary = headerSections.find((s) => s.label === "Summary");
  const blurb = extractBlurb(thesis?.body ?? summary?.body ?? rest);

  const slug = filename.replace(/\.md$/, "").toLowerCase().replace(/^ctx-(\d+).*/i, "ctx-$1");
  const filenameSlug = filename.replace(/\.md$/, "").toLowerCase();
  const routeSlug = `ctx-${String(parsedId.number).padStart(3, "0")}`;

  return {
    id: parsedId.id,
    number: parsedId.number,
    slug: routeSlug,
    href: `/studio/${routeSlug}`,
    title: extractTitle(raw, parsedId.id),
    status: meta.status,
    statusRaw: meta.statusRaw,
    owner: meta.owner,
    lastUpdated: meta.lastUpdated,
    extraMeta: meta.extra,
    blurb,
    headerSections,
    body: rest,
    source: `${REPO_REL}/${filenameSlug}.md`,
    updatedAt: mtime.toISOString(),
  };
}

export function loadCtxDocs(): CtxDoc[] {
  if (!fs.existsSync(PRESENTATIONS_DIR)) return [];
  const files = fs
    .readdirSync(PRESENTATIONS_DIR)
    .filter(isMarkdown)
    .filter((f) => f.toLowerCase() !== "readme.md");

  const docs: CtxDoc[] = [];
  for (const f of files) {
    const filePath = path.join(PRESENTATIONS_DIR, f);
    const raw = fs.readFileSync(filePath, "utf8");
    const stat = fs.statSync(filePath);
    const parsed = parseDoc(f, raw, stat.mtime);
    if (parsed) docs.push(parsed);
  }

  docs.sort((a, b) => a.number - b.number);
  return docs;
}
