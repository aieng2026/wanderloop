import { registerOTel } from "@vercel/otel";

// OpenTelemetry setup. Next.js calls this once per server runtime.
//
// registerOTel wires the OTLP export path: on Vercel, spans flow to the
// platform's built-in OpenTelemetry collector (visible in the dashboard's
// observability, and forwardable to Datadog/Honeycomb/etc. via an OTel drain);
// locally they no-op unless an OTEL_EXPORTER endpoint is set.
//
// The AI SDK emits spans for every model call and tool call when
// `experimental_telemetry: { isEnabled: true }` is passed to streamText /
// DurableAgent — giving per-step latency and token usage without hand-rolled
// instrumentation.
export function register() {
  registerOTel({ serviceName: "wanderloop" });
}
