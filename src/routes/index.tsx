import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Coins, Leaf, MapPin, Recycle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CO2_PER_KG } from "@/lib/points";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zero2Hero — Report waste, earn rewards" },
      { name: "description", content: "Join a community making waste management efficient and rewarding. Report waste, collect it and earn points." },
      { property: "og:title", content: "Zero2Hero — Report waste, earn rewards" },
      { property: "og:description", content: "Report waste, collect it and earn points for a cleaner community." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const stats = useQuery({
    queryKey: ["impact"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_impact_stats");
      const s = data?.[0];
      const kg = Number(s?.waste_collected ?? 0);
      return {
        waste: Math.round(kg * 10) / 10,
        reports: Number(s?.reports_submitted ?? 0),
        tokens: Number(s?.tokens_earned ?? 0),
        co2: Math.round(kg * CO2_PER_KG * 10) / 10,
      };
    },
  });
  const s = stats.data ?? { waste: 0, reports: 0, tokens: 0, co2: 0 };

  return (
    <div className="space-y-20">
      <section className="relative overflow-hidden rounded-3xl bg-hero px-6 py-16 text-center">
        <div className="relative mx-auto mb-8 h-32 w-32">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20" />
          <div className="absolute inset-4 rounded-full bg-secondary" />
          <Leaf className="animate-float absolute inset-0 m-auto h-16 w-16 text-primary" />
        </div>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold md:text-6xl">
          Zero-to-Hero <span className="text-primary italic">Waste Management</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Join our community in making waste management more efficient and rewarding!
        </p>
        <Button asChild size="lg" className="mt-8 h-14 rounded-full px-10 text-base">
          <Link to={user ? "/report" : "/auth"}>
            {user ? "Report Waste" : "Get Started"} <ArrowRight className="ml-1 h-5 w-5" />
          </Link>
        </Button>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          { icon: Leaf, title: "Eco-Friendly", text: "Contribute to a cleaner environment by reporting and collecting waste." },
          { icon: Coins, title: "Earn Rewards", text: "Get points for your contributions to waste management efforts." },
          { icon: Users, title: "Community-Driven", text: "Be part of a growing community committed to sustainable practices." },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-8 text-center shadow-soft">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-secondary">
              <f.icon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">{f.title}</h3>
            <p className="mt-3 text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-sidebar p-10 text-sidebar-foreground">
        <h2 className="mb-10 text-center text-4xl font-bold">Our Impact</h2>
        <div className="grid gap-5 md:grid-cols-4">
          {[
            { icon: Recycle, label: "Waste Collected", value: `${s.waste} kg` },
            { icon: MapPin, label: "Reports Submitted", value: s.reports },
            { icon: Coins, label: "Points Earned", value: s.tokens },
            { icon: Leaf, label: "CO2 Offset", value: `${s.co2} kg` },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-sidebar-accent p-6">
              <c.icon className="mb-4 h-9 w-9 text-sidebar-primary" />
              <p className="font-display text-3xl font-bold">{c.value}</p>
              <p className="text-sm opacity-80">{c.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
