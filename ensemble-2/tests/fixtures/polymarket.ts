export const gammaMarketFixture = {
  id: "123",
  conditionId: "0xabc",
  question: "Will the Fed cut rates by September?",
  slug: "fed-cut-rates-by-september",
  volumeNum: "150000",
  liquidityNum: "50000",
  active: true,
  closed: false,
  endDateIso: "2026-09-30T00:00:00.000Z",
  updatedAt: "2026-06-22T10:00:00.000Z",
  outcomes: "[\"Yes\",\"No\"]",
  outcomePrices: "[\"0.62\",\"0.38\"]",
  clobTokenIds: "[\"yes-token\",\"no-token\"]",
  tags: [{ label: "Federal Reserve", slug: "fed" }]
};

export const clobBookFixture = {
  bids: [{ price: "0.61", size: "100" }],
  asks: [{ price: "0.63", size: "100" }]
};
