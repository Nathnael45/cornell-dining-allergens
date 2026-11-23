import { readFileSync } from "node:fs";
import { parseEateries, type EateriesResponse } from "@/lib/cornell/dining-api";

export const rawSnapshot = (): unknown => JSON.parse(readFileSync("fixtures/eateries-2026-11-20.json", "utf8"));
export const snapshot = (): EateriesResponse => parseEateries(rawSnapshot());
export const labelHtml = () => readFileSync("fixtures/netnutrition-label-sample.html", "utf8");
