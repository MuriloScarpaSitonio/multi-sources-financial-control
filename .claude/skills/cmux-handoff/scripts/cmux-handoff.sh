#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  cmux-handoff.sh list [--workspace <id|ref>]
  cmux-handoff.sh source-info --agent <claude|codex> [--same-agent-peer] [--workspace <id|ref>] [--source-title <title> | --tab <title>]
  cmux-handoff.sh pair-title --agent <claude|codex> [--same-agent-peer] [--source-title <title> | --tab <title>]
  cmux-handoff.sh review-path --agent <claude|codex> [--source-title <title> | --tab <title>] [--context <path>]
  cmux-handoff.sh counterpart --agent <claude|codex> [--same-agent-peer] [--workspace <id|ref>] [--source-title <title> | --tab <title>] [--direction <left|right|up|down>] [--pane <pane>] [--cwd <path>] [--lines <n>]
  cmux-handoff.sh new-codex [--workspace <id|ref>] [--pane <pane>] [--name <title>] [--cwd <path>] [--lines <n>]
  cmux-handoff.sh new-claude [--workspace <id|ref>] [--pane <pane>] [--name <title>] [--cwd <path>] [--lines <n>]
  cmux-handoff.sh new-tab [--workspace <id|ref>] [--pane <pane>] [--name <title>] [--start <command>] [--cwd <path>] [--lines <n>]
  cmux-handoff.sh new-pane [--workspace <id|ref>] [--direction <left|right|up|down>] [--name <title>] [--start <command>] [--cwd <path>] [--lines <n>]
  cmux-handoff.sh read (--surface <surface> | --title <text>) [--workspace <id|ref>] [--lines <n>]
  cmux-handoff.sh send (--surface <surface> | --title <text>) (--message <text> | --message-file <path>) [--workspace <id|ref>] [--submit] [--lines <n>]

Defaults:
  --workspace defaults to CMUX_WORKSPACE_ID when set, otherwise workspace:1.

Safety:
  send reads the target screen first, sends text, and only presses Enter when --submit is present.
  counterpart reuses only an exact paired title like "[codex] canada"; otherwise it creates a side pane.
  --same-agent-peer names same-agent peers like "[codex peer] canada" to avoid colliding with the source tab.
  source-info reports the caller surface and paired counterpart title for prompt handoffs.
  review-path colocates feature peer reviews under docs/history/features/ when --context points there.
  new-tab/new-pane return the created surface and read it after optional startup command.
  --cwd starts new agent surfaces from a specific repository directory.
  --message-file avoids fragile shell quoting for long or multi-line handoffs.
  new-codex/new-claude are counterpart shortcuts for cross-agent handoffs.
EOF
}

workspace="${CMUX_WORKSPACE_ID:-workspace:1}"
surface=""
title=""
message=""
message_file=""
lines="40"
submit="false"
pane=""
direction="right"
name=""
start_command=""
cwd=""
target_agent=""
source_title=""
review_context=""
same_agent_peer="false"

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  usage
  exit 0
fi

command="$1"
shift

while [[ $# -gt 0 ]]; do
  case "$1" in
    --workspace)
      workspace="${2:?missing --workspace value}"
      shift 2
      ;;
    --surface)
      surface="${2:?missing --surface value}"
      shift 2
      ;;
    --title)
      title="${2:?missing --title value}"
      shift 2
      ;;
    --message)
      message="${2:?missing --message value}"
      shift 2
      ;;
    --message-file)
      message_file="${2:?missing --message-file value}"
      shift 2
      ;;
    --pane)
      pane="${2:?missing --pane value}"
      shift 2
      ;;
    --direction)
      direction="${2:?missing --direction value}"
      shift 2
      ;;
    --name)
      name="${2:?missing --name value}"
      shift 2
      ;;
    --start)
      start_command="${2:?missing --start value}"
      shift 2
      ;;
    --cwd)
      cwd="${2:?missing --cwd value}"
      shift 2
      ;;
    --agent)
      target_agent="${2:?missing --agent value}"
      shift 2
      ;;
    --source-title|--tab)
      source_title="${2:?missing $1 value}"
      shift 2
      ;;
    --context|--review-target)
      review_context="${2:?missing $1 value}"
      shift 2
      ;;
    --lines)
      lines="${2:?missing --lines value}"
      shift 2
      ;;
    --submit)
      submit="true"
      shift
      ;;
    --same-agent-peer)
      same_agent_peer="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

