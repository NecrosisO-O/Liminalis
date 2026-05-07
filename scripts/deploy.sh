#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

DEPLOY_MODE=""
APP_URL=""
ADMIN_URL=""
API_URL=""
WEB_PORT=""
ADMIN_PORT=""
POSTGRES_HOST_PORT=""
YES=0
RESET_DATA=0
RECONFIGURE=0
PRINT_PASSWORD=0
INITIAL_ADMIN_PASSWORD=""

usage() {
  cat <<'EOF'
Usage: scripts/deploy.sh [options]

Options:
  --local                 Use local testing defaults.
  --public                Use public-domain / reverse-proxy prompts.
  --app-url URL           User-site public URL.
  --admin-url URL         Admin-site public URL.
  --api-url URL           API public URL. Defaults to app URL.
  --web-port PORT         Local user-site port.
  --admin-port PORT       Local admin-site port.
  --postgres-bind HOST:PORT
                          Local PostgreSQL bind address.
  --yes                   Accept defaults for missing prompts.
  --reconfigure           Update URL and port settings in existing .env.
  --reset-data            Stop services and delete deployment volumes.
  -h, --help              Show this help.
EOF
}

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

read_prompt() {
  local prompt="$1"
  local value

  if [ -r /dev/tty ] && [ -w /dev/tty ]; then
    printf '%s' "${prompt}" >/dev/tty
    IFS= read -r value </dev/tty
  elif [ -t 0 ]; then
    printf '%s' "${prompt}" >&2
    IFS= read -r value
  else
    echo "Interactive input requires a TTY. Re-run with explicit options or --yes." >&2
    exit 1
  fi

  printf '%s' "${value}"
}

prompt_default() {
  local label="$1"
  local default="$2"
  local value

  if [ "${YES}" -eq 1 ]; then
    printf '%s' "${default}"
    return
  fi

  value="$(read_prompt "${label} [${default}]: ")"
  printf '%s' "${value:-$default}"
}

prompt_required() {
  local label="$1"
  local value=""

  if [ "${YES}" -eq 1 ]; then
    echo "Missing required option: ${label}" >&2
    exit 1
  fi

  while [ -z "${value}" ]; do
    value="$(read_prompt "${label}: ")"
  done

  printf '%s' "${value}"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --local)
        DEPLOY_MODE="local"
        ;;
      --public)
        DEPLOY_MODE="public"
        ;;
      --app-url)
        APP_URL="${2:-}"
        shift
        ;;
      --admin-url)
        ADMIN_URL="${2:-}"
        shift
        ;;
      --api-url)
        API_URL="${2:-}"
        shift
        ;;
      --web-port)
        WEB_PORT="${2:-}"
        shift
        ;;
      --admin-port)
        ADMIN_PORT="${2:-}"
        shift
        ;;
      --postgres-bind)
        POSTGRES_HOST_PORT="${2:-}"
        shift
        ;;
      --yes)
        YES=1
        ;;
      --reconfigure)
        RECONFIGURE=1
        ;;
      --reset-data)
        RESET_DATA=1
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      *)
        echo "Unknown option: $1" >&2
        usage >&2
        exit 1
        ;;
    esac
    shift
  done
}

choose_mode() {
  local choice

  if [ -n "${DEPLOY_MODE}" ]; then
    return
  fi

  if [ "${YES}" -eq 1 ]; then
    DEPLOY_MODE="public"
    return
  fi

  echo "Deployment mode:"
  echo "  1. Public domain / reverse proxy"
  echo "  2. Local testing"
  choice="$(read_prompt "Choose [1]: ")"

  case "${choice:-1}" in
    1)
      DEPLOY_MODE="public"
      ;;
    2)
      DEPLOY_MODE="local"
      ;;
    *)
      echo "Invalid deployment mode: ${choice}" >&2
      exit 1
      ;;
  esac
}

port_from_bind() {
  local bind="$1"
  printf '%s' "${bind##*:}"
}

