#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_VENV="$BACKEND_DIR/.venv"
BACKEND_PYTHON=""
PIDS=()
CLEANED_UP=0

error() {
  echo "[ERROR] $1" >&2
}

info() {
  echo "[INFO] $1"
}

check_command() {
  local cmd="$1"
  local package_name="${2:-$1}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    error "Missing required command '$cmd'. Please install $package_name before continuing."
    exit 1
  fi
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

cleanup() {
  if [ "$CLEANED_UP" -eq 1 ]; then
    return
  fi
  CLEANED_UP=1
  echo
  info "Shutting down services..."
  for pid in "${PIDS[@]}"; do
    if [ -n "${pid:-}" ] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  for pid in "${PIDS[@]}"; do
    if [ -n "${pid:-}" ]; then
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
  info "All services stopped."
}

trap 'cleanup; exit 0' INT TERM
trap cleanup EXIT

# 1. Verify prerequisites
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

read -r -a PYTHON_CMD <<<"$(detect_python || true)"
if [ "${#PYTHON_CMD[@]}" -eq 0 ]; then
  error "Python 3 executable not found. Install Python 3 and ensure it is on your PATH."
  exit 1
fi

python_display="${PYTHON_CMD[*]}"

if ! "${PYTHON_CMD[@]}" -m pip --version >/dev/null 2>&1; then
  error "pip for Python 3 is not available. Install pip (usually via '$python_display -m ensurepip --upgrade' or your package manager)."
  exit 1
fi
check_command node "Node.js"
check_command npm "npm (Node Package Manager)"

# 2. Load root environment file if present
load_env_if_present "$ROOT_DIR/.env"

# 3. Prepare backend virtual environment
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

# 4. Prepare frontend dependencies
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  info "Installing frontend dependencies (this may take a moment)..."
  (cd "$FRONTEND_DIR" && npm install)
else
  info "Frontend dependencies already installed."
fi

# 5. Launch backend server
start_backend() {
  (
    cd "$BACKEND_DIR"
    load_env_if_present "$BACKEND_DIR/.env"
    exec "$BACKEND_PYTHON" -m uvicorn app.main:app --reload
  ) &
  local pid=$!
  PIDS+=("$pid")
  info "Backend server started (PID $pid)."
}

# 6. Launch frontend server
start_frontend() {
  (
    cd "$FRONTEND_DIR"
    load_env_if_present "$FRONTEND_DIR/.env"
    exec npm run dev
  ) &
  local pid=$!
  PIDS+=("$pid")
  info "Frontend server started (PID $pid)."
}

start_backend
start_frontend

info "Both services are running. Press Ctrl+C to stop."

# Keep script running until one of the services exits
wait_for_services() {
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
    return
  fi

  # Fallback for shells without wait -n (e.g. macOS default Bash 3.x in VS Code)
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
}

wait_for_services

exit 0
