---
description: Run peer-agent cmux modes
argument-hint: [review|fix|status|new] [claude|codex]
---

# Peer

Use the `peer` skill. Treat `$ARGUMENTS` as a command-shaped mode, not as a free-form message to forward.

## Parse Arguments

Supported forms:

```text
/peer review
/peer review <md_file>
/peer review codex
/peer review claude <md_file>
/peer review tab=<source-tab>
/peer fix
/peer fix <context>
/peer fix codex <context>
/peer fix <context> tab=<source-tab>
/peer status
/peer new
```

If `$ARGUMENTS` is empty, default to `review`.

## Behavior

1. Read `.claude/skills/peer/SKILL.md`.
2. Parse the first word of `$ARGUMENTS` as the mode.
3. Parse an optional explicit target:
   - If the first non-mode argument is `claude` or `codex`, use it as the peer target and remove it from the remaining arguments.
   - Otherwise default to the opposite agent: Claude targets Codex, Codex targets Claude.
   - If the explicit target is the current agent type, pass `--same-agent-peer` to the cmux helper.
4. Use `.claude/skills/cmux-handoff/scripts/cmux-handoff.sh` for cmux transport.
5. Do not ask the user to write a handoff message.
6. For `review`, run the two-phase review loop: the peer writes a review Markdown file, then prompts the requester with a callback message it composes after seeing the findings.
7. Never accept a peer/requester summary, "applied" report, or reported validation as proof. Re-open the actual files/diff and verify claimed fixes from code before saying the review is resolved.

## Paired Tab Resolution

Use deterministic peer titles:

- From Claude with no explicit target, target `[codex] <base>`.
- From Codex with no explicit target, target `[claude] <base>`.
- With an explicit opposite-agent target, target `[claude] <base>` or `[codex] <base>`.
- With an explicit same-agent target, target `[claude peer] <base>` or `[codex peer] <base>`.
- `<base>` is the current source tab title with one leading `[claude]`, `[codex]`, `[claude peer]`, or `[codex peer]` prefix stripped.
- If the user passes `tab=<source-tab>`, use that value as the source title instead of the current tab title.

Examples:

```text
current Claude tab: canada         -> [codex] canada
current Claude tab: [claude] canada -> [codex] canada
current Codex tab: canada          -> [claude] canada
current Codex tab: [codex] canada  -> [claude] canada
current Codex tab with explicit codex target: canada -> [codex peer] canada
```

Use the helper's exact-match operation instead of fuzzy title search:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --tab "canada" --direction right
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --same-agent-peer --tab "canada" --direction right
```

The helper reuses only an exact paired title. If there is no exact match, it creates the peer surface in a side pane. If duplicates exist, stop and ask the user to close or rename one.

For notification back to the requester, use the caller source surface from:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh source-info --agent codex
```

Do not notify by title when the paired title contains the source title.

## Mode Mapping

### `review`

If no path is provided, ask the peer to review the current working tree or branch. Before sending, gather:

```bash
git branch --show-current
git status --short
git diff --stat
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh source-info --agent <peer-agent> [--same-agent-peer]
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh review-path --agent <peer-agent>
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh review-path --agent <peer-agent> --context <md_file>
```

Use `--context <md_file>` when the review has an obvious Markdown target under `docs/history/features/`; this colocates the review beside the feature docs. Otherwise use the fallback path from `review-path`.

Send a static code-review task. The peer must treat summaries, reported fixes, and reported validation as leads only; it must inspect the actual code/diff and cite file/line evidence. The peer must not edit code and must not run tests or verification commands unless the user explicitly requested runtime verification. It must write the review to the generated Markdown file, then notify the requester surface with a prompt it composes after seeing the findings.

### `review <md_file>`

Validate that `<md_file>` exists. Generate the review path with `review-path --context <md_file>` when the file is under `docs/history/features/`. Ask the peer to review that Markdown file against the actual current codebase. The peer must treat summaries, reported fixes, and reported validation as leads only, inspect the actual code/diff, cite file paths and line numbers for factual claims, must not edit code, and must not run tests or verification commands unless the user explicitly requested runtime verification. It must write the review to the generated Markdown file, then notify the requester surface with a prompt it composes after seeing the findings.

### Review Completion Prompt

The peer controls the completion prompt. The requester must not prewrite exact callback text to itself through the peer.

The completion prompt should include:

- The review file path.
- A concise reviewer-authored summary of the outcome.
- Next-step guidance based on the actual findings.
- A reminder that the review is advisory input and the requester should apply judgment.
- If fixes are recommended, ask the requester to fix only findings it judges valid and skip or rebut findings it judges invalid, risky, or out of scope.
- A reminder not to revert unrelated changes.

```text
Peer review is complete. Review file: <review_file>.

<Reviewer-authored summary and next step guidance based on the findings.>
```

The prompt may be longer if needed.

### `fix`

Ask the peer to implement the current requested fix. Include current branch and `git status --short`. Tell the peer that multiple agents may share the worktree and it must not revert unrelated changes.

### `fix <context>`

Ask the peer to implement the current requested fix using `<context>` as the primary thing to inspect first. `<context>` is usually a Markdown review, plan, handoff, bug report, or failing-test name. Do not imply that `<context>` is necessarily the code file to edit.

### `status`

Read the peer surface and summarize its state. Do not send a new task.

### `new`

Create the peer surface only. Do not send a task.

## Invalid Modes

If the mode is not one of `review`, `fix`, `status`, or `new`, explain the supported forms in one short response.
