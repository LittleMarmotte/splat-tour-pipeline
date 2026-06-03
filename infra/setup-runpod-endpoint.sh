#!/usr/bin/env bash
# Create RunPod Serverless endpoint pointing at ghcr.io image
set -euo pipefail

RUNPOD_API_KEY="${RUNPOD_API_KEY:?Missing RUNPOD_API_KEY}"
GITHUB_USERNAME="${GITHUB_USERNAME:-LittleMarmotte}"
IMAGE="ghcr.io/${GITHUB_USERNAME}/splat-gpu-worker:latest"

echo "Creating RunPod endpoint with image: $IMAGE"

RESPONSE=$(curl -s -X POST \
  "https://api.runpod.io/graphql?api_key=${RUNPOD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"mutation { saveEndpoint(input: { name: \\\"splat-gpu-worker\\\", dockerArgs: \\\"\\\", containerDiskInGb: 20, minWorkers: 0, maxWorkers: 3, gpuIds: \\\"AMPERE_80\\\", imageName: \\\"${IMAGE}\\\", scalerType: \\\"QUEUE_DELAY\\\", scalerValue: 4 }) { id name } }\"
  }")

echo "$RESPONSE" | jq .
ENDPOINT_ID=$(echo "$RESPONSE" | jq -r '.data.saveEndpoint.id')
echo ""
echo "✓ RunPod Endpoint ID: $ENDPOINT_ID"
echo "Add to .env: RUNPOD_ENDPOINT_ID=$ENDPOINT_ID"
