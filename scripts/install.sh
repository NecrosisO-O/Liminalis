#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${LIMINALIS_REPO_URL:-https://github.com/NecrosisO-O/Liminalis.git}"
REPO_REF="${LIMINALIS_REPO_REF:-main}"
INSTALL_DIR="${LIMINALIS_INSTALL_DIR:-}"

ASSUME_YES=0
DEPLOY_MODE=""
APP_URL=""
ADMIN_URL=""
API_URL=""
WEB_PORT=""
ADMIN_PORT=""
POSTGRES_HOST_PORT=""
RECONFIGURE=0
RESET_DATA=0
EXTRA_DEPLOY_ARGS=()
DEPLOY_ARGS=()

usage() {
  cat <<'EOF'
Usage: install.sh [options]

Options handled by install.sh:
  --install-dir DIR       Install or update Liminalis in DIR.
  --repo-url URL          Git repository URL.
  --ref REF               Git branch, tag, or commit to deploy.
  --local                 Use local testing deployment defaults.
  --public                Use public-domain / reverse-proxy deployment defaults.
  --app-url URL           User-site public URL.
  --admin-url URL         Admin-site public URL.
  --api-url URL           API public URL. Defaults to app URL.
  --web-port PORT         Local user-site port.
  --admin-port PORT       Local admin-site port.
  --postgres-bind HOST:PORT
                          Local PostgreSQL bind address.
  --reconfigure           Update URL and port settings in existing .env.
  --reset-data            Stop services and delete deployment volumes.
  --yes                   Accept defaults for missing prompts.
  -h, --help              Show this help.

Unknown options are passed through to scripts/deploy.sh.

Examples:
  curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash
  curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- --local --yes --web-port 5173 --admin-port 3001
EOF
}

log() {
  echo "[install] $*"
}

is_root() {
  [ "$(id -u)" -eq 0 ]
}

sudo_cmd() {
  if is_root; then
    "$@"
  else
    sudo "$@"
  fi
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

  if [ "${ASSUME_YES}" -eq 1 ]; then
    printf '%s' "${default}"
    return
  fi

  value="$(read_prompt "${label} [${default}]: ")"
  printf '%s' "${value:-$default}"
}

prompt_required() {
  local label="$1"
  local value=""

  if [ "${ASSUME_YES}" -eq 1 ]; then
    echo "Missing required option: ${label}" >&2
    exit 1
  fi

  while [ -z "${value}" ]; do
    value="$(read_prompt "${label}: ")"
  done

  printf '%s' "${value}"
}

detect_install_dir() {
  if [ -n "${INSTALL_DIR}" ]; then
    return
  fi

  if is_root; then
    INSTALL_DIR="/opt/liminalis"
  else
    INSTALL_DIR="${HOME}/liminalis"
  fi
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --install-dir)
        INSTALL_DIR="${2:-}"
        shift
        ;;
      --repo-url)
        REPO_URL="${2:-}"
        shift
        ;;
      --ref)
        REPO_REF="${2:-}"
        shift
        ;;
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
      --reconfigure)
        RECONFIGURE=1
        ;;
      --reset-data)
        RESET_DATA=1
        ;;
      --yes)
        ASSUME_YES=1
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      --)
        shift
        EXTRA_DEPLOY_ARGS+=("$@")
        break
        ;;
      *)
        EXTRA_DEPLOY_ARGS+=("$1")
        ;;
    esac
    shift
  done
}

require_supported_os() {
  if [ ! -f /etc/os-release ]; then
    echo "This installer currently supports Debian/Ubuntu style systems." >&2
    exit 1
  fi

  # shellcheck disable=SC1091
  . /etc/os-release

  case "${ID:-}" in
    debian | ubuntu)
      ;;
    *)
      case " ${ID_LIKE:-} " in
        *" debian "*)
          ;;
        *)
          echo "Unsupported OS: ${PRETTY_NAME:-unknown}" >&2
          echo "This installer currently supports Debian/Ubuntu style systems." >&2
          exit 1
          ;;
      esac
      ;;
  esac
}

