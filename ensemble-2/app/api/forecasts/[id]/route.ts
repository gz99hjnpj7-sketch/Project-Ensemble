import { NextResponse } from "next/server";
import { getForecastDetail } from "@/ensemble/serving/read-models";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const forecast = await getForecastDetail(id);
  if (!forecast) return NextResponse.json({ error: "Forecast not found" }, { status: 404 });
  return NextResponse.json({ forecast });
}