is_port_in_use() {
  local port="$1"
  ss -ltn 2>/dev/null | awk '{print $4}' | grep -Eq "[:.]${port}$"
}

ensure_port_available() {
  local label="$1"
  local port="$2"

  if ! command -v ss >/dev/null 2>&1; then
    return
  fi

  if ! is_port_in_use "${port}"; then
    return
  fi

  if [ "${YES}" -eq 1 ]; then
    echo "${label} port ${port} is already in use." >&2
    exit 1
  fi

  echo
  echo "${label} port ${port} is already in use."
  echo "Choose another port, or press Enter to continue anyway."
  local replacement
  replacement="$(read_prompt "New ${label} port: ")"
  if [ -n "${replacement}" ]; then
    case "${label}" in
      "User site")
        WEB_PORT="${replacement}"
        ;;
      "Admin site")
        ADMIN_PORT="${replacement}"
        ;;
      "PostgreSQL")
        POSTGRES_HOST_PORT="127.0.0.1:${replacement}"
        ;;
    esac
  fi
}

load_env_if_present() {
  if [ -f "${ENV_FILE}" ]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
  fi
}

write_env_file() {
  local postgres_user postgres_db postgres_password session_secret admin_username admin_email

  choose_mode

  if [ "${DEPLOY_MODE}" = "local" ]; then
    WEB_PORT="${WEB_PORT:-$(prompt_default "User site local port" "5173")}"
    ADMIN_PORT="${ADMIN_PORT:-$(prompt_default "Admin site local port" "3001")}"
    ensure_port_available "User site" "${WEB_PORT}"
    ensure_port_available "Admin site" "${ADMIN_PORT}"
    APP_URL="${APP_URL:-$(prompt_default "User site URL" "http://127.0.0.1:${WEB_PORT}")}"
    ADMIN_URL="${ADMIN_URL:-$(prompt_default "Admin site URL" "http://127.0.0.1:${ADMIN_PORT}")}"
    API_URL="${API_URL:-$(prompt_default "API public URL" "${APP_URL}")}"
    POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-$(prompt_default "PostgreSQL local bind address" "127.0.0.1:5432")}"
  else
    APP_URL="${APP_URL:-$(prompt_required "User site public URL, e.g. https://app.example.com")}"
    ADMIN_URL="${ADMIN_URL:-$(prompt_required "Admin site public URL, e.g. https://admin.example.com")}"
    API_URL="${API_URL:-$(prompt_default "API public URL" "${APP_URL}")}"
    WEB_PORT="${WEB_PORT:-$(prompt_default "User site local port" "8080")}"
    ADMIN_PORT="${ADMIN_PORT:-$(prompt_default "Admin site local port" "8081")}"
    POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-$(prompt_default "PostgreSQL local bind address" "127.0.0.1:5432")}"
  fi

  ensure_port_available "PostgreSQL" "$(port_from_bind "${POSTGRES_HOST_PORT}")"

  postgres_user="liminalis"
  postgres_db="liminalis"
  postgres_password="$(random_password)"
  session_secret="$(random_secret)"
  admin_username="owner"
  admin_email="owner@liminalis.local"
  INITIAL_ADMIN_PASSWORD="$(random_password)"
  PRINT_PASSWORD=1

  cat >"${ENV_FILE}" <<EOF
POSTGRES_USER=${postgres_user}
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=${postgres_db}
POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT}

DATABASE_URL=postgresql://${postgres_user}:${postgres_password}@${POSTGRES_HOST_PORT}/${postgres_db}?schema=public

WEB_PORT=${WEB_PORT}
ADMIN_PORT=${ADMIN_PORT}
API_PORT=3000

PUBLIC_APP_URL=${APP_URL}
PUBLIC_ADMIN_URL=${ADMIN_URL}
PUBLIC_API_URL=${API_URL}

SESSION_SECRET=${session_secret}
PAIRING_CODE_LENGTH=6

SEED_ADMIN_USERNAME=${admin_username}
SEED_ADMIN_EMAIL=${admin_email}
SEED_ADMIN_PASSWORD=${INITIAL_ADMIN_PASSWORD}

