#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  echo "Docker Compose is required. Install the Docker Compose plugin or docker-compose." >&2
  exit 1
}

random_secret() {
  openssl rand -base64 48 | tr -d '\n'
}

random_password() {
  openssl rand -hex 24
}

prompt_default() {
  local label="$1"
  local default="$2"
  local value
  read -r -p "${label} [${default}]: " value
  printf '%s' "${value:-$default}"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

write_env_file() {
  local app_url admin_url api_url web_port admin_port postgres_host_port postgres_password session_secret admin_password

  app_url="$(prompt_default "User site public URL" "http://localhost:8080")"
  admin_url="$(prompt_default "Admin site public URL" "http://localhost:8081")"
  api_url="$(prompt_default "API public URL" "${app_url}")"
  web_port="$(prompt_default "User site local port" "8080")"
  admin_port="$(prompt_default "Admin site local port" "8081")"
  postgres_host_port="$(prompt_default "PostgreSQL local bind address" "127.0.0.1:5432")"
  postgres_password="$(random_password)"
  session_secret="$(random_secret)"
  admin_password="$(random_password)"

  cat >"${ENV_FILE}" <<EOF
POSTGRES_USER=liminalis
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=liminalis
POSTGRES_HOST_PORT=${postgres_host_port}

DATABASE_URL=postgresql://liminalis:${postgres_password}@${postgres_host_port}/liminalis?schema=public

WEB_PORT=${web_port}
ADMIN_PORT=${admin_port}
API_PORT=3000

PUBLIC_APP_URL=${app_url}
PUBLIC_ADMIN_URL=${admin_url}
PUBLIC_API_URL=${api_url}

SESSION_SECRET=${session_secret}
PAIRING_CODE_LENGTH=6

SEED_ADMIN_USERNAME=owner
SEED_ADMIN_EMAIL=owner@liminalis.local
SEED_ADMIN_PASSWORD=${admin_password}

STORAGE_ROOT=.liminalis-storage
EOF

  chmod 600 "${ENV_FILE}"

  echo
  echo "Created .env with generated secrets."
  echo "Initial admin username: owner"
  echo "Initial admin password: ${admin_password}"
  echo "Store this password now. The script will not print it again."
  echo
}

wait_for_postgres() {
  for _ in $(seq 1 60); do
    if compose exec -T postgres pg_isready -U "${POSTGRES_USER:-liminalis}" -d "${POSTGRES_DB:-liminalis}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "PostgreSQL did not become ready in time." >&2
  return 1
}

wait_for_api() {
  for _ in $(seq 1 60); do
    if compose exec -T api node -e "fetch('http://127.0.0.1:3000/api/instance/public-settings').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "API did not become healthy in time." >&2
  return 1
}

main() {
  cd "${ROOT_DIR}"

  require_command docker
  require_command openssl

  if [ ! -f "${ENV_FILE}" ]; then
    write_env_file
  else
    echo ".env already exists; keeping existing secrets and settings."
  fi

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  echo "Building Liminalis containers..."
  compose build

  echo "Starting PostgreSQL..."
  compose up -d postgres

  echo "Waiting for PostgreSQL to become healthy..."
  wait_for_postgres

  echo "Applying database migrations..."
  compose run --rm api npx prisma migrate deploy

  if [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
    echo "Seeding initial admin and default policy..."
    compose run --rm \
      -e "SEED_ADMIN_USERNAME=${SEED_ADMIN_USERNAME:-owner}" \
      -e "SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL:-owner@liminalis.local}" \
      -e "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}" \
      api npx tsx prisma/seed.ts
  fi

  echo "Starting application services..."
  compose up -d

  echo "Checking API health..."
  wait_for_api

  echo
  echo "Liminalis is running."
  echo "User site:  ${PUBLIC_APP_URL}"
  echo "Admin site: ${PUBLIC_ADMIN_URL}"
  echo
  echo "Useful commands:"
  echo "  scripts/deploy.sh                 # rebuild/reapply migrations/start"
  echo "  docker compose ps                 # or docker-compose ps"
  echo "  docker compose logs -f api        # or docker-compose logs -f api"
}

main "$@"
