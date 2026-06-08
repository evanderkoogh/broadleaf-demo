const HONEYCOMB_BASE = "https://api.honeycomb.io/1";
const HONEYCOMB_ENV = process.env.HONEYCOMB_ENV ?? "test";

interface QuerySpec {
  calculations: Array<{ op: string; column?: string; name?: string }>;
  filters?: Array<{ column: string; op: string; value?: unknown }>;
  breakdowns?: string[];
  orders?: Array<{ op?: string; column?: string; order: string }>;
  limit?: number;
}

interface HoneycombResult {
  data: Record<string, unknown>;
}

async function runQueryOrNull(
  dataset: string,
  spec: QuerySpec,
  apiKey: string,
  timeRangeSecs = 900
): Promise<Record<string, unknown>[] | null> {
  try {
    return await runQuery(dataset, spec, apiKey, timeRangeSecs);
  } catch {
    return null;  // column doesn't exist or other query error → criterion fails
  }
}

async function runQuery(
  dataset: string,
  spec: QuerySpec,
  apiKey: string,
  timeRangeSecs = 900  // 15 minutes in seconds
): Promise<Record<string, unknown>[]> {
  const headers = {
    "X-Honeycomb-Team": apiKey,
    "X-Honeycomb-Environment": HONEYCOMB_ENV,
    "Content-Type": "application/json",
  };

  // Step 1: save query definition — spec goes directly (no wrapper), time_range is integer seconds
  const createRes = await fetch(`${HONEYCOMB_BASE}/queries/${dataset}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...spec, time_range: timeRangeSecs }),
  });
  if (!createRes.ok) throw new Error(`Query create failed: ${createRes.status} ${await createRes.text()}`);
  const { id: queryId } = (await createRes.json()) as { id: string };

  // Step 2: start a query run
  const runRes = await fetch(`${HONEYCOMB_BASE}/query_results/${dataset}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query_id: queryId, disable_series: false }),
  });
  if (!runRes.ok) throw new Error(`Query run failed: ${runRes.status} ${await runRes.text()}`);
  const { id: resultId } = (await runRes.json()) as { id: string };

  // Step 3: poll for completion
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(`${HONEYCOMB_BASE}/query_results/${dataset}/${resultId}`, { headers });
    if (!res.ok) throw new Error(`Query poll failed: ${res.status}`);
    const data = (await res.json()) as {
      complete: boolean;
      data?: { results: HoneycombResult[] };
    };
    if (data.complete) return (data.data?.results ?? []).map((r) => r.data);
  }
  throw new Error("Honeycomb query timed out");
}

export interface CriterionResult {
  pass: boolean;
  value?: unknown;
}

export interface EvaluationResults {
  spans_arriving: CriterionResult;
  http_routes: CriterionResult;
  db_spans: CriterionResult;
  skill_version: CriterionResult;
  rootless_traces: CriterionResult;
  no_explosion: CriterionResult;
}

export async function evaluate(
  dataset: string,
  apiKey: string
): Promise<EvaluationResults> {
  const [spans, httpRoutes, dbSpans, skillVersion, rootless, explosion] =
    await Promise.all([
      runQuery(dataset, { calculations: [{ op: "COUNT" }] }, apiKey),
      runQueryOrNull(
        dataset,
        {
          calculations: [{ op: "COUNT" }],
          filters: [
            { column: "span.kind", op: "=", value: "server" },
            { column: "http.route", op: "exists" },
          ],
          breakdowns: ["http.route"],
          orders: [{ op: "COUNT", order: "descending" }],
          limit: 10,
        },
        apiKey
      ),
      runQueryOrNull(
        dataset,
        {
          calculations: [{ op: "COUNT" }],
          filters: [{ column: "db.system", op: "exists" }],
          breakdowns: ["db.system"],
        },
        apiKey
      ),
      runQueryOrNull(
        dataset,
        {
          calculations: [{ op: "COUNT" }],
          filters: [
            { column: "service.instrumentation_skill.branch", op: "exists" },
          ],
          breakdowns: ["service.instrumentation_skill.branch"],
        },
        apiKey
      ),
      runQueryOrNull(
        dataset,
        {
          calculations: [{ op: "COUNT" }],
          filters: [
            { column: "none.trace.parent_id", op: "does-not-exist" },
            { column: "any.trace.parent_id", op: "exists" },
          ],
        },
        apiKey
      ),
      runQueryOrNull(
        dataset,
        {
          calculations: [{ op: "COUNT" }],
          breakdowns: ["name"],
          orders: [{ op: "COUNT", order: "descending" }],
          limit: 1,
        },
        apiKey
      ),
    ]);

  const totalSpans = (spans[0]?.["COUNT"] as number) ?? 0;
  const httpRouteRows = (httpRoutes ?? []).filter(
    (r) => r["http.route"] !== "/*" && r["http.route"] !== "/"
  );
  const dbSystem = dbSpans?.[0]?.["db.system"] as string | undefined;
  const rootlessCount = (rootless?.[0]?.["COUNT"] as number) ?? 0;
  const topSpanCount = (explosion?.[0]?.["COUNT"] as number) ?? 0;

  return {
    spans_arriving: { pass: totalSpans > 0, value: totalSpans },
    http_routes: {
      pass: httpRoutes !== null && httpRouteRows.length > 0,
      value: httpRoutes === null ? "column absent" : httpRouteRows.map((r) => r["http.route"]),
    },
    db_spans: { pass: !!dbSystem, value: dbSystem ?? "column absent" },
    skill_version: {
      pass: skillVersion !== null && ((skillVersion[0]?.["COUNT"] as number) ?? 0) > 0,
      value: skillVersion?.[0]?.["service.instrumentation_skill.branch"] ?? "column absent",
    },
    rootless_traces: { pass: rootless !== null && rootlessCount === 0, value: rootlessCount },
    no_explosion: { pass: explosion !== null && topSpanCount < 10_000, value: topSpanCount },
  };
}
