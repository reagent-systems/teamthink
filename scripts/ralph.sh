#!/usr/bin/env bash
# Local Ralph loop driver for TeamThink Phase 0 stories.
# Each iteration: print next incomplete story from .ralph/prd.json and
# optionally spawn `cursor-agent` / `agent` if available.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PRD=".ralph/prd.json"
PROGRESS=".ralph/progress.md"
SCRATCH=".cursor/ralph/scratchpad.md"
MAX="${RALPH_MAX_ITERATIONS:-12}"
PROMISE="FEATURES_1_5_AND_DESKTOP_RELEASE_READY"

if [[ ! -f "$PRD" ]]; then
  echo "Missing $PRD" >&2
  exit 1
fi

next_story() {
  python3 - <<'PY'
import json
from pathlib import Path
prd = json.loads(Path(".ralph/prd.json").read_text())
for s in prd["stories"]:
    if not s.get("passes"):
        print(f"{s['id']}|{s['title']}")
        break
else:
    print("DONE|")
PY
}

mark_pass() {
  local id="$1"
  python3 - <<PY
import json
from pathlib import Path
p = Path(".ralph/prd.json")
prd = json.loads(p.read_text())
for s in prd["stories"]:
    if s["id"] == "$id":
        s["passes"] = True
p.write_text(json.dumps(prd, indent=2) + "\n")
PY
}

for i in $(seq 1 "$MAX"); do
  IFS='|' read -r sid stitle <<<"$(next_story)"
  if [[ "$sid" == "DONE" ]]; then
    echo "All stories pass. Promise: $PROMISE"
    echo "<promise>$PROMISE</promise>"
    exit 0
  fi
  echo "=== Ralph iteration $i / $MAX — story #$sid: $stitle ==="
  # Refresh scratchpad iteration counter
  if [[ -f "$SCRATCH" ]]; then
    python3 - <<PY
from pathlib import Path
import re
p = Path("$SCRATCH")
text = p.read_text()
text = re.sub(r"(iteration:\\s*)\\d+", r"\\g<1>$i", text, count=1)
p.write_text(text)
PY
  fi
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) — starting story $sid: $stitle" >> "$PROGRESS"

  AGENT_BIN=""
  if command -v cursor-agent >/dev/null 2>&1; then AGENT_BIN=cursor-agent
  elif command -v agent >/dev/null 2>&1; then AGENT_BIN=agent
  fi

  PROMPT=$(cat <<EOF
[Ralph loop iteration $i.]
Read .ralph/prd.json, .ralph/progress.md, and .cursor/ralph/scratchpad.md.
Implement story #$sid ($stitle) only. Satisfy its acceptance criteria.
Commit when done, set passes:true for that story in .ralph/prd.json,
append a note to .ralph/progress.md. Do not start other stories.
EOF
)

  if [[ -n "$AGENT_BIN" ]]; then
    "$AGENT_BIN" -p "$PROMPT" || true
  else
    echo "No cursor-agent/agent CLI — run this story in the IDE agent, then:"
    echo "  mark story $sid passes:true in $PRD"
    echo "Re-run ./scripts/ralph.sh when ready for the next iteration."
    exit 2
  fi
done

echo "Hit max iterations ($MAX) without completing all stories." >&2
exit 1