STORAGE_ROOT=.liminalis-storage
EOF

  chmod 600 "${ENV_FILE}"
  echo "Created .env with generated secrets."
}

update_env_assignment() {
  local key="$1"
  local value="$2"
  local tmp_file="${ENV_FILE}.tmp.$$"
  local found=0

  while IFS= read -r line || [ -n "${line}" ]; do
    case "${line}" in
      "${key}="*)
        printf '%s=%s\n' "${key}" "${value}" >>"${tmp_file}"
        found=1
        ;;
      *)
        printf '%s\n' "${line}" >>"${tmp_file}"
        ;;
    esac
  done <"${ENV_FILE}"

  if [ "${found}" -eq 0 ]; then
    printf '%s=%s\n' "${key}" "${value}" >>"${ENV_FILE}"
    rm -f "${tmp_file}"
    return
  fi

  mv "${tmp_file}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
}

reconfigure_env_file() {
  load_env_if_present
  choose_mode

  if [ "${DEPLOY_MODE}" = "local" ]; then
    WEB_PORT="${WEB_PORT:-$(prompt_default "User site local port" "${WEB_PORT:-5173}")}"
    ADMIN_PORT="${ADMIN_PORT:-$(prompt_default "Admin site local port" "${ADMIN_PORT:-3001}")}"
    ensure_port_available "User site" "${WEB_PORT}"
    ensure_port_available "Admin site" "${ADMIN_PORT}"
    APP_URL="${APP_URL:-$(prompt_default "User site URL" "${PUBLIC_APP_URL:-http://127.0.0.1:${WEB_PORT}}")}"
    ADMIN_URL="${ADMIN_URL:-$(prompt_default "Admin site URL" "${PUBLIC_ADMIN_URL:-http://127.0.0.1:${ADMIN_PORT}}")}"
    API_URL="${API_URL:-$(prompt_default "API public URL" "${PUBLIC_API_URL:-${APP_URL}}")}"
    POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-$(prompt_default "PostgreSQL local bind address" "${POSTGRES_HOST_PORT:-127.0.0.1:5432}")}"
  else
    APP_URL="${APP_URL:-$(prompt_default "User site public URL" "${PUBLIC_APP_URL:-https://app.example.com}")}"
    ADMIN_URL="${ADMIN_URL:-$(prompt_default "Admin site public URL" "${PUBLIC_ADMIN_URL:-https://admin.example.com}")}"
    API_URL="${API_URL:-$(prompt_default "API public URL" "${PUBLIC_API_URL:-${APP_URL}}")}"
    WEB_PORT="${WEB_PORT:-$(prompt_default "User site local port" "${WEB_PORT:-8080}")}"
    ADMIN_PORT="${ADMIN_PORT:-$(prompt_default "Admin site local port" "${ADMIN_PORT:-8081}")}"
    POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-$(prompt_default "PostgreSQL local bind address" "${POSTGRES_HOST_PORT:-127.0.0.1:5432}")}"
  fi

  ensure_port_available "PostgreSQL" "$(port_from_bind "${POSTGRES_HOST_PORT}")"

  update_env_assignment "WEB_PORT" "${WEB_PORT}"
  update_env_assignment "ADMIN_PORT" "${ADMIN_PORT}"
  update_env_assignment "PUBLIC_APP_URL" "${APP_URL}"
  update_env_assignment "PUBLIC_ADMIN_URL" "${ADMIN_URL}"
  update_env_assignment "PUBLIC_API_URL" "${API_URL}"
  update_env_assignment "POSTGRES_HOST_PORT" "${POSTGRES_HOST_PORT}"

  if [ -n "${POSTGRES_USER:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && [ -n "${POSTGRES_DB:-}" ]; then
    update_env_assignment "DATABASE_URL" "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST_PORT}/${POSTGRES_DB}?schema=public"
  fi

  echo "Updated URL and port settings in .env."
}

confirm_reset_data() {
  local confirmation

  if [ "${YES}" -eq 1 ]; then
    return
  fi

  echo
  echo "This will stop Liminalis and delete PostgreSQL/storage Docker volumes."
  confirmation="$(read_prompt "Type RESET to continue: ")"
  if [ "${confirmation}" != "RESET" ]; then
    echo "Reset cancelled."
    exit 0
  fi
}

reset_data() {
  confirm_reset_data
  compose down -v
  echo "Deployment containers, network, and volumes have been removed."
}

existing_env_menu() {
  local choice

  if [ "${RECONFIGURE}" -eq 1 ] || [ "${RESET_DATA}" -eq 1 ] || [ "${YES}" -eq 1 ]; then
    return
  fi

  echo
  echo "Existing .env found."
  echo "  1. Start / update existing deployment"
  echo "  2. Reconfigure ports and public URLs"
  echo "  3. Reset deployment data"
  echo "  4. Exit"
  choice="$(read_prompt "Choose [1]: ")"

  case "${choice:-1}" in
    1)
      ;;
    2)
      RECONFIGURE=1
      ;;
    3)
      RESET_DATA=1
      ;;
    4)
      exit 0
      ;;
    *)
      echo "Invalid choice: ${choice}" >&2
      exit 1
      ;;
  esac
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

