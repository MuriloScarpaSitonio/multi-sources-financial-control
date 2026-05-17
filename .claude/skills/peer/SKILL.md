---
name: peer
description: Coordinate the peer-agent cmux workflow used in this repo. Use when the user asks to ask the other agent, start a peer Claude or Codex session in cmux, relay a handoff, run a critique/review loop between agents, or continue peer collaboration. Defaults to the opposite agent and supports explicit claude/codex target overrides. This skill uses cmux-handoff as the low-level transport.
allowed-tools: Bash
argument-hint: [review|fix|status|new]
---

# Peer

## Overview

Use this skill for command-shaped peer-agent collaboration. The user should be able to invoke a small mode such as `review`, `review <file>`, `review codex <file>`, or `fix`; the current agent translates that mode into a peer task and sends it through cmux.

`review` is a two-phase loop: the peer writes a Markdown review artifact, then prompts the original requesting tab with its own callback message. The requester evaluates the review as advisory input and fixes selectively.

This is not a generic cmux automation skill and it is not a free-form "write a message to the other agent" workflow.

Use `.claude/skills/cmux-handoff/scripts/cmux-handoff.sh` for all terminal operations.

## User Interface

The primary invocation is the slash command:

```text
/peer review
/peer review docs/history/features/example/plan.md
/peer review codex
/peer review claude docs/history/features/example/plan.md
/peer review tab=canada
/peer fix
/peer fix docs/history/features/example/plan-review.md
/peer fix codex docs/history/features/example/plan-review.md
/peer fix docs/history/features/example/plan-review.md tab=canada
/peer status
/peer new
```

If the user invokes the skill by name instead of the slash command, parse the same trailing words as the mode and argument.

## Target Agent Rule

- If the current agent is Claude, the default peer is Codex.
- If the current agent is Codex, the default peer is Claude.
- If the first non-mode argument is `claude` or `codex`, use that as the explicit peer target and remove it from the remaining mode arguments.
- Same-agent peers are allowed only through an explicit `claude` or `codex` override. For example, from Codex, `/peer review codex` targets another Codex session.
- Do not ask the user whether they meant Claude or Codex when they omit the target; infer the default peer from the current agent.

## Paired Tab Naming

Use deterministic peer titles, not fuzzy names:

- Source tab `canada` from Claude defaults to peer tab `[codex] canada`.
- Source tab `[claude] canada` from Claude defaults to peer tab `[codex] canada`.
- Source tab `canada` from Codex defaults to peer tab `[claude] canada`.
- Source tab `[codex] canada` from Codex defaults to peer tab `[claude] canada`.
- Explicit same-agent peers use `[codex peer] canada` or `[claude peer] canada` to avoid colliding with the source tab.

Derive the base title by stripping one leading `[claude]`, `[codex]`, `[claude peer]`, or `[codex peer]` prefix from the source tab title, then prepend the target prefix. If the user passes `tab=xyz`, use `xyz` as the source title instead of the current tab title.

Always use the transport helper for this derivation:

```bash
# From Claude, default target/create Codex.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --tab "canada" --direction right

# From Codex, default target/create Claude.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent claude --tab "canada" --direction right

# From Codex, explicit same-agent peer.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --same-agent-peer --tab "canada" --direction right
```

## Modes

### `review`

Review the current working tree or branch. Gather the current branch, `git status --short`, a changed-file summary, source metadata, and a review artifact path. Then ask the peer for a static code-review pass.

Peer task:

```text
Review the current working tree in <repo>. Focus on bugs, regressions, missing tests, and risky assumptions. Do not trust summaries, reported fixes, or reported validation as proof; use them only as leads, inspect the actual code/diff, and ground conclusions in file paths and line numbers. Do not edit code. Do not run tests or verification commands during review unless the user explicitly requested runtime verification in the command. Write the review to <review_file>. Lead with findings ordered by severity and cite file paths and line numbers. If there are no findings, say so and list residual test gaps.

After writing <review_file>, compose your own notification prompt for the requesting tab at <source_surface>. Include the review path, a concise summary of the outcome, and next-step guidance based on what you found. The notification must make clear that the review is advisory input and the requester should apply judgment rather than blindly implement every finding.
```

After the peer review callback arrives:

- Read the review file in full and verify the most impactful claims against the codebase before triaging.
- If a peer/requester reports that findings were applied, treat that report as untrusted until you inspect the actual changed files/diff. Re-check each claimed fix from code before saying the review is resolved, and notify the requester if the fix is incomplete, risky, or introduced a new issue.
- Triage every finding: Accept, Rebut, or Out-of-scope. Show your triage to the user as a single compact table (severity, finding, proposed fix) before applying anything.
- When the user opts to walk findings one-by-one, **drive that loop with the AskUserQuestion tool**, one finding per question. Each question shows the finding's severity, what's currently in the doc/code, and the proposed fix; offer at least Apply / Skip / Modify options. Do not prompt for findings via plain prose when AskUserQuestion is available — the structured form is the canonical UI for this loop.
- **Don't ask about objectively-required fixes.** If a finding has a single correct answer and no design/product trade-off (e.g., a wrong import path, a wrong dataclass field name, a test that would not run as written, a typo), just apply it and report it in the final summary. The one-by-one loop is for findings where the user's judgment changes the outcome.
- Only edit files for findings the user has explicitly accepted. After all findings are triaged, present a final summary (applied / skipped / modified) before asking about commit.

