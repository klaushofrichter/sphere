#!/usr/bin/env bash
# Upload the variables in a .env file to GitHub repository secrets.
#
# Usage: ./scripts/upload-secrets.sh [env-file]   (default: .env)
#
# Requires the GitHub CLI (gh), authenticated with repo access.
# Note: secrets are write-only on GitHub — they can be replaced or deleted
# but never read back. Existing secrets with the same name are overwritten.
set -euo pipefail

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "error: '$ENV_FILE' not found" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "error: GitHub CLI is not authenticated (run: gh auth login)" >&2
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)

# Advisory count of NAME=VALUE lines (ignores comments and blanks). The
# authoritative parsing is done by `gh secret set -f`, which also accepts
# forms this regex misses (e.g. "export FOO=", quoted multiline values) —
# the count is only used for the empty-file guard and the status message.
VAR_COUNT=$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" || true)
if [ "$VAR_COUNT" -eq 0 ]; then
  echo "error: no NAME=VALUE lines found in '$ENV_FILE'" >&2
  exit 1
fi

echo "Uploading $VAR_COUNT secret(s) from '$ENV_FILE' to $REPO ..."
gh secret set -f "$ENV_FILE" --repo "$REPO"

echo
echo "Current repository secrets:"
gh secret list --repo "$REPO"