ensure_privilege_tool() {
  if is_root; then
    return
  fi

  if ! command -v sudo >/dev/null 2>&1; then
    echo "sudo is required when not running as root." >&2
    exit 1
  fi
}

configure_install_source() {
  detect_install_dir

  INSTALL_DIR="$(prompt_default "Install directory" "${INSTALL_DIR}")"
  REPO_URL="$(prompt_default "Repository URL" "${REPO_URL}")"
  REPO_REF="$(prompt_default "Git branch, tag, or commit" "${REPO_REF}")"
}

install_packages() {
  local packages=()
  local has_compose=0
  local confirmation

  dpkg -s ca-certificates >/dev/null 2>&1 || packages+=("ca-certificates")
  command -v curl >/dev/null 2>&1 || packages+=("curl")
  command -v git >/dev/null 2>&1 || packages+=("git")
  command -v openssl >/dev/null 2>&1 || packages+=("openssl")
  command -v ss >/dev/null 2>&1 || packages+=("iproute2")

  if ! command -v docker >/dev/null 2>&1; then
    packages+=("docker.io")
  elif docker compose version >/dev/null 2>&1; then
    has_compose=1
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    has_compose=1
  fi

  if [ "${has_compose}" -eq 0 ]; then
    packages+=("docker-compose")
  fi

  if [ "${#packages[@]}" -eq 0 ]; then
    log "Required packages are already installed."
    return
  fi

  log "Installing packages: ${packages[*]}"

  if [ "${ASSUME_YES}" -ne 1 ]; then
    confirmation="$(prompt_default "Install these packages now?" "yes")"
    case "${confirmation}" in
      y | Y | yes | YES | Yes)
        ;;
      *)
        echo "Package installation cancelled." >&2
        exit 1
        ;;
    esac
  fi

  sudo_cmd apt-get update
  sudo_cmd env DEBIAN_FRONTEND=noninteractive apt-get install -y "${packages[@]}"
}

ensure_docker_usable() {
  if ! docker info >/dev/null 2>&1; then
    if is_root; then
      log "Starting Docker service."
      if command -v systemctl >/dev/null 2>&1; then
        systemctl enable --now docker >/dev/null 2>&1 || true
      else
        service docker start >/dev/null 2>&1 || true
      fi
    else
      echo "Docker is installed but not usable by the current user." >&2
      echo "Run this installer with sudo/root, or add the user to the docker group and re-login." >&2
      exit 1
    fi
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is not available." >&2
    exit 1
  fi
}

repo_cmd() {
  if [ "${REPO_NEEDS_SUDO:-0}" -eq 1 ]; then
    sudo_cmd "$@"
  else
    "$@"
  fi
}

