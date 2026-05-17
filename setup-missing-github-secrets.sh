#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./setup-missing-github-secrets.sh [owner/repo]
#   GH_REPO_OVERRIDE=owner/repo ./setup-missing-github-secrets.sh
repo="${1:-${GH_REPO_OVERRIDE:-}}"
if [[ -z "$repo" ]]; then
  repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

required_secrets=(
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_D1_MIGRATION_RUNNER_SECRET
  GOOGLE_CLIENT_ID_PRODUCTION
  GOOGLE_CLIENT_ID_PREVIEW
  GOOGLE_CLIENT_SECRET_PRODUCTION
  GOOGLE_CLIENT_SECRET_PREVIEW
  JWT_SECRET_PRODUCTION
  JWT_SECRET_PREVIEW
)

echo "Repo: $repo"
echo "Checking existing secrets..."
existing="$(gh secret list --repo "$repo" --json name -q '.[].name' || true)"

for s in "${required_secrets[@]}"; do
  if grep -qx "$s" <<<"$existing"; then
    echo "✓ $s already present"
  else
    echo "✗ $s missing"
    read -r -s -p "Enter value for $s: " value
    echo
    gh secret set "$s" --repo "$repo" --body "$value"
    unset value
    echo "  -> $s set"
  fi
done

echo "Done."
