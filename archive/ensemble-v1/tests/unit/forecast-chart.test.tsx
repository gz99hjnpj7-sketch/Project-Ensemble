import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForecastChart } from "@/components/ForecastChart";

describe("ForecastChart", () => {
  it("renders an empty state without history", () => {
    render(<ForecastChart compositeData={[]} />);
    expect(screen.getByText("No snapshot history yet")).toBeInTheDocument();
  });
});
