#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/check-deployment-artifacts.sh [options]

Options:
  --bundle FILE       Check a deploy bundle tarball.
  --api-image IMAGE   Check an API runtime image.
  -h, --help          Show this help.
EOF
}

BUNDLE=""
API_IMAGE=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --bundle)
      BUNDLE="${2:-}"
      shift
      ;;
    --api-image)
      API_IMAGE="${2:-}"
      shift
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

check_bundle() {
  local bundle="$1"
  local listing

  listing="$(tar -tzf "${bundle}")"
  if printf '%s\n' "${listing}" | grep -E '(^|/)(\.git|apps|audit|design|docs|node_modules)(/|$)|(^|/)(memory|now)(\.previous)?\.md$|(^|/)package(-lock)?\.json$' >/dev/null; then
    echo "Deploy bundle contains source or development files:" >&2
    printf '%s\n' "${listing}" | grep -E '(^|/)(\.git|apps|audit|design|docs|node_modules)(/|$)|(^|/)(memory|now)(\.previous)?\.md$|(^|/)package(-lock)?\.json$' >&2
    return 1
  fi

  echo "Bundle check passed: ${bundle}"
}

check_api_image() {
  local image="$1"

  docker run --rm --entrypoint sh "${image}" -lc '
    set -eu
    blocked="
      /app/apps/api/src
      /app/apps/api/test
      /app/audit
      /app/design
      /app/docs
      /app/.git
      /app/memory.md
      /app/now.md
      /app/node_modules/@playwright/test
      /app/node_modules/vitest
      /app/node_modules/eslint
      /app/node_modules/tsx
      /app/node_modules/vite
      /app/apps/api/node_modules/jest
      /app/apps/api/node_modules/eslint
      /app/apps/api/node_modules/tsx
      /app/apps/api/node_modules/vite
    "
    for path in ${blocked}; do
      if [ -e "${path}" ]; then
        echo "Unexpected runtime path: ${path}" >&2
        exit 1
      fi
    done
    test -f /app/apps/api/dist/main.js
    test -f /app/apps/api/dist/maintenance/seed.js
    test -d /app/apps/api/prisma/migrations
    test -d /app/apps/api/generated/prisma
  '

  echo "API image check passed: ${image}"
}

if [ -z "${BUNDLE}" ] && [ -z "${API_IMAGE}" ]; then
  usage >&2
  exit 1
fi

[ -n "${BUNDLE}" ] && check_bundle "${BUNDLE}"
[ -n "${API_IMAGE}" ] && check_api_image "${API_IMAGE}"

exit 0
