import Link from "next/link";

/** The carnelian header band. Holds the wordmark, (on phones) your restrictions, and day/meal controls. */
export function Band({ children }: { children?: React.ReactNode; top?: boolean }) {
  return (
    <div className="band bg-band text-band-ink">
      <div className="mx-auto max-w-6xl px-4">
        <Link href="/" className="inline-block pt-3 font-display text-[1rem] font-bold tracking-tight lg:pt-4 lg:text-[1.05rem]">
          Cornell dining, <span className="font-normal text-band-muted">filtered</span>
        </Link>
        {children}
      </div>
    </div>
  );
}

/** Loading state that keeps the header in place. */
export function BandLoading({ text }: { text: string }) {
  return (
    <>
      <Band>
        <div className="h-28" />
      </Band>
      <p className="mx-auto max-w-6xl px-4 py-8 text-muted">{text}</p>
    </>
  );
}