require_cmux() {
  if ! command -v cmux >/dev/null 2>&1; then
    echo "cmux CLI not found on PATH" >&2
    exit 127
  fi
}

surface_from_output() {
  local output="$1"
  local created
  created="$(printf '%s\n' "$output" | grep -Eo 'surface:[[:alnum:]-]+' | head -n 1 || true)"
  if [[ -z "$created" ]]; then
    echo "Could not parse created surface from cmux output: $output" >&2
    exit 1
  fi
  printf '%s\n' "$created"
}

read_target() {
  local target="$1"
  cmux read-screen --workspace "$workspace" --surface "$target" --lines "$lines"
}

validate_direction() {
  case "$direction" in
    left|right|up|down) ;;
    *)
      echo "--direction must be one of: left, right, up, down" >&2
      exit 2
      ;;
  esac
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s\n' "$value"
}

normalize_agent() {
  local lowered
  lowered="$(printf '%s\n' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$lowered" in
    claude|codex)
      printf '%s\n' "$lowered"
      ;;
    *)
      echo "--agent must be one of: claude, codex" >&2
      exit 2
      ;;
  esac
}

strip_agent_prefix() {
  local value
  value="$(trim "$1")"
  value="$(printf '%s\n' "$value" | sed -E 's/^[^[:alnum:]\[]+[[:space:]]*//')"
  value="$(printf '%s\n' "$value" | sed -E 's/^\[(claude|codex)( peer)?\][[:space:]]*//I')"
  trim "$value"
}

current_surface_ref() {
  local ref
  ref="$(cmux identify | awk '
    /"caller"[[:space:]]*:/ {
      in_caller = 1
    }
    in_caller && /"surface_ref"[[:space:]]*:/ {
      gsub(/[",]/, "", $0)
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^surface:/) {
          print $i
          exit
        }
      }
    }
  ')"
  if [[ -z "$ref" ]]; then
    echo "Could not identify current cmux caller surface; pass --source-title or --tab." >&2
    exit 2
  fi
  printf '%s\n' "$ref"
}

title_for_surface() {
  local target="$1"
  if [[ -z "$target" ]]; then
    echo "No current cmux surface is available; pass --source-title or --tab." >&2
    exit 2
  fi

  local found
  found="$(cmux list-panels --workspace "$workspace" | awk -v target="$target" '
    {
      matched = 0
      for (i = 1; i <= NF; i++) {
        token = $i
        sub(/^\*/, "", token)
        if (token == target) {
          matched = 1
          break
        }
      }
      if (matched && match($0, /"[^"]*"$/)) {
        print substr($0, RSTART + 1, RLENGTH - 2)
        exit
      }
    }
  ')"

  if [[ -z "$found" ]]; then
    echo "Could not resolve title for surface: $target" >&2
    exit 1
  fi
  printf '%s\n' "$found"
}

paired_title() {
  local agent
  local source
  local base
  agent="$(normalize_agent "$target_agent")"
  source="$source_title"
  if [[ -z "$source" ]]; then
    source="$(title_for_surface "$(current_surface_ref)")"
  fi
  base="$(strip_agent_prefix "$source")"
  if [[ -z "$base" ]]; then
    echo "Could not derive counterpart title from source title: $source" >&2
    exit 1
  fi
  if [[ "$same_agent_peer" == "true" ]]; then
    printf '[%s peer] %s\n' "$agent" "$base"
  else
    printf '[%s] %s\n' "$agent" "$base"
  fi
}

base_title() {
  local source
  source="$source_title"
  if [[ -z "$source" ]]; then
    source="$(title_for_surface "$(current_surface_ref)")"
  fi
  strip_agent_prefix "$source"
}

slugify() {
  local value="$1"
  value="$(printf '%s\n' "$value" | tr '[:upper:]' '[:lower:]')"
  value="$(printf '%s\n' "$value" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
  if [[ -z "$value" ]]; then
    value="session"
  fi
  printf '%s\n' "$value"
}

