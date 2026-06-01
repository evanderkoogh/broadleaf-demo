---
name: feedback-java-agent-injection
description: How to reliably load the OTel Java agent in Broadleaf / Spring Boot stacks
metadata:
  type: feedback
---

For this Broadleaf stack, the OTel Java agent must be loaded via `java -javaagent:` on the command line of the actual application JVM — not via MAVEN_OPTS, not via spring-boot.run.jvmArguments, not via JAVA_TOOL_OPTIONS.

**Why:** `spring-boot:run` forks a child JVM; MAVEN_OPTS only applies to Maven's own JVM. The Broadleaf parent pom overrides `jvmArguments` in the plugin config, so `-Dspring-boot.run.jvmArguments` on the CLI is silently ignored. JAVA_TOOL_OPTIONS works but also instruments Maven itself, producing junk spans.

**How to apply:** In `start-site.sh` / `start-admin.sh`, add `-javaagent:"$AGENT_JAR"` to the `exec java` command, after `-javaagent:"$SPRING_INSTRUMENT"`. The agent JAR lives at `../otel/opentelemetry-javaagent.jar` (relative to DemoSite/), which resolves to the harness-level `otel/` directory (gitignored, persists across resets).

**Service name:** Set `export OTEL_SERVICE_NAME="broadleaf-site"` (or `broadleaf-admin`) in the start script before `exec java`. The OTLP endpoint and API key come from the harness `.env` file loaded by `broadleaf.sh`.

**Two agents required:** `spring-instrument.jar` must come BEFORE the OTel agent in the argument list. Both are javaagents on the same `exec java` line.

**Verified working config:**
```bash
exec java \
  -javaagent:"$SPRING_INSTRUMENT" \
  -javaagent:"$AGENT_JAR" \
  -cp "$EXPLODED/BOOT-INF/classes:$EXPLODED/BOOT-INF/lib/*" \
  com.community.SiteApplication
```
