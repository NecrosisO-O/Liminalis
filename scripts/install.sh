#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${LIMINALIS_REPO_URL:-https://github.com/NecrosisO-O/Liminalis.git}"
REPO_REF="${LIMINALIS_REPO_REF:-main}"
INSTALL_DIR="${LIMINALIS_INSTALL_DIR:-}"
ASSUME_YES=0
DEPLOY_ARGS=()

usage() {
  cat <<'EOF'
Usage: install.sh [options] [-- deploy-options]

Options handled by install.sh:
  --install-dir DIR       Install or update Liminalis in DIR.
  --repo-url URL          Git repository URL.
  --ref REF               Git branch, tag, or commit to deploy.
  --yes                   Accept install defaults.
  -h, --help              Show this help.

All other options are passed to scripts/deploy.sh.

Example:
  curl -fsSL https://raw.githubusercontent.com/NecrosisO-O/Liminalis/main/scripts/install.sh | bash -s -- --local --web-port 5173 --admin-port 3001
EOF
}

log() {
  echo "[install] $*"
}

is_root() {
  [ "$(id -u)" -eq 0 ]
}

run_as_owner() {
  if is_root; then
    "$@"
  else
    "$@"
  fi
}

sudo_cmd() {
  if is_root; then
    "$@"
  else
    sudo "$@"
  fi
}

prompt_default() {
  local label="$1"
  local default="$2"
  local value

  if [ "${ASSUME_YES}" -eq 1 ]; then
    printf '%s' "${default}"
    return
  fi

  read -r -p "${label} [${default}]: " value
  printf '%s' "${value:-$default}"
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
      --yes)
        ASSUME_YES=1
        DEPLOY_ARGS+=("--yes")
        ;;
      -h | --help)
        usage
        exit 0
        ;;
      --)
        shift
        DEPLOY_ARGS+=("$@")
        break
        ;;
      *)
        DEPLOY_ARGS+=("$1")
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

install_packages() {
  local packages=()

  dpkg -s ca-certificates >/dev/null 2>&1 || packages+=("ca-certificates")
  command -v curl >/dev/null 2>&1 || packages+=("curl")
  command -v git >/dev/null 2>&1 || packages+=("git")
  command -v openssl >/dev/null 2>&1 || packages+=("openssl")
  command -v ss >/dev/null 2>&1 || packages+=("iproute2")

  if ! command -v docker >/dev/null 2>&1; then
    packages+=("docker.io")
  fi

  if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    packages+=("docker-compose")
  fi

  if [ "${#packages[@]}" -eq 0 ]; then
    log "Required packages are already installed."
    return
  fi

  log "Installing packages: ${packages[*]}"
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

clone_or_update_repo() {
  local parent_dir
  local use_sudo=0

  detect_install_dir
  INSTALL_DIR="$(prompt_default "Install directory" "${INSTALL_DIR}")"
  parent_dir="$(dirname "${INSTALL_DIR}")"

  if is_root || case "${INSTALL_DIR}" in "${HOME}"/*) true ;; *) false ;; esac; then
    use_sudo=0
  else
    use_sudo=1
  fi

  if [ "${use_sudo}" -eq 1 ]; then
    sudo_cmd mkdir -p "${parent_dir}"
  else
    mkdir -p "${parent_dir}"
  fi

  if [ ! -d "${INSTALL_DIR}" ]; then
    log "Cloning ${REPO_URL} into ${INSTALL_DIR}."
    if [ "${use_sudo}" -eq 1 ]; then
      sudo_cmd git clone "${REPO_URL}" "${INSTALL_DIR}"
    else
      run_as_owner git clone "${REPO_URL}" "${INSTALL_DIR}"
    fi
  elif [ ! -d "${INSTALL_DIR}/.git" ]; then
    echo "${INSTALL_DIR} exists but is not a git repository." >&2
    exit 1
  else
    log "Existing repository found at ${INSTALL_DIR}; fetching updates."
  fi

  cd "${INSTALL_DIR}"

  git fetch --tags origin
  git checkout "${REPO_REF}"

  if git symbolic-ref -q HEAD >/dev/null 2>&1; then
    git pull --ff-only origin "${REPO_REF}" || true
  fi

  chmod +x scripts/deploy.sh
}

main() {
  parse_args "$@"

  echo "Liminalis one-line installer"
  echo
  echo "This installer will install required packages, clone/update Liminalis,"
  echo "and start the Docker Compose deployment."
  echo

  require_supported_os
  ensure_privilege_tool
  install_packages
  ensure_docker_usable
  clone_or_update_repo

  log "Starting Liminalis deployment."
  ./scripts/deploy.sh "${DEPLOY_ARGS[@]}"
}

main "$@"
