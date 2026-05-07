#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${LIMINALIS_VERSION:-}"
OUT_DIR="${ROOT_DIR}/dist/deploy"

if [ -z "${VERSION}" ]; then
  VERSION="$(git -C "${ROOT_DIR}" describe --tags --always --dirty 2>/dev/null || echo "dev")"
fi

BUNDLE_NAME="liminalis-deploy-${VERSION}.tar.gz"
STAGING_DIR="${OUT_DIR}/liminalis-deploy-${VERSION}"

rm -rf "${STAGING_DIR}"
mkdir -p "${STAGING_DIR}/scripts"

cp "${ROOT_DIR}/docker-compose.yml" "${STAGING_DIR}/compose.yml"
cp "${ROOT_DIR}/.env.example" "${STAGING_DIR}/.env.example"
cp "${ROOT_DIR}/scripts/deploy.sh" "${STAGING_DIR}/scripts/deploy.sh"
cp "${ROOT_DIR}/scripts/install.sh" "${STAGING_DIR}/scripts/install.sh"
cp "${ROOT_DIR}/docs/deployment/docker-compose.md" "${STAGING_DIR}/README.md"
printf '%s\n' "${VERSION}" >"${STAGING_DIR}/VERSION"

chmod +x "${STAGING_DIR}/scripts/deploy.sh" "${STAGING_DIR}/scripts/install.sh"

tar -C "${OUT_DIR}" -czf "${OUT_DIR}/${BUNDLE_NAME}" "liminalis-deploy-${VERSION}"

echo "${OUT_DIR}/${BUNDLE_NAME}"
