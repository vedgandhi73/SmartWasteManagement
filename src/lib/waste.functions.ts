import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { collectionPasses, collectionReward, computeBalance, REPORT_POINTS } from "@/lib/points";

const dataUrl = z.string().startsWith("data:image/").max(14_000_000);

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function award(userId: string, type: string, amount: number, description: string, note: string) {
  const db = await admin();
  await db.from("transactions").insert({ user_id: userId, type, amount, description });
  await db.from("notifications").insert({ user_id: userId, message: note, type: "reward" });
}

export const verifyWastePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ image: dataUrl }))
  .handler(async ({ data }) => {
    const { analyzeImageJson, AiError } = await import("@/lib/ai.server");
    try {
      const r = await analyzeImageJson<{ wasteType: string; quantity: string; confidence: number }>(
        `You are an expert in waste management and recycling. Analyze this image and provide:
1. The type of waste (e.g., plastic, paper, glass, metal, organic)
2. An estimate of the quantity or amount (in kg or liters)
3. Your confidence level in this assessment (number between 0 and 1)
JSON shape: {"wasteType": string, "quantity": string, "confidence": number}`,
        data.image,
      );
      if (!r.wasteType || !r.quantity || typeof r.confidence !== "number") {
        return { ok: false as const, error: "The photo couldn't be verified as waste." };
      }
      return { ok: true as const, result: r };
    } catch (e) {
      return { ok: false as const, error: e instanceof AiError ? e.message : "Verification failed." };
    }
  });

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      location: z.string().trim().min(2).max(300),
      wasteType: z.string().trim().min(1).max(100),
      amount: z.string().trim().min(1).max(100),
      imagePath: z.string().max(300).nullable(),
      verification: z.object({ wasteType: z.string(), quantity: z.string(), confidence: z.number() }),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    if (data.imagePath && !data.imagePath.startsWith(`${context.userId}/`)) throw new Error("Invalid image");
    const { data: report, error } = await db
      .from("reports")
      .insert({
        user_id: context.userId,
        location: data.location,
        waste_type: data.wasteType,
        amount: data.amount,
        image_url: data.imagePath,
        verification_result: data.verification,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await award(context.userId, "earned_report", REPORT_POINTS, "Points earned for reporting waste",
      `You've earned ${REPORT_POINTS} points for reporting waste!`);
    return report;
  });

export const startCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ reportId: z.number().int() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: rows, error } = await db
      .from("reports")
      .update({ status: "in_progress", collector_id: context.userId })
      .eq("id", data.reportId)
      .eq("status", "pending")
      .select();
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("This task was already taken.");
    return rows[0];
  });

export const verifyCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ reportId: z.number().int(), image: dataUrl }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: report } = await db.from("reports").select("*").eq("id", data.reportId).single();
    if (!report || report.collector_id !== context.userId || report.status !== "in_progress") {
      return { ok: false as const, error: "You can only verify tasks you're collecting." };
    }
    const { analyzeImageJson, AiError } = await import("@/lib/ai.server");
    let r: { wasteTypeMatch: boolean; quantityMatch: boolean; confidence: number };
    try {
      r = await analyzeImageJson(
        `You are an expert in waste management and recycling. Analyze this image and provide:
1. Confirm if the waste type matches: ${report.waste_type}
2. Estimate if the quantity matches: ${report.amount}
3. Your confidence level in this assessment (number between 0 and 1)
JSON shape: {"wasteTypeMatch": boolean, "quantityMatch": boolean, "confidence": number}`,
        data.image,
      );
    } catch (e) {
      return { ok: false as const, error: e instanceof AiError ? e.message : "Verification failed." };
    }
    const result = { wasteTypeMatch: !!r.wasteTypeMatch, quantityMatch: !!r.quantityMatch, confidence: Number(r.confidence) || 0 };
    if (!collectionPasses(result)) return { ok: true as const, passed: false as const, result };
    const { data: updated } = await db
      .from("reports").update({ status: "verified" }).eq("id", report.id).eq("status", "in_progress").select();
    if (!updated?.length) return { ok: false as const, error: "Already verified." };
    const reward = collectionReward();
    await db.from("collected_wastes").insert({ report_id: report.id, collector_id: context.userId });
    await award(context.userId, "earned_collect", reward, "Points earned for collecting waste",
      `You earned ${reward} points for collecting waste!`);
    return { ok: true as const, passed: true as const, result, reward };
  });

export const redeemReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ rewardId: z.number().int() }))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: txns } = await db.from("transactions").select("type, amount").eq("user_id", context.userId);
    const balance = computeBalance(txns ?? []);
    let cost: number;
    let label: string;
    if (data.rewardId === 0) {
      if (balance <= 0) throw new Error("You have no points to redeem.");
      cost = balance;
      label = `Redeemed all points: ${balance}`;
    } else {
      const { data: item } = await db.from("reward_items").select("*").eq("id", data.rewardId).eq("is_available", true).single();
      if (!item) throw new Error("Reward not found.");
      if (balance < item.cost) throw new Error("Not enough points for this reward.");
      cost = item.cost;
      label = `Redeemed: ${item.name}`;
    }
    await db.from("transactions").insert({ user_id: context.userId, type: "redeemed", amount: cost, description: label });
    await db.from("notifications").insert({ user_id: context.userId, message: label, type: "redeem" });
    return { balance: balance - cost };
  });
