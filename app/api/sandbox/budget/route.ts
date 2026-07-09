import { Sandbox } from "@vercel/sandbox";
import { z } from "zod";
import { rateLimitGuard } from "@/lib/rate-limit";

export const maxDuration = 30;

const RequestSchema = z.object({
  code: z.string().min(1).max(4000),
  places: z.array(z.unknown()).max(500),
});

const WRAPPER = (userCode: string) => `
const places = JSON.parse(process.argv[2]);
let fn;
try {
  fn = (${userCode});
} catch (e) {
  console.error(JSON.stringify({ kind: "compile", message: String(e) }));
  process.exit(2);
}
if (typeof fn !== "function") {
  console.error(JSON.stringify({ kind: "type", message: "Expression did not evaluate to a function. Expected: places => places.filter(...)" }));
  process.exit(3);
}
try {
  const result = fn(places);
  if (!Array.isArray(result)) {
    console.error(JSON.stringify({ kind: "type", message: "Filter must return an array, got " + typeof result }));
    process.exit(4);
  }
  console.log(JSON.stringify(result));
} catch (e) {
  console.error(JSON.stringify({ kind: "runtime", message: String(e) }));
  process.exit(5);
}
`;

export async function POST(req: Request) {
  const limited = await rateLimitGuard("wanderloop-sandbox", req);
  if (limited) return limited;

  let parsed;
  try {
    const body = await req.json();
    parsed = RequestSchema.parse(body);
  } catch (err) {
    return Response.json(
      { error: "Invalid request", details: String(err) },
      { status: 400 },
    );
  }

  const startedAt = Date.now();
  let sandbox: Sandbox | null = null;

  try {
    sandbox = await Sandbox.create({
      runtime: "node22",
      timeout: 60_000,
    });

    const script = WRAPPER(parsed.code);
    await sandbox.fs.writeFile("/tmp/filter.js", script);

    const placesJson = JSON.stringify(parsed.places);
    const cmdAbort = new AbortController();
    const cmdTimer = setTimeout(() => cmdAbort.abort(), 8_000);
    let result;
    try {
      result = await sandbox.runCommand({
        cmd: "node",
        args: ["/tmp/filter.js", placesJson],
        signal: cmdAbort.signal,
      });
    } finally {
      clearTimeout(cmdTimer);
    }

    const stdout = await result.stdout();
    const stderr = await result.stderr();
    const durationMs = Date.now() - startedAt;

    if (result.exitCode === 0) {
      const filtered = JSON.parse(stdout || "[]");
      return Response.json({
        ok: true,
        durationMs,
        before: parsed.places.length,
        after: filtered.length,
        filtered,
      });
    }

    // Non-zero exit — parse our structured error if possible
    let errPayload: { kind?: string; message?: string } = {};
    try {
      errPayload = JSON.parse(stderr.split("\n").filter(Boolean).pop() ?? "{}");
    } catch {
      errPayload = { kind: "unknown", message: stderr || "no stderr" };
    }

    return Response.json(
      {
        ok: false,
        durationMs,
        exitCode: result.exitCode,
        kind: errPayload.kind ?? "unknown",
        message: errPayload.message ?? "sandbox exited non-zero",
        stderr: stderr.slice(0, 1000),
      },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sandbox/budget] FAIL ${message}`);
    return Response.json(
      {
        ok: false,
        kind: "sandbox_error",
        message,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  } finally {
    if (sandbox) {
      sandbox.stop().catch(() => {});
    }
  }
}
