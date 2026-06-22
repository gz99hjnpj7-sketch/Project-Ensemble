#!/bin/bash
# Automatic Git watcher for Future News
# Watches source files and auto-commits + pushes changes.
#
# Usage:
#   npm run git:watch
#   (Run this in a separate terminal while you edit code)
#
# Features:
# - Uses inotifywait (available in this Codespace)
# - Debounces rapid changes (3 second delay)
# - Only watches relevant source directories
# - Respects .gitignore automatically via git add
# - Safe: does nothing if no real changes

set -euo pipefail

WATCH_DIRS="app lib components prisma worker tests"
EXCLUDES="(\.next|node_modules|\.git|dist|coverage|.*\.log)"

echo "👀 Starting Git auto-watch..."
echo "   Watching: $WATCH_DIRS"
echo "   Press Ctrl+C to stop."
echo ""

# Make sure inotifywait is available
if ! command -v inotifywait >/dev/null 2>&1; then
  echo "❌ inotifywait not found. Install with: sudo apt-get install -y inotify-tools"
  exit 1
fi

# Function to perform a sync
do_sync() {
  echo "📦 Change detected at $(date '+%H:%M:%S')"
  bash "$(dirname "$0")/git-sync.sh" || echo "   (sync script completed with no new commit)"
  echo "👀 Watching again..."
  echo ""
}

# Initial sync on start (optional, comment out if you don't want it)
# do_sync

# Watch loop with debounce
while true; do
  # Wait for filesystem events in watched dirs, excluding junk
  EVENT=$(inotifywait -q -r -e modify,create,delete,move \
    --exclude "$EXCLUDES" \
    $WATCH_DIRS 2>/dev/null || true)

  if [ -n "$EVENT" ]; then
    # Debounce: wait a bit in case more changes are coming
    sleep 3
    do_sync
  fi
done
