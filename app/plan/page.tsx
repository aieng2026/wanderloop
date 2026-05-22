import { Suspense } from "react";
import Planner from "./planner";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <Suspense fallback={<div className="p-8 text-neutral-500">Loading…</div>}>
      <Planner initialPrompt={q ?? ""} />
    </Suspense>
  );
}