### `review <md_file>`

Review a specific Markdown plan, spec, handoff, or critique file against the current codebase. Verify claims against code instead of reviewing prose only. Gather source metadata and a review artifact path.

Peer task:

```text
Review <md_file> against the current codebase in <repo>. Read the file first, then inspect relevant implementation files. Verify factual claims with file path and line references. Treat summaries, reported fixes, and reported validation as leads only; do not trust them without checking the actual code/diff. Identify omissions, incorrect assumptions, and concrete failure modes. Do not edit code. Do not run tests or verification commands during review unless the user explicitly requested runtime verification in the command. Write the review to <review_file>.

After writing <review_file>, compose your own notification prompt for the requesting tab at <source_surface>. Include the review path, a concise summary of the outcome, and next-step guidance based on what you found. The notification must make clear that the review is advisory input and the requester should apply judgment rather than blindly implement every finding.
```

### `fix`

Ask the peer to implement a fix for the current failing state or latest review findings. Use this only when the user explicitly requests `fix`.

Before sending `fix`, gather the current branch, `git status --short`, and any obvious context from recent conversation. The handoff must tell the peer that multiple agents may be sharing the worktree and that it must not revert unrelated changes.

Peer task:

```text
Implement the requested fix in <repo>. First inspect the current worktree and relevant context. Do not revert unrelated changes. Keep edits scoped, run the smallest relevant validation, and report files changed plus verification.
```

### `fix <context>`

Ask the peer to implement a fix using `<context>` as the first thing to inspect. `<context>` is usually a Markdown review, plan, handoff, bug report, or failing-test name. It is not necessarily the code file to edit.

Peer task:

```text
Implement the requested fix in <repo>. Use <context> as the primary context artifact to inspect first. Do not assume <context> is the file to modify. Do not revert unrelated changes. Keep edits scoped, run the smallest relevant validation, and report files changed plus verification.
```

### `status`

Read the peer surface and summarize whether it is idle, still working, blocked, or has returned an answer. Do not send a new task.

### `new`

Create the peer surface only. Do not send a task.

## Workflow

1. List cmux surfaces:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh list
```

2. Gather source metadata. Choose the peer agent from the command arguments:

```bash
# From Claude.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh source-info --agent codex

# From Codex.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh source-info --agent claude

# From Codex with explicit Codex peer.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh source-info --agent codex --same-agent-peer
```

For `review`, also generate the review artifact path. If the command has a Markdown target under `docs/history/features/`, or the current context names an obvious feature plan/spec under that tree, pass it as `--context` so the review is written beside the feature docs:

```bash
# From Claude.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh review-path --agent codex
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh review-path --agent codex --context docs/history/features/example/plan.md

# From Codex.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh review-path --agent claude
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh review-path --agent claude --context docs/history/features/example/plan.md

# From Codex with explicit Codex peer.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh review-path --agent codex
```

Cross-repo rule: if the selected repo is not the current repo, start any newly created peer in the selected repo by passing `--cwd <repo>` to `counterpart`, `new-codex`, or `new-claude`. This lets the peer runtime initialize its filesystem sandbox around the repo it must read or write. Do not start a peer in repo A and ask it to write a review artifact into repo B unless the user explicitly accepts that an approval may be required.

Review artifact rule: choose a review path inside the peer's working repo whenever possible. If the requested context is outside the peer's writable repo, use the normal `.claude/peer/reviews/...` fallback inside the writable repo and include the original context path in the review title/body. Only specify an output path outside the peer's working repo when the user explicitly requested that exact path and approval friction is acceptable.

3. Decide whether to reuse a peer surface:

- Exclude the current surface from candidates.
- Determine the source title from the current tab, unless the user passed `tab=xyz`.
- Strip a leading `[claude]`, `[codex]`, `[claude peer]`, or `[codex peer]` prefix from the source title.
- Build the exact peer title from the selected peer target and source title. If the selected peer target is the current agent type, pass `--same-agent-peer`.
- Reuse only an exact title match for that peer title.
- If multiple exact matches exist, stop and ask the user to close or rename duplicates.
- If no exact match exists, create a new peer surface in a side pane with that exact title.

Read the selected surface before sending:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --tab "canada" --direction right --lines 80
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --same-agent-peer --tab "canada" --direction right --lines 80
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --tab "supplybuy" --cwd /Users/murilo/filterbuy/github/supplybuy --direction right --lines 80
```

