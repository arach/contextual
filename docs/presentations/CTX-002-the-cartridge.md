# CTX-002: The Context Package

Status: active
Owner: Contextual
Last updated: 2026-05-31

## Thesis

A context package is the durable object produced by context planning.

It is not a transcript dump. It is not a magic memory snapshot. It is a versioned, source-backed set of intent, sources, parts, and profiles that a developer can inspect and an agent can compile.

## What A Context Package Contains

| Field | Job |
| --- | --- |
| Intent | What future session this prepares |
| Objectives | Concrete outcomes the session should support |
| Scope | Repo, directory, branch, or global boundary |
| Sources | Native logs, docs, code, sidecars, manual notes |
| Parts | Ordered context material to compile |
| Profiles | Briefing, working set, deep pack |
| Freshness | When the package becomes stale |
| Evals | Tests for truth and launch claims |
| History | Versions, authors, and notes |
| Plans | Launch and fork previews derived from the package |

## Truth Labels

Every source and part has an explicit truth label.

| Label | Meaning |
| --- | --- |
| Logged | Directly backed by files, logs, docs, or sidecars |
| Reconstructed | Derived from logged evidence but not directly present |
| Inferred | Agent or developer inference |
| Manual | Human-authored note without machine-verifiable source |

Truth labels drive health, warnings, and fork lineage. They are part of the product contract.

## Profiles

One package can produce multiple context loads.

| Profile | Use |
| --- | --- |
| Briefing | Minimal fresh-session context |
| Working Set | Default build, design, or review context |
| Deep Pack | Larger audit or implementation context |

Profiles prevent a package from becoming one giant context blob. They also let a target agent ask for the smallest useful load.

## Storage Direction

Prototype data can live in TypeScript while the schema settles. Durable storage should move to an append-friendly local store:

```txt
~/.contextual/
  packages/
    <package-id>/
      manifest.json
      versions/
      health/
      plans/
```

Versions should be immutable. Health and plan records should be derived and recomputable.

## Acceptance Shape

The seed `agent-harness-context` package should prove the object:

- source map renders before parts
- every required part has provenance
- every profile compiles to known parts and token totals
- health emits one recommendation
- launch and fork previews preserve lineage labels