review_output_path() {
  local agent="$1"
  local base="$2"
  local timestamp="$3"
  local slug
  local review_dir
  slug="$(slugify "$base")"

  if [[ -n "$review_context" ]]; then
    case "$review_context" in
      *docs/history/features/*)
        if [[ -d "$review_context" ]]; then
          review_dir="$review_context"
        else
          review_dir="$(dirname "$review_context")"
        fi
        printf '%s/peer-review-%s-%s.md\n' "$review_dir" "$timestamp" "$agent"
        return
        ;;
    esac
  fi

  printf '.claude/peer/reviews/%s-%s-%s-review.md\n' "$timestamp" "$agent" "$slug"
}

exact_matches_for_title() {
  local wanted="$1"
  cmux list-panels --workspace "$workspace" | awk -v wanted="$wanted" '
    {
      if (!match($0, /"[^"]*"$/)) {
        next
      }
      title = substr($0, RSTART + 1, RLENGTH - 2)
      if (title != wanted) {
        next
      }
      for (i = 1; i <= NF; i++) {
        token = $i
        sub(/^\*/, "", token)
        if (token ~ /^surface:/) {
          print token
          break
        }
      }
    }
  '
}

finish_created_surface() {
  local target="$1"

  if [[ -n "$name" ]]; then
    cmux rename-tab --workspace "$workspace" --surface "$target" "$name" >/dev/null
  fi

  if [[ -n "$start_command" ]]; then
    if [[ -n "$cwd" ]]; then
      if [[ ! -d "$cwd" ]]; then
        echo "--cwd does not exist or is not a directory: $cwd" >&2
        exit 2
      fi
      printf -v quoted_cwd '%q' "$cwd"
      start_command="cd ${quoted_cwd} && ${start_command}"
    fi
    # Give the new terminal a moment to initialize before typing.
    sleep 0.2
    cmux send --workspace "$workspace" --surface "$target" "$start_command" >/dev/null
    cmux send-key --workspace "$workspace" --surface "$target" Enter >/dev/null
    sleep 0.5
  fi

  echo "Created $target in $workspace"
  read_target "$target"
}

resolve_surface() {
  if [[ -n "$surface" ]]; then
    printf '%s\n' "$surface"
    return
  fi

  if [[ -z "$title" ]]; then
    echo "Provide --surface or --title" >&2
    exit 2
  fi

  local matches
  matches="$(cmux list-panels --workspace "$workspace" | awk -v title="$title" '
    index(tolower($0), tolower(title)) {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^surface:/) {
          print $i
          break
        }
      }
    }
  ')"

  local count
  count="$(printf '%s\n' "$matches" | sed '/^$/d' | wc -l | tr -d ' ')"
  if [[ "$count" == "0" ]]; then
    echo "No cmux surface title matched: $title" >&2
    echo "Available surfaces:" >&2
    cmux list-panels --workspace "$workspace" >&2
    exit 1
  fi
  if [[ "$count" != "1" ]]; then
    echo "Multiple cmux surfaces matched title: $title" >&2
    printf '%s\n' "$matches" >&2
    echo "Use --surface explicitly." >&2
    exit 1
  fi

  printf '%s\n' "$matches"
}

require_cmux

