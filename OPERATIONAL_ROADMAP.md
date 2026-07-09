# Wanderloop — Operational Roadmap

A Well-Architected view of Wanderloop: what the app does per pillar today, what
was hardened recently, and what I'd do next. The point isn't that a demo needs
all of this — it's how I reason about operating a system on this platform.

Each pillar notes the Vercel primitive doing the work and the operational
concern it removes from my plate.

---

## Operational Excellence

| Shipped | How |
|---|---|
| **Eval-in-CI gate** | `.github/workflows/eval.yml` runs the hallucination-regression eval on PRs touching the agent's behavior surface. A prompt or model change can't merge if it regresses grounding. |
| **Per-run structured telemetry** | `lib/cost.ts` emits a `run_cost` log line per trip; OTel spans (`instrumentation.ts`) capture per-model and per-tool latency. |
| **Health endpoint** | `GET /api/health` (public) reports serving region + deployment id + Blob status — probeable by an uptime monitor; shows failover and ties an incident to a release. |

**Next:** ship a `/status` ops page (p50/p95 latency, error rate, cost/run) reading from telemetry; wire the eval into a required Vercel deployment **Check** (blocks promotion, not just a GitHub status); add a runbook (rollback, on-call, incident triage).

**Log drains (capability):** the structured `run_cost` / OTel signal is drain-ready — a Vercel **Log Drain** (`/v1/integrations/log-drains`) ships it to Datadog / Axiom / a SIEM. No code change; it's a destination + config.

## Reliability

| Shipped | How |
|---|---|
| **Model failover** | `lib/models.ts` — AI Gateway degradation chain: primary Haiku 4.5 → GLM-5.2 → GPT-5.5 across two providers, so a rate-limit or single-provider outage fails over instead of failing. |
| **Durable, resumable runs** | Workflow DevKit + `DurableAgent` — each model/tool call is a checkpointed step; a run resumes across a refresh or a crash. |
| **Chaos fault injection** | `lib/workflows/chaos.ts` — `WANDERLOOP_CHAOS` arms synthetic transient failures in tool steps; the runtime's step retries recover with no user-visible failure. An in-app FIS experiment. |

**RPO/RTO framing:** state is Vercel Blob (durable, replicated) + stateless HMAC sessions, so **RPO ≈ 0** for saved itineraries (no in-memory state to lose) and **RTO** is a redeploy/rollback (seconds, immutable deployments). The failure modes I'd actually rehearse: model-provider outage (covered by the fallback chain) and a stuck durable run (covered by step retries + resumable streams).

**Multi-region failover (Enterprise capability):** `functionFailoverRegions` in `vercel.json` auto-fails functions over to a passive region if the primary is unavailable — the platform analogue of multi-AZ/multi-region DR. It's gated to the Enterprise plan (the deploy is rejected on Pro), so the app pins `regions: ["iad1"]` today and this is a one-line turn-on at Enterprise, not an architecture change.

**Staged rollout (capability):** Rolling Releases (canary 25%→100%) + Skew Protection — the platform blue/green. Config, not code.

**Next:** define explicit retry budgets/backoff per tool step; a dead-letter path for runs that exhaust retries.

## Performance Efficiency

| Shipped | How |
|---|---|
| **Streaming-first UX** | First token in ~1s vs a 30s+ spinner for a full plan; tool progress renders live. |
| **Right-sized model routing** | Non-reasoning model on the durable path (its thinking phase would read as a stall); fast path free to use a richer model. |
| **Edge geo + static delivery** | `proxy.ts` injects locale from `x-vercel-ip-country`; marketing/landing served static. |

**Next:** cache tool outputs for identical (city, dates) inputs (Runtime Cache / Data Cache); measure and budget LCP with Speed Insights.

## Cost Optimization

| Shipped | How |
|---|---|
| **Per-run cost visibility** | `lib/cost.ts` computes estimated USD/run from token usage (~$0.005/trip today) and logs it structured — the input to a spend dashboard or budget alert. |
| **Read caching** | `/itinerary/[id]` is ISR-cached (`revalidate=3600`), turning a per-request Blob read into an edge cache hit. |

**Next:** replace approximate rates with live Gateway pricing (`getAvailableModels().pricing`); a budget alert when cost/run crosses a threshold; A/B the fallback models on cost-per-quality.

## Security

| Shipped | How |
|---|---|
| **Auth + isolation** | HMAC-signed session cookie (`lib/auth.ts`); untrusted user code runs in a Vercel Sandbox microVM; cron enforces a `CRON_SECRET` bearer. |
| **Rate limiting** | `lib/rate-limit.ts` — fail-open `@vercel/firewall` guard on `/api/chat`, `/api/chat-durable`, `/api/sandbox/budget` (the routes where abuse burns money). |
| **Secrets discipline** | All secrets in env vars; nothing in the repo. |

**Apply the edge rule** (the guard fails open until it exists):
```sh
vercel firewall rules add "Rate limit AI routes" \
  --condition '{"type":"path","op":"pre","value":"/api/chat"}' \
  --action rate_limit --rate-limit-window 60 --rate-limit-requests 30 \
  --rate-limit-keys ip --rate-limit-action deny --yes
```

**Next:** add BotID (`checkBotId`) on the AI + sandbox routes; Attack Challenge Mode for DDoS; **Secure Compute** (VPC peering) for private-backend connectivity; scope a real RBAC model beyond the single admin.

---

## Shipped vs. backlog at a glance

| Enhancement | Pillar | Status |
|---|---|---|
| Model fallback chain | Reliability | ✅ shipped |
| Chaos fault injection + resume | Reliability | ✅ shipped |
| OTel tracing + per-run cost | Ops / Cost | ✅ shipped |
| Eval-in-CI gate | Ops Excellence | ✅ shipped |
| `/api/health` endpoint | Ops / Monitoring | ✅ shipped |
| Rate-limit guard on expensive routes | Security | ✅ shipped |
| ISR-cached itinerary reads | Performance / Cost | ✅ shipped |
| Multi-region `functionFailoverRegions` | Reliability | 🏢 Enterprise plan |
| Secure Compute (VPC peering) | Infra / Security | 🏢 capability (config) |
| Rolling releases + skew protection | Ops Excellence | 🏢 capability (config) |
| Log drain → Datadog/SIEM | Monitoring | ⏳ config + destination |
| BotID on AI + sandbox routes | Security | ⏳ next |
| `/status` ops dashboard | Ops Excellence | ⏳ next |

The shipped set is deliberately small and demonstrable; the backlog is prioritized by risk, not novelty. That prioritization — not the length of the list — is the operational-maturity signal.