clone_or_update_repo() {
  local parent_dir
  REPO_NEEDS_SUDO=0

  parent_dir="$(dirname "${INSTALL_DIR}")"

  if ! is_root; then
    case "${INSTALL_DIR}" in
      "${HOME}" | "${HOME}"/*)
        REPO_NEEDS_SUDO=0
        ;;
      *)
        REPO_NEEDS_SUDO=1
        ;;
    esac
  fi

  repo_cmd mkdir -p "${parent_dir}"

  if [ ! -d "${INSTALL_DIR}" ]; then
    log "Cloning ${REPO_URL} into ${INSTALL_DIR}."
    repo_cmd git clone "${REPO_URL}" "${INSTALL_DIR}"
  elif [ ! -d "${INSTALL_DIR}/.git" ]; then
    echo "${INSTALL_DIR} exists but is not a git repository." >&2
    exit 1
  else
    log "Existing repository found at ${INSTALL_DIR}; fetching updates."
  fi

  repo_cmd git -C "${INSTALL_DIR}" fetch --tags origin
  repo_cmd git -C "${INSTALL_DIR}" checkout "${REPO_REF}"

  if repo_cmd git -C "${INSTALL_DIR}" symbolic-ref -q HEAD >/dev/null 2>&1; then
    repo_cmd git -C "${INSTALL_DIR}" pull --ff-only origin "${REPO_REF}" || true
  fi

  repo_cmd chmod +x "${INSTALL_DIR}/scripts/deploy.sh"
}

choose_existing_action() {
  local choice

  if [ ! -f "${INSTALL_DIR}/.env" ]; then
    return
  fi

  if [ "${RECONFIGURE}" -eq 1 ] || [ "${RESET_DATA}" -eq 1 ] || [ "${ASSUME_YES}" -eq 1 ]; then
    return
  fi

  echo
  echo "Existing Liminalis deployment found in ${INSTALL_DIR}."
  echo "  1. Update and restart"
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

confirm_reset_data() {
  local confirmation

  if [ "${ASSUME_YES}" -eq 1 ]; then
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

choose_deployment_mode() {
  local choice

  if [ -n "${DEPLOY_MODE}" ]; then
    return
  fi

  if [ "${ASSUME_YES}" -eq 1 ]; then
    echo "Missing deployment mode. Pass --local or --public when using --yes." >&2
    exit 1
  fi

  echo
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

collect_deploy_config() {
  if [ "${RESET_DATA}" -eq 1 ]; then
    confirm_reset_data
    return
  fi

  if [ -f "${INSTALL_DIR}/.env" ] && [ "${RECONFIGURE}" -eq 0 ]; then
    return
  fi

  choose_deployment_mode

  if [ "${DEPLOY_MODE}" = "local" ]; then
    WEB_PORT="${WEB_PORT:-$(prompt_default "User site local port" "5173")}"
    ADMIN_PORT="${ADMIN_PORT:-$(prompt_default "Admin site local port" "3001")}"
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
}

build_deploy_args() {
  DEPLOY_ARGS=()

  if [ "${RESET_DATA}" -eq 1 ]; then
    DEPLOY_ARGS+=("--reset-data" "--yes")
    DEPLOY_ARGS+=("${EXTRA_DEPLOY_ARGS[@]}")
    return
  fi

  if [ "${RECONFIGURE}" -eq 1 ]; then
    DEPLOY_ARGS+=("--reconfigure")
  fi

  if [ -n "${DEPLOY_MODE}" ]; then
    DEPLOY_ARGS+=("--${DEPLOY_MODE}")
  fi

  [ -n "${APP_URL}" ] && DEPLOY_ARGS+=("--app-url" "${APP_URL}")
  [ -n "${ADMIN_URL}" ] && DEPLOY_ARGS+=("--admin-url" "${ADMIN_URL}")
  [ -n "${API_URL}" ] && DEPLOY_ARGS+=("--api-url" "${API_URL}")
  [ -n "${WEB_PORT}" ] && DEPLOY_ARGS+=("--web-port" "${WEB_PORT}")
  [ -n "${ADMIN_PORT}" ] && DEPLOY_ARGS+=("--admin-port" "${ADMIN_PORT}")
  [ -n "${POSTGRES_HOST_PORT}" ] && DEPLOY_ARGS+=("--postgres-bind" "${POSTGRES_HOST_PORT}")

  DEPLOY_ARGS+=("--yes")
  DEPLOY_ARGS+=("${EXTRA_DEPLOY_ARGS[@]}")
}

main() {
  parse_args "$@"

  echo "Liminalis one-line installer"
  echo
  echo "This installer will install required packages, clone/update Liminalis,"
  echo "collect deployment settings, and start the Docker Compose deployment."
  echo

  require_supported_os
  ensure_privilege_tool
  configure_install_source
  install_packages
  ensure_docker_usable
  clone_or_update_repo
  choose_existing_action
  collect_deploy_config
  build_deploy_args

  log "Starting Liminalis deployment."
  cd "${INSTALL_DIR}"
  ./scripts/deploy.sh "${DEPLOY_ARGS[@]}"
}

main "$@"
