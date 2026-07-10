import { put, get } from "@vercel/blob";
import { estimateCostUSD } from "./cost";

// AI/cost telemetry — a rolling window of recent runs the /status dashboard
// reads. This captures what Vercel Observability can't: per-trip LLM token
// cost, model used, and tool-retry counts. It's complementary to the platform's
// HTTP metrics, not a re-implementation of them.
//
// Storage is a capped list in Blob — deliberately lightweight. At real volume
// the read-modify-write below races and this moves to Upstash Redis / Neon
// (a sorted set or an append-only table); the Blob ring buffer is the honest
// demo-scale version.

const KEY = "telemetry/runs.json";
const MAX_RUNS = 50;

export type RunRecord = {
  ts: string;
  path: "fast" | "durable";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  faults: number;
};

type Usage = { inputTokens?: number; outputTokens?: number };

export async function recordRun(input: {
  path: "fast" | "durable";
  model: string;
  usage: Usage;
  faults?: number;
}): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const existing = await readRuns();
    const record: RunRecord = {
      ts: new Date().toISOString(),
      path: input.path,
      model: input.model,
      inputTokens: input.usage.inputTokens ?? 0,
      outputTokens: input.usage.outputTokens ?? 0,
      costUSD: Number(estimateCostUSD(input.model, input.usage).toFixed(5)),
      faults: input.faults ?? 0,
    };
    const next = [record, ...existing].slice(0, MAX_RUNS);
    await put(KEY, JSON.stringify(next), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  } catch (err) {
    // Telemetry must never break the request it measures.
    console.error("[telemetry] recordRun failed", err);
  }
}

export async function readRuns(): Promise<RunRecord[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  try {
    const result = await get(KEY, { access: "private", useCache: false });
    if (!result) return [];
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as RunRecord[]) : [];
  } catch {
    return [];
  }
}

export type TelemetrySummary = {
  runs: number;
  totalCostUSD: number;
  avgCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: { model: string; runs: number; costUSD: number }[];
  byPath: { path: string; runs: number }[];
  totalFaultsRecovered: number;
};

export function summarize(records: RunRecord[]): TelemetrySummary {
  const runs = records.length;
  const totalCostUSD = records.reduce((s, r) => s + r.costUSD, 0);
  const modelMap = new Map<string, { runs: number; costUSD: number }>();
  const pathMap = new Map<string, number>();
  for (const r of records) {
    const m = modelMap.get(r.model) ?? { runs: 0, costUSD: 0 };
    m.runs += 1;
    m.costUSD += r.costUSD;
    modelMap.set(r.model, m);
    pathMap.set(r.path, (pathMap.get(r.path) ?? 0) + 1);
  }
  return {
    runs,
    totalCostUSD,
    avgCostUSD: runs ? totalCostUSD / runs : 0,
    totalInputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
    totalOutputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
    byModel: [...modelMap.entries()]
      .map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.costUSD - a.costUSD),
    byPath: [...pathMap.entries()].map(([path, r]) => ({ path, runs: r })),
    totalFaultsRecovered: records.reduce((s, r) => s + r.faults, 0),
  };
}
