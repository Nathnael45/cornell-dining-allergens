import { revalidateTag } from "next/cache";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { getDb } from "@/lib/db/client";
import { runMenuIngest } from "@/lib/jobs";

export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  try {
    const stats = await runMenuIngest(getDb());
    revalidateTag("menus", "max");
    return Response.json({ ok: true, stats });
  } catch (err) {
    // Last good data keeps being served; the failure is recorded in ingest_runs.
    return Response.json({ ok: false, error: (err as Error).message }, { status: 502 });
  }
}
