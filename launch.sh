#!/usr/bin/env bash
set -euo pipefail

COMMAND="${1:-dev}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_VENV="$BACKEND_DIR/.venv"
DEV_STATE_DIR="$ROOT_DIR/.devserver"
PID_DIR="$DEV_STATE_DIR/pids"
LOG_DIR="$DEV_STATE_DIR/logs"

PYTHON_CMD=()
BACKEND_PYTHON=""

error() {
  echo "[ERROR] $1" >&2
}

info() {
  echo "[INFO] $1"
}

usage() {
  cat <<'USAGE'
Usage: ./launch.sh [command]

Commands:
  dev|run|foreground   Start backend and frontend in the foreground (default)
  up|start|background  Start backend and frontend in the background and return the shell
  down|stop            Stop background services
  restart              Restart background services
  status               Show background service status
  logs [service]       Tail logs for backend, frontend, or both (default)

Examples:
  ./launch.sh up          # start both services in the background
  ./launch.sh logs        # follow combined logs from background services
  ./launch.sh down        # stop background services
  ./launch.sh             # run both services in the foreground (original behaviour)
USAGE
}

check_command() {
  local cmd="$1"
  local package_name="${2:-$1}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    error "Missing required command '$cmd'. Please install $package_name before continuing."
    exit 1
  fi
}

detect_python() {
  local candidate
  for candidate in "python3" "python" "py -3" "py"; do
    case "$candidate" in
    *" "*)
      local cmd="${candidate%% *}"
      local args="${candidate#* }"
      if command -v "$cmd" >/dev/null 2>&1; then
        if "$cmd" $args -c "import sys" >/dev/null 2>&1; then
          echo "$cmd $args"
          return 0
        fi
      fi
      ;;
    *)
      if command -v "$candidate" >/dev/null 2>&1; then
        if "$candidate" -c "import sys" >/dev/null 2>&1; then
          echo "$candidate"
          return 0
        fi
      fi
      ;;
    esac
  done

  return 1
}

load_env_if_present() {
  local env_file="$1"
  if [ -f "$env_file" ]; then
    info "Loading environment variables from $env_file"
    # shellcheck disable=SC1090
    set -a
    source "$env_file"
    set +a
  else
    info "No environment file found at $env_file (skipping)."
    if [ -f "$env_file.example" ]; then
      info "Consider copying $env_file.example to $env_file and updating the values."
    fi
  fi
}

ensure_prerequisites() {
  if [ "${#PYTHON_CMD[@]}" -eq 0 ]; then
    read -r -a PYTHON_CMD <<<"$(detect_python || true)"
  fi

  if [ "${#PYTHON_CMD[@]}" -eq 0 ]; then
    error "Python 3 executable not found. Install Python 3 and ensure it is on your PATH."
    exit 1
  fi

  local python_display="${PYTHON_CMD[*]}"

  if ! "${PYTHON_CMD[@]}" -m pip --version >/dev/null 2>&1; then
    error "pip for Python 3 is not available. Install pip (usually via '$python_display -m ensurepip --upgrade' or your package manager)."
    exit 1
  fi

  check_command node "Node.js"
  check_command npm "npm (Node Package Manager)"

  load_env_if_present "$ROOT_DIR/.env"

  if [ ! -x "$BACKEND_VENV/bin/python" ] && [ ! -x "$BACKEND_VENV/Scripts/python.exe" ]; then
    info "Creating Python virtual environment for backend at $BACKEND_VENV"
    "${PYTHON_CMD[@]}" -m venv "$BACKEND_VENV"
  fi

  if [ -x "$BACKEND_VENV/bin/python" ]; then
    BACKEND_PYTHON="$BACKEND_VENV/bin/python"
  elif [ -x "$BACKEND_VENV/Scripts/python.exe" ]; then
    BACKEND_PYTHON="$BACKEND_VENV/Scripts/python.exe"
  else
    error "Unable to locate the Python interpreter inside the virtual environment at $BACKEND_VENV."
    exit 1
  fi

  info "Installing backend dependencies..."
  "$BACKEND_PYTHON" -m pip install -r "$BACKEND_DIR/requirements.txt"

  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    info "Installing frontend dependencies (this may take a moment)..."
    (cd "$FRONTEND_DIR" && npm install)
  else
    info "Frontend dependencies already installed."
  fi
}

