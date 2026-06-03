# splat-tour-pipeline

Automated pipeline for generating 3D real estate tours from smartphone video using Gaussian Splatting.

**Agent films a house → uploads video → receives a 3D virtual tour URL by email.**

## Architecture

```
Agent (smartphone)
  → Frontend (Next.js/Vercel) — upload form
  → Cloudflare R2 — video storage
  → n8n webhook 02 — triggers GPU job
  → RunPod Serverless (GPU) — nerfstudio + splat-transform
  → Cloudflare R2 — stores scene.sog
  → n8n webhook 03 — deploys viewer + sends email
  → Cloudflare Pages — serves 3D viewer
  → Resend — email with URL + iframe snippet
```

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | GPU worker (Dockerfile + run.py + CI) | ✅ Done |
| 2 | n8n workflows (3 webhooks) | ✅ Done |
| 3 | Viewer template + Cloudflare Pages | ✅ Done |
| 4 | Frontend Next.js | ⬜ Todo |
| 5 | Resend email (integrated in Phase 2) | ✅ Done |

## Setup

### Prerequisites
- Cloudflare account with R2 and Pages
- RunPod account
- Airtable base (see below)
- n8n instance
- Resend account
- Vercel account

### Environment variables

Copy `.env.example` to `.env` and fill all values.

### Infrastructure setup

```bash
# 1. Create R2 bucket
bash infra/setup-r2.sh

# 2. Create Cloudflare Pages project
bash infra/setup-pages.sh

# 3. Create RunPod endpoint (after pushing Docker image)
bash infra/setup-runpod-endpoint.sh
```

### Airtable

Create a base named **Splat Tours CRM** with a table named **jobs** containing fields:
- `slug` (Single line text, primary)
- `agent_email` (Email)
- `address` (Single line text)
- `status` (Single select: awaiting_upload, uploaded, processing, building, done, failed)
- `tour_url` (URL)
- `r2_video_path` (Single line text)
- `r2_splat_path` (Single line text)
- `runpod_job_id` (Single line text)
- `error_message` (Long text)
- `created_at` (Date)

### n8n

Import the 3 workflow JSON files from `n8n-workflows/` into your n8n instance and activate them.

### GPU Worker

The Docker image is built and pushed automatically by GitHub Actions on every push to `main` that modifies `gpu-worker/`.

Image: `ghcr.io/LittleMarmotte/splat-gpu-worker:latest`

## URL format

Tours are served at `https://{TOURS_DOMAIN}/{slug}`

Slug format: `{address-kebab-case}-{6-random-chars}` e.g. `15-rue-mozart-paris-a3f7k2`

## Cost

~0.50€ per tour (RunPod GPU time). Charged at 200-500€/tour.
