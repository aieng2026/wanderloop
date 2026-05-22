// Synthetic deal generator for the daily-deals cron job.
// Real implementation would hit Skyscanner / Booking / etc. APIs.

export type Deal = {
  kind: "flight" | "hotel" | "experience";
  destination: string;
  title: string;
  discountPct: number;
  validUntil: string;
};

const DEAL_TEMPLATES: Record<
  "flight" | "hotel" | "experience",
  Array<(dest: string, off: number) => string>
> = {
  flight: [
    (d, off) => `${off}% off TAP nonstop flights to ${d}`,
    (d, off) => `${off}% off Delta+AF connecting to ${d}`,
    (d, off) => `Flash sale: ${off}% off any carrier to ${d} this month`,
  ],
  hotel: [
    (d, off) => `${off}% off boutique hotels in ${d} for autumn stays`,
    (d, off) => `Marriott Bonvoy: ${off}% off ${d} properties`,
    (d, off) => `${off}% off long-stay apartments in ${d}`,
  ],
  experience: [
    (d, off) => `${off}% off food tours in ${d}`,
    (d, off) => `Skip-the-line + ${off}% off museums in ${d}`,
    (d, off) => `${off}% off small-group day trips out of ${d}`,
  ],
};

function pseudoRandom(seed: string): () => number {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return Math.abs(s % 1000) / 1000;
  };
}

export function generateDealsFor(
  destination: string,
  date: string,
  count = 3,
): Deal[] {
  const rng = pseudoRandom(`${destination.toLowerCase()}|${date}`);
  const kinds: Array<"flight" | "hotel" | "experience"> = [
    "flight",
    "hotel",
    "experience",
  ];
  const deals: Deal[] = [];

  for (let i = 0; i < count; i++) {
    const kind = kinds[Math.floor(rng() * kinds.length)];
    const templates = DEAL_TEMPLATES[kind];
    const template = templates[Math.floor(rng() * templates.length)];
    const discount = 10 + Math.floor(rng() * 35); // 10–44% off
    const validDays = 7 + Math.floor(rng() * 21); // valid 7–27 days
    const validUntil = new Date(
      new Date(date).getTime() + validDays * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);

    deals.push({
      kind,
      destination,
      title: template(destination, discount),
      discountPct: discount,
      validUntil,
    });
  }

  return deals;
}

export function inferDestinationFromPrompt(prompt: string): string {
  // Cheap heuristic: look for "in {City}" or "to {City}"
  const m = prompt.match(/\b(?:in|to)\s+([A-Z][a-zA-Zà-ÿ]+(?:\s+[A-Z][a-zA-Zà-ÿ]+)?)/);
  if (m) return m[1];
  // Fallback: first capitalized word
  const cap = prompt.match(/\b([A-Z][a-zA-Zà-ÿ]+)\b/);
  return cap ? cap[1] : "your destination";
}
