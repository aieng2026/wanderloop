import { Suspense } from "react";
import DurablePlanner from "./durable-planner";
import { getLocale } from "@/lib/locale";

export default async function DurablePlanPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const locale = await getLocale();

  return (
    <Suspense fallback={<div className="p-8 text-neutral-500">Loading…</div>}>
      <DurablePlanner initialPrompt={q ?? ""} locale={locale} />
    </Suspense>
  );
}
