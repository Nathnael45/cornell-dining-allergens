import Link from "next/link";

/** The carnelian header band. Holds the wordmark, (on phones) your restrictions, and day/meal controls. */
export function Band({ children }: { children?: React.ReactNode; top?: boolean }) {
  return (
    <div className="band bg-band text-band-ink">
      <div className="mx-auto max-w-6xl px-4">
        <Link href="/" className="inline-block pt-4 font-display text-[1.05rem] font-bold tracking-tight">
          Cornell dining, <span className="font-normal text-band-muted">filtered</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
