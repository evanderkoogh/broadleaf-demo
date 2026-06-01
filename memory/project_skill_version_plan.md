---
name: project-skill-version-plan
description: Planned but not yet implemented — skill version tracking + instrumentation log
metadata:
  type: project
---

## What to build

Two features to add to the broadleaf test harness. Not yet implemented as of 2026-06-01.

**Why:** Currently no record of which skill version was used to instrument a scratch branch, or what prompt triggered it. Planned to fix.

---

### Part 1: Skill version in OTel attributes + DemoSite file

**At instrument time**, Claude writes `DemoSite/.skill-version` (bash-sourceable):
```bash
SKILL_BRANCH=evanderkoogh/java_misc
SKILL_SHA=cf3acc8   # short 7-char SHA (user preference)
```

Detection: resolve symlink at `~/.claude/plugins/cache/honeycomb-plugins/honeycomb/1.1.0` → git repo root, then:
```bash
SKILL_REPO=$(git -C "$(readlink ~/.claude/plugins/cache/honeycomb-plugins/honeycomb/1.1.0)" rev-parse --show-toplevel)
SKILL_BRANCH=$(git -C "$SKILL_REPO" rev-parse --abbrev-ref HEAD)
SKILL_SHA=$(git -C "$SKILL_REPO" rev-parse --short HEAD)
```

**`clean` branch start scripts** — add before `exec java` in both `start-site.sh` and `start-admin.sh`:
```bash
if [[ -f "$SCRIPT_DIR/.skill-version" ]]; then
  source "$SCRIPT_DIR/.skill-version"
  export OTEL_RESOURCE_ATTRIBUTES="service.instrumentation_skill.branch=${SKILL_BRANCH},service.instrumentation_skill.git_sha=${SKILL_SHA}"
fi
```

Attribute names: `service.instrumentation_skill.branch`, `service.instrumentation_skill.git_sha`.

---

### Part 2: Instrumentation prompt log

Two files, one entry appended/written per session by Claude:

**Harness log** (persistent, never reset): `instrumentation-log.md` in harness root.

**Per-branch record**: `DemoSite/INSTRUMENTATION.md` committed to the scratch branch.

Entry format (both):
```markdown
## 2026-06-01T05:35:00Z — scratch_2026-06-01
- **Skill:** evanderkoogh/java_misc @ cf3acc8
- **Prompt:** "reset and purge the current demosite and reapply otel instrumentation from scratch using the skill"
```

Claude writes these immediately after applying the skill, before committing.

---

### CLAUDE.md update

Add a step between "invoke skill" and "start":
> Write `DemoSite/.skill-version` and append entries to `instrumentation-log.md` and `DemoSite/INSTRUMENTATION.md`.

---

### Verification

1. Restart servers, browse site, query `broadleaf-site` in Honeycomb — confirm `service.instrumentation_skill.branch` and `service.instrumentation_skill.git_sha` attributes on spans
2. Check `instrumentation-log.md` has a correctly-formatted entry
3. Run a second session (`reset --purge` → instrument) — confirm harness log accumulates second entry

**SHA length:** short 7-char (user confirmed).
