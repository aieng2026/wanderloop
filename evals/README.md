# Wanderloop — Hallucination Regression Eval

A lightweight evaluation harness for the Wanderloop agent. Required by the Vercel SA take-home brief (Track B: *"Include at least one lightweight evaluation approach"*).

## What it tests

The single, stated invariant from `lib/system-prompt.ts`:

> *"Never invent restaurants, attractions, flights, or weather. Only use what tools returned."*

For each test prompt, the eval runs the same `streamText` pipeline as production (`anthropic/claude-haiku-4-5`, same tools, same system prompt). It then:

1. Extracts every **place-shaped token** from the final assistant text (capitalized multi-word spans, filtered against a stopword list).
2. Asserts each token appears **somewhere in the tool-call output corpus** for that run.

Any place mentioned in the response that doesn't trace back to a tool result is a hallucination.

## Outcomes per prompt

| Outcome | Severity | Why |
|---|---|---|
| `FAIL` — hallucination (place not in corpus) | **Hard** (exit 1) | The stated system-prompt invariant |
| `SKIP` — model didn't call any tools | Soft (warn) | Non-itinerary turn (clarification or offline response). The invariant only applies when the model claims to ground in tools. Surfaces a real model-behavior signal — e.g. Haiku 4.5 sometimes prefers to ask a clarifying question on ambiguous prompts rather than commit to tool calls. |
| `## Day N` markdown structure missing | Soft (warn) | Structure rule, not a data-correctness rule |
| Past dates in the response | Soft (warn) | Date-anchoring rule from `CURRENT DATE:` injection |
| `check_weather` not called | Soft (warn) | Documented tool-call order from the system prompt |

The eval exits `0` if all hallucination checks pass (including SKIP outcomes), `1` if any FAIL, `2` if env/setup issues prevent the run.

## How to run

```sh
# One-time: get an AI Gateway API key OR pull OIDC token
vercel env pull .env.local

# Run all 10 prompts
pnpm eval
```

Expected wall-time: ~90 seconds (10 prompts × ~5s LLM call + 4s inter-request delay). Expected cost on paid Gateway: ~$0.01 per prompt × 10 = ~$0.10 on Haiku 4.5.

### Rate-limit note

Vercel AI Gateway's **free tier** rate-limits burst requests to most models; running all 10 prompts back-to-back can hit `429 rate_limit_exceeded`. The runner inserts a 4-second delay between prompts to stay within the burst limit; configurable via `EVAL_DELAY_MS=<ms>`.

If you've topped up Gateway credits, set `EVAL_DELAY_MS=0` for a faster run. To eval a different model, swap the `gateway("anthropic/claude-haiku-4-5")` call in `evals/hallucination-regression.ts` — same code path, any Gateway-routed model.

## How to extend

**Add a prompt:** append to `evals/test-prompts.json`. Each entry needs `id` (kebab-case) and `text` (the user prompt).

**Add an assertion:** edit `evals/hallucination-regression.ts`. Each new check should declare itself as hard-fail or soft-warn explicitly in the summary section.

**Rule of thumb:** *a prompt belongs in the eval if a known bug existed there.* As bugs surface (in user testing, in production), add prompts that would have caught them.

## What this is NOT

- **Not an LLM-as-judge.** A second LLM scoring the response would be more accurate but isn't "lightweight" — deterministic regex assertions are.
- **Not a regression fixture harness.** No frozen expected outputs per prompt. Adding that is a 1–2 hour extension.
- **Not in CI.** A GitHub Action that runs this on PRs touching `lib/system-prompt.ts` or `lib/tools/` would be the next step.
- **Not the only eval you'd want in production.** Response-quality (does the itinerary actually make sense), latency (P50/P95 per tool), and cost (tokens per run) all want their own harnesses. This one closes the hallucination axis only.

## What a production version would add

In rough order of value:

1. **LLM-as-judge for response quality** — was the itinerary good, not just non-hallucinated.
2. **Regression fixtures** — frozen JSON expected outputs per prompt, diffed on model upgrades.
3. **CI integration** — GitHub Action on PRs touching `lib/system-prompt.ts` or tool implementations.
4. **Paid-tier model in CI** — Sonnet so the eval reflects what a paying customer would see.
5. **A/B harness for model routing** — same prompts against a candidate model (e.g. GLM-5.2, Sonnet) vs the production Haiku 4.5, to surface behavior drift before switching.

The current eval is the minimum viable evidence that the team thinks about evals; the discussion above extends it to enterprise.
