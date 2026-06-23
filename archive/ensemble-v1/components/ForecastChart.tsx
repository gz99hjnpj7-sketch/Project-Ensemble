"use client";

import React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { formatTimestamp } from "@/lib/utils/date";

type CompositePoint = {
  observedAt: string;
  probability: number | null;
  qualityScore: number;
};

type Series = {
  name: string;
  data: Array<{ observedAt: string; probability: number | null }>;
};

export function ForecastChart({
  compositeData,
  series = []
}: {
  compositeData: CompositePoint[];
  series?: Series[];
}) {
  if (!compositeData.length) return <div className="empty">No snapshot history yet</div>;

  // Build combined data points keyed by time label
  const timeMap: Record<string, any> = {};
  compositeData.forEach((p) => {
    const label = formatTimestamp(p.observedAt);
    if (!timeMap[label]) timeMap[label] = { label, observedAt: p.observedAt };
    timeMap[label].composite = p.probability === null ? null : Math.round(p.probability * 1000) / 10;
  });

  series.forEach((s, idx) => {
    s.data.forEach((p) => {
      const label = formatTimestamp(p.observedAt);
      if (!timeMap[label]) timeMap[label] = { label, observedAt: p.observedAt };
      timeMap[label][`s${idx}`] = p.probability === null ? null : Math.round(p.probability * 1000) / 10;
    });
  });

  const chartData = Object.values(timeMap).sort((a: any, b: any) => a.observedAt.localeCompare(b.observedAt));

  const colors = ["#67d59a", "#65c7d0", "#e9c46a", "#ff7d7d"];

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ left: 8, right: 18, top: 12, bottom: 8 }}>
          <XAxis dataKey="label" tick={{ fill: "#9dac9f", fontSize: 12 }} tickLine={false} minTickGap={36} />
          <YAxis domain={[0, 100]} tick={{ fill: "#9dac9f", fontSize: 12 }} tickFormatter={(value) => `${value}%`} width={44} />
          <Tooltip
            contentStyle={{ background: "#171d1a", border: "1px solid #344139", borderRadius: 8 }}
            formatter={(value, name) => [`${value}%`, name === 'composite' ? 'Frontrunner (composite)' : name]}
          />
          <Legend wrapperStyle={{ color: '#9dac9f', fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="composite"
            name="Frontrunner (composite)"
            stroke="#67d59a"
            strokeWidth={3}
            dot={false}
            connectNulls
          />
          {series.map((s, idx) => (
            <Line
              key={idx}
              type="monotone"
              dataKey={`s${idx}`}
              name={s.name}
              stroke={colors[idx % colors.length]}
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
