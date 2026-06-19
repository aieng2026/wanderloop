# Wanderloop — Design Doc

> **Status:** Implemented — see [`README.md`](./README.md) for the shipped routes and feature map.

---

## 1. Product story

Wanderloop is an AI travel concierge for the moment a user knows they want to go somewhere but doesn't know where, when, or how. They type `"5 days in Lisbon, foodie, mid-budget, late September"` into a single input on the landing page. Within 6 seconds, an AI agent starts streaming a day-by-day itinerary — destination photos load progressively, restaurant cards populate as tool calls return, weather and flight options appear in context. The user edits live ("swap day 3 for a beach day," "find a vegan option for dinner"), saves the itinerary as a shareable PDF, and gets daily emails when matching deals appear.

The delight moment: **watching the itinerary build itself in real-time** while photos of the destination fade in. The conversion moment: **the user realizing this is faster and better than 90 minutes of Googling**.

---

## 2. User flow / screen map

```
┌─────────────────────────────────────────────────────┐
│  Landing — /                                        │
│                                                     │
│  [hero image carousel — destinations]               │
│  "Plan a trip in seconds"                           │
│  [prompt input ▌]                              [➜]  │
│  "5 days in Lisbon, foodie, mid-budget…"            │
│                                                     │
│  ↓ submit                                           │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Plan — /plan?q=...                                 │
│                                                     │
│  Agent: "Searching flights to Lisbon..."  [tool ✓]  │
│  Agent: "Finding restaurants..."          [tool ✓]  │
│  Agent: "Checking weather..."             [tool ✓]  │
│                                                     │
│  ┌─ Day 1 ────────────────────────────┐             │
│  │ [Belém district photo]             │             │
│  │ 09:00 → Mosteiro dos Jerónimos     │             │
│  │ 13:00 → Pastéis de Belém           │             │
│  │ 19:00 → Cervejaria Ramiro 🦞       │             │
│  └────────────────────────────────────┘             │
│  ┌─ Day 2 ────────────────────────────┐             │
│  │ ...                                │             │
│  └────────────────────────────────────┘             │
│                                                     │
│  [💾 Save]  [📄 PDF]  [✏️ Edit]                     │
└─────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Itinerary — /itinerary/[id]                        │
│                                                     │
│  • Saved version, shareable URL                     │
│  • [Toolbar embedded] — travel agent co-edit        │
│  • [Set budget filter ▼] — Sandbox-powered          │
│  • [Subscribe to deals]                             │
│                                                     │
│  PDF export → /itinerary/[id]/pdf                   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  Admin — /admin                                     │
│  • AI Gateway cost dashboard (per provider, per day)│
│  • Live trip-plan runs                              │
│  • Cron job logs (daily-deals)                      │
└─────────────────────────────────────────────────────┘
```

---

## 3. Route map

| Route | Purpose | Rendering |
|---|---|---|
| `/` | Landing — hero + prompt | PPR (static frame + dynamic prompt) |
| `/plan?q=...` | Streaming planner | Dynamic, client + server streaming |
| `/itinerary/[id]` | Saved itinerary, editable | Cache Components with `cacheTag` |
| `/itinerary/[id]/pdf` | Blob-stored PDF | Server-rendered, then cached in Blob |
| `/admin` | Cost + ops view | Server Component + streaming |
| `/api/chat` | AI SDK streaming endpoint | Function (Fluid Compute) |
| `/api/workflow/plan-trip` | Durable trip orchestration | Workflow DevKit entry point |
| `/api/sandbox/budget` | User-defined budget filter | Sandbox (Firecracker) |
| `/api/cron/daily-deals` | Cron scan + email digest | Vercel Cron, runs 06:00 UTC |
| `/api/itinerary/[id]/save` | Save itinerary + write PDF to Blob | Server Action equivalent |

---

## 4. Data model

Lightweight, no full database for the demo — use Edge Config for user prefs and Blob for itineraries-as-JSON.

```ts
// lib/types.ts

type Itinerary = {
  id: string;                  // nanoid
  prompt: string;              // original user input
  destination: string;         // "Lisbon, Portugal"
  startDate: string;           // ISO
  days: Day[];
  budget: BudgetSpec;
  createdAt: string;
  userPrefs: UserPreferences;
};

type Day = {
  date: string;
  locations: Place[];
  restaurants: Restaurant[];
  weather: WeatherSummary;
  notes: string;
};

type BudgetSpec = {
  perDayUSD: number;
  customFilterCode?: string;   // user-pasted JS for Sandbox eval
};

type UserPreferences = {
  currency: "USD" | "EUR" | "GBP";
  units: "metric" | "imperial";
  dietary: string[];
  pace: "relaxed" | "balanced" | "packed";
};
```

**Storage:**
- Itinerary JSON → Blob at `itineraries/{id}.json`
- PDF → Blob at `itineraries/{id}.pdf`
- UserPreferences → Edge Config keyed by user session ID (no persistent accounts for demo)
- AI Gateway cost data → already aggregated by Vercel, surfaced through the Gateway API

---

## 5. Feature-by-feature implementation plan

For each Vercel feature: **the file**, **why it's there** (product reason, not "because Vercel"), and **how to verify** it works.

