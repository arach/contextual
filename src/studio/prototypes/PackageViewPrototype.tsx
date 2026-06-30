"use client";

// Context IDE — embedded prototype for the Package/Designer view.
//
// STUDIO prototype: real hangar design system, NOT wired to data (mock
// ingredients, faked agent, local useState). For reviewing the experience.
//
// Frame: Cursor is an IDE for CODE with an agent that edits it. This is an IDE
// for CONTEXT with an agent that CONSTRUCTS it. "Files" = ingredients, the
// "codebase" = the agent's worldview, the destination = the Brief (the ordered
// play-by-play of what the agent is told). Density analysis is downstream.
//
// Color discipline (Arach): color is EARNED, not decorative. Syntax
// highlighting in the editor = yes. Per-kind taxonomy colors / little rounded
// markers = no. Chrome is monochrome; the one accent (orange) is spent on
// active state, primary actions, and the task block.

import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight, ArrowUp, Boxes, Check, ChevronDown, CornerDownLeft, FileText,
  GitBranch, Layers, RotateCcw, Search, Settings, Sparkles, X,
} from "lucide-react";

type Kind = "instructions" | "summary" | "examples" | "code" | "entrypoints" | "skill";
const KIND_TAG: Record<Kind, string> = {
  instructions: "agents.md", summary: "doc summary", examples: "icl examples",
  code: "code snippet", entrypoints: "entry points", skill: "skill",
};

type OriginType = "manual" | "summarized" | "found" | "curated" | "scanned" | "skill";

interface Ref { label: string; type: OriginType }
interface Doc { id: string; kind: Kind; title: string; origin: string; tok: string; lang: Lang; material: string; refs: Ref[]; blurb: string }
type Lang = "md" | "code" | "ts" | "text";

const INGREDIENTS: Doc[] = [
  {
    id: "agents", kind: "instructions", title: "api conventions", origin: "AGENTS.md", tok: "2.1k", lang: "md",
    blurb: "The guardrails the agent must respect on the API.", refs: [{ label: "AGENTS.md", type: "manual" }],
    material: `# API conventions (AGENTS.md)

- Everything ships under /v1; never break a published contract
- Validate inputs with zod at the edge
- Errors use Problem+JSON: { type, title, status, detail }
- Auth: bearer token; scope checked in middleware
- bun for scripts; vitest for contract tests`,
  },
  {
    id: "openapi", kind: "summary", title: "openapi contract", origin: "docs/openapi.yaml", tok: "6.4k", lang: "md",
    blurb: "Condensed contract: resources, conventions, auth.",
    refs: [
      { label: "docs/openapi.yaml", type: "summarized" },
      { label: "docs/api/resources.md", type: "summarized" },
      { label: "docs/api/auth.md", type: "summarized" },
    ],
    material: `# API contract (summary)

## Resources
/v1/sessions   create · list · get
/v1/packages   create · list · get · publish
/v1/contexts   create · get

## Conventions
Cursor pagination (?cursor=). JSON only. Problem+JSON on 4xx/5xx.

## Auth
Bearer token. Scopes per resource: sessions:read, packages:write.`,
  },
  {
    id: "error-icl", kind: "examples", title: "error-shape exemplars", origin: "curated · 4 pairs", tok: "2.6k", lang: "text",
    blurb: "Few-shot pairs so errors match the house Problem+JSON shape.", refs: [{ label: "curated · 4 pairs", type: "curated" }],
    material: `GOOD ▸ 404 { "type": "/errors/not-found", "title": "Session not found", "status": 404 }
BAD  ▸ 500 "something went wrong"

GOOD ▸ 422 { "status": 422, "errors": [{ "path": "budget", "msg": "must be <= 100000" }] }
BAD  ▸ 200 { "ok": false }`,
  },
  {
    id: "handler-code", kind: "code", title: "route handler pattern", origin: "app/api/v1/contexts/route.ts", tok: "1.6k", lang: "ts",
    blurb: "The canonical handler: validate, act, return typed JSON.", refs: [{ label: "app/api/v1/contexts/route.ts", type: "found" }],
    material: `import { ContextInput } from "@/api/schemas";
import { problem } from "@/api/problem";

export async function POST(req: Request) {
  const parsed = ContextInput.safeParse(await req.json());
  if (!parsed.success) return problem(422, "Invalid context", parsed.error);
  const ctx = await createContext(parsed.data);
  return Response.json(ctx, { status: 201 });
}`,
  },
  {
    id: "entry", kind: "entrypoints", title: "api surface", origin: "repo scan · 6 files", tok: "0.9k", lang: "text",
    blurb: "Where the API lives. The map, not the territory.", refs: [{ label: "repo scan", type: "scanned" }],
    material: `app/api/v1/sessions/route.ts
app/api/v1/packages/route.ts
app/api/v1/contexts/route.ts
src/api/auth.ts
src/api/problem.ts
src/api/schemas.ts`,
  },
  {
    id: "audit-skill", kind: "skill", title: "contract-check", origin: "skill · contract-check", tok: "1.1k", lang: "md",
    blurb: "Instructions injected when changing an endpoint. On demand.", refs: [{ label: "skill · contract-check", type: "skill" }],
    material: `# contract-check (loaded on demand)

When changing an endpoint:
- Diff the OpenAPI contract; flag breaking changes
- Ensure 4xx/5xx use Problem+JSON
- Verify the auth scope on every route
- Add or update a vitest contract test`,
  },
];
const DOC_BY_ID: Record<string, Doc> = Object.fromEntries(INGREDIENTS.map((d) => [d.id, d]));

