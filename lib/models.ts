// Central model routing + resilience config.
//
// One place decides which model the agent runs and how it degrades. The AI
// Gateway walks FALLBACK_MODELS in order if the primary is unavailable or
// errors (rate limit, provider outage, timeout) — a provider-agnostic
// failover chain expressed as config, not a client you operate.
//
// GLM-5.2 is the first fallback because the hallucination eval has verified it
// works with this exact tool set. GPT-5.5 is the second backstop across a
// different provider, so a single-provider outage can't take the app down.

export const PRIMARY_MODEL = "anthropic/claude-haiku-4-5";

export const FALLBACK_MODELS = ["zai/glm-5.2", "openai/gpt-5.5"];

// Spread into a streamText / DurableAgent `providerOptions` to enable the
// Gateway degradation chain on that call.
export const gatewayResilience = {
  gateway: { models: FALLBACK_MODELS },
} as const;
