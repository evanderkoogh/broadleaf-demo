# BeaverHabits — app profile for the OTel skill test harness.
# Sourced by harness.sh; defines APP_* variables and cmd_* overrides.

APP_NAME="beaverhabits"
APP_REPO="https://github.com/evanderkoogh/beaverhabits.git"
APP_CLEAN_BRANCH="clean"
APP_HTTP_PORT=9001
APP_OTEL_AGENT_TYPE="python"

cmd_build() {
  if [[ ! -d "$REPO_DIR" ]]; then
    echo "Repo not found. Run 'download' first." >&2
    exit 1
  fi
  export PATH="$HOME/.local/bin:$PATH"
  echo "Installing dependencies with uv..."
  (cd "$REPO_DIR" && uv venv && uv sync)
  echo "Build complete."
}

cmd_start() {
  mkdir -p "$LOG_DIR"

  if [[ -f "$PID_FILE" ]]; then
    echo "PID file exists — server may already be running. Run 'status' to check." >&2
    exit 1
  fi

  if port_in_use "$APP_HTTP_PORT"; then
    echo "Port $APP_HTTP_PORT is already in use." >&2
    exit 1
  fi

  echo "Starting beaverhabits on port $APP_HTTP_PORT..."
  (
    export PATH="$HOME/.local/bin:$PATH"
    cd "$REPO_DIR"
    HABITS_STORAGE=USER_DISK \
    NICEGUI_STORAGE_SECRET=test-secret \
    TRUSTED_LOCAL_EMAIL=test@example.com \
    OTEL_EXPORTER_OTLP_ENDPOINT="${OTEL_EXPORTER_OTLP_ENDPOINT:-https://api.honeycomb.io}" \
    OTEL_EXPORTER_OTLP_HEADERS="${OTEL_EXPORTER_OTLP_HEADERS:-}" \
    OTEL_SERVICE_NAME="${OTEL_SERVICE_NAME:-beaverhabits}" \
    uv run uvicorn beaverhabits.main:app --workers 1 --port 9001 --host 0.0.0.0
  ) > "$LOG_DIR/beaverhabits.log" 2>&1 &
  local pid=$!
  echo "$pid" > "$PID_FILE"

  echo "Waiting for server to boot..."
  until grep -q "Application startup complete" "$LOG_DIR/beaverhabits.log" 2>/dev/null; do
    sleep 2
    if ! kill -0 "$pid" 2>/dev/null; then
      echo "Server process died. Check $LOG_DIR/beaverhabits.log" >&2
      rm -f "$PID_FILE"
      exit 1
    fi
  done

  echo ""
  echo "Server is up:"
  echo "  BeaverHabits -> http://localhost:$APP_HTTP_PORT"
  echo "  Demo (no auth) -> http://localhost:$APP_HTTP_PORT/demo"
  echo ""
  echo "Logs: $LOG_DIR/beaverhabits.log"
  echo "Stop with: ./harness.sh beaverhabits stop"
}
