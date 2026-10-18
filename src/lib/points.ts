export const REPORT_POINTS = 10;
export const COLLECT_MIN_POINTS = 10;
export const COLLECT_MAX_POINTS = 59;
export const MIN_COLLECT_CONFIDENCE = 0.7;

export type Txn = { type: string; amount: number };

export function computeBalance(txns: Txn[]): number {
  const b = txns.reduce((acc, t) => (t.type.startsWith("earned") ? acc + t.amount : acc - t.amount), 0);
  return Math.max(b, 0);
}

export function collectionReward(rand: () => number = Math.random): number {
  return Math.floor(rand() * (COLLECT_MAX_POINTS - COLLECT_MIN_POINTS + 1)) + COLLECT_MIN_POINTS;
}

export function collectionPasses(r: { wasteTypeMatch: boolean; quantityMatch: boolean; confidence: number }) {
  return r.wasteTypeMatch && r.quantityMatch && r.confidence > MIN_COLLECT_CONFIDENCE;
}

export function parseKg(amount: string): number {
  const m = amount.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[0]) : 0;
}

export const CO2_PER_KG = 0.5;
