#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${PACKAGE_DIR}/../.." && pwd)"
TASKS_DIR="${PACKAGE_DIR}/examples/tasks"
ENVIRONMENTS_DIR="${PACKAGE_DIR}/environments"
BASH_TASK_DIR="${TASKS_DIR}/bash"
BASH_ENV_DIR="${ENVIRONMENTS_DIR}/bash"
TS_TASK_DIR="${TASKS_DIR}/typescript"
TS_ENV_DIR="${ENVIRONMENTS_DIR}/typescript"
LOG_DIR="${REPO_ROOT}/.context/daycare-factory"
LOG_FILE="${LOG_DIR}/factory-e2e.log"
IMAGE_TAG="daycare-factory:e2e"

mkdir -p "${BASH_TASK_DIR}/out" "${TS_TASK_DIR}/out" "${LOG_DIR}"
rm -f "${LOG_FILE}"
rm -rf "${BASH_TASK_DIR}/out-host-check"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "[e2e] bash task dir: ${BASH_TASK_DIR}"
echo "[e2e] typescript task dir: ${TS_TASK_DIR}"
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
  --task "${BASH_TASK_DIR}/TASK.md" \
  --template "${BASH_ENV_DIR}/template" \
  --out "${BASH_TASK_DIR}/out-host-check"
HOST_INTERNAL_STATUS=$?
set -e
if [[ "${HOST_INTERNAL_STATUS}" -eq 0 ]]; then
  echo "[e2e] internal command unexpectedly succeeded on host"
  exit 1
fi

echo "[e2e] building docker image ${IMAGE_TAG}"
docker build -t "${IMAGE_TAG}" -f "packages/daycare-factory/Dockerfile" .

run_sample() {
  local sample_name="$1"
  local task_dir="$2"
  local env_dir="$3"
  local expected_source="$4"
  local expected_value="$5"

  echo "[e2e] running sample: ${sample_name}"
  node "${REPO_ROOT}/packages/daycare-factory/dist/main.js" \
    build "${task_dir}" \
    --environment "${env_dir}"

  echo "[e2e] verifying outputs for: ${sample_name}"
  if [[ ! -f "${task_dir}/out/result.txt" ]]; then
    echo "[e2e] missing output: ${task_dir}/out/result.txt"
    exit 1
  fi
  if [[ ! -f "${task_dir}/out/TASK.md" ]]; then
    echo "[e2e] missing output: ${task_dir}/out/TASK.md"
    exit 1
  fi
  if [[ ! -f "${task_dir}/out/AGENTS.md" ]]; then
    echo "[e2e] missing output: ${task_dir}/out/AGENTS.md"
    exit 1
  fi
  if [[ ! -f "${task_dir}/out/${expected_source}" ]]; then
    echo "[e2e] missing output: ${task_dir}/out/${expected_source}"
    exit 1
  fi
  if [[ ! -f "${task_dir}/out/test-result.txt" ]]; then
    echo "[e2e] missing output: ${task_dir}/out/test-result.txt"
    exit 1
  fi
  if [[ ! -f "${task_dir}/out/build.jsonl" ]]; then
    echo "[e2e] missing output: ${task_dir}/out/build.jsonl"
    exit 1
  fi

  grep -q "${expected_value}" "${task_dir}/out/${expected_source}"
  grep -q '"type":"pi.event"' "${task_dir}/out/build.jsonl"
  grep -q '"type":"command.test"' "${task_dir}/out/build.jsonl"
}

run_sample "bash" "${BASH_TASK_DIR}" "${BASH_ENV_DIR}" "bash.sh" "bash-environment-ok"
run_sample "typescript" "${TS_TASK_DIR}" "${TS_ENV_DIR}" "sources/main.ts" "typescript-environment-ok"

echo "[e2e] success"
echo "[e2e] output directories: ${BASH_TASK_DIR}/out and ${TS_TASK_DIR}/out"
echo "[e2e] complete"