type BlockKind = Kind | "system" | "task";
interface Block { n: string; kind: BlockKind; label: string; ref?: string; tok: string; note?: string }
const BRIEF: Block[] = [
  { n: "00", kind: "system", label: "session framing", tok: "0.3k" },
  { n: "01", kind: "instructions", label: "api conventions", ref: "agents", tok: "2.1k" },
  { n: "02", kind: "summary", label: "openapi contract", ref: "openapi", tok: "6.4k" },
  { n: "03", kind: "examples", label: "error-shape exemplars", ref: "error-icl", tok: "1.4k" },
  { n: "04", kind: "code", label: "route handler pattern", ref: "handler-code", tok: "1.6k" },
  { n: "05", kind: "skill", label: "contract-check", ref: "audit-skill", tok: "1.1k", note: "on demand" },
  { n: "06", kind: "task", label: "the task", tok: "—" },
];
const SYSTEM_MATERIAL = `You are working on the platform API in the Contextual repo.
Never break a published /v1 contract. Validate inputs at the edge; return Problem+JSON on errors.`;
const TASK_MATERIAL = `‹ the user's API change request for this session is injected here ›`;
function blockTag(k: BlockKind): string {
  if (k === "system") return "system";
  if (k === "task") return "task";
  return KIND_TAG[k];
}

type ChangeVerb = "add" | "compress" | "reorder" | "remove";
interface Change { verb: ChangeVerb; what: string; detail: string }
const CHANGESET: Change[] = [
  { verb: "add", what: "rate-limit-policy", detail: "new ingredient from docs/api/rate-limits.md" },
  { verb: "compress", what: "openapi contract", detail: "6.4k → 3.8k — keep /v1 routes + auth, drop prose" },
  { verb: "reorder", what: "conventions above framing", detail: "rules read first in the brief" },
];

// the ingredient the changeset adds
const RATE_LIMIT: Doc = {
  id: "rate-limit", kind: "summary", title: "rate-limit policy", origin: "docs/api/rate-limits.md", tok: "1.0k", lang: "md",
  blurb: "Per-token limits and the 429 contract.", refs: [{ label: "docs/api/rate-limits.md", type: "summarized" }],
  material: `# Rate limits (summary)

- 600 req/min per token (sliding window)
- Burst: 60 requests over 10s
- On breach: 429 with Retry-After (seconds)`,
};

interface IdeData { ingredients: Doc[]; brief: Block[]; docById: Record<string, Doc>; total: string }
function kNum(t: string): number {
  if (t.endsWith("k")) return parseFloat(t) * 1000;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}
