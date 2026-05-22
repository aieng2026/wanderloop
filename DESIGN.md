# Wanderloop — Design Doc

> **Status:** Designed, not yet scaffolded. Bootstrap is Phase C (next session).
> **Sibling:** [`../concepts/01-wanderloop-travel-concierge.md`](../concepts/01-wanderloop-travel-concierge.md) — the higher-level concept doc.

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

---

## 6. Demo script (5 min)

Rehearse this until it's muscle memory. Time budget is brutal — practice with a stopwatch.

> **0:00 — Open landing page.**
> "This is Wanderloop. The frame you're seeing — hero, destination gallery — is rendered with Partial Prerendering. Static at the edge, instant load. The prompt input is the only dynamic part."

> **0:30 — Type the prompt.** `5 days in Lisbon, foodie, mid-budget`. Submit.
> "Watch the agent fire. AI SDK's `streamText` with four tools."

> **1:00 — Point at the tool calls as they appear.**
> "find_flights, find_restaurants, check_weather, find_attractions. Each call is going through Vercel's AI Gateway — multi-provider routing with cost attribution per call."

> **1:30 — Day cards populate. Photos fade in.**
> "Image Optimization. Each card has 5-10 photos. Pre-resized, AVIF, lazy. The page is 800KB instead of 12MB."

> **2:00 — Click 'Add custom rule'.** Paste a JS budget filter.
> "Vercel Sandbox. Their code runs in a Firecracker microVM. Strict limits. No network. They paste an infinite loop, we time it out in 5 seconds."

> **2:30 — Hit Save.** Show the URL appear.
> "Itinerary saved to Vercel Blob. PDF generated server-side, also in Blob. Forward the URL — shareable."

> **3:00 — Flip geo header to PT in DevTools.** Reload.
> "Routing Middleware just flipped the prices to Euros and distances to kilometers. No client flicker. No redeploy."

> **3:30 — Open `/admin`.** Show the cost dashboard.
> "AI Gateway numbers. Anthropic 60%, OpenAI 30%, Bedrock 10%. Per-provider, per-day. The cron job at the bottom is the daily-deals digest — running tonight at 6 AM UTC."

> **4:00 — Drop a Toolbar comment on the itinerary.**
> "Vercel Toolbar. Built-in collaboration for the operator interface. A travel agent and their high-value customer co-edit a trip in real-time."

> **4:30 — Wrap.**
> "Ten Vercel features, each one solving a real product problem, not stuffed in. Built in three weeks of evenings. Total cost to run: about eight bucks a month."

---

## 7. Build phases

| Phase | Scope | Duration |
|---|---|---|
| **C — Bootstrap** | `pnpm create next-app wanderloop`, deps (AI SDK, Anthropic, Zod, shadcn/ui), `.env.example`, `git init`, first preview deploy to Vercel. End state: empty landing page deployed at `wanderloop.vercel.app`. | 1 evening (~3 hrs) |
| **D — MVP** | Landing → /plan → streaming chat with 4 mock tools → itinerary rendering. No save, no PDF, no advanced features. End state: type a prompt, see a complete itinerary stream in. | 3–5 evenings (~10 hrs) |
| **E — Advanced features** | Workflow DevKit (durable orchestration), Sandbox (budget filter), Routing Middleware (geo/locale), Cron Jobs (daily deals), Blob (save + PDF). End state: all 10 features wired in. | 1–2 weeks (~20 hrs) |
| **F — Polish** | Image-heavy gallery, AI Gateway admin dashboard, Toolbar embedded, Firewall rules tightened, demo video recorded, README polished. End state: demoable end-to-end with no rough edges. | 3–5 evenings (~10 hrs) |
| **Total** | **~45 hours, ~3–4 weeks of evenings.** |

**Stop conditions per phase:** Each phase ends with a Git tag and a 2-line "what's done" entry in `wanderloop/README.md`. Don't slide into the next phase until the current one is shippable.

---

## 8. Interview Simulation — Q&A bank

> Use this to rehearse. The interviewer doesn't get a setup; they walk in cold and ask. Practice answers aloud, with a timer. Each answer should be 30–60 seconds spoken.

### A. Architecture / decision-making

#### A1. "Why did you put the trip-planning logic in a Workflow instead of just a long-running serverless function?"

**Testing:** Do you actually understand the value of durable execution?