ensure_state_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
}

is_pid_running() {
  local pid="$1"
  if [ -z "${pid:-}" ]; then
    return 1
  fi
  if kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

stop_pid() {
  local pid="$1"
  local name="$2"

  if ! is_pid_running "$pid"; then
    return
  fi

  info "Stopping $name (PID $pid)..."
  if ! kill "$pid" >/dev/null 2>&1; then
    error "Failed to send termination signal to $name (PID $pid)."
    return
  fi

  for _ in {1..50}; do
    if ! is_pid_running "$pid"; then
      break
    fi
    sleep 0.1
  done

  if is_pid_running "$pid"; then
    info "$name did not terminate gracefully; sending SIGKILL."
    kill -9 "$pid" >/dev/null 2>&1 || true
  fi
}

start_backend_foreground() {
  (
    cd "$BACKEND_DIR"
    load_env_if_present "$BACKEND_DIR/.env"
    exec "$BACKEND_PYTHON" -m uvicorn app.main:app --reload
  ) &
  local pid=$!
  PIDS+=("$pid")
  info "Backend server started (PID $pid)."
}

start_frontend_foreground() {
  (
    cd "$FRONTEND_DIR"
    load_env_if_present "$FRONTEND_DIR/.env"
    exec npm run dev
  ) &
  local pid=$!
  PIDS+=("$pid")
  info "Frontend server started (PID $pid)."
}

cleanup_foreground() {
  if [ "${CLEANED_UP:-0}" -eq 1 ]; then
    return
  fi
  CLEANED_UP=1
  echo
  info "Shutting down services..."
  for pid in "${PIDS[@]:-}"; do
    if [ -n "${pid:-}" ] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  for pid in "${PIDS[@]:-}"; do
    if [ -n "${pid:-}" ]; then
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
  info "All services stopped."
}

run_foreground() {
  PIDS=()
  CLEANED_UP=0
  trap 'cleanup_foreground; exit 0' INT TERM
  trap cleanup_foreground EXIT

  start_backend_foreground
  start_frontend_foreground

  info "Both services are running. Press Ctrl+C to stop."

  if help wait 2>/dev/null | grep -q -- "-n"; then
    while true; do
      if ! wait -n; then
        status=$?
        if [ "$status" -ne 0 ]; then
          error "One of the services exited unexpectedly (status $status)."
        fi
        break
      fi
    done
  else
    info "Current shell does not support 'wait -n'; using portable process monitoring."
    while true; do
      for pid in "${PIDS[@]}"; do
        if [ -n "${pid:-}" ] && ! kill -0 "$pid" >/dev/null 2>&1; then
          status=0
          if ! wait "$pid" >/dev/null 2>&1; then
            status=$?
          fi
          if [ "$status" -ne 0 ]; then
            error "One of the services exited unexpectedly (status $status)."
          fi
          return
        fi
      done
      sleep 1
    done
  fi
}

pid_file_for() {
  local name="$1"
  echo "$PID_DIR/$name.pid"
}

log_file_for() {
  local name="$1"
  echo "$LOG_DIR/$name.log"
}

ensure_log_file_exists() {
  local file="$1"
  if [ ! -f "$file" ]; then
    : >"$file"
  fi
}

start_background_service() {
  local name="$1"
  local start_command="$2"
  local pid_file
  pid_file="$(pid_file_for "$name")"

  if [ -f "$pid_file" ]; then
    local existing_pid
    existing_pid="$(cat "$pid_file")"
    if is_pid_running "$existing_pid"; then
      info "$name is already running (PID $existing_pid)."
      return 0
    fi
    info "Removing stale PID file for $name."
    rm -f "$pid_file"
  fi

  local log_file
  log_file="$(log_file_for "$name")"
  : >"$log_file"

  info "Starting $name in background (logs: $log_file)..."
  bash -c "$start_command" >>"$log_file" 2>&1 &
  local pid=$!
  builtin disown "$pid" 2>/dev/null || true
  echo "$pid" >"$pid_file"
  info "$name started with PID $pid."
}

start_background() {
  ensure_state_dirs

  local backend_cmd frontend_cmd
  backend_cmd="$(cat <<EOF
$(declare -f info)
$(declare -f load_env_if_present)

cd '$BACKEND_DIR'
load_env_if_present '$BACKEND_DIR/.env'
exec '$BACKEND_PYTHON' -m uvicorn app.main:app --reload
EOF
)"
  frontend_cmd="$(cat <<EOF
$(declare -f info)
$(declare -f load_env_if_present)

cd '$FRONTEND_DIR'
load_env_if_present '$FRONTEND_DIR/.env'
exec npm run dev
EOF
)"

  start_background_service "backend" "$backend_cmd"
  start_background_service "frontend" "$frontend_cmd"

  info "Background services running. Use './launch.sh logs' to follow output or './launch.sh down' to stop."
}

