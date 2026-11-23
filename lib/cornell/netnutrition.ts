/**
 * Crawler + parser for Cornell's CBORD NetNutrition (ARCHITECTURE.md §1.2, §6.3).
 *
 * There is no public API. The site is an ASP.NET app whose AJAX endpoints depend on a session
 * cookie and on server-side "current selection" state, so the crawl is sequential:
 *   GET  /NetNutrition/1                              (sets session cookie)
 *   POST Unit/SelectUnitFromUnitsList {unitOid}       → JSON { panels: [{id, html}] }
 *   POST Menu/SelectMenu {menuOid} / Menu/SelectCourse {oid}
 *   POST NutritionDetail/ShowItemNutritionLabel {detailOid}  → label HTML
 *
 * Be polite: sequential requests with a delay; run weekly at most.
 */
import { mapCornellAllergens, type Allergen } from "@/lib/allergens/taxonomy";

export const NETNUTRITION_BASE =
  process.env.CORNELL_NETNUTRITION_URL ?? "https://netnutrition.dining.cornell.edu/NetNutrition/1";

// ---------------------------------------------------------------- parsing (pure, unit-tested)

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeHtml(s: string): string {
  return s
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
      const c = code.toLowerCase();
      if (ENTITIES[c] !== undefined) return ENTITIES[c];
      if (c.startsWith("#x")) return String.fromCodePoint(parseInt(c.slice(2), 16));
      if (c.startsWith("#")) return String.fromCodePoint(parseInt(c.slice(1), 10));
      return m;
    })
    .replace(/ /g, " ");
}

const stripTags = (s: string) => decodeHtml(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

function spanText(html: string, cls: string): string | null {
  const m = html.match(new RegExp(`class=['"]${cls}['"][^>]*>([\\s\\S]*?)</(?:span|td)>`, "i"));
  return m ? stripTags(m[1]) : null;
}

export type ParsedLabel = {
  name: string | null;
  servingSize: string | null;
  ingredients: string | null;
  hasContainsLine: boolean;
  containsRaw: string[];
  allergens: Allergen[];
  unmappedAllergens: string[];
};

export function parseLabel(html: string): ParsedLabel {
  const serving = spanText(html, "cbo_nn_LabelBottomBorderLabel");
  const containsText = spanText(html, "cbo_nn_LabelAllergens");
  const hasContainsLine = /cbo_nn_LabelAllergensBold/i.test(html);
  const containsRaw = (containsText ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const { allergens, unmapped } = mapCornellAllergens(containsRaw);
  return {
    name: spanText(html, "cbo_nn_LabelHeader"),
    servingSize: serving ? serving.replace(/^Serving Size:\s*/i, "") : null,
    ingredients: spanText(html, "cbo_nn_LabelIngredients"),
    hasContainsLine,
    containsRaw,
    allergens,
    unmappedAllergens: unmapped,
  };
}

/** Concatenate the `html` of every panel in a NetNutrition AJAX JSON response. */
export function panelsHtml(body: string): string {
  try {
    const j = JSON.parse(body) as { panels?: { html?: string }[] };
    return (j.panels ?? []).map((p) => p.html ?? "").join("\n");
  } catch {
    return body;
  }
}

export function parseUnits(homeHtml: string): { oid: number; name: string }[] {
  const seen = new Map<number, string>();
  for (const m of homeHtml.matchAll(/unitsSelectUnit\((\d+)\)[^>]*>\s*([^<]+)</g)) {
    const oid = Number(m[1]);
    if (!seen.has(oid)) seen.set(oid, decodeHtml(m[2]).trim());
  }
  return [...seen].map(([oid, name]) => ({ oid, name }));
}

/**
 * Listing rows that are section headers or cross-references, not food. Seen 2026-11-23:
 * "BURGER TOPPINGS:", "BURGER OPTIONS:", "See Dining Facility: Baked Goods".
 */
export function isListingHeader(name: string): boolean {
  const n = name.trim();
  return /:\s*$/.test(n) || /^see dining facility\b/i.test(n);
}

export function parseListing(html: string) {
  const items = new Map<number, string>();
  for (const m of html.matchAll(/getItemNutritionLabelOnClick\(event,\s*(\d+)[^)]*\)[^>]*>\s*([^<]+)</g)) {
    const name = decodeHtml(m[2]).trim();
    if (!isListingHeader(name)) items.set(Number(m[1]), name);
  }
  return {
    items,
    menus: [...new Set([...html.matchAll(/menuListSelectMenu\((\d+)\)/g)].map((m) => Number(m[1])))],
    courses: [...new Set([...html.matchAll(/selectCourse\((\d+)\)/g)].map((m) => Number(m[1])))],
  };
}

// ---------------------------------------------------------------- session client

export type SessionOptions = {
  fetch: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  timeoutMs: number;
  retries: number;
  backoffMs: number;
  maxConsecutiveFailures: number;
};

const DEFAULT_SESSION: SessionOptions = {
  fetch: (...args) => fetch(...args),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  timeoutMs: 30_000,
  retries: 2,
  backoffMs: 2_000,
  maxConsecutiveFailures: 5,
};

class Session {
  private cookies = new Map<string, string>();
  private consecutiveFailures = 0;
  private opts: SessionOptions;
  constructor(
    private base: string,
    private delayMs: number,
    opts: Partial<SessionOptions> = {},
  ) {
    this.opts = { ...DEFAULT_SESSION, ...Object.fromEntries(Object.entries(opts).filter(([, v]) => v !== undefined)) };
  }

  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private absorb(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
    }
  }

  /**
   * One logical request with retries. Retries timeouts, network errors, 429 and 5xx with
   * backoff. After `maxConsecutiveFailures` logical requests fail in a row, every further call
   * throws CircuitOpenError so the crawl stops instead of hammering an unhealthy server.
   */
  async request(path: string, body?: Record<string, string | number>): Promise<string> {
    if (this.consecutiveFailures >= this.opts.maxConsecutiveFailures) {
      throw new CircuitOpenError(`NetNutrition looks unhealthy (${this.consecutiveFailures} consecutive failures)`);
    }
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.opts.retries; attempt++) {
      if (attempt > 0) await this.opts.sleep(this.opts.backoffMs * 2 ** (attempt - 1));
      try {
        const text = await this.requestOnce(path, body);
        this.consecutiveFailures = 0;
        if (this.delayMs) await this.opts.sleep(this.delayMs);
        return text;
      } catch (e) {
        lastErr = e;
        if (!isRetryable(e)) break;
      }
    }
    this.consecutiveFailures++;
    throw lastErr;
  }

  private async requestOnce(path: string, body?: Record<string, string | number>): Promise<string> {
    let url = this.base + path;
    // Follow redirects manually so Set-Cookie on the 302 isn't lost.
    for (let hop = 0; hop < 5; hop++) {
      const res = await this.opts.fetch(url, {
        method: body ? "POST" : "GET",
        redirect: "manual",
        headers: {
          ...(this.cookies.size ? { Cookie: this.cookieHeader() } : {}),
          // NB: Node's fetch defaults to `Accept-Language: *`, which this ASP.NET app can't parse
          // as a culture → it returns a "NetNutrition Start-up Error" page. Always send a real one.
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "dining-allergen-finder/0.1",
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" } : {}),
        },
        body: body ? new URLSearchParams(Object.entries(body).map(([k, v]) => [k, String(v)])).toString() : undefined,
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      });
      this.absorb(res);
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, url).toString();
        body = undefined;
        continue;
      }
      if (!res.ok) throw new HttpError(res.status, `NetNutrition HTTP ${res.status} for ${path}`);
      return await res.text();
    }
    throw new Error(`NetNutrition: too many redirects for ${path}`);
  }
}