### 5.1 PPR + Cache Components
- **File:** `app/page.tsx`, `components/destination-gallery.tsx`
- **Why:** The landing page hero + destination gallery is the same for everyone; the prompt input is the only dynamic block. PPR renders the static frame instantly and streams the dynamic input in. The destination gallery (which has 50+ photos) is wrapped in `'use cache'` with `cacheTag('destinations')` so the marketing team can swap featured destinations without a redeploy.
- **Verify:** Lighthouse score 95+; first-paint under 800ms on cold load; gallery updates within 5s of triggering `updateTag('destinations')`.

### 5.2 AI SDK streaming + tool calling
- **File:** `app/api/chat/route.ts`
- **Why:** This is the agent loop. `streamText` with 4 tools: `find_flights`, `find_restaurants`, `check_weather`, `find_attractions`. Each tool is mocked for the demo but called via AI Gateway so cost attribution works. Stop condition: `stepCountIs(8)` to cap runaway loops.
- **Verify:** Open `/plan?q=...`, watch tool calls render in the UI as they fire; AI Gateway dashboard shows the 4 tool-call requests per trip.

### 5.3 Workflow DevKit
- **File:** `app/api/workflow/plan-trip/route.ts`
- **Why:** Trip planning is a 5-step pipeline: parse intent → search flights → enrich destinations → score restaurants → assemble itinerary. Each step can fail. Workflow DevKit checkpoints each, retries the failing step with exponential backoff, and exposes a status endpoint the UI subscribes to. The user can close the tab and come back — workflow keeps running.
- **Verify:** Trigger a trip plan, close the tab, reopen 30s later, see the completed itinerary. Manually 500 the restaurants tool — workflow retries 3x then surfaces a degraded result.

### 5.4 Sandbox
- **File:** `app/api/sandbox/budget/route.ts`
- **Why:** Power users want to filter the itinerary with their own rules: "no museum entry over €15," "skip restaurants more than 2km from hotel." Instead of inventing a custom DSL, let them paste JavaScript. Vercel Sandbox runs that code in a Firecracker microVM with strict CPU/memory limits and no network. Result piped back.
- **Verify:** Paste a rule like `places => places.filter(p => p.priceUSD < 50)`. Sandbox returns filtered list in <2s. Paste `while(true){}` — sandbox kills it after 5s and surfaces a timeout error.

### 5.5 Image Optimization
- **File:** `components/destination-card.tsx`, `next.config.ts` `images.remotePatterns`
- **Why:** Itineraries are visual. Each day has 5-10 photos (destinations, restaurants, attractions). `next/image` with remote Unsplash + Pexels patterns handles resizing, formats (AVIF), and lazy-loading. Without it, the page is 12MB; with it, the page is 800KB.
- **Verify:** Network tab shows AVIF served on Chrome, JPEG fallback on Safari; LCP under 2.5s on `/itinerary/[id]`.

### 5.6 Routing Middleware
- **File:** `middleware.ts`
- **Why:** Users in EU should see Euros + metric units by default; US users see USD + imperial. Doing this client-side causes flicker. Doing it at the middleware layer means the response is already correct on first paint. Reads `request.geo.country` and sets a `locale` cookie that downstream components consume.
- **Verify:** Use Vercel's preview deploy with geo-spoofing header `x-vercel-ip-country: PT` → page renders in EUR + km. Switch to `US` → USD + miles. No client-side flicker.

### 5.7 Cron Jobs
- **File:** `app/api/cron/daily-deals/route.ts`, `vercel.json` cron config
- **Why:** Users who save a trip get a 6 AM daily email if matching deals appear. Cron Job runs at 06:00 UTC, iterates all saved itineraries (from Blob), checks mock deal feed, sends email (mocked to console for demo).
- **Verify:** Trigger manually via `vercel cron trigger daily-deals`; check logs show iteration over saved itineraries + email payload constructed.

### 5.8 Blob storage
- **File:** `app/api/itinerary/[id]/save/route.ts`, `app/api/itinerary/[id]/pdf/route.ts`
- **Why:** Itineraries are saved as JSON in Blob (no DB needed for demo) and PDFs are generated server-side and stored in Blob with public URLs. Sharing = forwarding the Blob URL.
- **Verify:** Save an itinerary, get a URL like `https://blob.vercel-storage.com/itineraries/abc.json`; open in incognito — accessible. PDF export returns a Blob URL with the rendered PDF.

### 5.9 Firewall + WAF
- **File:** Vercel Firewall dashboard config (committed as `vercel.json` rules)
- **Why:** `/api/chat` is the expensive endpoint — rate-limit to 20/min per IP. `/api/cron/*` should reject any request without the cron secret. Block known bot user-agents from hitting `/api/sandbox/*`. WAF managed ruleset enabled for OWASP coverage.
- **Verify:** Hit `/api/chat` 21 times in a minute → 429. Hit `/api/cron/daily-deals` without `Authorization: Bearer $CRON_SECRET` → 403.

### 5.10 Toolbar
- **File:** `app/itinerary/[id]/page.tsx` — embed `<VercelToolbar />`
- **Why:** Travel agents using Wanderloop for their high-touch customers want to co-edit an itinerary in real-time. Toolbar gives them a comment-anywhere collaboration layer without building one. Showcase feature — leads into a "could be the operator interface" conversation in demos.
- **Verify:** Open `/itinerary/[id]` in two browsers, drop a Toolbar comment in one, see it in the other within seconds.

