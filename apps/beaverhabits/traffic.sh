#!/usr/bin/env bash
# Generates representative HTTP traffic against BeaverHabits.
# Uses /demo routes which require no authentication.
set -euo pipefail

if ! lsof -ti tcp:9001 > /dev/null 2>&1; then
  echo "Server is not running on port 9001. Run './harness.sh beaverhabits start' first." >&2
  exit 1
fi

base="http://localhost:9001"
paths=(
  "/demo"
  "/demo/add"
  "/demo/stats"
  "/demo/order"
  "/demo/completion-status"
  "/login"
  "/register"
)

echo "Generating traffic against $base..."
for path in "${paths[@]}"; do
  printf "  GET %-40s" "$path"
  curl -s -o /dev/null -w "%{http_code} (%{time_total}s)\n" "$base$path" || echo "FAILED"
done
echo "Done. Allow ~10s for spans to flush to Honeycomb."
