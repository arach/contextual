# Context Planner Agent

Status: active
Truth: manual
Last reviewed: 2026-06-01

## Job

The context planner agent turns a user objective plus local resources into a
compact context draft.

It does not launch the model directly. It proposes:

- resources to keep, compress, refresh, or drop
- context parts with source ids and truth labels
- briefing, working-set, and deep-pack profiles
- test-drive checks and scenario prompts
- a session draft that the main app can instantiate

## Resource Actions

| Action | Meaning |
| --- | --- |
| Keep | Load close to source truth because it is compact and relevant |
| Compress | Summarize down to decisions, claims, and pointers |
| Refresh | Keep as a visible warning until the source is current |
| Drop | Do not load; preserve only the source gap |

## Test Drive

Every context should be dry-run before session creation.

The minimum dry run asks:

1. Can the context explain its objective and scope?
2. Does it name the sources it used?
3. Does it admit stale, missing, or manual evidence?
4. Does it avoid hidden memory or native fork claims without proof?
