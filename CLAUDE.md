# Broadleaf OTel Skill Test Harness

This project exists to repeatedly test Claude's OpenTelemetry instrumentation skills against a real Java/Spring Boot codebase.

## Purpose

Each session simulates a fresh instrumentation engagement on the Broadleaf Commerce DemoSite. The scripts in this repo exist to quickly reset the DemoSite to a clean, pre-instrumentation state so the same skill can be re-tested without leftover changes from a previous run.

## Workflow

1. `./broadleaf.sh reset --purge` — discard the current scratch branch (local + remote) and create a fresh `scratch_YYYY-MM-DD` branch from the `clean` baseline
2. Invoke the OTel instrumentation skill and apply changes to `DemoSite/`
3. Build and run the demo to verify telemetry is flowing
4. Repeat from step 1

## Key facts

- **DemoSite** is a Maven multi-module Spring Boot app (Spring Boot 2.7.x, Java 17+)
- Modules: `core`, `site` (port 8080), `admin` (port 8081), `api` (port 8082)
- Default database: embedded HSQLDB — no external services needed
- The `clean` branch in the fork (`evanderkoogh/broadleaf-demosite`) is the unmodified upstream baseline; never commit instrumentation changes there
- Scratch branches (`scratch_YYYY-MM-DD[-N]`) are the working branches for each test run

## Running the DemoSite

Always use `broadleaf.sh` to manage the DemoSite servers — never start or stop them directly with Maven or `java -jar`:

- `./broadleaf.sh start` — start site (port 8080) and admin (port 8081) in the background
- `./broadleaf.sh stop` — stop running servers
- `./broadleaf.sh restart` — stop then start
- `./broadleaf.sh status` — check whether servers are running

## Browsing the DemoSite

Use the **Playwright MCP** tools (`playwright_navigate`, `playwright_screenshot`, etc.) when interacting with the running demo. Do not use `curl`, `WebFetch`, or raw HTTP calls to browse or verify UI behavior.

## Constraints

**All OpenTelemetry instrumentation changes must be made inside `DemoSite/` only.** The root-level directory is the test harness and must never be modified as part of an instrumentation task. If an instrumentation skill tries to create or edit files outside `DemoSite/`, that is a mistake.
