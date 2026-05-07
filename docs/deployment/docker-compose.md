# Docker Compose Deployment

Docker Compose is the recommended v1 self-hosted deployment path for Liminalis.
It runs PostgreSQL, the API, the user site, and the admin site on one host.

## Services

The root `docker-compose.yml` defines:

- `postgres`: PostgreSQL 16 with a persistent Docker volume.
- `api`: the NestJS API, Prisma client, migrations, and local disk storage driver.
- `web`: the user-facing React app served by Nginx.
- `admin`: the independent admin React app served by Nginx.

The `web` and `admin` containers proxy `/api/*` to the internal `api` service.
This keeps the browser API URL relative to the current site and avoids frontend
rebuilds when the external domain changes.

## One-Line Install

On a fresh Debian or Ubuntu host, run:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash
```

The installer will:

1. Install missing system dependencies.
2. Install Docker and Docker Compose if needed.
3. Ask for the install directory, repository URL, and branch/tag.
4. Clone or update Liminalis in `/opt/liminalis` when running as root, or
   `$HOME/liminalis` otherwise.
5. Ask for deployment mode, public URLs, local ports, and PostgreSQL bind.
6. Call `scripts/deploy.sh` to create `.env`, build images, run migrations, seed
   the initial admin user, and start services.

The interactive prompts cover every common deployment option. For unattended
local testing on fixed ports:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- --local --yes --web-port 5173 --admin-port 3001
```

For unattended public-domain deployment:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- \
  --public \
  --yes \
  --app-url https://app.example.com \
  --admin-url https://admin.example.com
```

For production, prefer a release tag after v1 is tagged:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/v1.0.0/scripts/install.sh | bash
```

If you prefer to review the script first:

```bash
curl -fsSLO https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh
less install.sh
bash install.sh
```

## Repository Quick Start

From the repository root:

```bash
chmod +x scripts/deploy.sh
scripts/deploy.sh
```

The script will:

1. Create `.env` if it does not exist.
2. Generate a database password, session secret, and initial admin password.
3. Build the Docker images.
4. Start PostgreSQL.
5. Apply Prisma migrations.
6. Seed the initial admin user and default policy bundles.
7. Start all services.
8. Run a basic API health check.

The initial admin credentials are printed only when `.env` is first created.
Store the generated password before closing the terminal.

## Manual Deployment

Copy the environment template:

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env` and replace all `change-me-*` values with strong random secrets.
At minimum, set:

- `POSTGRES_PASSWORD`
- `SESSION_SECRET`
- `PUBLIC_APP_URL`
- `PUBLIC_ADMIN_URL`
- `PUBLIC_API_URL`
- `SEED_ADMIN_PASSWORD`
- `POSTGRES_HOST_PORT`, if port `5432` is already used locally
- `DATABASE_URL`, if you change `POSTGRES_HOST_PORT`

Then build and start:

```bash
docker compose build
docker compose up -d postgres
docker compose run --rm api npx prisma migrate deploy
set -a; source .env; set +a
docker compose run --rm \
  -e "SEED_ADMIN_USERNAME=${SEED_ADMIN_USERNAME:-owner}" \
  -e "SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL:-owner@liminalis.local}" \
  -e "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}" \
  api npx tsx prisma/seed.ts
docker compose up -d
```

If your Docker installation uses the legacy Compose binary, replace
`docker compose` with `docker-compose`.

## URL Configuration

Recommended production shape:

```text
https://app.example.com      user site
https://admin.example.com    admin site
https://app.example.com/api  API through the user-site reverse proxy
```

For this shape:

```env
PUBLIC_APP_URL=https://app.example.com
PUBLIC_ADMIN_URL=https://admin.example.com
PUBLIC_API_URL=https://app.example.com
```

The admin site contains the instance `Public origin` setting. Set it to the
user site origin, such as `https://app.example.com`. Liminalis uses this origin
when creating public extraction and public-link URLs.

## Ports

Default local ports:

```env
WEB_PORT=8080
ADMIN_PORT=8081
POSTGRES_HOST_PORT=127.0.0.1:5432
```

The API container is not published directly by default. Browser traffic reaches
it through `/api` on the user/admin site containers. This is the simplest safe
default for Cloudflare Tunnel, Nginx Proxy Manager, Caddy, or another reverse
proxy.

PostgreSQL is bound to `127.0.0.1` for local maintenance commands. Do not bind
it to `0.0.0.0` on an internet-facing host.

## Cloudflare Tunnel Example

Point your tunnel hostnames to the local exposed ports:

```text
app.example.com    -> http://127.0.0.1:8080
admin.example.com  -> http://127.0.0.1:8081
```

Keep `PUBLIC_APP_URL` and the admin `Public origin` setting aligned with the
real browser-visible user-site URL.

Large uploads still depend on the limits and timeouts of the external tunnel or
reverse proxy. Liminalis uses advanced chunked upload for large files, but the
outer proxy must allow long-lived upload and download requests.

## Day-To-Day Commands

```bash
docker compose ps
docker compose logs -f api
docker compose up -d
docker compose down
docker compose run --rm api npx prisma migrate deploy
```

Use `docker compose down` to stop containers while preserving volumes. Do not
use `docker compose down -v` unless you intentionally want to delete the
database and stored encrypted payloads.

## Persistent Data

Do not delete these unless you are intentionally destroying the instance:

- `liminalis-postgres-data`: PostgreSQL data.
- `liminalis-storage`: encrypted upload parts and live-transfer relay objects.
- `.env`: deployment secrets and initial admin seed password.

The API, web, and admin containers can be rebuilt safely.
