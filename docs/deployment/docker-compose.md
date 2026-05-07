# Docker Compose Deployment

Docker Compose is the recommended v1 self-hosted deployment path for
Liminalis. It runs PostgreSQL, the API, the user site, and the admin site on one
host.

Production deployment uses prebuilt images and a clean deploy bundle. Source
checkout deployment remains available for development, auditing, and emergency
builds.

## Services

The production `compose.yml` or repository `docker-compose.yml` defines:

- `postgres`: PostgreSQL 16 with a persistent Docker volume.
- `api`: the NestJS API, Prisma client, migrations, and local disk storage
  driver.
- `web`: the user-facing React app served by Nginx.
- `admin`: the independent admin React app served by Nginx.

The `web` and `admin` containers proxy `/api/*` to the internal `api` service.
The API container is not published directly by default.

## One-Line Install

On a fresh Debian or Ubuntu host, run:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash
```

The installer will:

1. Install missing system dependencies.
2. Install Docker and Docker Compose if needed.
3. Ask for the install directory, deploy bundle version, and deploy bundle URL.
4. Download the clean deploy bundle into `/opt/liminalis` when running as root,
   or `$HOME/liminalis` otherwise.
5. Ask for deployment mode, public URLs, local ports, and PostgreSQL bind.
6. Call `scripts/deploy.sh` to create `.env`, pull images, run migrations, seed
   the initial admin user, and start services.

The installed production directory contains only deployment files, not the
source repository:

```text
compose.yml
.env
.env.example
README.md
VERSION
scripts/deploy.sh
scripts/install.sh
```

For unattended local testing on fixed ports:

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

For a specific release:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- --version v1.0.0
```

If you prefer to review the script first:

```bash
curl -fsSLO https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh
less install.sh
bash install.sh
```

## Production Bundle Deployment

If you already have a deploy bundle:

```bash
tar -xzf liminalis-deploy-v1.0.0.tar.gz
cd liminalis-deploy-v1.0.0
chmod +x scripts/deploy.sh
scripts/deploy.sh
```

The script will:

1. Create `.env` if it does not exist.
2. Generate a database password, session secret, and initial admin password.
3. Pull the configured API, web, and admin images.
4. Start PostgreSQL.
5. Apply Prisma migrations.
6. Seed the initial admin user and default policy bundles.
7. Start all services.
8. Run a basic API health check.

The initial admin credentials are printed only when `.env` is first created.
Store the generated password before closing the terminal.

If the images are already preloaded on the host, use
`scripts/deploy.sh --skip-pull` to start from local images without contacting
the registry.

## Source Checkout Deployment

From a source checkout, use source-build mode:

```bash
chmod +x scripts/deploy.sh
scripts/deploy.sh --source-build
```

This mode layers `docker-compose.source.yml` over `docker-compose.yml`, builds
local `liminalis-*:local` images, then runs the same migration, seed, and start
workflow. Use it for development and validation, not as the default production
path.

The one-line installer can also force source mode:

```bash
curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- --source --local
```

## Manual Production Deployment

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

Then pull, migrate, seed, and start:

```bash
docker compose -f compose.yml pull
docker compose -f compose.yml up -d postgres
docker compose -f compose.yml run --rm -T api npx prisma migrate deploy
set -a; source .env; set +a
docker compose -f compose.yml run --rm -T \
  -e "SEED_ADMIN_USERNAME=${SEED_ADMIN_USERNAME:-owner}" \
  -e "SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL:-owner@liminalis.local}" \
  -e "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}" \
  api node dist/maintenance/seed.js
docker compose -f compose.yml up -d
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

## Images

By default, production Compose uses:

```env
LIMINALIS_VERSION=latest
LIMINALIS_API_IMAGE=ghcr.io/necrosiso-o/liminalis-api
LIMINALIS_WEB_IMAGE=ghcr.io/necrosiso-o/liminalis-web
LIMINALIS_ADMIN_IMAGE=ghcr.io/necrosiso-o/liminalis-admin
```

Set `LIMINALIS_VERSION` to a release tag for pinned production deployments.

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
docker compose run --rm -T api npx prisma migrate deploy
```

Use `docker compose down` to stop containers while preserving volumes. Do not
use `docker compose down -v` unless you intentionally want to delete the
database and stored encrypted payloads.

## Persistent Data

Do not delete these unless you are intentionally destroying the instance:

- `liminalis-postgres-data`: PostgreSQL data.
- `liminalis-storage`: encrypted upload parts and live-transfer relay objects.
- `.env`: deployment secrets and initial admin seed password.

The API, web, and admin containers can be pulled, rebuilt, or recreated safely.
