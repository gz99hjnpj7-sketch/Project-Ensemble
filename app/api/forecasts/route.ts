import { NextResponse } from "next/server";
import { getForecastList } from "@/lib/forecast/read-models";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const forecasts = await getForecastList({
    query: url.searchParams.get("q"),
    category: url.searchParams.get("category"),
    confidence: url.searchParams.get("confidence"),
    warningsOnly: url.searchParams.get("warnings") === "1"
  });
  return NextResponse.json({ forecasts });
}
