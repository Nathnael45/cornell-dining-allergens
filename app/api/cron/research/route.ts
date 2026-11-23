import { revalidateTag } from "next/cache";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { getDb } from "@/lib/db/client";
import { runResearchBatch } from "@/lib/research/worker";

// Researches newly seen foods (~50–150/week). 40 per run keeps each run well under the time limit.
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ ok: false, error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  const stats = await runResearchBatch(getDb(), { limit: 40, concurrency: 4 });
  if (stats.done + stats.needsReview > 0) revalidateTag("menus", "max");
  return Response.json({ ok: stats.failed === 0, stats });
}
