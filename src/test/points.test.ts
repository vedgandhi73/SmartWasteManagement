import { describe, expect, it } from "vitest";
import { collectionPasses, collectionReward, computeBalance, REPORT_POINTS } from "@/lib/points";

describe("points rules", () => {
  it("reporting waste earns 10 points", () => {
    expect(REPORT_POINTS).toBe(10);
  });
  it("collection reward is between 10 and 59", () => {
    expect(collectionReward(() => 0)).toBe(10);
    expect(collectionReward(() => 0.9999)).toBe(59);
  });
  it("collection needs both matches and confidence above 0.7", () => {
    expect(collectionPasses({ wasteTypeMatch: true, quantityMatch: true, confidence: 0.7 })).toBe(false);
    expect(collectionPasses({ wasteTypeMatch: true, quantityMatch: true, confidence: 0.71 })).toBe(true);
    expect(collectionPasses({ wasteTypeMatch: true, quantityMatch: false, confidence: 0.9 })).toBe(false);
  });
  it("balance is earned minus redeemed, never negative", () => {
    expect(computeBalance([{ type: "earned_report", amount: 10 }, { type: "redeemed", amount: 4 }])).toBe(6);
    expect(computeBalance([{ type: "redeemed", amount: 4 }])).toBe(0);
  });
});
