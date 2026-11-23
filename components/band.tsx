import Link from "next/link";

/** The evergreen header band. Pages put their title, restrictions and day/meal controls inside. */
export function Band({ children, top = false }: { children: React.ReactNode; top?: boolean }) {
  return (
    <div className="band bg-band text-band-ink">
      <div className="mx-auto max-w-2xl px-4">
        {top && (
          <Link href="/" className="inline-block pt-5 font-display text-[1rem] font-bold tracking-tight text-band-ink">
            Cornell dining, <span className="text-accent">filtered</span>
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}
