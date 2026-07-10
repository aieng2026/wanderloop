// Before/after architecture diagram — aligned capability rows.
// Each row is one capability: the stack of AWS services you'd operate on the
// left, the single Vercel primitive it collapses into on the right. The
// many→one collapse, repeated per row, is both the mapping (what equals what)
// and the contrast (how much the platform absorbs). Heavy-bordered = you
// operate it; light fill = platform behavior you configure.

type AwsBox = { name: string; note?: string };
type Row = {
  capability: string;
  aws: AwsBox[];
  vercel: string; // "" when the platform absorbs it with no box to configure
  vercelNote?: string;
};

const ROWS: Row[] = [
  {
    capability: "Streaming compute",
    aws: [
      { name: "ALB", note: "load balancer" },
      { name: "ECS Fargate", note: "SSR + streaming" },
      { name: "Auto Scaling", note: "policies you tune" },
    ],
    vercel: "Functions",
    vercelNote: "streaming, per-route maxDuration",
  },
  {
    capability: "Model access",
    aws: [
      { name: "LiteLLM on ECS", note: "routing proxy" },
      { name: "Secrets Manager", note: "provider keys" },
      { name: "Usage metering", note: "custom" },
      { name: "Failover logic", note: "custom" },
    ],
    vercel: "AI Gateway",
    vercelNote: "one key, any model, fallbacks",
  },
  {
    capability: "Durable agent runs",
    aws: [
      { name: "Step Functions", note: "state machine" },
      { name: "SQS + DLQ" },
      { name: "DynamoDB", note: "checkpoint journal" },
      { name: "Stream-resume svc", note: "custom" },
    ],
    vercel: "Workflow DevKit",
    vercelNote: "checkpoints + resumable streams",
  },
  {
    capability: "Storage",
    aws: [{ name: "S3" }, { name: "IAM policies", note: "+ presigned URLs" }],
    vercel: "Blob",
    vercelNote: "put() / get(), private",
  },
  {
    capability: "Scheduling",
    aws: [{ name: "EventBridge" }, { name: "Lambda", note: "daily-deals" }],
    vercel: "Cron",
    vercelNote: "4 lines in vercel.json",
  },
  {
    capability: "Untrusted code exec",
    aws: [{ name: "Firecracker on EC2", note: "microVM pool you patch" }],
    vercel: "Sandbox",
    vercelNote: "microVM per request",
  },
  {
    capability: "Edge · CDN · auth · geo",
    aws: [
      { name: "Route 53" },
      { name: "CloudFront", note: "CDN + TLS" },
      { name: "Lambda@Edge", note: "geo + auth" },
    ],
    vercel: "Edge + proxy.ts",
    vercelNote: "CDN, TLS, geo headers, one file",
  },
  {
    capability: "Observability",
    aws: [{ name: "CloudWatch" }, { name: "RUM / X-Ray" }],
    vercel: "Analytics + Speed Insights",
    vercelNote: "two lines in layout.tsx",
  },
  {
    capability: "CI/CD + deploy",
    aws: [{ name: "CodePipeline", note: "build + blue/green" }, { name: "ECR" }],
    vercel: "git push",
    vercelNote: "preview per PR, instant rollback",
  },
  {
    capability: "Cross-cutting (always on-call)",
    aws: [
      { name: "VPC + NAT", note: "~$35/mo to exist" },
      { name: "IAM roles", note: "per service pair" },
      { name: "Patching", note: "AMIs, runtimes" },
    ],
    vercel: "",
    vercelNote: "absorbed by the platform",
  },
];

const AWS_COUNT = ROWS.reduce((n, r) => n + r.aws.length, 0);
const VERCEL_COUNT = ROWS.filter((r) => r.vercel !== "").length;

function AwsChip({ box }: { box: AwsBox }) {
  return (
    <div className="rounded-md border-2 border-neutral-600 bg-neutral-900 px-2 py-1 text-xs leading-tight text-neutral-200">
      <div className="font-medium">{box.name}</div>
      {box.note && (
        <div className="mt-0.5 text-[10px] text-neutral-500">{box.note}</div>
      )}
    </div>
  );
}

function DiagramRow({ row }: { row: Row }) {
  const absorbed = row.vercel === "";
  return (
    <div className="flex flex-col gap-2 border-b border-neutral-800/60 py-3 last:border-0 md:flex-row md:items-center">
      {/* capability */}
      <div className="shrink-0 text-[11px] font-medium tracking-wider text-neutral-400 uppercase md:w-36">
        {row.capability}
      </div>

      {/* AWS stack */}
      <div className="flex flex-1 flex-wrap gap-1.5">
        {row.aws.map((box) => (
          <AwsChip key={box.name} box={box} />
        ))}
      </div>

      {/* arrow */}
      <div className="shrink-0 text-center text-neutral-600 md:w-6">→</div>

      {/* Vercel primitive */}
      <div className="shrink-0 md:w-56">
        {absorbed ? (
          <div className="rounded-md border border-dashed border-neutral-700 px-3 py-1.5 text-xs text-neutral-500 italic">
            {row.vercelNote}
          </div>
        ) : (
          <div className="rounded-md border border-purple-800/60 bg-purple-950/40 px-3 py-1.5 text-xs leading-tight">
            <div className="font-semibold text-purple-200">{row.vercel}</div>
            {row.vercelNote && (
              <div className="mt-0.5 text-[10px] text-purple-400/80">
                {row.vercelNote}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArchitectureDiagram() {
  return (
    <figure className="my-8 rounded-xl border border-neutral-800 bg-neutral-950 p-4 sm:p-5">
      {/* column headers */}
      <div className="mb-2 hidden gap-2 border-b border-neutral-700 pb-2 text-[10px] font-medium tracking-wider text-neutral-500 uppercase md:flex md:items-center">
        <div className="w-36 shrink-0">Capability</div>
        <div className="flex-1">
          <span className="text-amber-500/80">Self-managed AWS</span> — you
          operate every box
        </div>
        <div className="w-6 shrink-0" />
        <div className="w-56 shrink-0">
          <span className="text-purple-300">On Vercel</span> — you configure it
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {ROWS.map((row) => (
            <DiagramRow key={row.capability} row={row} />
          ))}
        </div>
      </div>

      <figcaption className="mt-4 border-t border-neutral-800 pt-3 text-center text-xs text-neutral-500">
        Every row collapses a stack you operate into one thing you configure —{" "}
        <span className="text-neutral-300">
          {AWS_COUNT} services with your name on the pager
        </span>{" "}
        become <span className="text-purple-300">{VERCEL_COUNT} config points</span>,
        and the cross-cutting lane is absorbed entirely.
      </figcaption>
    </figure>
  );
}
