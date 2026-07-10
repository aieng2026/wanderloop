// Before/after architecture diagram for /architecture.
// Left: every service you'd stand up and operate yourself on AWS.
// Right: the same system as Vercel platform config.
// The at-a-glance read is box count + border weight: heavy borders = you own it.

type Box = { name: string; note?: string };
type Lane = { title: string; boxes: Box[] };

const AWS_LANES: Lane[] = [
  {
    title: "Edge & delivery",
    boxes: [
      { name: "Route 53", note: "DNS" },
      { name: "CloudFront", note: "CDN + TLS" },
      { name: "ACM", note: "cert renewal" },
      { name: "Lambda@Edge", note: "geo headers" },
    ],
  },
  {
    title: "Compute & CI/CD",
    boxes: [
      { name: "ALB", note: "load balancer" },
      { name: "ECS Fargate", note: "Next.js SSR, streaming" },
      { name: "Auto Scaling", note: "policies you tune" },
      { name: "ECR", note: "image registry" },
      { name: "CodePipeline", note: "build + blue/green" },
    ],
  },
  {
    title: "AI plumbing",
    boxes: [
      { name: "LiteLLM on ECS", note: "model routing proxy" },
      { name: "Secrets Manager", note: "provider API keys" },
      { name: "Usage metering", note: "custom" },
      { name: "Failover logic", note: "custom" },
    ],
  },
  {
    title: "Durable agent runs",
    boxes: [
      { name: "Step Functions", note: "state machine" },
      { name: "SQS", note: "queues + DLQ" },
      { name: "DynamoDB", note: "checkpoint journal" },
      { name: "Stream-resume svc", note: "custom — resumable UI streams" },
    ],
  },
  {
    title: "Storage & scheduled jobs",
    boxes: [
      { name: "S3", note: "itineraries, digests" },
      { name: "EventBridge", note: "cron schedule" },
      { name: "Lambda", note: "daily-deals job" },
    ],
  },
  {
    title: "Untrusted code exec",
    boxes: [
      { name: "Firecracker on EC2", note: "microVM pool you patch" },
    ],
  },
  {
    title: "Cross-cutting (always on-call)",
    boxes: [
      { name: "VPC + subnets + NAT", note: "~$35/mo just to exist" },
      { name: "IAM roles & policies", note: "per service pair" },
      { name: "CloudWatch", note: "logs, alarms, dashboards" },
      { name: "RUM / X-Ray", note: "web vitals, tracing" },
      { name: "Patching & upgrades", note: "AMIs, runtimes, proxies" },
    ],
  },
];

const VERCEL_LANES: Lane[] = [
  {
    title: "You write",
    boxes: [
      { name: "Next.js app", note: "the actual product" },
      { name: "proxy.ts", note: "auth + geo, one file" },
      { name: "vercel.json", note: "cron: 4 lines" },
    ],
  },
  {
    title: "Platform runs it",
    boxes: [
      { name: "Functions", note: "streaming, per-route maxDuration" },
      { name: "AI Gateway", note: "one key, any model" },
      { name: "Workflow DevKit", note: "checkpoints + resumable streams" },
      { name: "Blob", note: "storage" },
      { name: "Cron", note: "scheduler" },
      { name: "Sandbox", note: "microVMs on demand" },
      { name: "Edge network", note: "CDN, TLS, geo headers" },
      { name: "Analytics + Speed Insights", note: "two lines in layout.tsx" },
    ],
  },
  {
    title: "Deploy pipeline",
    boxes: [
      { name: "git push", note: "preview URL per PR, instant rollback" },
    ],
  },
];

function Panel({
  heading,
  sub,
  lanes,
  owned,
}: {
  heading: string;
  sub: string;
  lanes: Lane[];
  owned: boolean;
}) {
  const boxCount = lanes.reduce((n, l) => n + l.boxes.length, 0);
  return (
    <div
      className={`flex-1 rounded-xl border p-4 sm:p-5 ${
        owned ? "border-amber-900/60 bg-neutral-950" : "border-purple-900/60 bg-neutral-950"
      }`}
    >
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-wide uppercase">
          {heading}
        </h3>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            owned
              ? "bg-amber-950 text-amber-400"
              : "bg-purple-950 text-purple-300"
          }`}
        >
          {boxCount} {owned ? "services you operate" : "boxes total"}
        </span>
      </div>
      <p className="mb-4 text-xs text-neutral-500">{sub}</p>
      <div className="flex flex-col gap-3">
        {lanes.map((lane) => (
          <div key={lane.title}>
            <div className="mb-1.5 text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
              {lane.title}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {lane.boxes.map((box) => (
                <div
                  key={box.name}
                  className={`rounded-md px-2.5 py-1.5 text-xs leading-tight ${
                    owned
                      ? "border-2 border-neutral-600 bg-neutral-900 text-neutral-200"
                      : "border border-purple-900/50 bg-purple-950/30 text-neutral-300"
                  }`}
                >
                  <div className="font-medium">{box.name}</div>
                  {box.note && (
                    <div className="mt-0.5 text-[10px] text-neutral-500">
                      {box.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArchitectureDiagram() {
  return (
    <figure className="my-8">
      <div className="flex flex-col gap-4 lg:flex-row">
        <Panel
          heading="Before — run it yourself on AWS"
          sub="Every heavy-bordered box is a service you provision, secure, monitor, patch, and page yourself about."
          lanes={AWS_LANES}
          owned
        />
        <Panel
          heading="After — the same system on Vercel"
          sub="The app code is the same. Everything below the first lane is platform behavior you configure, not services you run."
          lanes={VERCEL_LANES}
          owned={false}
        />
      </div>
      <figcaption className="mt-3 text-center text-xs text-neutral-500">
        Same product, same features, same traffic. Left: 26 services with your
        name on the pager. Right: an app, two config files, and a git remote.
      </figcaption>
    </figure>
  );
}