4. If there is no exact peer surface, create one in a side pane in the current workspace:

```bash
# Run from Claude.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --tab "canada" --direction right

# Run from Codex.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent claude --tab "canada" --direction right

# Run from Codex with explicit Codex peer.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --same-agent-peer --tab "canada" --direction right

# Cross-repo review: start the peer in the target repo.
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh counterpart --agent codex --tab "supplybuy" --cwd /Users/murilo/filterbuy/github/supplybuy --direction right
```

5. Build the handoff prompt from the selected mode. Include:

- Current repo path or workspace.
- The selected mode and argument.
- Source surface ID for notifying the requester.
- Review artifact path for `review`.
- Review context path for `review`, when there is an obvious feature doc folder.
- Constraints and non-goals.
- Files or docs the peer should read first.
- Expected output format.

6. Send and submit the prompt:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh send --surface surface:18 --message "..." --submit
```

For multi-line handoffs or callbacks, write the message to a small file inside the current writable repo, then send it with `--message-file`. This avoids shell redirection and complex `$'...'` quoting in cmux commands, which makes approval-prefix matching more reliable:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh send --surface surface:18 --message-file .claude/peer/callbacks/review-done.txt --submit
```

If a cmux command fails with `Operation not permitted` for the cmux socket, rerun the same simple helper command with tool escalation. Prefer a stable prefix such as `.claude/skills/cmux-handoff/scripts/cmux-handoff.sh send` over an exact one-off shell command.

7. Later, read the peer surface and relay the result or status to the user:

```bash
.claude/skills/cmux-handoff/scripts/cmux-handoff.sh read --surface surface:18 --lines 120
```

If the peer is still working, report that plainly and continue only if the user wants more polling.

## Prompt Template

Use this shape and keep it short:

```text
Context: /path/to/repo, current branch/session context if relevant.
Mode: review | review <md_file> | review <claude|codex> <md_file> | fix | fix <context> | fix <claude|codex> <context>.
Task: <mode-specific task from this skill>.
Read first: <paths, docs, prior review files, command outputs>.
Constraints: <what not to edit, what must stay untouched, approval limits>.
Expected output: <review, patch, summary, answer, file path, etc.>.
```

Prefer file paths over pasted file contents. If the peer needs long context, write or reference an artifact in the repo and point to it.

## Review Handoff Prompt

For `review`, send a prompt with this content. Fill in exact paths and command output:

```text
You are the peer reviewer for /peer review.

Context:
- Repo: <repo>
- Branch: <branch>
- Source tab title: <source_title>
- Notify requester surface: <source_surface>
- Review output file: <review_file>

Task:
Review the current working tree. Focus on bugs, behavioral regressions, missing tests, risky assumptions, and incorrect documentation claims if a Markdown file was provided.

Inputs:
- git status --short:
<status>
- git diff --stat:
<diff_stat>
- Review target, if any: <md_file or none>

Rules:
- Do not edit code.
- Do not trust summaries, reported fixes, or reported validation as proof; inspect the actual code/diff and cite evidence from files.
- Do not run tests or verification commands during review unless the original command explicitly asked for runtime verification.
- Create the review directory if needed.
- Write the full review to <review_file>.
- Findings first, ordered by severity.
- Cite concrete file paths and line numbers for every factual claim.
- If there are no findings, say that clearly and list residual test gaps.

After writing the review file, notify the requester:

.claude/skills/cmux-handoff/scripts/cmux-handoff.sh send --surface <source_surface> --message "<notification_prompt>" --submit
```

The reviewer must compose `<notification_prompt>` itself after seeing the findings. The requester must not prewrite the callback text. The callback can be as long as needed and should include:

- The review file path.
- A concise summary of the review result.
- Next-step guidance based on the actual findings.
- A reminder that the review is advisory input and the requester should apply judgment.
- If fixes are recommended, ask the requester to fix only findings it judges valid and skip or rebut findings it judges invalid, risky, or out of scope.
- Do not revert unrelated changes.
- Ask the requester to report changed files, skipped findings, and any validation it chose to run.

Notification shape, not exact text:

```text
Peer review is complete. Review file: <review_file>.

<Reviewer-authored summary and next step guidance based on the findings.>
```

## Safety Rules

- Do not create multiple peer tabs when an existing command-managed idle peer surface is obvious.
- Do not press Enter except through `send --submit` when intentionally submitting the handoff.
- Always read the target screen before sending.
- If the target title is ambiguous, use an explicit `surface:<n>` or ask the user.
- If cmux fails with `Operation not permitted`, rerun the same command with escalation.
- Keep `plan.md`, code, or docs untouched unless the user specifically asks this skill to coordinate edits.