function totalTok(ings: Doc[]): string {
  const sum = ings.reduce((a, d) => a + kNum(d.tok), 0);
  return `${(sum / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}
// apply the agent's changeset: compress openapi, add rate-limit, reorder conventions before framing
function computeApplied(ings: Doc[], brief: Block[]): { ingredients: Doc[]; brief: Block[] } {
  const nextIngredients: Doc[] = [];
  for (const d of ings) {
    nextIngredients.push(d.id === "openapi" ? { ...d, tok: "3.8k" } : d);
    if (d.id === "openapi") nextIngredients.push(RATE_LIMIT);
  }
  let nextBrief: Block[] = [];
  for (const b of brief) {
    nextBrief.push(b.ref === "openapi" ? { ...b, tok: "3.8k" } : b);
    if (b.ref === "openapi") nextBrief.push({ n: "", kind: "summary", label: "rate-limit policy", ref: "rate-limit", tok: "1.0k" });
  }
  const conv = nextBrief.find((b) => b.ref === "agents");
  if (conv) {
    nextBrief = nextBrief.filter((b) => b.ref !== "agents");
    const sysIdx = nextBrief.findIndex((b) => b.kind === "system");
    nextBrief.splice(Math.max(sysIdx, 0), 0, conv);
  }
  nextBrief = nextBrief.map((b, i) => ({ ...b, n: String(i).padStart(2, "0") }));
  return { ingredients: nextIngredients, brief: nextBrief };
}

// Crisper, more readable palette — overrides hangar tokens locally on the IDE
// container only (scoped, doesn't leak into the rest of the studio). Page is the
// dark base; raised surfaces step up clearly; borders + text are brighter.
const IDE_PALETTE = {
  "--hg-bg": "#0d1117",
  "--hg-bg-tint": "#161c24",
  "--hg-surface": "#1b232c",
  "--hg-surface-2": "#212b35",
  "--hg-ink": "#f2f6fa",
  "--hg-ink-2": "#c7d1db",
  "--hg-muted": "#8b97a4",
  "--hg-line": "#2c3742",
  "--hg-hairline": "#41505d",
  "--hg-accent": "#ff8636",
} as CSSProperties;

export function PackageViewPrototype() {
  return (
    <main className="px-7 pt-5 pb-10 md:px-10">
      <header className="mb-4 max-w-[820px]">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-studio-ink-faint">prototype · context ide</div>
        <h1 className="mt-2 text-[20px] font-medium leading-[1.3] text-studio-ink-strong">An IDE for context, with an agentic layer.</h1>
        <p className="mt-2 text-[13px] leading-[1.6] text-studio-ink-faint">
          Cursor for context: explorer · tabbed editor · agent. The "files" are ingredients; the
          "codebase" is the agent's worldview; the destination is the <b className="text-studio-ink">Brief</b>.
          The agent proposes a changeset you Apply or Reject. Monochrome chrome — color is reserved for
          syntax highlighting and the one accent.
        </p>
      </header>
      <ContextIDE />
    </main>
  );
}

type ChangeStatus = "pending" | "applied" | "rejected";

function ContextIDE() {
  const [ingredients, setIngredients] = useState<Doc[]>(INGREDIENTS);
  const [brief, setBrief] = useState<Block[]>(BRIEF);
  const [changeStatus, setChangeStatus] = useState<ChangeStatus>("pending");
  const [tabs, setTabs] = useState<string[]>(["overview", "brief"]);
  const [active, setActive] = useState("overview");
  const [panel, setPanel] = useState<"explorer" | "search" | "sources">("explorer");

  const docById: Record<string, Doc> = Object.fromEntries(ingredients.map((d) => [d.id, d]));
  const data: IdeData = { ingredients, brief, docById, total: totalTok(ingredients) };

  function open(id: string) {
    setTabs((t) => (t.includes(id) ? t : [...t, id]));
    setActive(id);
  }
  function close(id: string) {
    setTabs((t) => {
      const next = t.filter((x) => x !== id);
      if (active === id) setActive(next[next.length - 1] ?? "overview");
      return next.length ? next : ["overview"];
    });
  }
  function applyChangeset() {
    const r = computeApplied(ingredients, brief);
    setIngredients(r.ingredients);
    setBrief(r.brief);
    setChangeStatus("applied");
    open("brief");
  }
  function undo() {
    setIngredients(INGREDIENTS);
    setBrief(BRIEF);
    setChangeStatus("pending");
  }

  return (
    <div style={IDE_PALETTE} className="flex h-[82vh] min-h-[640px] flex-col overflow-hidden rounded-[8px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] text-[var(--hg-ink)] shadow-2xl">
      {/* title bar */}
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-[var(--hg-hairline)] bg-[var(--hg-surface-2)] px-3">
        <div className="flex gap-1.5">
          <span className="h-[11px] w-[11px] rounded-full bg-[#3a444d]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#3a444d]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#3a444d]" />
        </div>
        <div className="mx-auto flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--hg-muted)]">
          <Layers size={12} /> contextual · api.worldview
        </div>
        <span className="w-[42px]" />
      </div>

      {/* body */}
      <div className="grid min-h-0 flex-1 grid-cols-[44px_232px_minmax(0,1fr)_356px]">
        <ActivityBar panel={panel} setPanel={setPanel} onBrief={() => open("brief")} />
        <Sidebar data={data} panel={panel} active={active} onOpen={open} />
        <Editor data={data} tabs={tabs} active={active} setActive={setActive} onClose={close} onOpen={open} />
        <AgentPanel data={data} status={changeStatus} onApply={applyChangeset} onReject={() => setChangeStatus("rejected")} onUndo={undo} onOpen={open} />
      </div>

      <StatusBar data={data} />
    </div>
  );
}

function ActivityBar({ panel, setPanel, onBrief }: { panel: string; setPanel: (p: "explorer" | "search" | "sources") => void; onBrief: () => void }) {
  const items: { id: "explorer" | "search" | "sources"; icon: ReactNode; label: string }[] = [
    { id: "explorer", icon: <Boxes size={18} />, label: "explorer" },
    { id: "search", icon: <Search size={18} />, label: "search" },
    { id: "sources", icon: <FileText size={18} />, label: "sources" },
  ];
  return (
    <div className="flex flex-col items-center gap-1 border-r border-[var(--hg-hairline)] bg-[var(--hg-surface-2)] py-2">
      {items.map((it) => {
        const on = panel === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setPanel(it.id)}
            title={it.label}
            className={"relative flex h-9 w-full items-center justify-center " + (on ? "text-[var(--hg-ink)]" : "text-[var(--hg-muted)] hover:text-[var(--hg-ink-2)]")}
          >
            {on ? <span className="absolute left-0 top-2 bottom-2 w-[2px] bg-[var(--hg-accent)]" /> : null}
            {it.icon}
          </button>
        );
      })}
      <button onClick={onBrief} title="brief" className="mt-1 flex h-9 w-full items-center justify-center text-[var(--hg-muted)] hover:text-[var(--hg-ink-2)]">
        <Sparkles size={18} />
      </button>
      <div className="mt-auto">
        <button title="settings" className="flex h-9 w-9 items-center justify-center text-[var(--hg-muted)] hover:text-[var(--hg-ink-2)]"><Settings size={17} /></button>
      </div>
    </div>
  );
}

function Sidebar({ data, panel, active, onOpen }: { data: IdeData; panel: string; active: string; onOpen: (id: string) => void }) {
  const { ingredients, brief } = data;
  return (
    <aside className="flex min-h-0 flex-col overflow-auto border-r border-[var(--hg-hairline)] bg-[var(--hg-surface-2)]">
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="hg-mono text-[10px] uppercase tracking-[0.14em] text-[var(--hg-ink-2)]">{panel}</span>
        <span className="hg-mono text-[9px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">api</span>
      </div>

      {panel === "search" ? (
        <div className="px-3">
          <input placeholder="search context…" className="w-full rounded-[3px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] px-2.5 py-1.5 text-[12px] text-[var(--hg-ink)] outline-none placeholder:text-[var(--hg-muted)] focus:border-[var(--hg-accent)]" />
          <div className="mt-3 text-[11.5px] leading-[1.5] text-[var(--hg-muted)]">Find a claim across every ingredient and trace it to its source.</div>
        </div>
      ) : panel === "sources" ? (
        <Tree label="upstream sources">
          {[...new Set(ingredients.flatMap((d) => d.refs.map((r) => r.label)))].map((label) => (
            <TreeItem key={label} onClick={() => onOpen(ingredients.find((d) => d.refs.some((r) => r.label === label))?.id ?? "brief")}>
              <span className="truncate">{label}</span>
            </TreeItem>
          ))}
        </Tree>
      ) : (
        <>
          <Tree label="package">
            <TreeItem active={active === "overview"} onClick={() => onOpen("overview")}>
              <span className="truncate">overview</span>
            </TreeItem>
          </Tree>
          <Tree label="ingredients">
            {ingredients.map((d) => (
              <TreeItem key={d.id} active={active === d.id} onClick={() => onOpen(d.id)}>
                <span className="truncate">{d.title}</span>
                <span className="ml-auto hg-mono text-[9px] text-[var(--hg-muted)]">{d.tok}</span>
              </TreeItem>
            ))}
          </Tree>
          <Tree label="brief">
            <TreeItem active={active === "brief"} onClick={() => onOpen("brief")}>
              <span className="truncate">play-by-play</span>
              <span className="ml-auto hg-mono text-[9px] text-[var(--hg-muted)]">{brief.length}</span>
            </TreeItem>
          </Tree>
        </>
      )}
    </aside>
  );
}

function Tree({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1 px-2.5 py-1 text-[var(--hg-muted)]">
        <ChevronDown size={12} />
        <span className="hg-mono text-[9.5px] uppercase tracking-[0.12em]">{label}</span>
      </div>
      <div className="pb-1">{children}</div>
    </div>
  );
}
function TreeItem({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={"flex w-full items-center gap-2 border-l-2 py-1.5 pl-5 pr-3 text-left text-[11.5px] " + (active ? "border-[var(--hg-accent)] bg-[rgba(255,123,44,0.06)] text-[var(--hg-ink)]" : "border-transparent text-[var(--hg-ink-2)] hover:bg-[var(--hg-bg-tint)]")}>
      {children}
    </button>
  );
}

function Editor({ data, tabs, active, setActive, onClose, onOpen }: { data: IdeData; tabs: string[]; active: string; setActive: (id: string) => void; onClose: (id: string) => void; onOpen: (id: string) => void }) {
  const title = (id: string) => (id === "overview" ? "Overview" : id === "brief" ? "Brief" : data.docById[id]?.title ?? id);
  return (
    <section className="flex min-h-0 min-w-0 flex-col border-r border-[var(--hg-hairline)]">
      {/* tab bar */}
      <div className="flex h-9 shrink-0 items-stretch overflow-auto border-b border-[var(--hg-hairline)] bg-[var(--hg-surface-2)]">
        {tabs.map((id) => {
          const on = id === active;
          return (
            <div key={id} className={"group flex items-center gap-2 border-r border-t-2 border-r-[var(--hg-line)] px-3 " + (on ? "border-t-[var(--hg-accent)] bg-[var(--hg-bg)]" : "border-t-transparent")}>
              <button onClick={() => setActive(id)} className={"hg-mono text-[10.5px] uppercase tracking-[0.04em] " + (on ? "text-[var(--hg-ink)]" : "text-[var(--hg-muted)]")}>{title(id)}</button>
              <button onClick={() => onClose(id)} className="text-[var(--hg-muted)] opacity-0 hover:text-[var(--hg-ink)] group-hover:opacity-100"><X size={12} /></button>
            </div>
          );
        })}
      </div>

      {/* breadcrumb */}
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-[var(--hg-line)] px-5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">
        api.worldview
        {active === "overview" ? null : (<><span>/</span> {active === "brief" ? "brief" : "ingredients"} <span>/</span> <span className="text-[var(--hg-ink-2)]">{title(active)}</span></>)}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {active === "overview" ? <OverviewDoc data={data} onOpen={onOpen} /> : active === "brief" ? <BriefDoc data={data} onOpen={onOpen} /> : <IngredientDoc doc={data.docById[active]} />}
      </div>
    </section>
  );
}

function IngredientDoc({ doc }: { doc?: Doc }) {
  if (!doc) return null;
  return (
    <div className="px-7 pb-10 pt-5">
      <div className="flex items-baseline gap-3">
        <div className="hg-mono text-[20px] font-medium uppercase leading-none tracking-[0.03em]">{doc.title}</div>
        <span className="hg-mono text-[10px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">{KIND_TAG[doc.kind]}</span>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10.5px] text-[var(--hg-muted)]">
        <span>from <b className="font-medium text-[var(--hg-ink-2)]">{doc.origin}</b></span>
        <span><b className="font-medium text-[var(--hg-ink-2)]">{doc.tok}</b> tok</span>
      </div>
      <p className="mt-2.5 max-w-[64ch] text-[12.5px] leading-[1.55] text-[var(--hg-ink-2)]">{doc.blurb}</p>

      <div className="mt-5 hg-section-label pb-2.5">what the agent sees</div>
      <CodePane lang={doc.lang} text={doc.material} />

      <div className="mt-6 border-t border-[var(--hg-line)] pt-4">
        <div className="hg-section-label pb-2.5">references · {doc.refs.length}</div>
        <div className="rounded-[4px] border border-[var(--hg-hairline)]">
          {doc.refs.map((r) => (
            <div key={r.label} className="group flex items-baseline gap-3 border-b border-[var(--hg-line)] px-3.5 py-2.5 last:border-b-0">
              <span className="hg-mono w-[88px] shrink-0 text-[9.5px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">{r.type}</span>
              <span className="hg-mono min-w-0 flex-1 truncate text-[11.5px] text-[var(--hg-ink-2)]">{r.label}</span>
              <span className="hg-mono shrink-0 text-[9.5px] uppercase tracking-[0.08em] text-[var(--hg-muted)] opacity-0 group-hover:opacity-100">open ↗</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OverviewDoc({ data, onOpen }: { data: IdeData; onOpen: (id: string) => void }) {
  const pct = Math.min(100, Math.round((kNum(data.total) / 100000) * 100));
  const beforeSum = data.brief.filter((b) => b.kind !== "task").reduce((a, b) => a + kNum(b.tok), 0);
  const before = `${(beforeSum / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  const sequence = data.brief.map((b) => b.label).join(" → ");
  return (
    <div className="max-w-[760px] px-7 pb-12 pt-6">
      <div className="hg-mono text-[26px] font-medium uppercase leading-none tracking-[0.03em]">api</div>
      <div className="mt-2 hg-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">worldview · v0.4 · updated yesterday</div>
      <p className="mt-3 max-w-[64ch] text-[13.5px] leading-[1.6] text-[var(--hg-ink-2)]">
        What an agent should know before touching the platform API — conventions, the contract, the
        error model, auth, and where the routes live. Six ingredients, assembled into a brief.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="hg-pill">#platform</span>
        <span className="hg-pill">#v1</span>
        <span className="hg-pill border-dashed text-[var(--hg-muted)]">+ tag</span>
      </div>

      <OvSection label="budget">
        <div className="flex items-center gap-3 font-mono text-[11.5px] text-[var(--hg-ink-2)]">
          <span className="h-1.5 w-[180px] overflow-hidden rounded-[2px] bg-[var(--hg-line)]"><i className="block h-full bg-[var(--hg-accent)]" style={{ width: `${pct}%` }} /></span>
          <span><b className="text-[var(--hg-ink)]">{data.total}</b> / 100k tokens · <span className="text-[var(--hg-muted)]">~{before} in the brief before the task</span></span>
        </div>
      </OvSection>

      <OvSection label={`composition · ${data.ingredients.length} ingredients`}>
        <div className="rounded-[4px] border border-[var(--hg-hairline)]">
          {data.ingredients.map((d) => (
            <button key={d.id} onClick={() => onOpen(d.id)} className="flex w-full items-baseline gap-3 border-b border-[var(--hg-line)] px-3.5 py-2.5 text-left last:border-b-0 hover:bg-[var(--hg-bg-tint)]">
              <span className="hg-mono w-[96px] shrink-0 text-[9.5px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">{KIND_TAG[d.kind]}</span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--hg-ink)]">{d.title}</span>
              <span className="hg-mono shrink-0 text-[10px] text-[var(--hg-muted)]">{d.tok}</span>
            </button>
          ))}
        </div>
      </OvSection>

      <OvSection label="health">
        <div className="flex items-center gap-2 text-[12.5px] text-[var(--hg-ink-2)]">
          <span className="text-[#e0a23c]">⚠</span>
          1 source needs refresh — <span className="hg-mono text-[11.5px]">auth.md</span> in
          <button onClick={() => onOpen("openapi")} className="text-[var(--hg-ink)] hover:text-[var(--hg-accent)]">openapi contract</button>
        </div>
      </OvSection>

      <OvSection label="brief">
        <div className="text-[12.5px] leading-[1.6] text-[var(--hg-ink-2)]">
          <b className="text-[var(--hg-ink)]">{data.brief.length} blocks</b>, assembled in order.
          <div className="mt-1.5 hg-mono text-[10.5px] uppercase tracking-[0.06em] text-[var(--hg-muted)]">{sequence}</div>
        </div>
        <button onClick={() => onOpen("brief")} className="hg-mono mt-3 inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--hg-hairline)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--hg-ink-2)] hover:border-[var(--hg-accent)] hover:text-[var(--hg-accent)]">Open the brief <ArrowRight size={11} /></button>
      </OvSection>

      <OvSection label="history">
        <div className="hg-mono text-[10.5px] leading-[1.9] text-[var(--hg-muted)]">
          <div><b className="text-[var(--hg-ink-2)]">v0.4</b> · today · add route handler pattern</div>
          <div><b className="text-[var(--hg-ink-2)]">v0.3</b> · 3d · summarize openapi contract</div>
          <div><b className="text-[var(--hg-ink-2)]">v0.2</b> · 1w · add error exemplars</div>
          <div><b className="text-[var(--hg-ink-2)]">v0.1</b> · 2w · initial from AGENTS.md</div>
        </div>
      </OvSection>
    </div>
  );
}

function OvSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <div className="hg-section-label border-t border-[var(--hg-line)] pb-2.5 pt-4">{label}</div>
      {children}
    </div>
  );
}

function BriefDoc({ data, onOpen }: { data: IdeData; onOpen: (id: string) => void }) {
  function material(b: Block): { lang: Lang; text: string } {
    if (b.kind === "system") return { lang: "text", text: SYSTEM_MATERIAL };
    if (b.kind === "task") return { lang: "text", text: TASK_MATERIAL };
    const d = b.ref ? data.docById[b.ref] : undefined;
    return d ? { lang: d.lang, text: d.material } : { lang: "text", text: "" };
  }
  return (
    <div className="px-7 pb-10 pt-5">
      <div className="flex items-baseline gap-3 pb-1">
        <span className="hg-mono text-[20px] font-medium uppercase leading-none tracking-[0.03em]">the brief</span>
        <span className="hg-mono text-[10px] text-[var(--hg-muted)]">{data.brief.length} blocks · assembly order</span>
      </div>
      <p className="mb-5 max-w-[66ch] text-[12px] leading-[1.55] text-[var(--hg-muted)]">
        Everything the agent is told, in sequence. Click a referenced ingredient to open it. Token/density
        analysis is a separate downstream tool.
      </p>

      <div className="flex flex-col gap-2.5">
        {data.brief.map((b) => {
          const m = material(b);
          const isTask = b.kind === "task";
          return (
            <div key={b.n} className="overflow-hidden rounded-[4px] border border-[var(--hg-hairline)]">
              <div className="flex items-center gap-2.5 bg-[var(--hg-surface-2)] px-3 py-2">
                <span className="hg-mono text-[10px] text-[var(--hg-muted)]">{b.n}</span>
                <span className={"hg-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] " + (isTask ? "text-[var(--hg-accent)]" : "text-[var(--hg-muted)]")}>{blockTag(b.kind)}</span>
                <span className="hg-mono text-[11px] uppercase tracking-[0.02em] text-[var(--hg-ink)]">{b.label}</span>
                {b.note ? <span className="hg-mono text-[9px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">{b.note}</span> : null}
                {b.ref ? <button onClick={() => onOpen(b.ref!)} className="hg-mono text-[9px] uppercase tracking-[0.08em] text-[var(--hg-muted)] hover:text-[var(--hg-accent)]">open ↗</button> : null}
                <span className="ml-auto hg-mono text-[10px] text-[var(--hg-muted)]">{b.tok}</span>
              </div>
              <CodePane lang={m.lang} text={m.text} flush />
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-[var(--hg-line)] pt-4">
        <span className="hg-mono text-[11px] text-[var(--hg-ink-2)]">assembled · <b className="text-[var(--hg-ink)]">~{`${(data.brief.filter((b) => b.kind !== "task").reduce((a, b) => a + kNum(b.tok), 0) / 1000).toFixed(1).replace(/\.0$/, "")}k`} tok</b> before the task</span>
        <button className="hg-mono ml-auto inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--hg-hairline)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--hg-ink-2)] hover:border-[var(--hg-accent)] hover:text-[var(--hg-accent)]">Copy brief</button>
        <button className="hg-mono inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--hg-hairline)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--hg-muted)] hover:border-[var(--hg-accent)] hover:text-[var(--hg-accent)]">Open density tool <ArrowRight size={11} /></button>
      </div>
    </div>
  );
}

/* ---------------- editor pane with lightweight syntax highlighting ---------------- */
const SYNTAX = { prop: "#7cc7ff", value: "#ffb27a", punct: "var(--hg-muted)" };

function hiCss(line: string): ReactNode {
  if (/^\s*(\/\*|\*|\*\/)/.test(line)) return <span className="text-[var(--hg-muted)]">{line}</span>;
  const m = line.match(/^(\s*)([a-zA-Z-]+)(\s*:\s*)(.+?)(;?)\s*$/);
  if (m) {
    const [, indent, prop, colon, value, semi] = m;
    const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
    return (
      <>
        {indent}
        <span style={{ color: SYNTAX.prop }}>{prop}</span>
        <span style={{ color: SYNTAX.punct }}>{colon}</span>
        {isHex ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[9px] w-[9px] rounded-[2px] align-middle" style={{ background: value }} />
            <span style={{ color: value }}>{value}</span>
          </span>
        ) : (
          <span style={{ color: SYNTAX.value }}>{value}</span>
        )}
        <span style={{ color: SYNTAX.punct }}>{semi}</span>
      </>
    );
  }
  if (/[{}]/.test(line)) {
    return line.split(/([{}])/).map((part, i) => (/[{}]/.test(part) ? <span key={i} style={{ color: SYNTAX.punct }}>{part}</span> : <span key={i} className="text-[var(--hg-ink)]">{part}</span>));
  }
  return <span className="text-[var(--hg-ink-2)]">{line || " "}</span>;
}

function bold(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (/^\*\*[^*]+\*\*$/.test(p) ? <span key={i} className="font-semibold text-[var(--hg-ink)]">{p.slice(2, -2)}</span> : <span key={i}>{p}</span>));
}
function hiMd(line: string): ReactNode {
  const h = line.match(/^(#{1,6})(\s+)(.*)$/);
  if (h) return (<><span className="text-[var(--hg-muted)]">{h[1]}</span>{h[2]}<span className="font-semibold text-[var(--hg-ink)]">{h[3]}</span></>);
  const li = line.match(/^(\s*[-*▸]\s+)(.*)$/);
  if (li) return (<><span className="text-[var(--hg-muted)]">{li[1]}</span><span className="text-[var(--hg-ink-2)]">{bold(li[2])}</span></>);
  return <span className="text-[var(--hg-ink-2)]">{bold(line) || " "}</span>;
}
const TS_KW = /^(const|let|var|export|default|async|function|return|await|import|from|new|type|interface|class|extends|implements|if|else|for|of|in|try|catch|finally|throw|typeof|as|void|null|true|false|number|string|boolean|Promise|Request|Response)\b/;
function hiTs(line: string): ReactNode {
  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const push = (text: string, color?: string) => out.push(color ? <span key={key++} style={{ color }}>{text}</span> : <span key={key++}>{text}</span>);
  while (i < line.length) {
    const rest = line.slice(i);
    if (rest.startsWith("//")) { push(rest, "var(--hg-muted)"); break; }
    const str = rest.match(/^(['"`])(?:\\.|(?!\1).)*\1/);
    if (str) { push(str[0], "#9fe88a"); i += str[0].length; continue; }
    const prevIdent = i > 0 && /[A-Za-z0-9_$]/.test(line[i - 1]);
    const kw = !prevIdent ? rest.match(TS_KW) : null;
    if (kw) { push(kw[0], "#c0a6ff"); i += kw[0].length; continue; }
    const num = rest.match(/^\d+(?:\.\d+)?/);
    if (num) { push(num[0], "#ffb27a"); i += num[0].length; continue; }
    const word = rest.match(/^[A-Za-z0-9_$]+/);
    if (word) { push(word[0]); i += word[0].length; continue; }
    push(line[i]);
    i += 1;
  }
  return <span className="text-[var(--hg-ink-2)]">{out.length ? out : line || " "}</span>;
}
function highlight(lang: Lang, line: string): ReactNode {
  if (lang === "code") return hiCss(line);
  if (lang === "ts") return hiTs(line);
  if (lang === "md") return hiMd(line);
  return <span className="text-[var(--hg-ink-2)]">{line || " "}</span>;
}

function CodePane({ lang, text, flush = false }: { lang: Lang; text: string; flush?: boolean }) {
  const lines = text.split("\n");
  return (
    <div className={flush ? "bg-[var(--hg-surface-2)]" : "overflow-hidden rounded-[4px] border border-[var(--hg-hairline)] bg-[var(--hg-surface-2)]"}>
      {!flush ? (
        <div className="flex items-center justify-between border-b border-[var(--hg-line)] px-3 py-1.5">
          <span className="hg-mono text-[9px] uppercase tracking-[0.12em] text-[var(--hg-muted)]">{lang === "ts" ? "typescript" : lang === "code" ? "css" : lang === "md" ? "markdown" : "text"}</span>
          <span className="hg-mono text-[9px] uppercase tracking-[0.1em] text-[var(--hg-muted)]">{lines.length} lines</span>
        </div>
      ) : null}
      <div className="overflow-auto py-2 font-mono text-[11.5px] leading-[1.7]">
        {lines.map((ln, i) => (
          <div key={i} className="flex px-3">
            <span className="w-7 shrink-0 select-none pr-3 text-right text-[var(--hg-muted)]/50">{i + 1}</span>
            <span className="flex-1 whitespace-pre-wrap">{highlight(lang, ln)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentPanel({ data, status, onApply, onReject, onUndo, onOpen }: { data: IdeData; status: ChangeStatus; onApply: () => void; onReject: () => void; onUndo: () => void; onOpen: (id: string) => void }) {
  const [mode, setMode] = useState<"agent" | "ask">("agent");
  return (
    <aside className="flex min-h-0 min-w-0 flex-col bg-[var(--hg-surface-2)]">
      <div className="flex items-center gap-2 border-b border-[var(--hg-line)] px-3 py-2.5">
        <Sparkles size={13} className="text-[var(--hg-accent)]" />
        <span className="hg-mono text-[10px] uppercase tracking-[0.14em] text-[var(--hg-ink-2)]">agent</span>
        <div className="ml-auto flex rounded-[3px] border border-[var(--hg-hairline)] p-0.5">
          {(["agent", "ask"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={"hg-mono rounded-[2px] px-2 py-0.5 text-[9px] uppercase tracking-[0.08em] " + (mode === m ? "bg-[var(--hg-accent)] text-[#0a0d10] font-semibold" : "text-[var(--hg-muted)] hover:text-[var(--hg-ink-2)]")}>{m}</button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 py-4">
        <div className="hg-mono text-[9.5px] uppercase tracking-[0.12em] text-[var(--hg-muted)]">worldview · {data.ingredients.length} ingredients · {data.total} tok</div>
        <Bubble who="you">Add our rate-limit policy from the API docs, and tighten this for an endpoint-change session.</Bubble>
        <Bubble who="agent">Here's a changeset — I'll pull a new ingredient, compress the contract, and put conventions ahead of the framing in the brief. Review before I apply:</Bubble>

        <div className="overflow-hidden rounded-[4px] border border-[var(--hg-hairline)]">
          {CHANGESET.map((c) => (
            <div key={c.what} className={"border-b border-[var(--hg-line)] px-3 py-2 last:border-b-0 " + (status === "rejected" ? "opacity-40" : "")}>
              <div className="flex items-baseline gap-2">
                <span className="hg-mono text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--hg-ink)]">{c.verb}</span>
                <span className="hg-mono text-[11px] uppercase tracking-[0.02em] text-[var(--hg-ink-2)]">{c.what}</span>
                {status === "applied" ? <Check size={11} className="ml-auto text-[var(--hg-ok)]" /> : null}
              </div>
              <div className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--hg-muted)]">{c.detail}</div>
            </div>
          ))}
        </div>

        {status === "pending" ? (
          <>
            <div className="flex items-center gap-2">
              <button onClick={onApply} className="hg-mono inline-flex items-center gap-2 rounded-[2px] bg-[var(--hg-accent)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#0a0d10] hover:bg-[var(--hg-accent-deep)]"><Check size={12} /> Apply all</button>
              <button onClick={() => onOpen("brief")} className="hg-mono inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--hg-hairline)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--hg-ink-2)] hover:border-[var(--hg-accent)] hover:text-[var(--hg-accent)]">Preview in brief</button>
              <button onClick={onReject} className="hg-mono inline-flex items-center gap-1.5 rounded-[2px] px-2 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--hg-muted)] hover:text-[var(--hg-ink-2)]"><RotateCcw size={11} /> Reject</button>
            </div>
            <div className="hg-mono text-[9px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">nothing saved without your ok</div>
          </>
        ) : status === "applied" ? (
          <div className="flex items-center gap-2">
            <span className="hg-mono inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--hg-ok)]"><Check size={12} /> applied · worldview now {data.total}</span>
            <button onClick={onUndo} className="hg-mono ml-auto inline-flex items-center gap-1.5 rounded-[2px] border border-[var(--hg-hairline)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--hg-ink-2)] hover:border-[var(--hg-accent)] hover:text-[var(--hg-accent)]"><RotateCcw size={11} /> Undo</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="hg-mono text-[9px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">changeset rejected</span>
            <button onClick={onUndo} className="hg-mono ml-auto rounded-[2px] border border-[var(--hg-hairline)] px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--hg-ink-2)] hover:border-[var(--hg-accent)] hover:text-[var(--hg-accent)]">Re-propose</button>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--hg-line)] p-3">
        <div className="rounded-[5px] border border-[var(--hg-hairline)] bg-[var(--hg-bg)] px-3 py-2 focus-within:border-[var(--hg-accent)]">
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="hg-mono rounded-[2px] border border-[var(--hg-hairline)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.06em] text-[var(--hg-muted)]">@ openapi</span>
          </div>
          <div className="flex items-end gap-2">
            <textarea rows={1} placeholder={mode === "agent" ? "Tell the agent what to construct…" : "Ask about this worldview…"} className="min-h-[20px] flex-1 resize-none bg-transparent text-[12.5px] leading-[1.5] text-[var(--hg-ink)] outline-none placeholder:text-[var(--hg-muted)]" />
            <button className="flex h-7 w-7 items-center justify-center rounded-[3px] bg-[var(--hg-accent)] text-[#0a0d10] hover:bg-[var(--hg-accent-deep)]"><ArrowUp size={14} /></button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 px-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--hg-muted)]"><CornerDownLeft size={10} /> {mode} · @ to reference an ingredient</div>
      </div>
    </aside>
  );
}

function Bubble({ who, children }: { who: "agent" | "you"; children: ReactNode }) {
  if (who === "you") return <div className="ml-5 rounded-[4px] border border-[var(--hg-hairline)] bg-[var(--hg-bg-tint)] px-3 py-2 text-[12.5px] leading-[1.5] text-[var(--hg-ink)]">{children}</div>;
  return <div className="border-l-2 border-[var(--hg-accent)] pl-3 text-[12.5px] leading-[1.55] text-[var(--hg-ink-2)]">{children}</div>;
}

function StatusBar({ data }: { data: IdeData }) {
  const pct = Math.min(100, Math.round((kNum(data.total) / 100000) * 100));
  return (
    <div className="flex h-6 shrink-0 items-center gap-4 border-t border-[var(--hg-hairline)] bg-[var(--hg-surface-2)] px-3 font-mono text-[9.5px] uppercase tracking-[0.08em] text-[var(--hg-muted)]">
      <span className="flex items-center gap-1.5"><GitBranch size={11} /> worldview · v0.4</span>
      <span>{data.ingredients.length} ingredients</span>
      <span className="flex items-center gap-1.5">
        budget
        <span className="h-1 w-[64px] overflow-hidden rounded-[2px] bg-[var(--hg-line)]"><i className="block h-full bg-[var(--hg-accent)]" style={{ width: `${pct}%` }} /></span>
        {data.total} / 100k
      </span>
      <span className="ml-auto text-[var(--hg-ink-2)]">brief ready</span>
      <span className="cursor-pointer hover:text-[var(--hg-accent)]">density tool →</span>
    </div>
  );
}
