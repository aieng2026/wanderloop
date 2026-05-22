import { Suspense } from "react";
import Planner from "./planner";
import { getLocale } from "@/lib/locale";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const locale = await getLocale();

  return (
    <Suspense fallback={<div className="p-8 text-neutral-500">Loading…</div>}>
      <Planner initialPrompt={q ?? ""} locale={locale} />
    </Suspense>
  );
}
