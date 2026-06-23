"use client";

import React from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTimestamp } from "@/ensemble/utils/date";

type CompositePoint = { observedAt: string; probability: number | null; qualityScore?: number };
type Series = { name: string; data: Array<{ observedAt: string; probability: number | null }> };

export function ForecastChart({ compositeData, data, series = [] }: { compositeData?: CompositePoint[]; data?: CompositePoint[]; series?: Series[] }) {
  const points = compositeData ?? data ?? [];
  if (!points.length) return <div className="empty">No snapshot history yet</div>;
  const timeMap: Record<string, any> = {};
  points.forEach((point) => {
    const label = formatTimestamp(point.observedAt);
    if (!timeMap[label]) timeMap[label] = { label, observedAt: point.observedAt };
    timeMap[label].composite = point.probability === null ? null : Math.round(point.probability * 1000) / 10;
  });
  series.forEach((item, index) => item.data.forEach((point) => {
    const label = formatTimestamp(point.observedAt);
    if (!timeMap[label]) timeMap[label] = { label, observedAt: point.observedAt };
    timeMap[label][`s${index}`] = point.probability === null ? null : Math.round(point.probability * 1000) / 10;
  }));
  const chartData = Object.values(timeMap).sort((a: any, b: any) => a.observedAt.localeCompare(b.observedAt));
  const colors = ["#67d59a", "#65c7d0", "#e9c46a", "#ff7d7d"];
  const showDots = chartData.length <= 8;
  return <div style={{ width: "100%", height: 320 }}><ResponsiveContainer><LineChart data={chartData} margin={{ left: 8, right: 18, top: 12, bottom: 8 }}>
    <CartesianGrid stroke="rgba(151, 172, 157, 0.14)" vertical={false} />
    <XAxis dataKey="label" tick={{ fill: "#9dac9f", fontSize: 12 }} tickLine={false} minTickGap={36} />
    <YAxis domain={[0, 100]} tick={{ fill: "#9dac9f", fontSize: 12 }} tickFormatter={(value) => `${value}%`} width={44} />
    <Tooltip contentStyle={{ background: "#171d1a", border: "1px solid #344139", borderRadius: 8 }} formatter={(value, name) => [`${value}%`, name === "composite" ? "Composite" : name]} />
    <Legend wrapperStyle={{ color: "#9dac9f", fontSize: 12 }} />
    <Line type="monotone" dataKey="composite" name="Composite" stroke="#67d59a" strokeWidth={3} dot={showDots ? { r: 3 } : false} activeDot={{ r: 5 }} connectNulls />
    {series.map((item, index) => <Line key={index} type="monotone" dataKey={`s${index}`} name={item.name} stroke={colors[index % colors.length]} strokeWidth={1.5} strokeDasharray="4 2" dot={showDots ? { r: 2 } : false} connectNulls />)}
  </LineChart></ResponsiveContainer></div>;
}
