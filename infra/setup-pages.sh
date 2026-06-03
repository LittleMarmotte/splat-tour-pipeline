#!/usr/bin/env bash
# Create Cloudflare Pages project for splat viewer hosting
set -euo pipefail

PROJECT="${CF_PAGES_PROJECT:-splat-tours-viewer}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:?Missing CF_ACCOUNT_ID}"

echo "Creating Cloudflare Pages project: $PROJECT"
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${PROJECT}\",
    \"production_branch\": \"main\"
  }" | jq '{name:.result.name, subdomain:.result.subdomain}'

echo "✓ Pages project ready — deploy via Direct Upload API"
