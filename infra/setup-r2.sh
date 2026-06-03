#!/usr/bin/env bash
# Setup Cloudflare R2 bucket — requires wrangler CLI authenticated
set -euo pipefail

BUCKET="${R2_BUCKET:-splat-tours}"
CF_ACCOUNT_ID="${CF_ACCOUNT_ID:?Missing CF_ACCOUNT_ID}"

echo "Creating R2 bucket: $BUCKET"
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"${BUCKET}\"}" | jq .

echo "✓ R2 bucket ready: $BUCKET"
