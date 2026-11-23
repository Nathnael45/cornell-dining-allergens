/**
 * Client for Cornell Dining's public (undocumented) eateries API.
 *
 * Gotchas learned during research (ARCHITECTURE.md §1.1):
 *  - The old host `now.dining.cornell.edu/api/1.0/...` returns the SPA's HTML with HTTP 200.
 *    We therefore check content-type AND validate the shape before trusting a response.
 *  - No CORS → must be fetched server-side.
 *  - Items carry only a name; there are no item ids or allergens.
 */
import { z } from "zod";

export const DINING_API_URL =
  process.env.CORNELL_DINING_API_URL ?? "https://admin-now.dining.cornell.edu/api/1.0/dining/eateries.json";

const MenuItem = z.object({
  item: z.string(),
  healthy: z.boolean().optional(),
  sortIdx: z.number().optional(),
});

const MenuCategory = z.object({
  category: z.string(),
  sortIdx: z.number().optional(),
  items: z.array(MenuItem).default([]),
});

const MealEvent = z.object({
  descr: z.string().default(""),
  start: z.string().optional(),
  end: z.string().optional(),
  startTimestamp: z.number(),
  endTimestamp: z.number(),
  calSummary: z.string().nullish(),
  menu: z.array(MenuCategory).default([]),
});

const OperatingDay = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.string().optional(),
  events: z.array(MealEvent).default([]),
});

const Eatery = z.object({
  id: z.number(),
  slug: z.string(),
  name: z.string(),
  nameshort: z.string().nullish(),
  campusArea: z.object({ descrshort: z.string().nullish() }).nullish(),
  eateryTypes: z.array(z.object({ descr: z.string() })).default([]),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  nutrition: z.string().nullish(),
  operatingHours: z.array(OperatingDay).default([]),
});

export const EateriesResponse = z.object({
  status: z.literal("success"),
  data: z.object({ eateries: z.array(Eatery).min(1) }),
  meta: z.object({ responseDttm: z.string().optional() }).optional(),
});

export type EateriesResponse = z.infer<typeof EateriesResponse>;
export type Eatery = z.infer<typeof Eatery>;
export type MealEvent = z.infer<typeof MealEvent>;

export class DiningApiError extends Error {}

export function parseEateries(json: unknown): EateriesResponse {
  const parsed = EateriesResponse.safeParse(json);
  if (!parsed.success) {
    throw new DiningApiError(`Dining API response failed validation: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

export async function fetchEateries(opts: { url?: string; timeoutMs?: number; retries?: number } = {}) {
  const url = opts.url ?? DINING_API_URL;
  const retries = opts.retries ?? 2;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "dining-allergen-finder/0.1" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
        cache: "no-store",
      });
      if (!res.ok) throw new DiningApiError(`HTTP ${res.status} from ${url}`);
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        throw new DiningApiError(`Expected JSON from ${url} but got "${ct}" — has the API moved again?`);
      }
      return parseEateries(await res.json());
    } catch (err) {
      lastErr = err;
      // Validation / wrong content-type errors won't fix themselves; only retry network-ish failures.
      if (err instanceof DiningApiError && !/^HTTP 5/.test(err.message)) break;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastErr;
}
