import type { Metadata } from "next";
import ArchitectureDiagram from "@/components/architecture-diagram";

export const metadata: Metadata = {
  title: "Wanderloop on raw AWS vs. on Vercel — an architecture teardown",
  description:
    "A before/after teardown of the same AI travel-planning app: what you'd stand up and operate yourself on raw cloud primitives vs. what Vercel handles for you.",
};

const MAPPING_ROWS: {
  feature: string;
  vercel: string;
  aws: string;
  own: string;
}[] = [
  {
    feature: "Streaming chat API (/api/chat)",
    vercel: "Function with maxDuration: 60",
    aws: "ALB + ECS Fargate (or Lambda response streaming)",
    own: "Scaling policy, container images, deploy pipeline",
  },
  {
    feature: "Model access (Haiku 4.5 today)",
    vercel: "AI Gateway — one key, model string in code",
    aws: "LiteLLM proxy on ECS + Secrets Manager + custom metering",
    own: "Proxy uptime, key rotation, failover, usage tracking",
  },
  {
    feature: "Durable agent runs (/durable-plan)",
    vercel: "Workflow DevKit — 'use workflow' / 'use step' directives",
    aws: "Step Functions + SQS + DynamoDB + custom stream-resume service",
    own: "State-machine JSON, checkpoint schema, resume protocol",
  },
  {
    feature: "Itinerary storage",
    vercel: "Blob — put() / get(), private access",
    aws: "S3 + IAM policies + presigned URL plumbing",
    own: "Bucket policies, lifecycle rules, access audit",
  },
  {
    feature: "Daily deals digest",
    vercel: "Cron — 4 lines in vercel.json",
    aws: "EventBridge Scheduler + Lambda + DLQ",
    own: "Retry semantics, dead-letter handling, alarm wiring",
  },
  {
    feature: "Untrusted JS (budget filter)",
    vercel: "Sandbox — Firecracker microVM per request",
    aws: "Firecracker pool on EC2 you build, or a hardened Lambda",
    own: "Isolation boundary, patching, capacity",
  },
  {
    feature: "Auth gate + geo currency/units",
    vercel: "proxy.ts reading x-vercel-ip-country",
    aws: "CloudFront Functions / Lambda@Edge + GeoIP database",
    own: "Edge deploy pipeline, GeoIP updates",
  },
  {
    feature: "Web vitals + traffic analytics",
    vercel: "Two components in layout.tsx",
    aws: "CloudWatch RUM + dashboards",
    own: "Instrumentation, dashboard upkeep",
  },
  {
    feature: "Preview environments + rollback",
    vercel: "Every git push; rollback is one click",
    aws: "CodePipeline + ECR + blue/green config",
    own: "The entire CI/CD system",
  },
];

function CodeBlock({ title, children }: { title: string; children: string }) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-neutral-800">
      <div className="border-b border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-medium text-neutral-400">
        {title}
      </div>
      <pre className="overflow-x-auto bg-neutral-950 p-4 text-xs leading-relaxed text-neutral-300">
        <code>{children}</code>
      </pre>
    </div>
  );
}

const BEFORE_CODE = `// lib/workflows/plan-trip.ts — before
// The whole agent loop lives inside ONE step.

async function runChatStep(messages, system, writable) {
  "use step";

  const result = streamText({
    model: gateway("anthropic/claude-haiku-4-5"),
    system,
    messages,
    tools: { find_flights, find_restaurants, check_weather, find_attractions },
    stopWhen: stepCountIs(8),
  });

  // ...plus 14 lines of manual writer plumbing:
  const writer = writable.getWriter();
  try {
    for await (const chunk of result.toUIMessageStream()) {
      await writer.write(chunk);
    }
  } finally {
    writer.releaseLock();
    await writable.close();
  }
}

export async function planTripWorkflow(messages, locale, today) {
  "use workflow";
  await runChatStep(messages, buildSystemPrompt(...), getWritable());
}`;

const AFTER_CODE = `// lib/workflows/plan-trip.ts — after
// The loop runs at the workflow level. Every model call and
// every tool call is its own checkpointed step.

export async function planTripWorkflow(messages, locale, today) {
  "use workflow";

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4-5",
    instructions: buildSystemPrompt({ today, locale, runtime: "durable" }),
    tools: { find_flights, find_restaurants, check_weather, find_attractions },
  });

  await agent.stream({
    messages,
    writable: getWritable(),
    stopWhen: stepCountIs(8),
  });
}`;