stop_background_service() {
  local name="$1"
  local pid_file
  pid_file="$(pid_file_for "$name")"

  if [ ! -f "$pid_file" ]; then
    info "$name is not running."
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if is_pid_running "$pid"; then
    stop_pid "$pid" "$name"
  else
    info "$name was not running but a PID file was present."
  fi

  rm -f "$pid_file"
}

stop_background() {
  stop_background_service "frontend"
  stop_background_service "backend"
  info "Background services stopped."
}

status_service() {
  local name="$1"
  local pid_file
  pid_file="$(pid_file_for "$name")"
  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file")"
    if is_pid_running "$pid"; then
      echo "$name: running (PID $pid)"
      return
    fi
  fi
  echo "$name: stopped"
}

show_status() {
  ensure_state_dirs
  status_service "backend"
  status_service "frontend"
  echo "Log files:"
  echo "  Backend : $(log_file_for backend)"
  echo "  Frontend: $(log_file_for frontend)"
}

tail_logs() {
  ensure_state_dirs
  local target="${1:-all}"
  local tail_cmd="tail"
  if ! command -v tail >/dev/null 2>&1; then
    error "'tail' command not available."
    echo "Log files available at $(log_file_for backend) and $(log_file_for frontend)."
    exit 1
  fi

  ensure_log_file_exists "$(log_file_for backend)"
  ensure_log_file_exists "$(log_file_for frontend)"

  case "$target" in
  backend)
    info "Streaming backend logs..."
    $tail_cmd -f "$(log_file_for backend)"
    ;;
  frontend)
    info "Streaming frontend logs..."
    $tail_cmd -f "$(log_file_for frontend)"
    ;;
  all|*)
    info "Streaming backend and frontend logs..."
    $tail_cmd -f "$(log_file_for backend)" "$(log_file_for frontend)"
    ;;
  esac
}

case "$COMMAND" in
dev|run|foreground)
  ensure_prerequisites
  run_foreground
  ;;
up|start|background)
  ensure_prerequisites
  start_background
  ;;
down|stop)
  stop_background
  ;;
restart)
  stop_background
  ensure_prerequisites
  start_background
  ;;
status)
  show_status
  ;;
logs)
  shift || true
  tail_logs "${1:-all}"
  ;;
-h|--help|help)
  usage
  ;;
*)
  error "Unknown command: $COMMAND"
  echo
  usage
  exit 1
  ;;
esac

exit 0
