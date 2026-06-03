---
name: project-broadleaf-startup
description: Broadleaf DemoSite startup mechanics — exploded JAR, LTW, HSQLDB, bootstrap
metadata:
  type: project
---

Broadleaf Commerce DemoSite (Spring Boot 2.7.x, Java 25) has several non-obvious startup requirements.

**Run method:** Use exploded JAR + `java -cp`, NOT `java -jar` and NOT `mvn spring-boot:run`. The fat JAR's nested classloader breaks Broadleaf's JPA entity extension scanning (missing `BLC_INDEX_FIELD_TYPE.ARCHIVED` column → Solr indexer crash → ApplicationContext failure).

**Why:** Broadleaf uses Spring Load-Time Weaving (`spring-instrument.jar`) to weave entity fields at class-load time. A standard JVM classpath via `java -cp` is required for this to work correctly.

**How to apply:** Always update `start-site.sh` and `start-admin.sh` in DemoSite/. The `broadleaf.sh` harness calls these scripts.

**HSQLDB bootstrap:** The embedded HSQLDB stores files at `/tmp/broadleaf-hsqldb`. These persist across normal restarts but are wiped on system reboot. On a fresh environment, run `./broadleaf.sh bootstrap` (uses `mvn spring-boot:run` once to seed the schema) before the first `./broadleaf.sh start`. If `start` fails with a schema error, run `bootstrap` again.

**Start sequence:** Site must fully start (Solr up) before admin. The harness waits for `Started SiteApplication` (not just `Started `) to avoid racing on the "Started Solr server" line. Admin is then started and waits for `Started AdminApplication`.

**Ports:** site HTTP 8080, HTTPS 8443; admin 8081; HSQLDB 9001; Solr 8983.
