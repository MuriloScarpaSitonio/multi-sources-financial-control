---
name: cmux-handoff
description: Low-level cmux transport helper for inspecting, creating, reading, and sending to cmux surfaces safely. Use when another skill or the user needs raw cmux terminal operations, explicit surface targeting, or safe message submission mechanics. This skill does not decide which agent should be contacted.
---

# Cmux Handoff

## Overview

Use this skill as the transport layer for cmux terminal surfaces. It is intentionally low-level: it helps list surfaces, create tabs or panes, read terminal screens, and send text without accidentally submitting to the wrong prompt.

Agent workflow policy belongs in a higher-level skill. For the peer-agent review/fix flow, use `peer`, which calls this skill's script.

## Transport Script

Prefer the bundled wrapper over raw `cmux` commands:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh list
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh read --surface surface:18 --lines 60
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh send --surface surface:18 --message "Read docs/foo.md."
```

The script reads the target screen before sending and only presses Enter when `--submit` is present.

Derive a paired title without creating anything:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh pair-title --agent codex --source-title "canada"
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh pair-title --agent codex --source-title "[claude] canada"
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh pair-title --agent codex --source-title "[codex] canada" --same-agent-peer
```

Both examples output:

```text
[codex] canada
```

The same-agent peer example outputs:

```text
[codex peer] canada
```

Reuse or create an exact paired counterpart surface:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --tab "canada" --direction right
```

`counterpart` strips a leading `[claude]`, `[codex]`, `[claude peer]`, or `[codex peer]` from the source title, prefixes the requested agent, reuses only an exact title match, and creates a side pane if there is no exact match. The default side is `right`; pass `--direction left|right|up|down` to choose another side. For explicit same-agent peers, pass `--same-agent-peer` so the target title is `[codex peer] <base>` or `[claude peer] <base>` and cannot collide with the source tab.

If you intentionally want to place the counterpart as a tab inside an existing pane, pass `--pane <pane>`; otherwise omit `--pane` so the helper creates a side pane.

Get source metadata for a peer prompt:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh source-info --agent codex
```

This prints the caller `source_surface`, the visible `source_title`, the stripped pairing base, and the exact counterpart title. Use `source_surface` when the counterpart needs to notify the original tab; do not notify by title when paired titles may overlap.

Generate a deterministic review artifact path:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh review-path --agent codex
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh review-path --agent codex --context docs/history/features/canadian-addresses-cad-pricing/plan.md
```

When `--context` points under `docs/history/features/`, the review is colocated in that feature folder:

```text
docs/history/features/canadian-addresses-cad-pricing/peer-review-20260426-153000-codex.md
```

Without an obvious feature-doc context, it falls back to:

```text
.claude/peer/reviews/20260426-153000-codex-canada-review.md
```

## Commands

List surfaces in the current workspace:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh list
```

Read a target by surface ID or title:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh read --surface surface:18 --lines 80
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh read --title "canada" --lines 80
```

Send text without submitting:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh send --surface surface:18 --message "Review docs/path/file.md."
```

Send and submit:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh send --surface surface:18 --message "Review docs/path/file.md." --submit
```

For long or multi-line messages, prefer a message file so the command remains simple and reusable by approval-prefix matching:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh send --surface surface:18 --message-file .claude/peer/callbacks/review-done.txt --submit
```

Create a generic tab or pane with an optional command:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh new-tab --pane pane:1 --name "scratch" --start "bash"
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh new-pane --pane pane:1 --direction right --name "scratch" --start "bash"
```

Start a new agent in a specific repository directory:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --tab "supplybuy" --cwd /Users/murilo/filterbuy/github/supplybuy
```

Convenience aliases exist for starting common agent CLIs:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh new-codex --pane pane:1 --name "codex handoff"
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh new-claude --pane pane:1 --name "claude handoff"
```

These aliases only create terminals and start the named CLI. They do not decide whether Codex or Claude is the correct target for a task.
For correlated Claude/Codex tabs, prefer `counterpart --agent <claude|codex>` over these generic aliases.

## Safety Rules

- Prefer explicit `surface:<n>` IDs. Pane IDs are not enough when a pane has multiple surfaces.
- In cmux terminology, a tab is a `surface`; a split area is a `pane`.
- Read the screen before sending. Check the title, prompt, current task, and whether it is waiting for input.
- Do not include `--submit` unless the text is meant to be submitted immediately.
- If a title matches multiple surfaces, stop and ask for a surface ID or use a more specific title.
- If sending long content, send a concise pointer to the file path instead of pasting the whole file.
- If `cmux` fails with `Operation not permitted` for the socket, rerun the same cmux command with tool escalation. Keep the helper command simple, especially by using `--message-file` for long callbacks, so stable approval prefixes can match future sends.
