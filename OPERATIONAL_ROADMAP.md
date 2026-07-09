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

**Next:** ship a `/status` ops page (p50/p95 latency, error rate, cost/run) reading from telemetry; wire the eval into a required status check; add a runbook (rollback, on-call, incident triage).

## Reliability

| Shipped | How |
|---|---|
| **Model failover** | `lib/models.ts` — AI Gateway degradation chain: primary Haiku 4.5 → GLM-5.2 → GPT-5.5 across two providers, so a rate-limit or single-provider outage fails over instead of failing. |
| **Durable, resumable runs** | Workflow DevKit + `DurableAgent` — each model/tool call is a checkpointed step; a run resumes across a refresh or a crash. |
| **Chaos fault injection** | `lib/workflows/chaos.ts` — `WANDERLOOP_CHAOS` arms synthetic transient failures in tool steps; the runtime's step retries recover with no user-visible failure. An in-app FIS experiment. |

**RPO/RTO framing:** state is Vercel Blob (durable, replicated) + stateless HMAC sessions, so **RPO ≈ 0** for saved itineraries (no in-memory state to lose) and **RTO** is a redeploy/rollback (seconds, immutable deployments). The failure modes I'd actually rehearse: model-provider outage (covered by the fallback chain) and a stuck durable run (covered by step retries + resumable streams).

**Next:** define explicit retry budgets/backoff per tool step; a dead-letter path for runs that exhaust retries; multi-region Blob read replicas if latency-sensitive.

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

**Next:** replace approximate rates with live Gateway pricing (`getAvailableModels().pricing`); a budget alert when cost/run crosses a threshold; A/B the fallback models on cost-per-quality.

## Security

| Shipped | How |
|---|---|
| **Auth + isolation** | HMAC-signed session cookie (`lib/auth.ts`); untrusted user code runs in a Vercel Sandbox microVM; cron enforces a `CRON_SECRET` bearer. |
| **Secrets discipline** | All secrets in env vars; nothing in the repo. |

**Next:** rate-limit `/api/chat` (Vercel Firewall rule or an Upstash token bucket) to cap abuse/cost; add WAF rules + BotID on the public routes; scope a real RBAC model beyond the single admin.

---

## Shipped vs. backlog at a glance

| Enhancement | Pillar | Status |
|---|---|---|
| Model fallback chain | Reliability | ✅ shipped |
| Chaos fault injection + resume | Reliability | ✅ shipped |
| OTel tracing + per-run cost | Ops / Cost | ✅ shipped |
| Eval-in-CI gate | Ops Excellence | ✅ shipped |
| `/status` ops dashboard | Ops Excellence | ⏳ next |
| Rate limiting on `/api/chat` | Security | ⏳ next |
| Real datastore (Neon/Upstash) for run metadata | Performance | ⏳ next |
| IaC (Terraform Vercel provider) for project config | Ops Excellence | ⏳ next |

The shipped set is deliberately small and demonstrable; the backlog is prioritized by risk, not novelty. That prioritization — not the length of the list — is the operational-maturity signal.