**Answer:** *"A serverless function tied to one HTTP request dies if the user closes the tab — and a five-step trip plan takes ten to twenty seconds, so it happens. Workflow DevKit decouples the orchestration from the request. The user submits, the workflow starts with a trip ID, the page subscribes to the status stream. If they close the tab, the workflow keeps running. If a step fails — say find_restaurants 500s — the workflow retries from that step, not from the start. The UI gets the final result whenever they come back. It's the difference between 'best effort' and 'durable.' For a travel plan that took thirty seconds to assemble, that matters."*

**Trap:** Saying "it's more reliable" without explaining what concretely fails without it.

#### A2. "Walk me through what happens when the user hits 'Plan my trip' — every layer it touches."

**Testing:** Mental model of the stack.

**Answer:** *"The form fires a Server Action that POSTs to /api/workflow/plan-trip with the prompt. That handler validates with Zod, generates a trip ID, kicks off the Workflow DevKit run, and returns the trip ID + a stream URL. The browser redirects to /plan?id=X, which opens an SSE connection to the workflow status endpoint. The workflow runs in five steps — parse → search flights → enrich → restaurants → assemble — each one calling Anthropic via AI Gateway with the appropriate tool. As each step completes, the workflow writes a checkpoint and emits a status event. The page streams those events to the UI. When step 5 finishes, the workflow writes the final itinerary to Blob and emits a 'done' event. The page hydrates the saved itinerary and offers Save/PDF/Edit."*

**Trap:** Skipping layers ("the user hits submit and the AI replies"). Interviewers want the plumbing.

#### A3. "Why Cache Components on the landing page and not on the itinerary page?"

**Testing:** Do you understand when caching helps and when it hurts?

**Answer:** *"Landing page is the same for every visitor — same hero, same destination gallery. Cache it aggressively, invalidate on demand when marketing swaps featured destinations. Itinerary page is per-user — the URL has the ID, the content is unique. Caching the rendered page does nothing for cache hit rate and just adds invalidation complexity. What I do cache on itinerary pages is the destination photos and the underlying place data — those are shared across users. So: cache the data, not the page."*

**Trap:** Saying "I cache everything I can." Caching the wrong thing is worse than no caching.

#### A4. "Why Sandbox for the budget filter — couldn't you just use eval() or run it in a serverless function?"

**Testing:** Do you understand the security boundary.

**Answer:** *"eval() runs in my process — one malicious filter and the user crashes my Function or exfiltrates env vars. Serverless function is better but still on my infrastructure. Sandbox is a Firecracker microVM with no network, strict CPU and memory limits, and a hard timeout. The prospect's code never touches my filesystem, never sees my env, can't make outbound calls. If they paste an infinite loop, the VM gets killed after five seconds and I report a timeout. That's the only design that's safe to expose."*

**Trap:** Saying "Sandbox is more secure" without explaining the threat. Spell out the threat.

#### A5. "How would you scale this from 1 user to 10,000 concurrent?"

**Testing:** Do you know the bottlenecks?

**Answer:** *"Three bottlenecks. First, the AI Gateway — rate limits per provider. Solution: AI Gateway already has retry and routing, plus I'd add per-IP rate limits at the Firewall. Second, the Workflow concurrency — Workflow DevKit scales but each run has its own state, so storage and Function invocations grow linearly. At 10k concurrent runs that's real money — I'd add a queue with backpressure and surface "your trip is queued, ETA 30s" to the user. Third, Blob writes for itinerary saves — Blob handles it fine, but I'd move from one-PDF-per-save to deferred PDF generation, only render the PDF when someone clicks the export link."*

**Trap:** "Vercel auto-scales, so it just works." Not at 10k concurrent on a complex pipeline.

#### A6. "What's your caching invalidation strategy?"

**Testing:** The hardest problem in computer science.

**Answer:** *"Two tags: 'destinations' for the marketing gallery, 'deals' for the cron-generated daily deals feed. Both invalidated explicitly via updateTag — destinations when the marketing team updates the feature list (rare), deals when the cron job finishes (daily). I don't use time-based invalidation because the data isn't time-correlated. Itinerary pages aren't cached at the page level — they're keyed by ID, and the underlying data is in Blob with no caching layer in front. If the itinerary changes, the user navigated, page re-renders. The only thing that's tricky is the gallery on the landing page — if marketing updates and a user is mid-prompt, they might see the old gallery; I accept that, it's not a correctness issue."*

**Trap:** Pretending invalidation is easy. The interviewer will respect honesty here.

#### A7. "How would the AI Gateway numbers change if you swapped Anthropic for Bedrock?"

**Testing:** Do you understand AI Gateway value beyond "multi-provider"?

