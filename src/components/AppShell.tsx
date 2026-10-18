import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Coins, Home, LogOut, MapPin, Medal, Menu, Recycle, Settings, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { computeBalance } from "@/lib/points";

const nav = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/report", icon: MapPin, label: "Report Waste" },
  { to: "/collect", icon: Trash2, label: "Collect Waste" },
  { to: "/rewards", icon: Coins, label: "Rewards" },
  { to: "/leaderboard", icon: Medal, label: "Leaderboard" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const balance = useQuery({
    queryKey: ["balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("transactions").select("type, amount");
      return computeBalance(data ?? []);
    },
  });
  const notes = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("is_read", false).order("created_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  async function markRead(id: number) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b bg-card/90 px-4 backdrop-blur lg:px-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X /> : <Menu />}
          </Button>
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
              <Recycle className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-semibold">Zero2Hero</span>
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Waste management</span>
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                    {!!notes.data?.length && (
                      <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                        {notes.data.length}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {notes.data?.length ? (
                    notes.data.map((n) => (
                      <DropdownMenuItem key={n.id} onClick={() => markRead(n.id)} className="flex-col items-start">
                        <span className="text-sm">{n.message}</span>
                        <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground">
                <Coins className="h-4 w-4 text-primary" />
                {balance.data ?? 0}
              </span>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </header>

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-sidebar pt-20 text-sidebar-foreground transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <nav className="flex h-full flex-col justify-between px-3 pb-6">
          <div className="space-y-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary" }}
                activeOptions={{ exact: true }}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            ))}
          </div>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg border-t border-sidebar-border px-4 py-3 text-sm font-medium hover:bg-sidebar-accent"
            activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground" }}
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </nav>
      </aside>

      <main className="pt-16 lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
