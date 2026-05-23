import Image from "next/image";
import Link from "next/link";
import { DESTINATIONS } from "@/lib/destinations";

export default function DestinationGallery() {
  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-sm font-medium tracking-wider text-neutral-400 uppercase">
          Or pick a destination
        </h2>
        <span className="text-xs text-neutral-600">
          {DESTINATIONS.length} curated starting points
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {DESTINATIONS.map((d) => (
          <Link
            key={d.slug}
            href={`/plan?q=${encodeURIComponent(d.prompt)}`}
            className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-neutral-800 transition hover:border-neutral-600"
          >
            <Image
              src={d.photo.url}
              alt={d.photo.alt}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3">
              <div className="text-xs tracking-wider text-neutral-300 uppercase">
                {d.country}
              </div>
              <div className="mt-0.5 text-base font-semibold text-white">
                {d.city}
              </div>
              <div className="mt-1 line-clamp-2 text-[11px] text-neutral-400 group-hover:text-neutral-300">
                {d.prompt}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
