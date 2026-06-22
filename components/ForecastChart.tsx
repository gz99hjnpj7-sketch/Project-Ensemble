"use client";

import React from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ChartPoint = {
  observedAt: string;
  probability: number | null;
  qualityScore: number;
};

export function ForecastChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) return <div className="empty">No snapshot history yet</div>;
  const formatted = data.map((point) => ({
    ...point,
    probabilityPercent: point.probability === null ? null : Math.round(point.probability * 1000) / 10,
    label: new Date(point.observedAt).toLocaleString()
  }));

  return (
    <div style={{ width: "100%", height: 320 }}>
      <ResponsiveContainer>
        <LineChart data={formatted} margin={{ left: 8, right: 18, top: 12, bottom: 8 }}>
          <XAxis dataKey="label" tick={{ fill: "#9dac9f", fontSize: 12 }} tickLine={false} minTickGap={36} />
          <YAxis domain={[0, 100]} tick={{ fill: "#9dac9f", fontSize: 12 }} tickFormatter={(value) => `${value}%`} width={44} />
          <Tooltip
            contentStyle={{ background: "#171d1a", border: "1px solid #344139", borderRadius: 8 }}
            formatter={(value) => [`${value}%`, "Probability"]}
          />
          <Line type="monotone" dataKey="probabilityPercent" stroke="#67d59a" strokeWidth={2} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
