# Wanderloop

An AI travel concierge — type a trip in plain English, watch an agent build the itinerary in real time. Built as a Vercel platform showcase: streaming AI agent + durable workflow runtime + sandboxed user code + image-heavy UI + shareable PDFs, all in one Next.js 16 app.

> **Live demo:** [wanderloop-fers-projects-73df9ff5.vercel.app](https://wanderloop-fers-projects-73df9ff5.vercel.app)
> **Design doc:** [`DESIGN.md`](./DESIGN.md) — full architectural sketch + ~25 interview Q&A
> **Interview prep:** [`INTERVIEW_PREP.md`](./INTERVIEW_PREP.md) — rehearsal source-of-truth with real bug stories

## What it shows

| Vercel feature | Where it lives | What it does |
|---|---|---|
| **AI SDK + Anthropic** | `app/api/chat/route.ts` | Streaming agent with 4 tools (flights, restaurants, weather, attractions) |
| **Workflow DevKit** | `lib/workflows/plan-trip.ts` | Durable agent run that survives tab close / refresh / timeout |
| **WorkflowChatTransport** | `app/durable-plan/durable-planner.tsx` | AI SDK transport that auto-reconnects to interrupted streams |
| **Vercel Sandbox** | `app/api/sandbox/budget/route.ts` | Runs user-pasted JS filters in Firecracker microVMs |
| **Vercel Blob** | `app/api/itinerary/save/route.ts` | Persists saved itineraries (private store + server-side `get()`) |
| **Cron Jobs** | `app/api/cron/daily-deals/route.ts` + `vercel.json` | Daily 06:00 UTC digest of matching deals |
| **Routing Middleware (Proxy)** | `proxy.ts` | Geo → currency + units locale injection |
| **Image Optimization** | `components/destination-gallery.tsx` | `next/image` with `remotePatterns` for the destination grid |
| **PDF generation** | `app/api/itinerary/[id]/pdf/route.ts` | `@react-pdf/renderer` → downloadable trip PDF |

## Routes

```
/                          Landing page (static, destination gallery)
/plan?q=...                Streaming planner (AI SDK + Functions)
/durable-plan?q=...        Durable planner (Workflow DevKit)
/itinerary/[id]            Saved itinerary (Server Component, reads Blob)
/itinerary/[id]/pdf        PDF export (renderToBuffer + Blob lookup)
/admin/digests             Latest cron digest of matching deals

/api/chat                  POST — streamText with tools
/api/chat-durable          POST — start workflow, return stream + x-workflow-run-id
/api/chat-durable/[id]/stream  GET — reconnect via getRun(id).getReadable()
/api/itinerary/save        POST — persist messages to Blob (private access)
/api/itinerary/[id]/pdf    GET — render PDF, stream as application/pdf
/api/sandbox/budget        POST — Firecracker microVM filter execution
/api/cron/daily-deals      GET — auth-gated cron digest generator
```

## Running locally

```bash
pnpm install
cp .env.example .env.local
# Fill in:
#   ADMIN_EMAIL / ADMIN_PASSWORD  (required — single-admin login gate)
#   AUTH_SECRET                   (required — HMAC for session cookies; openssl rand -hex 32)
#   AI_GATEWAY_API_KEY            (optional — local LLM calls; falls back to OIDC)
#   BLOB_READ_WRITE_TOKEN         (optional — enables Save trip + Cron digest)
#   CRON_SECRET                   (optional — protects /api/cron/*)
# For LLM calls + workflow durable mode without an API key:
vercel link
vercel env pull .env.local    # gets VERCEL_OIDC_TOKEN (used by AI Gateway + Workflow)

pnpm dev
# open http://localhost:3000
```

## Stack

- **Next.js 16** (Turbopack, App Router)
- **React 19** + **Tailwind 4**
- **AI SDK 6** (`ai`, `@ai-sdk/gateway`, `@ai-sdk/react`)
- **Workflow DevKit 4** (`workflow`, `@workflow/ai`)
- **@vercel/blob 2** · **@vercel/sandbox 2** · **@react-pdf/renderer 4**
- **react-markdown** + **remark-gfm** for the day-by-day card rendering
- **Zod 4** for tool schemas + request validation

## Build phases (delivery history)

- **Phase C** — Bootstrap: Next 16 + deps + first preview deploy
- **Phase D** — MVP: Streaming agent + 4 mock tools + day-card rendering
- **Phase E.1** — Blob save + share (private store, server-side `get()`)
- **Phase E.2** — Routing Middleware (Proxy) for geo/locale
- **Phase E.3** — Vercel Sandbox for the budget-filter feature
- **Phase E.4** — Cron Jobs for the daily-deals digest
- **Phase E.5** — Workflow DevKit durable mode + resumable streams
- **Phase F** — Image-heavy landing page + PDF export + Wanderloop README

## Known limitations (honest)

- Tool data is **synthetic** (Lisbon, Tokyo, Paris have curated mocks; other cities get a generic fallback). Real-API integration would replace `lib/tools/*.ts` and `lib/workflows/tools.ts`.
- Durable mode loses **per-tool-call checkpointing** vs DurableAgent — the whole agent loop is one step boundary (see `INTERVIEW_PREP.md` B2 for the story behind that decision).
- Single hardcoded admin login (env-var creds, HMAC-signed cookie) — saved itineraries at `/itinerary/<id>` stay publicly readable by design so share links work.
- LLM calls route through Vercel AI Gateway for unified observability and provider swaps.

## Repo

[github.com/aieng2026/super-vercel-demo](https://github.com/aieng2026/super-vercel-demo)

Built ~6 evenings, May 2026. ~10¢ per planned trip in real LLM cost.