export class CircuitOpenError extends Error {}
class HttpError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
  }
}

function isRetryable(e: unknown): boolean {
  if (e instanceof HttpError) return e.status === 429 || e.status >= 500;
  const name = (e as Error)?.name;
  // TimeoutError/AbortError from AbortSignal.timeout; TypeError("fetch failed") for network errors.
  return name === "TimeoutError" || name === "AbortError" || name === "TypeError";
}

// ---------------------------------------------------------------- crawl

export type CrawledItem = ParsedLabel & { detailOid: number; unitName: string; listedName: string };

export type CrawlResult = {
  units: number;
  items: CrawledItem[];
  errors: string[];
  /** True when the circuit breaker stopped the crawl early. A partial crawl must never prune data. */
  aborted: boolean;
};

export type CrawlOptions = {
  base?: string;
  delayMs?: number;
  maxUnits?: number;
  log?: (msg: string) => void;
} & Partial<SessionOptions>;

export async function crawlNetNutrition(opts: CrawlOptions = {}): Promise<CrawlResult> {
  const s = new Session(opts.base ?? NETNUTRITION_BASE, opts.delayMs ?? 400, opts);
  const log = opts.log ?? (() => {});
  const home = await s.request("");
  const units = parseUnits(home).slice(0, opts.maxUnits ?? Infinity);
  if (!units.length) throw new Error("NetNutrition: no units found on home page — markup changed?");

  const out = new Map<number, CrawledItem>();
  const errors: string[] = [];
  let aborted = false;

  // Labels are fetched immediately after the listing that revealed them, while the server-side
  // selection state still matches.
  const fetchLabels = async (unitName: string, items: Map<number, string>) => {
    for (const [oid, listedName] of items) {
      if (out.has(oid)) continue;
      try {
        const label = parseLabel(await s.request("/NutritionDetail/ShowItemNutritionLabel", { detailOid: oid }));
        out.set(oid, { ...label, detailOid: oid, unitName, listedName });
      } catch (e) {
        if (e instanceof CircuitOpenError) throw e;
        errors.push(`label ${oid} (${listedName}): ${(e as Error).message}`);
      }
    }
  };

  for (const unit of units) {
    if (aborted) break;
    try {
      await s.request(""); // reset selection state
      const top = parseListing(panelsHtml(await s.request("/Unit/SelectUnitFromUnitsList", { unitOid: unit.oid })));
      await fetchLabels(unit.name, top.items);
      const courses = new Set(top.courses);
      for (const menuOid of top.menus) {
        const m = parseListing(panelsHtml(await s.request("/Menu/SelectMenu", { menuOid })));
        await fetchLabels(unit.name, m.items);
        m.courses.forEach((c) => courses.add(c));
      }
      for (const oid of courses) {
        const c = parseListing(panelsHtml(await s.request("/Menu/SelectCourse", { oid })));
        await fetchLabels(unit.name, c.items);
      }
      log(`unit ${unit.oid} ${unit.name}: ${out.size} labels so far`);
    } catch (e) {
      errors.push(`unit ${unit.oid} (${unit.name}): ${(e as Error).message}`);
      if (e instanceof CircuitOpenError) {
        aborted = true;
        log(`aborting crawl: ${(e as Error).message}`);
      }
    }
  }
  return { units: units.length, items: [...out.values()], errors, aborted };
}
