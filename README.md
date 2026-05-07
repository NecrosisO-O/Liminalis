# Liminalis

`Liminalis` is a browser-first protected transfer system centered on send-to-self encrypted holding, controlled outward sharing, and later live transfer.

This repository currently contains:

- canonical design and architecture documents under `design/`
- implementation-planning and sequencing notes under `design/16+`
- a TypeScript monorepo with a NestJS backend in `apps/api`
- a React frontend in `apps/web`

## Local Development

1. Copy `.env.example` to `.env`
2. Start PostgreSQL with `docker compose up -d postgres`
3. Install dependencies in each workspace
4. Run Prisma generation and migrations
5. Start the API and web app

## Deployment

Docker Compose is the recommended v1 self-hosted deployment path. On a fresh
Debian or Ubuntu host:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash
```

For details, see:

- `docs/deployment/docker-compose.md`
- `docs/deployment/backup-restore.md`
- `docs/deployment/upgrade.md`

## Source Of Truth

- `design/09-15`: canonical architecture and baseline summaries
- `design/16-35`: accepted implementation-planning and sequencing corpus
- `design/36`: recorded code-phase macro plan
