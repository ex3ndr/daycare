#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${PACKAGE_DIR}/../.." && pwd)"
TASK_DIR="${PACKAGE_DIR}/examples/e2e-repo-task"
LOG_DIR="${REPO_ROOT}/.context/daycare-factory"
LOG_FILE="${LOG_DIR}/factory-e2e.log"
IMAGE_TAG="daycare-factory:e2e"

mkdir -p "${TASK_DIR}/out" "${LOG_DIR}"
rm -f "${LOG_FILE}"
rm -rf "${TASK_DIR}/out-host-check"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "[e2e] task dir: ${TASK_DIR}"
echo "[e2e] log file: ${LOG_FILE}"

if [[ ! -f "${HOME}/.pi/agent/auth.json" ]]; then
  echo "[e2e] missing required auth file: ${HOME}/.pi/agent/auth.json"
  exit 1
fi

echo "[e2e] building package"
cd "${REPO_ROOT}"
yarn workspace daycare-factory build

echo "[e2e] verifying internal command rejects on host"
set +e
node "${REPO_ROOT}/packages/daycare-factory/dist/main.js" \
  _factory-build-3f8d \
  --task "${TASK_DIR}/TASK.md" \
  --out "${TASK_DIR}/out-host-check"
HOST_INTERNAL_STATUS=$?
set -e
if [[ "${HOST_INTERNAL_STATUS}" -eq 0 ]]; then
  echo "[e2e] internal command unexpectedly succeeded on host"
  exit 1
fi

echo "[e2e] building docker image ${IMAGE_TAG}"
docker build -t "${IMAGE_TAG}" -f "packages/daycare-factory/Dockerfile" .

echo "[e2e] running host build command"
node "${REPO_ROOT}/packages/daycare-factory/dist/main.js" build "${TASK_DIR}"

echo "[e2e] verifying output files"
if [[ ! -f "${TASK_DIR}/out/result.txt" ]]; then
  echo "[e2e] missing output: ${TASK_DIR}/out/result.txt"
  exit 1
fi
if [[ ! -f "${TASK_DIR}/out/TASK.copy.md" ]]; then
  echo "[e2e] missing output: ${TASK_DIR}/out/TASK.copy.md"
  exit 1
fi

grep -q "built inside docker" "${TASK_DIR}/out/result.txt"
grep -q "# E2E Repo Task" "${TASK_DIR}/out/TASK.copy.md"

echo "[e2e] success"
echo "[e2e] output directory: ${TASK_DIR}/out"
echo "[e2e] complete"
