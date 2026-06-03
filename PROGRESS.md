# PROGRESS

## Status

| Phase | Task | Status |
|-------|------|--------|
| 0 | Repo structure + env.example | ✅ Done |
| 0 | README.md | ✅ Done |
| 1 | gpu-worker/Dockerfile | ✅ Done |
| 1 | gpu-worker/run.py | ✅ Done |
| 1 | .github/workflows/build-gpu-container.yml | ✅ Done |
| 1 | infra/setup-runpod-endpoint.sh | ✅ Done |
| 2 | n8n-workflows/01-new-tour.json | ✅ Done |
| 2 | n8n-workflows/02-upload-done.json | ✅ Done |
| 2 | n8n-workflows/03-gpu-done.json | ✅ Done |
| 3 | viewer-template/index.html.tmpl | ✅ Done |
| 3 | infra/setup-pages.sh | ✅ Done |
| 4 | frontend/ Next.js app | ⬜ Todo |
| - | Airtable base creation | ⬜ Todo |
| - | n8n workflows import | ⬜ Todo |
| - | RunPod endpoint creation | ⬜ Todo |

## In Progress

- Push all files to GitHub main

## Blocked

- Airtable base: no Airtable MCP available, will use REST API with PAT

## Decisions

| # | Decision | Reason |
|---|----------|--------|
| 1 | Base image: `dromni/nerfstudio:1.1.3` | Stable community image, pinned version |
| 2 | Presigned URL via Next.js API route `/api/presign` | n8n doesn't have AWS SDK access; simpler to do in Next.js |
| 3 | SuperSplat viewer via CDN (jsdelivr) | No build step needed, viewer HTML is pure static |
| 4 | Resend email integrated in workflow 03 | No need for separate workflow, saves complexity |
