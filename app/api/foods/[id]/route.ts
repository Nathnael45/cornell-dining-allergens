import { getDb } from "@/lib/db/client";
import { getFoodDetail } from "@/lib/menu";
import { getPause } from "@/lib/settings";

/** Detail for one item as served at one hall/station (policies depend on both). */
export async function GET(request: Request, ctx: RouteContext<"/api/foods/[id]">) {
  if ((await getPause(getDb())).paused) return new Response("Paused", { status: 503 });
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const foodId = Number(id);
  const eateryId = Number(url.searchParams.get("eatery"));
  const station = url.searchParams.get("station") ?? "";
  if (!Number.isInteger(foodId) || !Number.isInteger(eateryId)) return new Response("Bad request", { status: 400 });
  const detail = await getFoodDetail(foodId, eateryId, station);
  if (!detail) return new Response("Not found", { status: 404 });
  return Response.json(detail);
}
