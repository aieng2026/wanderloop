// Health / liveness endpoint. Public (no auth) so an uptime monitor or load
// balancer can probe it. Reports the serving region and deployment so you can
// see failover in action and correlate an incident to a specific release.

export const dynamic = "force-dynamic";
export const maxDuration = 5;

export async function GET() {
  return Response.json(
    {
      status: "ok",
      region: process.env.VERCEL_REGION ?? "dev",
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? "local",
      // Blob is the only stateful dependency; report whether it's configured.
      blob: process.env.BLOB_READ_WRITE_TOKEN ? "configured" : "unset",
      timestamp: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
