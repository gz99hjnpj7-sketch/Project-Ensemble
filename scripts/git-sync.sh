#!/bin/bash
# One-command Git sync for Future News
# Usage: npm run git:sync   or   bash scripts/git-sync.sh

set -e

echo "🔄 Syncing changes to GitHub..."

# Stage everything (gitignore will filter .env, node_modules, .next, etc.)
git add -A

# Commit only if there are staged changes
if git diff --cached --quiet; then
  echo "✅ No changes to commit."
else
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  git commit -m "sync: ${TIMESTAMP}"
  echo "📝 Committed changes."
fi

# Push (in Codespaces this is seamless thanks to the built-in credential helper)
git push origin main

echo "✅ Synced to GitHub: $(git remote get-url origin)"
echo "   View at: https://github.com/$(git config --get remote.origin.url | sed -E 's#https://github.com/##; s/.git$//')/commits/main"