#!/usr/bin/env bash
set -euo pipefail

control_path=""
command=()

while (($# > 0)); do
    case "$1" in
        --control)
            if (($# < 2)); then
                echo "daycare-exec-supervisor: expected --control <path>" >&2
                exit 1
            fi
            control_path="$2"
            shift 2
            ;;
        --)
            shift
            command=("$@")
            break
            ;;
        *)
            echo "daycare-exec-supervisor: unexpected argument: $1" >&2
            exit 1
            ;;
    esac
done

if [[ -z "$control_path" ]]; then
    echo "daycare-exec-supervisor: expected --control <path>" >&2
    exit 1
fi

if ((${#command[@]} == 0)); then
    echo "daycare-exec-supervisor: expected command after --" >&2
    exit 1
fi

child_pid=""
listener_pid=""

cleanup() {
    if [[ -n "$listener_pid" ]]; then
        kill "$listener_pid" >/dev/null 2>&1 || true
    fi
    rm -f "$control_path"
}

process_tree_kill() {
    local target="$1"
    local signal="$2"
    local signal_name="${signal#SIG}"

    if [[ -z "$target" ]]; then
        return
    fi

    kill_tree() {
        local current="$1"
        local child=""

        while IFS= read -r child; do
            [[ -n "$child" ]] || continue
            kill_tree "$child"
        done < <(pgrep -P "$current" 2>/dev/null || true)

        kill "-${signal_name}" -- "-${current}" >/dev/null 2>&1 || true
        kill "-${signal_name}" "$current" >/dev/null 2>&1 || true
    }

    kill_tree "$target"
}

trap 'process_tree_kill "$child_pid" "SIGTERM"' TERM
trap 'process_tree_kill "$child_pid" "SIGINT"' INT
trap 'process_tree_kill "$child_pid" "SIGHUP"' HUP
trap cleanup EXIT

rm -f "$control_path"
mkfifo "$control_path"

setsid "${command[@]}" &
child_pid="$!"

control_loop() {
    local signal=""

    while true; do
        if ! IFS= read -r signal <"$control_path"; then
            break
        fi
        case "$signal" in
            SIGTERM|SIGINT|SIGHUP|SIGKILL)
                process_tree_kill "$child_pid" "$signal"
                ;;
        esac
    done
}

control_loop &
listener_pid="$!"

set +e
wait "$child_pid"
status="$?"
set -e

exit "$status"
