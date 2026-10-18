import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Coins, Gift } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { computeBalance } from "@/lib/points";
import { redeemReward } from "@/lib/waste.functions";

export const Route = createFileRoute("/_authenticated/rewards")({
  head: () => ({
    meta: [
      { title: "Rewards — Zero2Hero" },
      { name: "description", content: "See your points balance and redeem eco rewards." },
      { property: "og:title", content: "Rewards — Zero2Hero" },
      { property: "og:description", content: "See your points balance and redeem eco rewards." },
    ],
  }),
  component: RewardsPage,
});

function RewardsPage() {
  const qc = useQueryClient();
  const txns = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => (await supabase.from("transactions").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const items = useQuery({
    queryKey: ["reward_items"],
    queryFn: async () => (await supabase.from("reward_items").select("*").eq("is_available", true).order("cost")).data ?? [],
  });
  const balance = computeBalance(txns.data ?? []);

  async function redeem(id: number) {
    try {
      await redeemReward({ data: { rewardId: id } });
      toast.success("Reward redeemed!");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-4xl font-bold">Rewards</h1>
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-sidebar p-8 text-sidebar-foreground">
        <div>
          <p className="text-sm opacity-80">Your balance</p>
          <p className="flex items-center gap-3 font-display text-5xl font-bold"><Coins className="h-10 w-10 text-sidebar-primary" />{balance}</p>
        </div>
        <Button variant="secondary" disabled={balance <= 0} onClick={() => redeem(0)}>Redeem all points</Button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-2xl font-bold">Recent activity</h2>
          <div className="divide-y rounded-2xl border bg-card">
            {txns.data?.slice(0, 15).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {t.type.startsWith("earned") ? <ArrowUpRight className="h-5 w-5 text-success" /> : <ArrowDownRight className="h-5 w-5 text-destructive" />}
                  <div>
                    <p className="text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`font-semibold ${t.type.startsWith("earned") ? "text-success" : "text-destructive"}`}>
                  {t.type.startsWith("earned") ? "+" : "-"}{t.amount}
                </span>
              </div>
            ))}
            {!txns.data?.length && <p className="p-6 text-center text-sm text-muted-foreground">No activity yet — report some waste to get started.</p>}
          </div>
        </section>
        <section>
          <h2 className="mb-4 text-2xl font-bold">Available rewards</h2>
          <div className="space-y-4">
            {items.data?.map((r) => (
              <div key={r.id} className="rounded-2xl border bg-card p-5 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-lg font-semibold"><Gift className="h-5 w-5 text-primary" />{r.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.collection_info}</p>
                  </div>
                  <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">{r.cost}</span>
                </div>
                <Button className="mt-4 w-full" disabled={balance < r.cost} onClick={() => redeem(r.id)}>
                  {balance < r.cost ? "Not enough points" : "Redeem"}
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