case "$command" in
  list)
    cmux tree --workspace "$workspace"
    echo
    cmux list-panels --workspace "$workspace"
    ;;
  source-info)
    if [[ -z "$target_agent" ]]; then
      echo "source-info requires --agent" >&2
      exit 2
    fi
    target_agent="$(normalize_agent "$target_agent")"
    current_ref="$(current_surface_ref)"
    current_title="$(title_for_surface "$current_ref")"
    base="$(base_title)"
    name="$(paired_title)"
    echo "source_surface: $current_ref"
    echo "source_title: $current_title"
    echo "pair_base_title: $base"
    echo "counterpart_agent: $target_agent"
    echo "counterpart_title: $name"
    ;;
  pair-title)
    if [[ -z "$target_agent" ]]; then
      echo "pair-title requires --agent" >&2
      exit 2
    fi
    paired_title
    ;;
  review-path)
    if [[ -z "$target_agent" ]]; then
      echo "review-path requires --agent" >&2
      exit 2
    fi
    target_agent="$(normalize_agent "$target_agent")"
    base="$(base_title)"
    review_output_path "$target_agent" "$base" "$(date +%Y%m%d-%H%M%S)"
    ;;
  counterpart)
    if [[ -z "$target_agent" ]]; then
      echo "counterpart requires --agent" >&2
      exit 2
    fi
    target_agent="$(normalize_agent "$target_agent")"
    name="$(paired_title)"
    matches="$(exact_matches_for_title "$name")"
    count="$(printf '%s\n' "$matches" | sed '/^$/d' | wc -l | tr -d ' ')"
    if [[ "$count" == "0" ]]; then
      start_command="$target_agent"
      if [[ -n "$pane" ]]; then
        args=(new-surface --workspace "$workspace")
        args+=(--pane "$pane")
        created_output="$(cmux "${args[@]}")"
      else
        validate_direction
        created_output="$(cmux new-pane --workspace "$workspace" --direction "$direction")"
      fi
      target="$(surface_from_output "$created_output")"
      finish_created_surface "$target"
      exit 0
    fi
    if [[ "$count" != "1" ]]; then
      echo "Multiple cmux surfaces exactly matched title: $name" >&2
      printf '%s\n' "$matches" >&2
      echo "Close or rename duplicates before continuing." >&2
      exit 1
    fi
    target="$(printf '%s\n' "$matches" | sed '/^$/d' | head -n 1)"
    echo "Target: $target \"$name\" in $workspace"
    read_target "$target"
    ;;
  read)
    target="$(resolve_surface)"
    read_target "$target"
    ;;
  new-codex)
    start_command="codex"
    if [[ -z "$name" ]]; then
      name="codex handoff"
    fi
    args=(new-surface --workspace "$workspace")
    if [[ -n "$pane" ]]; then
      args+=(--pane "$pane")
    fi
    created_output="$(cmux "${args[@]}")"
    target="$(surface_from_output "$created_output")"
    finish_created_surface "$target"
    ;;
  new-claude)
    start_command="claude"
    if [[ -z "$name" ]]; then
      name="claude handoff"
    fi
    args=(new-surface --workspace "$workspace")
    if [[ -n "$pane" ]]; then
      args+=(--pane "$pane")
    fi
    created_output="$(cmux "${args[@]}")"
    target="$(surface_from_output "$created_output")"
    finish_created_surface "$target"
    ;;
  new-tab)
    args=(new-surface --workspace "$workspace")
    if [[ -n "$pane" ]]; then
      args+=(--pane "$pane")
    fi
    created_output="$(cmux "${args[@]}")"
    target="$(surface_from_output "$created_output")"
    finish_created_surface "$target"
    ;;
  new-pane)
    validate_direction
    created_output="$(cmux new-pane --workspace "$workspace" --direction "$direction")"
    target="$(surface_from_output "$created_output")"
    finish_created_surface "$target"
    ;;
  send)
    if [[ -n "$message" && -n "$message_file" ]]; then
      echo "send accepts only one of --message or --message-file" >&2
      exit 2
    fi
    if [[ -n "$message_file" ]]; then
      if [[ ! -f "$message_file" ]]; then
        echo "--message-file does not exist or is not a file: $message_file" >&2
        exit 2
      fi
      message="$(cat "$message_file")"
    fi
    if [[ -z "$message" ]]; then
      echo "send requires --message or --message-file" >&2
      exit 2
    fi
    target="$(resolve_surface)"
    echo "Target: $target in $workspace" >&2
    echo "Current screen:" >&2
    read_target "$target" >&2
    cmux send --workspace "$workspace" --surface "$target" "$message"
    if [[ "$submit" == "true" ]]; then
      cmux send-key --workspace "$workspace" --surface "$target" Enter
    else
      echo "Message sent but not submitted. Re-run with --submit or send Enter explicitly if appropriate." >&2
    fi
    ;;
  *)
    echo "Unknown command: $command" >&2
    usage >&2
    exit 2
    ;;
esac
