import { OPTIONS_LABEL, type OptionsLevel, type OptionsRating } from "@/lib/allergens/buckets";

/** Colors for the four options levels: green → amber → red. */
const STYLE: Record<OptionsLevel, { badge: string; dot: string }> = {
  plenty: { badge: "bg-fit text-white", dot: "bg-fit" },
  some: { badge: "bg-fit-tint text-fit", dot: "bg-fit/60" },
  limited: { badge: "bg-check-tint text-check", dot: "bg-check" },
  none: { badge: "bg-brand-tint text-brand", dot: "bg-brand" },
};

export function OptionsBadge({ level }: { level: OptionsLevel }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[0.85rem] font-bold ${STYLE[level].badge}`}>{OPTIONS_LABEL[level]}</span>;
}

export function OptionsDot({ level }: { level: OptionsLevel }) {
  return <span aria-label={OPTIONS_LABEL[level]} title={OPTIONS_LABEL[level]} className={`inline-block size-2.5 shrink-0 rounded-full ${STYLE[level].dot}`} />;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "2 main dishes and 5 sides fit you" */
export function optionsLine(o: OptionsRating): string {
  if (!o.mains.length) return o.sides ? `Only sides fit you (${o.sides})` : "Nothing filling fits you";
  return `${plural(o.mains.length, "main dish", "main dishes")}${o.sides ? ` and ${plural(o.sides, "side")}` : ""} fit you`;
}

/** Summary at the top of a hall's menu: level, which mains fit, and what's left to check. */
export function OptionsSummary({ o, meal }: { o: OptionsRating; meal: string }) {
  return (
    <div className="mt-4 rounded-2xl bg-side p-4 ring-1 ring-rule">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-[1.1rem] font-bold">{meal} for you:</span>
        <OptionsBadge level={o.level} />
      </div>
      <p className="mt-1.5 text-[0.95rem]">
        {o.mains.length ? (
          <>
            {optionsLine(o)}: <span className="font-bold">{o.mains.map((m) => m.name).join(", ")}</span>.
          </>
        ) : (
          <>{optionsLine(o)}.</>
        )}
        {o.mainsToCheck > 0 && <span className="text-check"> {plural(o.mainsToCheck, "more main dish", "more main dishes")} to check at the station.</span>}
      </p>
    </div>
  );
}