export default function ArchitecturePage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-6 py-12 sm:py-16">
      <header className="mb-10">
        <a
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-300"
        >
          ← Wanderloop
        </a>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          What Vercel is actually doing for Wanderloop
        </h1>
        <p className="mt-2 text-lg text-neutral-400">
          A before/after teardown: the same AI travel-planning app on raw cloud
          primitives vs. on the platform.
        </p>
      </header>

      <article className="space-y-6 text-[15px] leading-relaxed text-neutral-300">
        {/* ---- Intro ---- */}
        <p>
          Wanderloop is an AI travel concierge: you type a trip in plain
          English and an agent builds the itinerary in real time — flights,
          restaurants, weather, and a day-by-day plan, streamed token by token.
          Under the hood it is a Next.js app with a streaming agent API, a
          durable workflow mode that survives page refreshes, blob storage for
          saved itineraries, a daily cron digest, a Firecracker sandbox for
          running untrusted user code, and an auth-plus-geolocation layer.
        </p>
        <p>
          That feature list is the interesting part. None of it is exotic —
          every production AI app ends up needing roughly this set. So the
          fair question is: what would it take to run this exact system
          yourself on raw cloud primitives, and what does the platform version
          actually save? This post is my honest accounting.
        </p>

        {/* ---- Section 1: the diagram ---- */}
        <h2 className="pt-4 text-2xl font-semibold tracking-tight text-neutral-100">
          1. The same system, twice
        </h2>
        <p>
          Left is what I would stand up on AWS to match Wanderloop
          feature-for-feature — not a strawman, the boring standard build:
          Fargate for SSR because streaming responses on Lambda have
          size/duration constraints you end up engineering around, Step
          Functions for durability, a LiteLLM proxy because you don&apos;t
          want provider keys and failover logic scattered through app code.
          Right is what actually exists in this repo.
        </p>

        <ArchitectureDiagram />

        {/* ---- Section 2: mapping table ---- */}
        <h2 className="pt-4 text-2xl font-semibold tracking-tight text-neutral-100">
          2. Component by component
        </h2>
        <p>
          Every row is a real Wanderloop feature you can click today. The
          &ldquo;what you&apos;d own&rdquo; column is the part that doesn&apos;t
          show up in architecture diagrams but does show up in your calendar.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-700 text-left text-xs tracking-wider text-neutral-500 uppercase">
                <th className="py-2 pr-3 font-medium">Feature</th>
                <th className="py-2 pr-3 font-medium text-purple-300">
                  On Vercel
                </th>
                <th className="py-2 pr-3 font-medium text-amber-400">
                  Self-managed AWS
                </th>
                <th className="py-2 font-medium">What you&apos;d own</th>
              </tr>
            </thead>
            <tbody>
              {MAPPING_ROWS.map((row) => (
                <tr
                  key={row.feature}
                  className="border-b border-neutral-800/70 align-top"
                >
                  <td className="py-2.5 pr-3 font-medium text-neutral-200">
                    {row.feature}
                  </td>
                  <td className="py-2.5 pr-3 text-neutral-300">{row.vercel}</td>
                  <td className="py-2.5 pr-3 text-neutral-400">{row.aws}</td>
                  <td className="py-2.5 text-neutral-500">{row.own}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ---- Section 3: why it matters ---- */}
        <h2 className="pt-4 text-2xl font-semibold tracking-tight text-neutral-100">
          3. Why this matters in practice
        </h2>

        <h3 className="pt-1 text-lg font-semibold text-neutral-100">
          Velocity
        </h3>
        <p>
          Wanderloop went from <code className="text-neutral-200">git init</code>{" "}
          to a working production deployment in an afternoon, and every feature
          on the list above shipped within days — as a solo build. The AWS
          column is realistically three to six engineer-weeks before the first
          user sees anything: VPC and IAM design, container pipeline, the
          Step Functions state machine, the LiteLLM deployment. And that gap
          compounds: every pull request here gets a preview URL automatically;
          on the self-managed side someone has to build and maintain that
          capability too.
        </p>

        <h3 className="pt-1 text-lg font-semibold text-neutral-100">
          Reliability
        </h3>
        <p>
          The durable planner is the concrete demo: start a trip plan, kill the
          tab mid-stream, reopen it — the run resumes exactly where it was,
          because every model call and tool call is checkpointed by the
          Workflow runtime (more on this in section 4). I did not build a
          checkpoint store, a replay journal, or a stream-resume protocol; on
          AWS all three are systems I&apos;d design, operate, and debug at 2am.
          Deploys are atomic with one-click rollback, which is the reliability
          feature people forget until they need it.
        </p>

        <h3 className="pt-1 text-lg font-semibold text-neutral-100">Cost</h3>
        <p>
          At Wanderloop&apos;s scale (a demo — tens of thousands of requests a
          month, single region), the honest numbers look like this. The AWS
          build idles around <span className="text-neutral-100">$150–300/month</span>{" "}
          before any real traffic: an ALB, two Fargate tasks, a NAT gateway
          (~$35 just to exist), the LiteLLM container, CloudWatch. The Vercel
          version runs on a{" "}
          <span className="text-neutral-100">$20/month Pro seat plus single-digit usage</span>.
          Model tokens cost the same on both sides.
        </p>
        <p>
          But the infra invoice is the small number. The dominant cost is
          people: the AWS column is a part-time platform-engineering job —
          patching, IAM reviews, alarm tuning, upgrade cycles. At real scale
          the raw-compute math can shift toward self-managed, and I&apos;d
          re-evaluate honestly at that point — but you pay the
          engineering-time cost from day one, at every scale, forever.
        </p>

        <h3 className="pt-1 text-lg font-semibold text-neutral-100">
          Fewer moving parts to own
        </h3>
        <p>
          Count the heavy-bordered boxes: roughly 26 services in the
          self-managed build, each with an IAM role, a patch cadence, a failure
          mode, and an alarm that can page you. The Vercel version has three
          things I actually maintain: the app, <code className="text-neutral-200">proxy.ts</code>,
          and four lines of cron config. Everything else is platform behavior.
          Fewer parts isn&apos;t just less work — it&apos;s a smaller attack
          surface, a shorter incident-response tree, and fewer things a new
          teammate has to learn before they can ship.
        </p>

        {/* ---- Section 4: DurableAgent ---- */}
        <h2 className="pt-4 text-2xl font-semibold tracking-tight text-neutral-100">
          4. The DurableAgent refactor: a case study in platform abstractions
        </h2>
        <p>
          This section is the before/after in miniature, inside one file — and
          it&apos;s a change I made while writing this post, so the diff is
          real.
        </p>
        <p>
          Wanderloop&apos;s durable mode was already built on the Workflow
          DevKit, but I had hand-rolled the agent loop: a low-level{" "}
          <code className="text-neutral-200">streamText</code> call wrapped in a
          single <code className="text-neutral-200">&quot;use step&quot;</code>{" "}
          function. It worked, but the durability was coarse — the entire
          loop, up to eight model calls plus tool calls, lived inside{" "}
          <em>one</em> checkpointed step:
        </p>

        <CodeBlock title="Before — streamText inside one step (abridged)">
          {BEFORE_CODE}
        </CodeBlock>

        <p>
          The failure mode hides in plain sight: if anything dies at model call
          five, the step retries <em>from the top</em> — re-running and
          re-paying model calls one through four. Durable, technically. Wasteful,
          definitely. And I owned all the streaming plumbing at the bottom.
        </p>

        <CodeBlock title="After — DurableAgent runs the loop at the workflow level">
          {AFTER_CODE}
        </CodeBlock>

        <p>
          The file went from 98 lines to 74, but the line count is the least
          interesting part. The build-time workflow manifest tells the real
          story: before, it registered one fat step. After, it registers the
          model call (<code className="text-neutral-200">doStreamStep</code>)
          and each of the four tools as <em>individual</em> steps. A failure at
          model call five now resumes at model call five, with calls one
          through four replayed from the journal — no re-execution, no repeat
          token spend. The tool implementations and the client transport
          didn&apos;t change at all.
        </p>
        <p>
          The judgment call worth stating: the fast path at{" "}
          <code className="text-neutral-200">/api/chat</code> deliberately stays
          on plain <code className="text-neutral-200">streamText</code>. A
          stateless request/response chat doesn&apos;t need checkpointing, and
          the abstraction would add latency and machinery for no benefit.
          DurableAgent earns its place exactly where a run is long-lived enough
          to be worth resuming — knowing where <em>not</em> to use the shiny
          abstraction is half the architecture. Model choice got the same
          scrutiny: both paths run Haiku 4.5 today. I trialed a reasoning model
          (GLM-5.2) on the interactive path, but its thinking phase reads as a
          stall in the checkpointed durable stream — which renders only text and
          tool parts — so I consolidated on one model for consistent behavior
          and simpler operations. The AI Gateway makes that a one-line string,
          which is the point: model selection stays a decision, not a migration.
        </p>

        {/* ---- Closing ---- */}
        <h2 className="pt-4 text-2xl font-semibold tracking-tight text-neutral-100">
          5. Where I&apos;d take it next
        </h2>
        <p>
          The repo ships a lightweight hallucination-regression eval (10 prompts
          asserting every place the model names traces back to a tool output —
          it&apos;s in <code className="text-neutral-200">evals/</code>). In the
          first draft this section listed three next steps; since then I shipped
          all three — the eval now gates CI, both paths emit OTel spans plus a
          per-run cost line, and the Gateway runs an explicit fallback chain.
          They were afternoon-sized on this platform, which is, in the end, the
          whole argument. See the operational section below.
        </p>
        <p>
          One cleanup the DurableAgent refactor didn&apos;t finish: the tools
          are still defined in two places —{" "}
          <code className="text-neutral-200">lib/tools/*</code> for the fast
          path and the <code className="text-neutral-200">&quot;use step&quot;</code>{" "}
          versions in <code className="text-neutral-200">lib/workflows/tools.ts</code>{" "}
          for the durable one. DurableAgent simplified the agent{" "}
          <em>loop</em>, not that duplication. The next move is a single tool
          module both paths import — the durable path wrapping each with the
          step directive — so a new tool or a schema change lands in exactly one
          place. Worth naming because it&apos;s the honest boundary of what the
          abstraction bought: it collapsed the orchestration, not the tool
          surface.
        </p>

        {/* ---- Operational excellence ---- */}
        <h2 className="pt-4 text-2xl font-semibold tracking-tight text-neutral-100">
          6. Operational excellence — the parts that don&apos;t demo but do page you
        </h2>
        <p>
          A Well-Architected writeup shouldn&apos;t stop at the happy path. Here
          is how the same platform primitives cover the operational pillars —
          each one is config or a few lines, not a service I stand up and run.
          The full breakdown, with RPO/RTO and what&apos;s still on the backlog,
          is in{" "}
          <code className="text-neutral-200">OPERATIONAL_ROADMAP.md</code>.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-700 text-left text-xs tracking-wider text-neutral-500 uppercase">
                <th className="py-2 pr-3 font-medium">Pillar</th>
                <th className="py-2 pr-3 font-medium text-neutral-300">What I shipped</th>
                <th className="py-2 font-medium">Primitive</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Reliability", "Gateway model fallback chain (Haiku → GLM-5.2 → GPT-5.5) so a provider outage fails over, not down", "AI Gateway"],
                ["Reliability", "Chaos fault injection into durable steps; the runtime's step retries recover with no user-visible failure", "Workflow DevKit"],
                ["Operations", "Per-model + per-tool OTel spans; a structured per-run cost line (~$0.005/trip)", "@vercel/otel + AI SDK telemetry"],
                ["Operations", "Public /api/health endpoint reporting serving region + deployment id — probeable by an uptime monitor", "Vercel Functions"],
                ["Ops Excellence", "Eval-in-CI gate — a prompt/model change that regresses grounding can't merge", "GitHub Actions"],
                ["Security", "Fail-open rate-limit guard on the LLM + sandbox routes (a limiter must never take down what it protects), enforced by an edge WAF rule", "Vercel Firewall"],
                ["Performance / Cost", "ISR-cached itinerary share pages — a per-request Blob read becomes an edge cache hit", "ISR + Vercel Blob"],
              ].map(([pillar, what, prim]) => (
                <tr key={what} className="border-b border-neutral-800/70 align-top">
                  <td className="py-2.5 pr-3 font-medium text-neutral-200">{pillar}</td>
                  <td className="py-2.5 pr-3 text-neutral-300">{what}</td>
                  <td className="py-2.5 text-neutral-500">{prim}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The chaos one is my favorite because it&apos;s testable in front of
          you: flip the <strong>Chaos</strong> toggle on the durable planner,
          plan a trip, and watch each tool card take synthetic failures and
          recover on a live retry timeline — a fault-injection experiment where
          I wrote the fault and the platform wrote the recovery. That division
          of labor is the whole point of the right side of the diagram.
        </p>
        <p>
          A few things I deliberately left as <em>capabilities to reach for</em>{" "}
          rather than shipping into a demo: multi-region function failover
          (<code className="text-neutral-200">functionFailoverRegions</code>,
          Enterprise) for the DR story; <strong>Secure Compute</strong> (VPC
          peering) for when a customer needs the app to reach a private backend;
          rolling releases with skew protection for staged rollouts; and log
          drains to ship the structured logs into Datadog or similar. The point
          isn&apos;t that Wanderloop needs them — it&apos;s that each is platform
          config I can turn on, not an operational program I have to build. The
          full pillar-by-pillar breakdown, with RPO/RTO, lives in{" "}
          <code className="text-neutral-200">OPERATIONAL_ROADMAP.md</code>.
        </p>

        <footer className="border-t border-neutral-800 pt-6 text-sm text-neutral-500">
          <p>
            Written by Fernando Hernandez. The app this post describes is live —{" "}
            <a href="/" className="text-purple-300 hover:text-purple-200">
              try Wanderloop
            </a>{" "}
            or{" "}
            <a
              href="https://github.com/aieng2026/wanderloop"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-300 hover:text-purple-200"
            >
              read the source
            </a>
            .
          </p>
        </footer>
      </article>
    </main>
  );
}