**Answer:** *"Two changes. First, latency — Bedrock has different per-region latency profiles than Anthropic; if my users are mostly in Europe, Bedrock in eu-west might be 100ms faster than Anthropic. AI Gateway lets me route based on latency. Second, cost — Bedrock pricing for Claude models is identical to Anthropic, but Bedrock for other models can be cheaper. The Gateway dashboard would show the cost-per-1k-tokens shift. The real value of swapping isn't 'Bedrock cheaper' — it's that I can swap one config line without changing any application code. The 30 lines that call the model don't know which provider answered."*

**Trap:** Reciting features ("multi-provider, cost tracking") without explaining the operator value.

#### A8. "If I told you to ship this Monday, what would you cut?"

**Testing:** Scoping judgment.

**Answer:** *"Five cuts. Toolbar — gone. Cron daily-deals — gone, defer to next sprint. Routing Middleware geo personalization — defer, English/USD only at launch. AI Gateway admin dashboard — defer, I'd watch costs from the Vercel dashboard directly. Sandbox custom-budget — defer, ship a fixed budget filter at launch. What ships: landing page, streaming planner with 4 tools, itinerary rendering, Save-to-Blob with shareable URL. Five days of focused work. The other features are real value, but they're not Monday-blocking."*

**Trap:** Cutting too little ("I'd just polish what's there"). Or too much ("strip it to a chat box"). Show judgment.

### B. Tradeoffs / honest limits

#### B1. "What's broken or fragile in this build?"

**Answer:** *"Three fragile things. One — the mock tool data. I'm calling find_flights but it returns hand-curated fake data; the moment I wire it to a real flights API, latency and error modes change and I'd need to add per-tool retry logic. Two — the Sandbox-to-UI pipe is brittle on errors: if Sandbox returns a 500, I show a generic 'try again,' but I haven't handled the case where Sandbox returns a partial result. Three — the itinerary editing flow is optimistic-UI without conflict resolution; if two Toolbar collaborators edit simultaneously, the last write wins, no merge."*

**Trap:** "Nothing is broken." Always wrong.

#### B2. "What did you NOT have time to build that you'd add next?"

**Answer:** *"Authentication and saved trips per user. Right now itineraries are saved by ID with no owner — anyone with the URL can see them. That's fine for the demo but the first thing I'd add for a real product is Auth.js or Clerk, then a 'My trips' page. Second — real flight/hotel APIs to replace the mocks. Third — image search per tool result so each restaurant card has its own photo, not just the city's."*

**Trap:** Listing things that are basically polish, not capability. Show you know what's structurally missing.

#### B3. "Where did you over-engineer?"

**Answer:** *"Honestly, Workflow DevKit might be over-engineered for the MVP. A 30-second pipeline could run inside a single function and just stream progress; Workflow gives me durability and replay, but those are features the user notices when the system fails — most of the time, they don't. I made the call because durability is part of the demo story, but for a real product where engineering velocity matters, I'd push back and ask 'how often do trip plans actually fail mid-run?' before locking in Workflow as the orchestration layer."*

**Trap:** "I didn't over-engineer anything." Always a red flag.

#### B4. "What's the worst bug you hit and how did you debug it?"

**Answer (hypothetical placeholder — replace with a real one after building):** *"The streaming tool calls were getting double-fired in development — every call showing up twice in the AI Gateway logs. Took me 90 minutes. Turned out React StrictMode was mounting the component twice in dev, which kicked off the chat hook twice. The fix was checking `mounted.current` before initiating the stream. Real bug, easy to miss, classic Next.js gotcha."*

**Trap:** Inventing a fake bug that sounds too clean. Real bugs are weird and you remember them.

> **Note to Fernando:** Replace B4 with an actual bug from your build before any interview.

#### B5. "If a customer asked for an on-prem version, what would you tell them?"

**Answer:** *"I'd push back honestly. Wanderloop depends on AI Gateway, Workflow DevKit, Sandbox, Blob, Edge Config — those are Vercel platform products and on-prem versions aren't generally available. But the real question isn't usually 'can it run on our infra,' it's 'can we trust where the data is' or 'are we locked in.' If it's data residency, Vercel has regional deploys. If it's compliance audit, every layer here logs to your existing observability. If it's lock-in, the React + AI SDK code is portable; only the orchestration layer is Vercel-specific. Most customers who ask for on-prem are asking the wrong question — and an SA's job is to surface the right one."*

**Trap:** Promising on-prem when it doesn't exist.

