import { NextResponse } from "next/server";
import { getForecastDashboard } from "@/ensemble/serving/read-models";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const dashboard = await getForecastDashboard({
    query: url.searchParams.get("q"),
    category: url.searchParams.get("category"),
    confidence: url.searchParams.get("confidence")
  });
  return NextResponse.json(dashboard);
}
