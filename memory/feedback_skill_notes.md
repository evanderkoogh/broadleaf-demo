---
name: feedback-skill-notes
description: Findings from this session that were added to the otel-instrumentation skill
metadata:
  type: feedback
---

The following gaps were found during Broadleaf testing and added to the skill's Java section (`sdk-setup-by-language.md`) on branch `evanderkoogh/java_misc` in `honeycombio/agent-skill`.

**1. spring-boot:run agent injection** — MAVEN_OPTS and spring-boot.run.jvmArguments are both unreliable. JAVA_TOOL_OPTIONS works but instruments Maven too. Preferred approach: build → explode JAR → `java -javaagent:... -cp "BOOT-INF/classes:BOOT-INF/lib/*"`.

**2. Spring LTW requirement** — Some frameworks (Broadleaf) require `spring-instrument.jar` as a javaagent alongside the OTel agent. Without it, entity fields woven in at class-load time are missing, causing startup crashes. The skill now documents this pattern explicitly with a working example.

**How to apply:** When instrumenting Java apps, check if they use Spring LTW (look for `spring-instrument.jar` being downloaded by the maven-dependency-plugin, or `@EnableLoadTimeWeaving` in config). If so, both agents are required on the `java` command line.
