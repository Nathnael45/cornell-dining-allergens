import { isAuthorizedCron } from "@/lib/cron-auth";
import { getDb } from "@/lib/db/client";
import { getPause } from "@/lib/settings";
import { runNetNutritionSync } from "@/lib/jobs";

// ~650 sequential polite requests; usually 2–4 minutes.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  if ((await getPause(getDb())).paused) return Response.json({ ok: true, skipped: "paused" });
  try {
    const stats = await runNetNutritionSync(getDb());
    return Response.json({ ok: true, stats });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
