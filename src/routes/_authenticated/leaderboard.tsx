import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Crown, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Zero2Hero" },
      { name: "description", content: "See the community's top waste heroes." },
      { property: "og:title", content: "Leaderboard — Zero2Hero" },
      { property: "og:description", content: "See the community's top waste heroes." },
    ],
  }),
  component: Leaderboard,
});

function Leaderboard() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => (await supabase.rpc("get_leaderboard")).data ?? [],
  });

  return (
    <div>
      <h1 className="mb-6 text-4xl font-bold">Leaderboard</h1>
      <div className="overflow-hidden rounded-3xl border bg-card shadow-soft">
        <div className="flex items-center justify-between bg-sidebar p-6 text-sidebar-foreground">
          <Trophy className="h-10 w-10 text-sidebar-primary" />
          <span className="font-display text-2xl font-bold">Top performers</span>
          <Award className="h-10 w-10 text-sidebar-primary" />
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-6 py-3">Rank</th><th className="px-6 py-3">User</th><th className="px-6 py-3">Points</th><th className="px-6 py-3">Level</th></tr>
          </thead>
          <tbody>
            {q.data?.map((r, i) => (
              <tr key={r.user_id} className={`border-t ${r.user_id === user?.id ? "bg-secondary" : ""}`}>
                <td className="px-6 py-4 font-semibold">{i < 3 ? <Crown className={`h-6 w-6 ${i === 0 ? "text-accent" : "text-muted-foreground"}`} /> : i + 1}</td>
                <td className="px-6 py-4 font-medium">{r.name}{r.user_id === user?.id && " (you)"}</td>
                <td className="px-6 py-4">{Number(r.points).toLocaleString()}</td>
                <td className="px-6 py-4"><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Level {Math.floor(Number(r.points) / 100) + 1}</span></td>
              </tr>
            ))}
            {!q.data?.length && <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No heroes yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
