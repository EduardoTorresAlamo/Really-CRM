#!/usr/bin/env bash
# Runs qwen-comment.mjs on every file in the plan, one at a time.
# After each file it runs tsc to catch any damage, then asks to continue.
#
# Usage:
#   bash scripts/run-comments.sh          # interactive, asks before each file
#   bash scripts/run-comments.sh --auto   # no prompts, write all and check tsc at end

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT="$ROOT/scripts/qwen-comment.mjs"
AUTO=${1:-""}

# ─── Files ordered by plan priority ──────────────────────────────────────────
TIER1=(
  "components/clients/ClientForm.tsx"
  "lib/claude/propertyMatch.ts"
  "app/api/cron/send-daily-followups/route.ts"
  "components/documents/DocumentUploadDialog.tsx"
  "components/follow-ups/FollowUpCard.tsx"
)

TIER2=(
  "app/(app)/dashboard/page.tsx"
  "app/(app)/clients/page.tsx"
  "components/clients/ClientFilters.tsx"
  "lib/resend/sendFollowUpEmail.ts"
  "proxy.ts"
  "components/clients/tabs/FollowUpsTab.tsx"
  "app/api/property-match/route.ts"
)

TIER3=(
  "app/(app)/clients/[id]/page.tsx"
  "lib/supabase/server.ts"
  "components/profile/AvatarUpload.tsx"
  "types/client.ts"
  "types/document.ts"
  "types/propertyMatch.ts"
)

ALL=("${TIER1[@]}" "${TIER2[@]}" "${TIER3[@]}")

# ─── Helpers ─────────────────────────────────────────────────────────────────
green()  { echo -e "\033[0;32m$*\033[0m"; }
yellow() { echo -e "\033[0;33m$*\033[0m"; }
red()    { echo -e "\033[0;31m$*\033[0m"; }

ask_continue() {
  if [[ "$AUTO" == "--auto" ]]; then return 0; fi
  read -r -p "Continue to next file? [Y/n] " ans
  [[ "${ans:-Y}" =~ ^[Yy]$ ]]
}

check_tsc() {
  cd "$ROOT"
  if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS"; then
    red "  tsc found errors — review before continuing"
    npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
    return 1
  else
    green "  tsc clean"
  fi
}

# ─── Main loop ────────────────────────────────────────────────────────────────
cd "$ROOT"

TOTAL=${#ALL[@]}
DONE=0
FAILED=()

for FILE in "${ALL[@]}"; do
  DONE=$((DONE + 1))
  echo ""
  yellow "[$DONE/$TOTAL] $FILE"

  if [[ ! -f "$FILE" ]]; then
    red "  File not found, skipping: $FILE"
    continue
  fi

  if ! node "$SCRIPT" "$FILE" --write; then
    red "  Qwen failed on $FILE"
    FAILED+=("$FILE")
    ask_continue || break
    continue
  fi

  check_tsc || true  # warn but don't abort
  ask_continue || break
done

echo ""
if [[ ${#FAILED[@]} -gt 0 ]]; then
  red "Failed files:"
  for f in "${FAILED[@]}"; do red "  $f"; done
else
  green "All files done."
fi

echo ""
echo "Run 'npm run build' for a final check."
