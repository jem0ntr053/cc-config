#!/usr/bin/env bash
# cc-config install - symlink contents into ~/.claude/
# Idempotent. Re-run after `git pull` to refresh.

set -euo pipefail

SOURCE="$(cd "$(dirname "$0")" && pwd)"
TARGET="$HOME/.claude"

mkdir -p "$TARGET/skills" "$TARGET/hooks"

ln -sfn "$SOURCE/plugin-routing.md"                   "$TARGET/plugin-routing.md"
ln -sfn "$SOURCE/skills/picking-model-tier"           "$TARGET/skills/picking-model-tier"
ln -sfn "$SOURCE/skills/writing-handoffs"             "$TARGET/skills/writing-handoffs"
ln -sfn "$SOURCE/skills/session-debrief"              "$TARGET/skills/session-debrief"
ln -sfn "$SOURCE/hooks/precompact-context.sh"         "$TARGET/hooks/precompact-context.sh"
ln -sfn "$SOURCE/hooks/picking-model-tier-context.sh" "$TARGET/hooks/picking-model-tier-context.sh"

echo "cc-config installed → $TARGET"
echo
echo "Symlinks:"
for link in plugin-routing.md skills/picking-model-tier skills/writing-handoffs skills/session-debrief hooks/precompact-context.sh hooks/picking-model-tier-context.sh; do
  printf "  %-40s -> " "$TARGET/$link"
  readlink "$TARGET/$link" || echo "(missing)"
done