### C. Customer / business perspective

#### C1. "Pretend I'm the CTO of Kayak. Pitch me Wanderloop in 90 seconds."

**Answer:** *"Your homepage today is a search box — people type 'flights to Lisbon' and get a list of fares. That converts the bottom-of-funnel users who already know what they want. It loses everyone in 'browsing' mode, which is roughly half your traffic. Wanderloop is the conversational layer for those users. They tell the agent what kind of trip they want, the agent builds a full itinerary — flights, hotels, restaurants, activities — and at every step there's a 'book this' CTA back into your inventory. The build is three weeks of engineering on Vercel. The conversion lift on the browsing-mode segment is what makes the business case. I'd want to ship a prototype with 1% of your traffic and measure conversion at 30 days — that's the trade I'd offer."*

**Trap:** Pitching features instead of the business case.

#### C2. "What's the ROI argument for a travel brand to rebuild on this stack?"

**Answer:** *"Three lines. Conversion — chat-first surfaces inventory that browsers don't search for, lifting conversion on the 'browsing' segment 2-4x in early pilots. Retention — saved itineraries plus daily personalized digests give customers a reason to open the email instead of starting fresh on a competitor site. Margin — AI-driven dynamic packaging (bundling flights + hotels + experiences for the specific user) creates packages your static funnel can't, and packaged trips have 30-50% higher margin than à la carte. The Vercel-specific lift is time-to-market — three weeks to a working prototype that proves the model before you commit serious engineering capacity."*

**Trap:** Big specific percentages stated as facts. Hedge specifics.

#### C3. "What does the migration path look like for an existing Rails/Django travel site?"

**Answer:** *"You don't migrate the whole site — you add Wanderloop as a new section. /plan is a Vercel-deployed Next.js app at travelbrand.com/plan, the rest of your site stays on Rails. Routing is at the edge — Vercel handles /plan, your origin handles everything else. The shared identity is OAuth or shared cookies. Inventory is API integration: your booking system exposes flights/hotels/etc as REST or GraphQL, the Vercel app calls those. Zero rewrite of the existing site, six to ten weeks to launch the new section. After that, you decide piece-by-piece what else moves to the Vercel stack."*

**Trap:** Proposing a big-bang migration. SAs propose incremental adoption.

#### C4. "What objection do you expect first from a buyer, and how do you handle it?"

**Answer:** *"'AI is too unreliable for our customer experience.' That's the first one, every travel brand says it. The handle is two-fold. One — show them the AI Gateway dashboard with retry and provider failover. They see explicit fallback paths instead of 'pray it works.' Two — show them the human-in-the-loop pattern with Toolbar: when stakes are high, the AI drafts, a human reviews. Wanderloop demos both. The buyer's not asking 'is the AI perfect,' they're asking 'what's the failure mode and who catches it.' Answer that, the objection melts."*

**Trap:** Arguing the AI is more reliable than it is.

#### C5. "How would you instrument this so the buyer can measure success?"

**Answer:** *"Three layers. One — product analytics on the funnel: prompt-submit, itinerary-rendered, itinerary-saved, deal-clicked, booking-completed. Standard PostHog or Mixpanel via the Vercel Analytics integration. Two — cost-per-conversion from AI Gateway: divide LLM spend by booked trips, surface that next to revenue. Three — perf metrics from Speed Insights: LCP and TTFB per page, with alerting when they regress. The buyer wants one dashboard showing 'cost in, revenue out, perf in the middle.' We give them that on day one."*

**Trap:** Hand-waving on instrumentation. Buyers care a lot about this.

#### C6. "Which Vercel feature is the most important one to a customer here, and which would you cut first if pushed?"

**Answer:** *"Most important: AI Gateway, hands down. The conversation about cost, routing, and reliability is the conversation a buyer cares about — features like Image Optimization are table stakes, AI Gateway is the differentiator they actually evaluate Vercel on. First cut: Toolbar. It's a flourish for a co-edit workflow that's probably 5% of users; for a launch, skip it, watch how often customers ask for it, add it when you see real demand."*

**Trap:** Refusing to rank.

### D. Live-iteration ("now change it") prompts

> These come in the live-iteration round per the build-round playbook. Practice walking through changes verbally, not actually editing code.

#### D1. "Add multi-language support. Walk me through the changes."