run_deploy() {
  echo
  echo "[1/7] Building containers"
  compose build

  echo
  echo "[2/7] Starting PostgreSQL"
  compose up -d postgres

  echo
  echo "[3/7] Waiting for PostgreSQL"
  wait_for_postgres

  echo
  echo "[4/7] Applying database migrations"
  compose run --rm -T api npx prisma migrate deploy

  if [ -n "${SEED_ADMIN_PASSWORD:-}" ]; then
    echo
    echo "[5/7] Seeding initial admin and default policy"
    compose run --rm -T \
      -e "SEED_ADMIN_USERNAME=${SEED_ADMIN_USERNAME:-owner}" \
      -e "SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL:-owner@liminalis.local}" \
      -e "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}" \
      api npx tsx prisma/seed.ts
  else
    echo
    echo "[5/7] Skipping seed; SEED_ADMIN_PASSWORD is not set"
  fi

  echo
  echo "[6/7] Starting application services"
  compose up -d

  echo
  echo "[7/7] Checking API health"
  wait_for_api
}

print_summary() {
  echo
  echo "Liminalis is running."
  echo "User site:  ${PUBLIC_APP_URL}"
  echo "Admin site: ${PUBLIC_ADMIN_URL}"

  if [ "${PRINT_PASSWORD}" -eq 1 ]; then
    echo
    echo "Initial admin username: ${SEED_ADMIN_USERNAME:-owner}"
    echo "Initial admin password: ${INITIAL_ADMIN_PASSWORD}"
    echo "Store this password now. The script will not print it again."
  fi

  echo
  echo "Useful commands:"
  echo "  scripts/deploy.sh                 # rebuild/reapply migrations/start"
  echo "  docker compose ps                 # or docker-compose ps"
  echo "  docker compose logs -f api        # or docker-compose logs -f api"
}

main() {
  parse_args "$@"
  cd "${ROOT_DIR}"

  echo "Liminalis self-hosted deployment"
  echo
  echo "This script will create or update a Docker Compose deployment."
  echo "Existing .env secrets are not overwritten unless you delete .env."
  echo

  require_command docker
  require_command openssl

  if [ "${RESET_DATA}" -eq 1 ]; then
    reset_data
    exit 0
  fi

  if [ ! -f "${ENV_FILE}" ]; then
    write_env_file
  else
    existing_env_menu
    if [ "${RESET_DATA}" -eq 1 ]; then
      reset_data
      exit 0
    fi
    if [ "${RECONFIGURE}" -eq 1 ]; then
      reconfigure_env_file
    else
      echo ".env already exists; keeping existing secrets and settings."
    fi
  fi

  load_env_if_present
  run_deploy
  print_summary
}

main "$@"