**Answer:** *"Three layers. UI strings — extract to a translations file, use next-intl or a similar library, key off the locale cookie that Routing Middleware already sets. AI prompts — the system prompt needs a 'respond in {locale}' instruction passed through, plus the tool outputs (restaurant names, attraction descriptions) need locale-aware data sources. Currency and units — already handled by the existing geo middleware, no change. Total work: one day for UI strings, two days for AI prompt + tool wiring, half a day for QA across three or four target locales. The hard part isn't the code — it's deciding which 5-10 languages to launch with."*

**Trap:** Skipping the AI-prompt piece. That's the meaty change.

#### D2. "The Anthropic API is down. What does the user see?"

**Answer:** *"AI Gateway's configured with provider fallback — when Anthropic returns 5xx, it auto-routes to OpenAI for that request. The user sees a slight latency bump but the trip still plans. If both Anthropic and OpenAI are down — rare, but possible — the Workflow DevKit step fails. The workflow retries with exponential backoff up to 3 attempts. After that, it writes a 'plan_failed' state to Blob and the UI shows a graceful 'we couldn't plan your trip right now, here's a saved one to inspire you instead' fallback. Worst case is degraded, never blank."*

**Trap:** "The user sees an error." That's the candidate answer; the SA answer is 'here's what we degrade to.'

#### D3. "Show me where you'd add user accounts and saved trips."

**Answer:** *"Three places. One — add Auth.js with a session cookie at the middleware layer; any /itinerary/* request gets the user ID injected as a header for the route handler. Two — Blob keys move from `itineraries/{id}.json` to `itineraries/{userId}/{id}.json` so directory listings give a user's own trips. Three — add a /trips page that lists the user's itineraries; it's a Server Component that lists the Blob prefix. Total work: half-day for auth, half-day for the data layout change with a migration script for existing IDs, half-day for the /trips UI. The hard part is migration — once there are real users, schema changes are expensive."*

**Trap:** Saying "we'd need a database" — you don't necessarily; Blob's directory structure is the database for this scale.

### E. Meta / behavioral

#### E1. "Why this demo and not something else?"

**Answer:** *"Three reasons. One — visually demoable in 5 minutes; the value is obvious to anyone, technical or not. Two — every Vercel feature in it earns its place; nothing's bolted on. Three — it's broad enough that the conversation can go in any direction the interviewer wants: AI infra, perf, multi-tenant, cost, customer ROI. I picked it over an enterprise observability tool (which I also drafted) because consumer-facing demos land harder in a panel intro, and over a sales-sandbox demo because Wanderloop is closer to where Vercel's product investment is heading."*

**Trap:** "It was fun to build" — fine to add, never to lead with.

#### E2. "What did you learn building this that surprised you?"

**Answer (hypothetical — replace post-build):** *"How much of the streaming-UX work is in the UI layer, not the platform layer. The AI SDK gives you tokens; making the page feel alive — placeholder cards that get replaced, tool-call indicators, partial-result rendering — is a UI design problem that's twice as much code as the agent itself. I'd assumed it was the other way around. The platform handled the hard distributed-systems work; I underestimated the front-end craft."*

**Trap:** A throwaway "the AI was harder than I thought" — too generic.

> **Note to Fernando:** Replace E2 with a real insight from your build.

#### E3. "If you had two more weekends, what would you do?"

**Answer:** *"Two specific things. One — replace the mock flight/hotel data with real APIs (Skyscanner or Amadeus). The mocks are convincing in the demo but the wiring is the realistic-engineering story. Two — record a 90-second product video. Right now Wanderloop is a live demo only; a recorded video means the demo travels with the GitHub README, with the LinkedIn post, with the resume link. The hosted app could fail at the worst moment in an interview — having the video as a fallback is just basic engineering hygiene for a demo project."*

**Trap:** "More features" — that's the answer of someone who hasn't actually shipped before. Real builders ship reliability and distribution.

---

## Appendix — Pre-build checklist

Before opening the editor in Phase C, confirm:

- [ ] Vercel account active, GitHub connected
- [ ] `vercel` CLI installed locally
- [ ] `pnpm` installed
- [ ] Node.js 20+
- [ ] Anthropic API key in hand
- [ ] AI Gateway enabled on the Vercel project
- [ ] Decision: domain — `wanderloop.vercel.app` for free or a custom domain (`wanderloop.app`?) for polish
- [ ] Decision: PDF generation library — `@react-pdf/renderer` (preferred), `puppeteer-core`, or `react-pdf`
- [ ] Decision: image sources — Unsplash API (rate-limited free tier) vs. curated set of 50 photos in Blob

Each decision deferred to the start of Phase C, not now.
